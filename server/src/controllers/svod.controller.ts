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
 * 
 * ОПТИМИЗИРОВАНО: минимальный набор полей, сортировка на клиенте
 */
export const getSvodByDate = async (req: Request, res: Response) => {
    try {
        console.time('getSvodByDate:total');
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ error: 'date parameter is required' });
        }

        // Парсим дату как UTC полночь для корректного сравнения
        const svodDate = new Date(String(date));
        svodDate.setUTCHours(0, 0, 0, 0);

        console.time('getSvodByDate:findExisting');
        // Проверяем, есть ли сохранённый свод (оптимизированный запрос)
        // ОПТИМИЗАЦИЯ: убрана сортировка - делается на клиенте, минимум полей product
        const existingSvod = await prisma.svodHeader.findUnique({
            where: { svodDate },
            include: {
                lines: {
                    include: {
                        product: {
                            select: { id: true, code: true, name: true, priceListName: true, category: true, coefficient: true }
                        }
                    }
                    // Сортировка убрана - делается на клиенте через useMemo
                },
                supplierCols: {
                    orderBy: { colIndex: 'asc' }
                },
                supplierValues: true
            }
        });
        console.timeEnd('getSvodByDate:findExisting');

        if (existingSvod) {
            console.timeEnd('getSvodByDate:total');
            return res.json({
                mode: existingSvod.status === 'draft' ? 'preview' : 'saved',
                svod: existingSvod
            });
        }

        // Если нет сохранённого свода - формируем предпросмотр
        console.time('getSvodByDate:buildPreview');
        const previewData = await buildSvodPreview(svodDate);
        console.timeEnd('getSvodByDate:buildPreview');

        console.timeEnd('getSvodByDate:total');
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
 * Получить EOD (остаток на конец дня) из ближайшего предыдущего Material Report
 * Если отчёт за D-1 не существует, ищем D-2, D-3 и т.д. (до 30 дней назад)
 * Возвращает Map<productId, closingBalance>
 */
async function getClosestPreviousEOD(svodDate: Date): Promise<Map<number, number>> {
    const stockByProduct = new Map<number, number>();

    // Ищем ближайший Material Report за последние 30 дней
    const searchStartDate = new Date(svodDate);
    searchStartDate.setDate(searchStartDate.getDate() - 30);
    searchStartDate.setUTCHours(0, 0, 0, 0);

    const previousDate = new Date(svodDate);
    previousDate.setDate(previousDate.getDate() - 1);
    previousDate.setUTCHours(23, 59, 59, 999);

    // Находим самый последний отчёт до указанной даты
    const latestReport = await prisma.materialReport.findFirst({
        where: {
            reportDate: {
                gte: searchStartDate,
                lte: previousDate
            },
            warehouseId: null
        },
        orderBy: { reportDate: 'desc' },
        include: {
            lines: {
                select: {
                    productId: true,
                    closingBalanceCalc: true,
                    closingBalanceFact: true
                }
            }
        }
    });

    if (latestReport) {
        console.log(`[SVOD] Using Material Report from ${latestReport.reportDate.toISOString().split('T')[0]} as EOD source`);
        for (const line of latestReport.lines) {
            // Используем фактический остаток если введён, иначе расчётный
            const balance = line.closingBalanceFact !== null
                ? Number(line.closingBalanceFact)
                : Number(line.closingBalanceCalc);
            if (balance !== 0) { // Не добавляем нулевые позиции
                stockByProduct.set(line.productId, balance);
            }
        }
    } else {
        console.log(`[SVOD] No Material Report found before ${svodDate.toISOString().split('T')[0]}`);
    }

    return stockByProduct;
}

/**
 * Сформировать данные для предпросмотра СВОД (без сохранения)
 * ОПТИМИЗИРОВАНО: 
 * - SQL агрегация для заказов (вместо загрузки всех записей)
 * - Параллельные запросы к БД
 * - Сортировка убрана (делается на клиенте)
 * - Fallback на ближайший Material Report если D-1 не существует
 */
async function buildSvodPreview(svodDate: Date) {
    console.time('buildSvodPreview:total');

    // Используем только дату (без времени) для корректной работы с часовыми поясами
    const dateStart = new Date(svodDate);
    dateStart.setUTCHours(0, 0, 0, 0);
    const dateEnd = new Date(svodDate);
    dateEnd.setUTCHours(23, 59, 59, 999);

    // ============================================
    // ПАРАЛЛЕЛЬНАЯ ЗАГРУЗКА ВСЕХ ИСТОЧНИКОВ
    // ============================================
    console.time('buildSvodPreview:fetchSources');

    // ОПТИМИЗАЦИЯ: Используем SQL агрегацию для заказов вместо загрузки всех записей
    // Получаем EOD из ближайшего Material Report параллельно с другими запросами
    const [orderAggregates, ordersCountResult, stockByProduct, purchases, productionValues] = await Promise.all([
        // A1: Агрегация заказов по товарам через SQL
        prisma.$queryRaw<{ productId: number; totalQty: number }[]>`
            SELECT "productId", SUM("orderQty") as "totalQty"
            FROM "SummaryOrderJournal"
            WHERE "shipDate" >= ${dateStart} AND "shipDate" <= ${dateEnd}
              AND "status" IN ('draft', 'forming', 'synced')
              AND "productId" IS NOT NULL
            GROUP BY "productId"
        `,

        // A2: Подсчёт уникальных заказов и общего веса через SQL
        prisma.$queryRaw<{ ordersCount: bigint; totalKg: number }[]>`
            SELECT 
                COUNT(DISTINCT "idn") as "ordersCount",
                COALESCE(SUM("orderQty"), 0) as "totalKg"
            FROM "SummaryOrderJournal"
            WHERE "shipDate" >= ${dateStart} AND "shipDate" <= ${dateEnd}
              AND "status" IN ('draft', 'forming', 'synced')
        `,

        // B: EOD из ближайшего Material Report (с fallback)
        getClosestPreviousEOD(svodDate),

        // C: Товары из закупок на дату
        prisma.purchaseItem.findMany({
            where: {
                purchase: {
                    purchaseDate: { gte: dateStart, lte: dateEnd },
                    isDisabled: false
                }
            },
            select: {
                productId: true,
                supplierId: true,
                qty: true
            }
        }),

        // D: Товары из производства на дату
        prisma.productionRunValue.findMany({
            where: {
                run: {
                    productionDate: { gte: dateStart, lte: dateEnd },
                    isHidden: false
                },
                value: { not: null }
            },
            select: {
                snapshotProductId: true,
                value: true,
                node: {
                    select: { productId: true }
                }
            }
        })
    ]);
    console.timeEnd('buildSvodPreview:fetchSources');

    // ============================================
    // АГРЕГАЦИЯ ДАННЫХ
    // ============================================
    console.time('buildSvodPreview:aggregate');

    // A: Заказы уже агрегированы через SQL
    const ordersByProduct = new Map<number, number>();
    console.log('[SVOD DEBUG] orderAggregates count:', orderAggregates.length);
    console.log('[SVOD DEBUG] orderAggregates raw:', JSON.stringify(orderAggregates.slice(0, 5)));
    for (const row of orderAggregates) {
        // Приводим к Number явно, т.к. PostgreSQL может вернуть BigInt
        const productId = Number(row.productId);
        const totalQty = Number(row.totalQty);
        console.log('[SVOD DEBUG] order row:', { productId, totalQty, rawProductId: row.productId, type: typeof row.productId });
        ordersByProduct.set(productId, totalQty);
    }
    const ordersCount = Number(ordersCountResult[0]?.ordersCount || 0);
    const totalOrderKg = Number(ordersCountResult[0]?.totalKg || 0);
    console.log('[SVOD DEBUG] ordersCount:', ordersCount, 'totalOrderKg:', totalOrderKg);
    console.log('[SVOD DEBUG] ordersByProduct size:', ordersByProduct.size);

    // B: stockByProduct уже получен из getClosestPreviousEOD (с fallback на ближайший отчёт)
    console.log('[SVOD DEBUG] stockByProduct size:', stockByProduct.size);

    // C: Агрегируем закупки по товарам и поставщикам
    const purchasesByProduct = new Map<number, Map<number, number>>();
    const totalQtyBySupplier = new Map<number, number>();

    for (const item of purchases) {
        if (!purchasesByProduct.has(item.productId)) {
            purchasesByProduct.set(item.productId, new Map());
        }
        const supplierMap = purchasesByProduct.get(item.productId)!;
        const currentQty = supplierMap.get(item.supplierId) || 0;
        supplierMap.set(item.supplierId, currentQty + Number(item.qty));

        const currentTotal = totalQtyBySupplier.get(item.supplierId) || 0;
        totalQtyBySupplier.set(item.supplierId, currentTotal + Number(item.qty));
    }

    // D: Агрегируем производство
    const productionByProduct = new Map<number, number>();
    for (const pv of productionValues) {
        const productId = pv.snapshotProductId || pv.node?.productId;
        if (productId) {
            const current = productionByProduct.get(productId) || 0;
            productionByProduct.set(productId, current + Number(pv.value || 0));
        }
    }
    console.timeEnd('buildSvodPreview:aggregate');

    // ============================================
    // Объединяем все товары (A ∪ B ∪ C ∪ D)
    // ============================================
    const allProductIds = new Set<number>([
        ...Array.from(ordersByProduct.keys()),
        ...Array.from(stockByProduct.keys()),
        ...Array.from(purchasesByProduct.keys()),
        ...Array.from(productionByProduct.keys())
    ]);
    console.log('[SVOD DEBUG] Product sources - orders:', ordersByProduct.size, 'stock:', stockByProduct.size, 'purchases:', purchasesByProduct.size, 'production:', productionByProduct.size);
    console.log('[SVOD DEBUG] allProductIds count:', allProductIds.size);

    // ============================================
    // ТОП-10 поставщиков по сумме закупленного количества
    // ============================================
    const sortedSuppliers = Array.from(totalQtyBySupplier.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    const supplierIds = sortedSuppliers.map(s => s[0]);
    const supplierIdsSet = new Set(supplierIds);

    // ОПТИМИЗАЦИЯ: Параллельный запрос товаров и поставщиков
    console.time('buildSvodPreview:fetchProducts');
    const productIdsArray = Array.from(allProductIds);
    console.log('[SVOD DEBUG] Querying products with IDs:', productIdsArray.slice(0, 10), '...');
    const [products, suppliersData] = await Promise.all([
        productIdsArray.length > 0
            ? prisma.product.findMany({
                where: { id: { in: productIdsArray }, status: 'active' },
                select: { id: true, code: true, name: true, priceListName: true, category: true, coefficient: true }
            })
            : Promise.resolve([]),
        supplierIds.length > 0
            ? prisma.supplier.findMany({
                where: { id: { in: supplierIds } },
                select: { id: true, name: true }
            })
            : Promise.resolve([])
    ]);
    console.log('[SVOD DEBUG] Found products (active):', products.length);
    console.timeEnd('buildSvodPreview:fetchProducts');
    console.timeEnd('buildSvodPreview:fetchProducts');

    const productsMap = new Map(products.map(p => [p.id, p]));
    const suppliersMap = new Map(suppliersData.map(s => [s.id, s]));

    // ============================================
    // Формируем строки свода
    // ============================================
    console.time('buildSvodPreview:buildLines');
    const lines = [];
    for (const productId of Array.from(allProductIds)) {
        const product = productsMap.get(productId);
        if (!product) continue;

        const categoryFromProduct = product.category || 'Без категории';
        const openingStock = stockByProduct.get(productId) || 0;
        const productionInQty = productionByProduct.get(productId) || 0;
        const coefficient = product.coefficient ?? 1;

        // Сумма закупок по всем поставщикам для данного товара
        let totalPurchasesForProduct = 0;
        const supplierMap = purchasesByProduct.get(productId);
        if (supplierMap) {
            for (const qty of Array.from(supplierMap.values())) {
                totalPurchasesForProduct += qty;
            }
        }

        const availableQty = openingStock + totalPurchasesForProduct + productionInQty;
        const factMinusWaste = availableQty * coefficient;
        const orderQty = ordersByProduct.get(productId) || 0;
        const isPurchaseOnly = totalPurchasesForProduct > 0 && orderQty === 0 && productionInQty === 0;
        const isProductionOnly = productionInQty > 0 && orderQty === 0 && totalPurchasesForProduct === 0;

        lines.push({
            productId,
            shortName: product.priceListName || product.name,
            category: categoryFromProduct,
            coefficient: product.coefficient,
            orderQty,
            openingStock,
            openingStockIsManual: false,
            productionInQty,
            afterPurchaseStock: null as number | null,
            availableQty,
            qtyToShip: null,
            factMinusWaste,
            weightToShip: null,
            planFactDiff: null,
            underOver: null,
            isPurchaseOnly,
            isProductionOnly,
            product
        });
    }
    console.timeEnd('buildSvodPreview:buildLines');

    // ОПТИМИЗАЦИЯ: Сортировка убрана - делается на клиенте через useMemo

    // Формируем колонки поставщиков
    const supplierCols = sortedSuppliers.map(([supplierId, totalQty], index) => ({
        colIndex: index + 1,
        supplierId,
        supplierName: suppliersMap.get(supplierId)?.name || `Поставщик ${supplierId}`,
        totalPurchase: totalQty
    }));

    // Значения закупок по поставщикам
    const supplierValues: { productId: number; supplierId: number; purchaseQty: number }[] = [];
    for (const [productId, supplierMap] of Array.from(purchasesByProduct.entries())) {
        for (const [supplierId, qty] of Array.from(supplierMap.entries())) {
            if (supplierIdsSet.has(supplierId)) {
                supplierValues.push({ productId, supplierId, purchaseQty: qty });
            }
        }
    }

    console.timeEnd('buildSvodPreview:total');
    return {
        id: null,
        svodDate,
        status: 'draft',
        ordersCount,
        totalOrderKg,
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

        // Парсим дату как UTC полночь
        const date = new Date(svodDate);
        date.setUTCHours(0, 0, 0, 0);

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
                        // Поля распределения
                        isDistributionSource: line.isDistributionSource || false,
                        distributedFromLineId: line.distributedFromLineId || null,
                        distributedFromName: line.distributedFromName || null,
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
        }, {
            timeout: 60000,  // 60 секунд
            maxWait: 10000
        });

        // Возвращаем полные данные
        // Оптимизированный запрос - select только нужные поля product
        const savedSvod = await prisma.svodHeader.findUnique({
            where: { id: result.id },
            include: {
                lines: {
                    include: {
                        product: { select: { id: true, code: true, name: true, priceListName: true, category: true, coefficient: true } }
                    },
                    orderBy: { sortOrder: 'asc' }
                },
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

            // *** СОХРАНЯЕМ СВЯЗИ РАСПРЕДЕЛЕНИЯ ПО PRODUCTID ***
            // Читаем старые строки и запоминаем связи: targetProductId -> sourceProductId
            const oldLines = await tx.svodLine.findMany({ where: { svodId } });
            const oldLineIdToProductId = new Map<number, number>();
            for (const ol of oldLines) {
                oldLineIdToProductId.set(ol.id, ol.productId);
            }

            // Создаём карту: targetProductId -> { sourceProductId, sourceName, isSource }
            const distributionLinks = new Map<number, { sourceProductId: number | null; sourceName: string | null }>();
            const sourceProductIds = new Set<number>();

            for (const line of lines) {
                // Сначала обрабатываем флаг источника (для всех строк)
                if (line.isDistributionSource) {
                    sourceProductIds.add(line.productId);
                }

                // ВАЖНО: Если клиент явно очистил distributedFromLineId (null), 
                // не восстанавливаем связь из старых данных БД
                if (line.distributedFromLineId === null) {
                    // Связь была удалена клиентом - не добавляем в distributionLinks
                    continue;
                }

                if (line.distributedFromLineId && oldLineIdToProductId.has(line.distributedFromLineId)) {
                    // Связь есть - сохраняем по productId источника
                    const sourceProductId = oldLineIdToProductId.get(line.distributedFromLineId)!;
                    distributionLinks.set(line.productId, {
                        sourceProductId,
                        sourceName: line.distributedFromName || null
                    });
                }
            }

            // Удаляем старые данные
            await tx.svodLine.deleteMany({ where: { svodId } });
            await tx.svodSupplierCol.deleteMany({ where: { svodId } });
            await tx.svodSupplierValue.deleteMany({ where: { svodId } });

            // Создаём строки БЕЗ distributedFromLineId (пока ID неизвестны)
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
                        qtyToShip: line.qtyToShip,
                        factMinusWaste: line.factMinusWaste,
                        weightToShip: line.weightToShip,
                        planFactDiff: line.planFactDiff,
                        underOver: line.underOver,
                        isDistributionSource: sourceProductIds.has(line.productId),
                        distributedFromLineId: null,  // Заполним позже
                        distributedFromName: distributionLinks.get(line.productId)?.sourceName || null,
                        sortOrder: index
                    }))
                });
            }

            // *** ВОССТАНАВЛИВАЕМ СВЯЗИ ПО НОВЫМ ID ***
            const newLines = await tx.svodLine.findMany({ where: { svodId } });
            const productIdToNewLineId = new Map<number, number>();
            for (const nl of newLines) {
                productIdToNewLineId.set(nl.productId, nl.id);
            }

            // Обновляем distributedFromLineId для строк со связями
            for (const [targetProductId, link] of Array.from(distributionLinks.entries())) {
                if (link.sourceProductId && productIdToNewLineId.has(link.sourceProductId)) {
                    const targetLineId = productIdToNewLineId.get(targetProductId);
                    const sourceLineId = productIdToNewLineId.get(link.sourceProductId);
                    if (targetLineId && sourceLineId) {
                        await tx.svodLine.update({
                            where: { id: targetLineId },
                            data: { distributedFromLineId: sourceLineId }
                        });
                    }
                }
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
        }, {
            timeout: 60000,  // 60 секунд
            maxWait: 10000
        });

        // Оптимизированный запрос - select только нужные поля product
        const savedSvod = await prisma.svodHeader.findUnique({
            where: { id: svodId },
            include: {
                lines: {
                    include: {
                        product: { select: { id: true, code: true, name: true, priceListName: true, category: true, coefficient: true } }
                    },
                    orderBy: { sortOrder: 'asc' }
                },
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
 * Обновить СВОД (добавить новые данные, сохраняя старые)
 * PUT /api/svod/:id/refresh
 * 
 * Логика:
 * 1. Получаем свежие данные из источников (заказы, закупки, производство)
 * 2. Добавляем ТОЛЬКО новые товары (которых еще нет в своде)
 * 3. Для существующих строк - обновляем только данные из источников
 *    (orderQty, productionInQty, supplierCols, supplierValues)
 * 4. Ручные правки пользователя (weightToShip, qtyToShip, openingStock с флагом manual, и т.д.) остаются неизменными
 * 
 * ОПТИМИЗИРОВАНО: Используем batch UPDATE с CASE/WHEN вместо отдельных запросов
 */
export const refreshSvod = async (req: Request, res: Response) => {
    try {
        const svodId = Number(req.params.id);
        const username = (req as any).user?.username || 'system';

        console.time('refreshSvod:initialFetch');
        // ОПТИМИЗАЦИЯ: Минимальный набор полей для существующих строк
        const svod = await prisma.svodHeader.findUnique({
            where: { id: svodId },
            include: {
                lines: {
                    select: {
                        id: true,
                        productId: true,
                        openingStockIsManual: true,
                        sortOrder: true
                    }
                }
            }
        });
        console.timeEnd('refreshSvod:initialFetch');

        if (!svod) {
            return res.status(404).json({ error: 'Svod not found' });
        }

        console.time('refreshSvod:buildPreview');
        // Формируем свежие данные из источников
        const freshData = await buildSvodPreview(svod.svodDate);
        console.timeEnd('refreshSvod:buildPreview');

        // Создаём Map существующих позиций по productId
        const existingLinesMap = new Map<number, typeof svod.lines[0]>();
        for (const line of svod.lines) {
            existingLinesMap.set(line.productId, line);
        }

        // Создаём Map свежих данных по productId
        const freshLinesMap = new Map<number, typeof freshData.lines[0]>();
        for (const line of freshData.lines) {
            freshLinesMap.set(line.productId, line);
        }

        const addedProducts: number[] = [];
        const updatedProducts: number[] = [];

        console.time('refreshSvod:transaction');
        await prisma.$transaction(async (tx) => {
            // 1. ОПТИМИЗАЦИЯ: Собираем данные для batch update
            const linesToUpdate: {
                id: number;
                orderQty: number;
                productionInQty: number;
                coefficient: number;
                category: string;
                shortName: string;
                openingStock: number | null;
            }[] = [];

            for (const existingLine of svod.lines) {
                const freshLine = freshLinesMap.get(existingLine.productId);
                if (freshLine) {
                    updatedProducts.push(existingLine.productId);
                    linesToUpdate.push({
                        id: existingLine.id,
                        orderQty: freshLine.orderQty,
                        productionInQty: freshLine.productionInQty,
                        coefficient: freshLine.coefficient ?? 1,
                        category: freshLine.category || 'Без категории',
                        shortName: freshLine.shortName || '',
                        openingStock: existingLine.openingStockIsManual ? null : freshLine.openingStock
                    });
                }
            }

            // ОПТИМИЗАЦИЯ: Один batch UPDATE через UNNEST (PostgreSQL)
            if (linesToUpdate.length > 0) {
                const ids = linesToUpdate.map(l => l.id);
                const orderQtys = linesToUpdate.map(l => l.orderQty);
                const productionInQtys = linesToUpdate.map(l => l.productionInQty);
                const coefficients = linesToUpdate.map(l => l.coefficient);
                const categories = linesToUpdate.map(l => l.category);
                const shortNames = linesToUpdate.map(l => l.shortName);
                const openingStocks = linesToUpdate.map(l => l.openingStock);

                await tx.$executeRaw`
                    UPDATE "SvodLine" AS sl SET
                        "orderQty" = v.order_qty,
                        "productionInQty" = v.production_in_qty,
                        "coefficient" = v.coefficient,
                        "category" = v.category,
                        "shortName" = v.short_name,
                        "openingStock" = COALESCE(v.opening_stock, sl."openingStock"),
                        "updatedAt" = NOW()
                    FROM (
                        SELECT 
                            UNNEST(${ids}::int[]) AS id,
                            UNNEST(${orderQtys}::decimal[]) AS order_qty,
                            UNNEST(${productionInQtys}::decimal[]) AS production_in_qty,
                            UNNEST(${coefficients}::decimal[]) AS coefficient,
                            UNNEST(${categories}::text[]) AS category,
                            UNNEST(${shortNames}::text[]) AS short_name,
                            UNNEST(${openingStocks}::decimal[]) AS opening_stock
                    ) AS v
                    WHERE sl."id" = v.id
                `;
            }

            // 2. Добавляем новые товары БАТЧЕМ
            const maxSortOrder = svod.lines.length > 0
                ? Math.max(...svod.lines.map(l => l.sortOrder || 0))
                : 0;

            const newLines = freshData.lines
                .filter(freshLine => !existingLinesMap.has(freshLine.productId))
                .map((freshLine, index) => {
                    addedProducts.push(freshLine.productId);
                    return {
                        svodId,
                        productId: freshLine.productId,
                        shortName: freshLine.shortName,
                        category: freshLine.category,
                        coefficient: freshLine.coefficient,
                        orderQty: freshLine.orderQty,
                        productionInQty: freshLine.productionInQty,
                        openingStock: freshLine.openingStock,
                        openingStockIsManual: false,
                        afterPurchaseStock: null,
                        qtyToShip: null,
                        factMinusWaste: null,
                        weightToShip: null,
                        planFactDiff: null,
                        underOver: null,
                        sortOrder: maxSortOrder + index + 1
                    };
                });

            if (newLines.length > 0) {
                await tx.svodLine.createMany({ data: newLines });
            }

            // 3. Обновляем колонки поставщиков (полностью заменяем)
            await tx.svodSupplierCol.deleteMany({ where: { svodId } });
            if (freshData.supplierCols.length > 0) {
                await tx.svodSupplierCol.createMany({
                    data: freshData.supplierCols.map((col: any) => ({
                        svodId,
                        colIndex: col.colIndex,
                        supplierId: col.supplierId,
                        supplierName: col.supplierName,
                        totalPurchase: col.totalPurchase || 0
                    }))
                });
            }

            // 4. Обновляем значения поставщиков (полностью заменяем)
            await tx.svodSupplierValue.deleteMany({ where: { svodId } });
            if (freshData.supplierValues.length > 0) {
                await tx.svodSupplierValue.createMany({
                    data: freshData.supplierValues.map((val: any) => ({
                        svodId,
                        productId: val.productId,
                        supplierId: val.supplierId,
                        purchaseQty: val.purchaseQty || 0
                    }))
                });
            }

            // 5. Обновляем заголовок свода
            await tx.svodHeader.update({
                where: { id: svodId },
                data: { updatedBy: username }
            });
        }, {
            timeout: 30000,  // 30 секунд (уменьшили, т.к. теперь быстрее)
            maxWait: 5000
        });
        console.timeEnd('refreshSvod:transaction');

        // ОПТИМИЗАЦИЯ: Возвращаем только изменённые/добавленные строки вместо полной перезагрузки
        // Клиент инкрементально обновит state

        console.time('refreshSvod:fetchChanges');

        // Получаем только новые строки (если были добавлены) с product info
        let addedLinesData: any[] = [];
        if (addedProducts.length > 0) {
            addedLinesData = await prisma.svodLine.findMany({
                where: {
                    svodId,
                    productId: { in: addedProducts }
                },
                include: {
                    product: { select: { id: true, code: true, name: true, priceListName: true, category: true, coefficient: true } }
                }
            });
        }

        // Получаем обновлённые данные для уже существующих строк (только изменённые поля)
        let updatedLinesData: any[] = [];
        if (updatedProducts.length > 0) {
            updatedLinesData = await prisma.svodLine.findMany({
                where: {
                    svodId,
                    productId: { in: updatedProducts }
                },
                select: {
                    id: true,
                    productId: true,
                    orderQty: true,
                    productionInQty: true,
                    openingStock: true,
                    coefficient: true,
                    category: true,
                    shortName: true
                }
            });
        }

        console.timeEnd('refreshSvod:fetchChanges');

        res.json({
            mode: 'saved',
            // Не возвращаем полный svod - клиент обновит инкрементально
            svodId,
            svodDate: svod.svodDate,
            // Новые строки (полные данные с product)
            addedLines: addedLinesData,
            // Обновлённые строки (только изменённые поля)
            updatedLines: updatedLinesData,
            // Новые данные поставщиков (всегда полностью заменяются)
            supplierCols: freshData.supplierCols,
            supplierValues: freshData.supplierValues,
            // Статистика
            addedProducts: addedProducts.length,
            updatedProducts: updatedProducts.length
        });
    } catch (error: any) {
        console.error('refreshSvod error:', error?.message || error);
        console.error('Stack:', error?.stack);
        res.status(500).json({ error: 'Failed to refresh svod', details: error?.message });
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

        // Ищем текущую версию MML для этого товара (MAX version, not deleted)
        const mml = await prisma.productionMml.findFirst({
            where: { productId, isDeleted: false },
            orderBy: { version: 'desc' },
            include: {
                product: {
                    select: { id: true, name: true, code: true, category: true }
                },
                nodes: {
                    where: { parentNodeId: null, isActive: true },  // Только корневые активные узлы
                    orderBy: { sortOrder: 'asc' },
                    include: {
                        product: {
                            select: { id: true, name: true, code: true }
                        },
                        children: {
                            where: { isActive: true },
                            orderBy: { sortOrder: 'asc' },
                            include: {
                                product: {
                                    select: { id: true, name: true, code: true }
                                },
                                children: {
                                    where: { isActive: true },
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

        const mmlData = mml as any;
        res.json({
            mml: {
                id: mml.id,
                productId: mml.productId,
                productName: mmlData.product?.name,
                isLocked: mml.isLocked
            },
            nodes: flattenNodes(mmlData.nodes)
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
        const { plannedWeight, distributions, deletedProductIds, addMissingProducts, sourceProductId, sourceProductName } = req.body;

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

            // *** ОБРАБОТКА УДАЛЁННЫХ СВЯЗЕЙ ***
            if (deletedProductIds && Array.isArray(deletedProductIds) && deletedProductIds.length > 0) {
                // Находим строки по productId и снимаем с них маркировку
                for (const deletedProductId of deletedProductIds) {
                    await tx.svodLine.updateMany({
                        where: {
                            svodId,
                            productId: deletedProductId,
                            distributedFromLineId: lineId
                        },
                        data: {
                            weightToShip: null,
                            distributedFromLineId: null,
                            distributedFromName: null
                        }
                    });
                }
            }

            // *** ОЧИСТКА СТАРЫХ РАСПРЕДЕЛЕНИЙ (только для товаров которые НЕ в новом списке) ***
            // Находим все строки которые ранее были распределены от этого источника
            const oldDistributedLines = await tx.svodLine.findMany({
                where: {
                    svodId,
                    distributedFromLineId: lineId
                }
            });

            // Обнуляем у них weightToShip и снимаем маркировку, ТОЛЬКО если их нет в новых распределениях
            const newProductIds = new Set(validDistributions.map((d: any) => d.productId));
            for (const oldLine of oldDistributedLines) {
                if (!newProductIds.has(oldLine.productId)) {
                    await tx.svodLine.update({
                        where: { id: oldLine.id },
                        data: {
                            weightToShip: null,
                            distributedFromLineId: null,
                            distributedFromName: null
                        }
                    });
                }
            }

            // Обновляем родительскую позицию
            // Если есть распределения - помечаем как источник, иначе - снимаем метку
            const isStillSource = validDistributions.length > 0;
            await tx.svodLine.update({
                where: { id: lineId },
                data: {
                    weightToShip: null,
                    isDistributionSource: isStillSource
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
