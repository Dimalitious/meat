import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// SVOD - СВОДНАЯ ТАБЛИЦА ЗАКАЗОВ
// ============================================

/**
 * Получить или сформировать СВОД на указанную дату
 * GET /api/svod?date=YYYY-MM-DD
 * 
 * Возвращает:
 * - Если есть сохранённый свод на дату → возвращаем его
 * - Если нет → формируем предпросмотр (не сохраняем)
 */
export const getSvodByDate = async (req: Request, res: Response) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ error: 'date parameter is required' });
        }

        const svodDate = new Date(String(date));
        svodDate.setHours(0, 0, 0, 0);

        // Проверяем, есть ли сохранённый свод
        const existingSvod = await prisma.svodHeader.findUnique({
            where: { svodDate },
            include: {
                lines: {
                    include: { product: true },
                    orderBy: [{ category: 'asc' }, { shortName: 'asc' }]
                },
                supplierCols: {
                    include: { supplier: true },
                    orderBy: { colIndex: 'asc' }
                },
                supplierValues: true
            }
        });

        if (existingSvod) {
            return res.json({
                mode: existingSvod.status === 'draft' ? 'preview' : 'saved',
                svod: existingSvod
            });
        }

        // Если нет сохранённого свода - формируем предпросмотр
        const previewData = await buildSvodPreview(svodDate);
        return res.json({
            mode: 'preview',
            svod: previewData
        });
    } catch (error) {
        console.error('getSvodByDate error:', error);
        res.status(500).json({ error: 'Failed to get svod' });
    }
};

/**
 * Сформировать данные для предпросмотра СВОД (без сохранения)
 */
async function buildSvodPreview(svodDate: Date) {
    const dateStart = new Date(svodDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(svodDate);
    dateEnd.setHours(23, 59, 59, 999);


    // ============================================
    // A: Товары из заказов (SummaryOrderJournal) на дату
    // ============================================
    const summaryOrders = await prisma.summaryOrderJournal.findMany({
        where: {
            shipDate: { gte: dateStart, lte: dateEnd },
            status: { in: ['draft', 'forming', 'synced'] }
        },
        select: {
            idn: true,
            productId: true,
            orderQty: true
        }
    });

    // Агрегируем заказы по товарам
    const ordersByProduct = new Map<number, number>();
    const uniqueOrderIdns = new Set<string>();
    let totalOrderKg = 0;

    for (const order of summaryOrders) {
        if (order.productId) {
            const current = ordersByProduct.get(order.productId) || 0;
            ordersByProduct.set(order.productId, current + order.orderQty);
            totalOrderKg += order.orderQty;
        }
        if (order.idn) {
            uniqueOrderIdns.add(order.idn);
        }
    }

    // KPI: Количество уникальных заказов и общий вес
    const ordersCount = uniqueOrderIdns.size;

    // ============================================
    // B: Товары с остатком (из Stock)
    // ============================================
    const stockItems = await prisma.stock.findMany({
        where: { quantity: { gt: 0 } },
        select: { productId: true, quantity: true }
    });
    const stockByProduct = new Map<number, number>();
    for (const stock of stockItems) {
        stockByProduct.set(stock.productId, stock.quantity);
    }

    // ============================================
    // C: Товары из закупок на дату (ИСПРАВЛЕНО!)
    // ============================================
    // Ищем закупки по диапазону даты со статусом isDisabled = false
    const purchases = await prisma.purchaseItem.findMany({
        where: {
            purchase: {
                purchaseDate: { gte: dateStart, lte: dateEnd },
                isDisabled: false
            }
        },
        select: {
            productId: true,
            supplierId: true,
            qty: true,
            amount: true,
            purchase: {
                select: { id: true, purchaseDate: true }
            }
        }
    });


    // Агрегируем закупки по товарам и поставщикам
    const purchasesByProduct = new Map<number, Map<number, number>>();
    // ИСПРАВЛЕНО: сортируем по SUM(qty) а не SUM(amount)
    const totalQtyBySupplier = new Map<number, number>();

    for (const item of purchases) {
        // По товару
        if (!purchasesByProduct.has(item.productId)) {
            purchasesByProduct.set(item.productId, new Map());
        }
        const supplierMap = purchasesByProduct.get(item.productId)!;
        const currentQty = supplierMap.get(item.supplierId) || 0;
        supplierMap.set(item.supplierId, currentQty + Number(item.qty));

        // Общий объём по поставщику (для ТОП-10) - теперь по количеству!
        const currentTotal = totalQtyBySupplier.get(item.supplierId) || 0;
        totalQtyBySupplier.set(item.supplierId, currentTotal + Number(item.qty));
    }


    // ============================================
    // D: Товары из производства на дату
    // ============================================
    const productionRuns = await prisma.productionRun.findMany({
        where: {
            productionDate: { gte: dateStart, lte: dateEnd },
            isHidden: false
        },
        select: { productId: true, actualWeight: true }
    });
    const productionByProduct = new Map<number, number>();
    for (const run of productionRuns) {
        const current = productionByProduct.get(run.productId) || 0;
        productionByProduct.set(run.productId, current + Number(run.actualWeight || 0));
    }

    // ============================================
    // Объединяем все товары (A ∪ B ∪ C ∪ D)
    // ============================================
    const allProductIds = new Set<number>([
        ...ordersByProduct.keys(),
        ...stockByProduct.keys(),
        ...purchasesByProduct.keys(),
        ...productionByProduct.keys()
    ]);

    // Получаем данные товаров из справочника
    const products = await prisma.product.findMany({
        where: { id: { in: Array.from(allProductIds) }, status: 'active' },
        select: { id: true, name: true, priceListName: true, category: true, coefficient: true }
    });
    const productsMap = new Map(products.map(p => [p.id, p]));

    // ============================================
    // Формируем строки свода
    // ============================================
    const lines = [];
    for (const productId of allProductIds) {
        const product = productsMap.get(productId);
        if (!product) continue;

        // Категория из справочника товаров
        const categoryFromProduct = product.category || 'Без категории';

        // Получаем значения для расчётов
        const openingStock = stockByProduct.get(productId) || 0;
        const productionInQty = productionByProduct.get(productId) || 0;
        const coefficient = product.coefficient ?? 1;

        // Сумма закупок по всем поставщикам для данного товара
        let totalPurchasesForProduct = 0;
        const supplierMap = purchasesByProduct.get(productId);
        if (supplierMap) {
            for (const qty of supplierMap.values()) {
                totalPurchasesForProduct += qty;
            }
        }

        // Расчёт "Имеется в наличии" = Остаток на начало + Закупки + Производство
        const availableQty = openingStock + totalPurchasesForProduct + productionInQty;

        // Расчёт "Факт (− отходы)" = Имеется в наличии × Коэффициент
        const factMinusWaste = availableQty * coefficient;

        lines.push({
            productId,
            shortName: product.priceListName || product.name,
            category: categoryFromProduct,
            coefficient: product.coefficient,
            orderQty: ordersByProduct.get(productId) || 0,
            openingStock,
            openingStockIsManual: false,
            productionInQty,
            afterPurchaseStock: null as number | null,
            availableQty,  // Имеется в наличии
            qtyToShip: null,
            factMinusWaste,  // Факт (− отходы)
            weightToShip: null,
            planFactDiff: null,
            underOver: null,
            product
        });
    }

    // Сортировка: по категориям, затем по короткому названию
    const categoryOrder = ['Баранина', 'Говядина', 'Курица'];
    lines.sort((a, b) => {
        const catA = categoryOrder.indexOf(a.category);
        const catB = categoryOrder.indexOf(b.category);
        const orderA = catA >= 0 ? catA : 999;
        const orderB = catB >= 0 ? catB : 999;
        if (orderA !== orderB) return orderA - orderB;
        if (a.category !== b.category) return a.category.localeCompare(b.category, 'ru');
        return (a.shortName || '').localeCompare(b.shortName || '', 'ru');
    });

    // ============================================
    // ТОП-10 поставщиков по сумме закупленного количества
    // ============================================
    const sortedSuppliers = Array.from(totalQtyBySupplier.entries())
        .sort((a, b) => b[1] - a[1])  // Сортировка по убыванию qty
        .slice(0, 10);


    const supplierIds = sortedSuppliers.map(s => s[0]);
    const suppliersData = await prisma.supplier.findMany({
        where: { id: { in: supplierIds } },
        select: { id: true, name: true }
    });
    const suppliersMap = new Map(suppliersData.map(s => [s.id, s]));

    const supplierCols = sortedSuppliers.map(([supplierId, totalQty], index) => ({
        colIndex: index + 1,
        supplierId,
        supplierName: suppliersMap.get(supplierId)?.name || `Поставщик ${supplierId}`,
        totalPurchase: totalQty  // Теперь это totalQty!
    }));

    // Значения закупок по поставщикам
    const supplierValues: { productId: number; supplierId: number; purchaseQty: number }[] = [];
    for (const [productId, supplierMap] of purchasesByProduct.entries()) {
        for (const [supplierId, qty] of supplierMap.entries()) {
            if (supplierIds.includes(supplierId)) {
                supplierValues.push({ productId, supplierId, purchaseQty: qty });
            }
        }
    }


    return {
        id: null,
        svodDate,
        status: 'draft',
        // KPI (новые поля!)
        ordersCount,
        totalOrderKg,
        // Данные
        lines,
        supplierCols,
        supplierValues
    };
}

/**
 * Сохранить СВОД
 * POST /api/svod
 */
export const saveSvod = async (req: Request, res: Response) => {
    try {
        const username = (req as any).user?.username || 'system';
        const { svodDate, lines, supplierCols, supplierValues } = req.body;

        if (!svodDate || !lines) {
            return res.status(400).json({ error: 'svodDate and lines are required' });
        }

        const date = new Date(svodDate);
        date.setHours(0, 0, 0, 0);

        // Проверяем, есть ли уже свод на эту дату
        const existing = await prisma.svodHeader.findUnique({
            where: { svodDate: date }
        });

        if (existing) {
            // Обновляем существующий свод
            return await updateExistingSvod(res, existing.id, username, lines, supplierCols, supplierValues);
        }

        // Создаём новый свод с транзакцией
        const result = await prisma.$transaction(async (tx) => {
            // Создаём шапку
            const header = await tx.svodHeader.create({
                data: {
                    svodDate: date,
                    status: 'saved',
                    createdBy: username
                }
            });

            // Создаём строки (batch)
            if (lines.length > 0) {
                await tx.svodLine.createMany({
                    data: lines.map((line: any, index: number) => ({
                        svodId: header.id,
                        productId: line.productId,
                        shortName: line.shortName,
                        category: line.category,
                        coefficient: line.coefficient,
                        orderQty: line.orderQty || 0,
                        productionInQty: line.productionInQty || 0,
                        openingStock: line.openingStock || 0,
                        openingStockIsManual: line.openingStockIsManual || false,
                        afterPurchaseStock: line.afterPurchaseStock,
                        // availableQty и factMinusWaste рассчитываются динамически на клиенте
                        qtyToShip: line.qtyToShip,
                        factMinusWaste: line.factMinusWaste,
                        weightToShip: line.weightToShip,
                        planFactDiff: line.planFactDiff,
                        underOver: line.underOver,
                        sortOrder: index
                    }))
                });
            }

            // Создаём колонки поставщиков (batch)
            if (supplierCols && supplierCols.length > 0) {
                await tx.svodSupplierCol.createMany({
                    data: supplierCols.map((col: any) => ({
                        svodId: header.id,
                        colIndex: col.colIndex,
                        supplierId: col.supplierId,
                        supplierName: col.supplierName,
                        totalPurchase: col.totalPurchase || 0
                    }))
                });
            }

            // Создаём значения поставщиков (batch)
            if (supplierValues && supplierValues.length > 0) {
                await tx.svodSupplierValue.createMany({
                    data: supplierValues.map((val: any) => ({
                        svodId: header.id,
                        productId: val.productId,
                        supplierId: val.supplierId,
                        purchaseQty: val.purchaseQty || 0
                    }))
                });
            }

            return header;
        });

        // Возвращаем полные данные
        const savedSvod = await prisma.svodHeader.findUnique({
            where: { id: result.id },
            include: {
                lines: { include: { product: true }, orderBy: { sortOrder: 'asc' } },
                supplierCols: { orderBy: { colIndex: 'asc' } },
                supplierValues: true
            }
        });

        res.status(201).json({ mode: 'saved', svod: savedSvod });
    } catch (error) {
        console.error('saveSvod error:', error);
        res.status(500).json({ error: 'Failed to save svod' });
    }
};

/**
 * Обновить существующий свод
 */
async function updateExistingSvod(
    res: Response,
    svodId: number,
    username: string,
    lines: any[],
    supplierCols: any[],
    supplierValues: any[]
) {
    try {
        await prisma.$transaction(async (tx) => {
            // Обновляем шапку
            await tx.svodHeader.update({
                where: { id: svodId },
                data: { status: 'saved', updatedBy: username }
            });

            // Удаляем старые данные и создаём новые
            await tx.svodLine.deleteMany({ where: { svodId } });
            await tx.svodSupplierCol.deleteMany({ where: { svodId } });
            await tx.svodSupplierValue.deleteMany({ where: { svodId } });

            // Создаём строки
            if (lines.length > 0) {
                await tx.svodLine.createMany({
                    data: lines.map((line: any, index: number) => ({
                        svodId,
                        productId: line.productId,
                        shortName: line.shortName,
                        category: line.category,
                        coefficient: line.coefficient,
                        orderQty: line.orderQty || 0,
                        productionInQty: line.productionInQty || 0,
                        openingStock: line.openingStock || 0,
                        openingStockIsManual: line.openingStockIsManual || false,
                        afterPurchaseStock: line.afterPurchaseStock,
                        // availableQty и factMinusWaste рассчитываются динамически на клиенте
                        qtyToShip: line.qtyToShip,
                        factMinusWaste: line.factMinusWaste,
                        weightToShip: line.weightToShip,
                        planFactDiff: line.planFactDiff,
                        underOver: line.underOver,
                        sortOrder: index
                    }))
                });
            }

            // Создаём колонки поставщиков
            if (supplierCols && supplierCols.length > 0) {
                await tx.svodSupplierCol.createMany({
                    data: supplierCols.map((col: any) => ({
                        svodId,
                        colIndex: col.colIndex,
                        supplierId: col.supplierId,
                        supplierName: col.supplierName,
                        totalPurchase: col.totalPurchase || 0
                    }))
                });
            }

            // Создаём значения поставщиков
            if (supplierValues && supplierValues.length > 0) {
                await tx.svodSupplierValue.createMany({
                    data: supplierValues.map((val: any) => ({
                        svodId,
                        productId: val.productId,
                        supplierId: val.supplierId,
                        purchaseQty: val.purchaseQty || 0
                    }))
                });
            }
        });

        const savedSvod = await prisma.svodHeader.findUnique({
            where: { id: svodId },
            include: {
                lines: { include: { product: true }, orderBy: { sortOrder: 'asc' } },
                supplierCols: { orderBy: { colIndex: 'asc' } },
                supplierValues: true
            }
        });

        return res.json({ mode: 'saved', svod: savedSvod });
    } catch (error) {
        console.error('updateExistingSvod error:', error);
        return res.status(500).json({ error: 'Failed to update svod' });
    }
}

/**
 * Обновить СВОД (пересобрать данные из источников)
 * PUT /api/svod/:id/refresh
 */
export const refreshSvod = async (req: Request, res: Response) => {
    try {
        const svodId = Number(req.params.id);
        const username = (req as any).user?.username || 'system';

        const svod = await prisma.svodHeader.findUnique({
            where: { id: svodId },
            include: { lines: true }
        });

        if (!svod) {
            return res.status(404).json({ error: 'Svod not found' });
        }

        // Сохраняем ручные правки
        const manualEdits = new Map<number, { openingStock: number; afterPurchaseStock: number | null }>();
        for (const line of svod.lines) {
            if (line.openingStockIsManual || line.afterPurchaseStock) {
                manualEdits.set(line.productId, {
                    openingStock: line.openingStockIsManual ? Number(line.openingStock) : 0,
                    afterPurchaseStock: line.afterPurchaseStock ? Number(line.afterPurchaseStock) : null
                });
            }
        }

        // Формируем свежие данные
        const freshData = await buildSvodPreview(svod.svodDate);

        // Восстанавливаем ручные правки
        for (const line of freshData.lines) {
            const manual = manualEdits.get(line.productId);
            if (manual) {
                if (manual.openingStock) {
                    line.openingStock = manual.openingStock;
                    line.openingStockIsManual = true;
                }
                if (manual.afterPurchaseStock !== null) {
                    line.afterPurchaseStock = manual.afterPurchaseStock;
                }
            }
        }

        // Обновляем в БД
        await updateExistingSvod(res, svodId, username, freshData.lines, freshData.supplierCols, freshData.supplierValues);
    } catch (error) {
        console.error('refreshSvod error:', error);
        res.status(500).json({ error: 'Failed to refresh svod' });
    }
};

/**
 * Обновить строку свода (ручные правки)
 * PATCH /api/svod/lines/:lineId
 */
export const updateSvodLine = async (req: Request, res: Response) => {
    try {
        const lineId = Number(req.params.lineId);
        const updates = req.body;

        // Определяем, какие поля можно редактировать
        const allowedFields = ['openingStock', 'afterPurchaseStock'];
        const data: any = {};

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                data[field] = updates[field] !== null ? Number(updates[field]) : null;
            }
        }

        // Если редактируется openingStock - ставим флаг ручной правки
        if (updates.openingStock !== undefined) {
            data.openingStockIsManual = true;
        }

        const updatedLine = await prisma.svodLine.update({
            where: { id: lineId },
            data,
            include: { product: true }
        });

        res.json(updatedLine);
    } catch (error) {
        console.error('updateSvodLine error:', error);
        res.status(500).json({ error: 'Failed to update svod line' });
    }
};

/**
 * Удалить СВОД
 * DELETE /api/svod/:id
 */
export const deleteSvod = async (req: Request, res: Response) => {
    try {
        const svodId = Number(req.params.id);

        await prisma.svodHeader.delete({
            where: { id: svodId }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('deleteSvod error:', error);
        res.status(500).json({ error: 'Failed to delete svod' });
    }
};

// ============================================
// РАСПРЕДЕЛЕНИЕ ВЕСА ОТГРУЗКИ ПО MML
// ============================================

/**
 * Получить MML (техкарту) по productId
 * GET /api/svod/mml/:productId
 */
export const getMmlForDistribution = async (req: Request, res: Response) => {
    try {
        const productId = Number(req.params.productId);

        // Ищем MML для этого товара
        const mml = await prisma.productionMml.findUnique({
            where: { productId },
            include: {
                product: {
                    select: { id: true, name: true, code: true, category: true }
                },
                nodes: {
                    where: { parentNodeId: null },  // Только корневые узлы
                    orderBy: { sortOrder: 'asc' },
                    include: {
                        product: {
                            select: { id: true, name: true, code: true }
                        },
                        children: {
                            orderBy: { sortOrder: 'asc' },
                            include: {
                                product: {
                                    select: { id: true, name: true, code: true }
                                },
                                children: {
                                    orderBy: { sortOrder: 'asc' },
                                    include: {
                                        product: {
                                            select: { id: true, name: true, code: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!mml) {
            return res.status(404).json({ error: 'MML not found for this product' });
        }

        // Рекурсивно собираем все узлы в плоский список для удобства
        const flattenNodes = (nodes: any[]): any[] => {
            const result: any[] = [];
            for (const node of nodes) {
                result.push({
                    id: node.id,
                    productId: node.productId,
                    productName: node.product?.name || 'Unknown',
                    productCode: node.product?.code || '',
                    parentNodeId: node.parentNodeId,
                    sortOrder: node.sortOrder
                });
                if (node.children && node.children.length > 0) {
                    result.push(...flattenNodes(node.children));
                }
            }
            return result;
        };

        res.json({
            mml: {
                id: mml.id,
                productId: mml.productId,
                productName: mml.product?.name,
                isLocked: mml.isLocked
            },
            nodes: flattenNodes(mml.nodes)
        });
    } catch (error) {
        console.error('getMmlForDistribution error:', error);
        res.status(500).json({ error: 'Failed to get MML' });
    }
};

/**
 * Получить распределение веса для строки свода
 * GET /api/svod/lines/:lineId/distribution
 */
export const getShipmentDistribution = async (req: Request, res: Response) => {
    try {
        const lineId = Number(req.params.lineId);

        const line = await prisma.svodLine.findUnique({
            where: { id: lineId },
            include: {
                product: {
                    select: { id: true, name: true, code: true, category: true }
                },
                shipmentDistributions: {
                    include: {
                        mmlNode: {
                            include: {
                                product: {
                                    select: { id: true, name: true, code: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!line) {
            return res.status(404).json({ error: 'Svod line not found' });
        }

        res.json({
            lineId: line.id,
            productId: line.productId,
            productName: line.product?.name,
            weightToShip: line.weightToShip,
            factMinusWaste: line.factMinusWaste,
            distributions: line.shipmentDistributions.map(d => ({
                id: d.id,
                mmlNodeId: d.mmlNodeId,
                distributedQty: Number(d.distributedQty),
                productName: d.mmlNode?.product?.name,
                productCode: d.mmlNode?.product?.code
            }))
        });
    } catch (error) {
        console.error('getShipmentDistribution error:', error);
        res.status(500).json({ error: 'Failed to get shipment distribution' });
    }
};

/**
 * Сохранить распределение веса для строки свода
 * POST /api/svod/lines/:lineId/distribution
 * Body: { 
 *   plannedWeight: number, 
 *   distributions: [{ productId: number, productName: string, qty: number }],
 *   addMissingProducts: boolean,
 *   sourceProductId: number,
 *   sourceProductName: string
 * }
 */
export const saveShipmentDistribution = async (req: Request, res: Response) => {
    try {
        const lineId = Number(req.params.lineId);
        const { plannedWeight, distributions, addMissingProducts, sourceProductId, sourceProductName } = req.body;

        if (!distributions || !Array.isArray(distributions)) {
            return res.status(400).json({ error: 'distributions array is required' });
        }

        // Проверяем существование строки и получаем svodId
        const line = await prisma.svodLine.findUnique({
            where: { id: lineId },
            include: { svod: true }
        });

        if (!line) {
            return res.status(404).json({ error: 'Svod line not found' });
        }

        const svodId = line.svodId;
        const addedLines: any[] = [];

        await prisma.$transaction(async (tx) => {
            // Фильтруем валидные распределения
            const validDistributions = distributions.filter((d: any) => d.qty > 0 && d.productId);

            // *** ОЧИСТКА СТАРЫХ РАСПРЕДЕЛЕНИЙ ***
            // Находим все строки которые ранее были распределены от этого источника
            const oldDistributedLines = await tx.svodLine.findMany({
                where: {
                    svodId,
                    distributedFromLineId: lineId
                }
            });

            // Обнуляем у них weightToShip и снимаем маркировку
            for (const oldLine of oldDistributedLines) {
                await tx.svodLine.update({
                    where: { id: oldLine.id },
                    data: {
                        weightToShip: null,
                        distributedFromLineId: null,
                        distributedFromName: null
                    }
                });
            }

            // Обнуляем weightToShip у родительской позиции и помечаем как источник
            await tx.svodLine.update({
                where: { id: lineId },
                data: {
                    weightToShip: null,
                    isDistributionSource: true  // Маркируем как источник
                }
            });

            // Получаем короткое название родительской позиции
            const sourceName = line.shortName || 'Источник';

            // Обрабатываем каждую позицию распределения
            for (const dist of validDistributions) {
                if (!dist.productId) continue;

                // Ищем существующую строку в своде
                let targetLine = await tx.svodLine.findUnique({
                    where: {
                        svodId_productId: { svodId, productId: dist.productId }
                    }
                });

                if (targetLine) {
                    // Обновляем weightToShip у существующей строки + маркировка
                    await tx.svodLine.update({
                        where: { id: targetLine.id },
                        data: {
                            weightToShip: {
                                increment: dist.qty
                            },
                            distributedFromLineId: lineId,
                            distributedFromName: sourceName
                        }
                    });
                } else if (addMissingProducts) {
                    // Добавляем новую строку в свод с маркировкой
                    const product = await tx.product.findUnique({
                        where: { id: dist.productId },
                        select: { id: true, name: true, priceListName: true, category: true, coefficient: true }
                    });

                    if (product) {
                        const newLine = await tx.svodLine.create({
                            data: {
                                svodId,
                                productId: dist.productId,
                                shortName: product.priceListName || product.name,
                                category: product.category,
                                coefficient: product.coefficient,
                                orderQty: 0,
                                productionInQty: 0,
                                openingStock: 0,
                                openingStockIsManual: false,
                                weightToShip: dist.qty,
                                distributedFromLineId: lineId,
                                distributedFromName: sourceName,
                                sortOrder: 999  // В конец списка
                            }
                        });
                        addedLines.push({
                            ...newLine,
                            product,
                            isNew: true
                        });
                    }
                }
            }
        });

        // Возвращаем обновлённые данные
        const updatedLine = await prisma.svodLine.findUnique({
            where: { id: lineId },
            include: {
                product: true,
                shipmentDistributions: {
                    include: {
                        mmlNode: {
                            include: {
                                product: {
                                    select: { id: true, name: true, code: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        res.json({
            success: true,
            line: updatedLine,
            addedLines,
            distributions: updatedLine?.shipmentDistributions.map(d => ({
                id: d.id,
                mmlNodeId: d.mmlNodeId,
                distributedQty: Number(d.distributedQty),
                productName: d.mmlNode?.product?.name
            }))
        });
    } catch (error) {
        console.error('saveShipmentDistribution error:', error);
        res.status(500).json({ error: 'Failed to save shipment distribution' });
    }
};
