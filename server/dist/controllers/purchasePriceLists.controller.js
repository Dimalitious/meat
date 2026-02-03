"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivePurchasePrice = exports.deactivatePurchasePriceLists = exports.updatePurchasePriceList = exports.createPurchasePriceList = exports.getPurchasePriceList = exports.getLastPriceListTemplate = exports.getPurchasePriceLists = void 0;
const db_1 = require("../db");
// Получить журнал прайс-листов с фильтрацией по датам
const getPurchasePriceLists = async (req, res) => {
    try {
        const { dateFrom, dateTo } = req.query;
        let where = {};
        if (dateFrom || dateTo) {
            where.date = {};
            if (dateFrom) {
                where.date.gte = new Date(String(dateFrom));
            }
            if (dateTo) {
                // Добавляем 1 день чтобы включить конечную дату
                const endDate = new Date(String(dateTo));
                endDate.setDate(endDate.getDate() + 1);
                where.date.lt = endDate;
            }
        }
        const priceLists = await db_1.prisma.purchasePriceList.findMany({
            where,
            include: {
                suppliers: {
                    include: {
                        supplier: true
                    }
                },
                _count: {
                    select: { items: true }
                }
            },
            orderBy: { date: 'desc' }
        });
        // Трансформируем для фронтенда
        const result = priceLists.map(pl => ({
            id: pl.id,
            date: pl.date,
            name: pl.name,
            isActive: pl.isActive,
            createdAt: pl.createdAt,
            createdBy: pl.createdBy,
            suppliersCount: pl.suppliers.length,
            itemsCount: pl._count.items,
            supplierNames: pl.suppliers.map(s => s.supplier.name).join(', ')
        }));
        res.json(result);
    }
    catch (error) {
        console.error('Get purchase price lists error:', error);
        res.status(500).json({ error: 'Failed to fetch purchase price lists' });
    }
};
exports.getPurchasePriceLists = getPurchasePriceLists;
// Получить шаблон из последнего активного прайса для создания нового
const getLastPriceListTemplate = async (req, res) => {
    try {
        // Найти последний активный закупочный прайс
        const lastPriceList = await db_1.prisma.purchasePriceList.findFirst({
            where: { isActive: true },
            orderBy: { date: 'desc' },
            include: {
                suppliers: {
                    include: {
                        supplier: {
                            select: { id: true, code: true, name: true, isActive: true }
                        },
                        primaryMml: {
                            select: {
                                id: true,
                                productId: true,
                                product: {
                                    select: { id: true, name: true, code: true }
                                }
                            }
                        }
                    }
                },
                items: {
                    include: {
                        product: {
                            select: { id: true, code: true, name: true, unit: true }
                        },
                        supplier: {
                            select: { id: true, code: true, name: true }
                        }
                    }
                }
            }
        });
        if (!lastPriceList) {
            return res.json({
                hasTemplate: false,
                message: 'Нет предыдущих прайсов'
            });
        }
        // Группируем товары по поставщикам
        const supplierItems = {};
        for (const item of lastPriceList.items) {
            if (!supplierItems[item.supplierId]) {
                supplierItems[item.supplierId] = [];
            }
            supplierItems[item.supplierId].push({
                productId: item.productId,
                product: item.product,
                purchasePrice: item.purchasePrice // Копируем последнюю цену как базу
            });
        }
        // Формируем структуру шаблона
        const template = {
            hasTemplate: true,
            sourceId: lastPriceList.id,
            sourceDate: lastPriceList.date,
            sourceName: lastPriceList.name,
            suppliers: lastPriceList.suppliers.map(s => ({
                supplierId: s.supplierId,
                supplier: s.supplier,
                primaryMmlId: s.primaryMmlId,
                primaryMml: s.primaryMml,
                items: supplierItems[s.supplierId] || []
            }))
        };
        console.log('[getLastPriceListTemplate] Template from price list:', lastPriceList.id, 'suppliers:', template.suppliers.length, 'total items:', lastPriceList.items.length);
        res.json(template);
    }
    catch (error) {
        console.error('Get last price list template error:', error);
        res.status(500).json({ error: 'Failed to fetch template' });
    }
};
exports.getLastPriceListTemplate = getLastPriceListTemplate;
// Получить один прайс-лист со всеми деталями
const getPurchasePriceList = async (req, res) => {
    try {
        const { id } = req.params;
        const priceList = await db_1.prisma.purchasePriceList.findUnique({
            where: { id: Number(id) },
            include: {
                suppliers: {
                    include: {
                        supplier: true,
                        primaryMml: {
                            select: {
                                id: true,
                                productId: true,
                                product: {
                                    select: { id: true, name: true, code: true }
                                }
                            }
                        }
                    }
                },
                items: {
                    include: {
                        product: true,
                        supplier: true
                    }
                }
            }
        });
        if (!priceList) {
            return res.status(404).json({ error: 'Price list not found' });
        }
        res.json(priceList);
    }
    catch (error) {
        console.error('Get purchase price list error:', error);
        res.status(500).json({ error: 'Failed to fetch purchase price list' });
    }
};
exports.getPurchasePriceList = getPurchasePriceList;
// Создать новый закупочный прайс
const createPurchasePriceList = async (req, res) => {
    try {
        const { date, name, suppliers } = req.body;
        if (!date) {
            return res.status(400).json({ error: 'Дата прайса обязательна' });
        }
        if (!suppliers || suppliers.length === 0) {
            return res.status(400).json({ error: 'Необходимо добавить хотя бы одного поставщика' });
        }
        // Проверяем что у каждого поставщика есть товары
        for (const s of suppliers) {
            if (!s.items || s.items.length === 0) {
                const supplier = await db_1.prisma.supplier.findUnique({ where: { id: s.supplierId } });
                return res.status(400).json({
                    error: `Поставщик "${supplier?.name || s.supplierId}" не имеет товаров`
                });
            }
        }
        // Создаём прайс-лист с поставщиками и товарами в транзакции
        const priceList = await db_1.prisma.$transaction(async (tx) => {
            // Создаём шапку прайса
            const pl = await tx.purchasePriceList.create({
                data: {
                    date: new Date(date),
                    name: name || null,
                    createdBy: req.user?.username || 'system',
                    isActive: true
                }
            });
            // Предупреждения о поставщиках без MML
            const warnings = [];
            // Добавляем поставщиков и их товары
            for (const s of suppliers) {
                // Получаем поставщика с его первичным MML
                const supplierData = await tx.supplier.findUnique({
                    where: { id: s.supplierId },
                    select: { id: true, name: true, primaryMmlId: true }
                });
                // Фиксируем первичный MML поставщика на момент создания прайса
                const frozenMmlId = supplierData?.primaryMmlId || null;
                if (!frozenMmlId) {
                    warnings.push(`У поставщика "${supplierData?.name || s.supplierId}" не назначен первичный MML`);
                }
                // Связь прайса с поставщиком + зафиксированный MML
                await tx.purchasePriceListSupplier.create({
                    data: {
                        priceListId: pl.id,
                        supplierId: s.supplierId,
                        primaryMmlId: frozenMmlId // Фиксируем MML на момент создания
                    }
                });
                // Добавляем товары поставщика
                for (const item of s.items) {
                    await tx.purchasePriceItem.create({
                        data: {
                            priceListId: pl.id,
                            supplierId: s.supplierId,
                            productId: item.productId,
                            purchasePrice: item.purchasePrice
                        }
                    });
                }
            }
            // Логируем предупреждения
            if (warnings.length > 0) {
                console.warn('[createPurchasePriceList] Warnings:', warnings);
            }
            return { priceList: pl, warnings };
        });
        res.status(201).json({
            success: true,
            id: priceList.priceList.id,
            message: 'Закупочный прайс успешно создан',
            warnings: priceList.warnings.length > 0 ? priceList.warnings : undefined
        });
    }
    catch (error) {
        console.error('Create purchase price list error:', error);
        res.status(400).json({ error: 'Не удалось создать прайс: ' + (error.message || '') });
    }
};
exports.createPurchasePriceList = createPurchasePriceList;
// Обновить закупочный прайс
const updatePurchasePriceList = async (req, res) => {
    try {
        const { id } = req.params;
        const { date, name, suppliers } = req.body;
        const priceListId = Number(id);
        // Проверяем существование
        const existing = await db_1.prisma.purchasePriceList.findUnique({
            where: { id: priceListId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Прайс-лист не найден' });
        }
        // Обновляем в транзакции
        await db_1.prisma.$transaction(async (tx) => {
            // Обновляем шапку
            await tx.purchasePriceList.update({
                where: { id: priceListId },
                data: {
                    date: new Date(date),
                    name: name || null,
                    updatedBy: req.user?.username || 'system'
                }
            });
            // Удаляем старые связи (каскадно удалятся и items)
            await tx.purchasePriceListSupplier.deleteMany({
                where: { priceListId }
            });
            await tx.purchasePriceItem.deleteMany({
                where: { priceListId }
            });
            // Добавляем новые
            for (const s of suppliers) {
                // Получаем поставщика с его первичным MML
                const supplierData = await tx.supplier.findUnique({
                    where: { id: s.supplierId },
                    select: { id: true, primaryMmlId: true }
                });
                // Фиксируем первичный MML поставщика
                const frozenMmlId = supplierData?.primaryMmlId || null;
                await tx.purchasePriceListSupplier.create({
                    data: {
                        priceListId,
                        supplierId: s.supplierId,
                        primaryMmlId: frozenMmlId // Фиксируем MML
                    }
                });
                for (const item of s.items) {
                    await tx.purchasePriceItem.create({
                        data: {
                            priceListId,
                            supplierId: s.supplierId,
                            productId: item.productId,
                            purchasePrice: item.purchasePrice
                        }
                    });
                }
            }
        });
        res.json({ success: true, message: 'Прайс-лист обновлён' });
    }
    catch (error) {
        console.error('Update purchase price list error:', error);
        res.status(400).json({ error: 'Не удалось обновить прайс: ' + (error.message || '') });
    }
};
exports.updatePurchasePriceList = updatePurchasePriceList;
// Отключить прайс-листы (массовое действие)
const deactivatePurchasePriceLists = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || ids.length === 0) {
            return res.status(400).json({ error: 'Не выбраны прайс-листы' });
        }
        await db_1.prisma.purchasePriceList.updateMany({
            where: { id: { in: ids } },
            data: { isActive: false }
        });
        res.json({
            success: true,
            message: `Отключено прайс-листов: ${ids.length}`
        });
    }
    catch (error) {
        console.error('Deactivate price lists error:', error);
        res.status(400).json({ error: 'Не удалось отключить прайс-листы' });
    }
};
exports.deactivatePurchasePriceLists = deactivatePurchasePriceLists;
// Получить актуальную закупочную цену товара по поставщику
const getActivePurchasePrice = async (req, res) => {
    try {
        const { productId, supplierId, asOfDate } = req.query;
        if (!productId || !supplierId) {
            return res.status(400).json({ error: 'productId и supplierId обязательны' });
        }
        const dateToCheck = asOfDate ? new Date(String(asOfDate)) : new Date();
        // Ищем последний активный прайс с датой <= указанной даты
        const priceItem = await db_1.prisma.purchasePriceItem.findFirst({
            where: {
                productId: Number(productId),
                supplierId: Number(supplierId),
                priceList: {
                    isActive: true,
                    date: { lte: dateToCheck }
                }
            },
            include: {
                priceList: true
            },
            orderBy: {
                priceList: { date: 'desc' }
            }
        });
        if (!priceItem) {
            return res.json({ price: null, message: 'Цена не найдена' });
        }
        res.json({
            price: priceItem.purchasePrice,
            priceListId: priceItem.priceListId,
            priceListDate: priceItem.priceList.date
        });
    }
    catch (error) {
        console.error('Get active purchase price error:', error);
        res.status(500).json({ error: 'Failed to get purchase price' });
    }
};
exports.getActivePurchasePrice = getActivePurchasePrice;
