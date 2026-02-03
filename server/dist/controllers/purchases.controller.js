"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLastPrice = exports.getSupplierMml = exports.deletePurchase = exports.disablePurchases = exports.updatePurchase = exports.createPurchase = exports.getPurchaseById = exports.getPurchases = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// ============================================
// ЖУРНАЛ ЗАКУПОК
// ============================================
/**
 * Получить список закупок (журнал) с фильтрацией
 */
const getPurchases = async (req, res) => {
    try {
        const { dateFrom, dateTo, includeDisabled } = req.query;
        const where = {};
        // По умолчанию не показываем отключенные
        if (includeDisabled !== 'true') {
            where.isDisabled = false;
        }
        // Фильтрация по датам
        if (dateFrom || dateTo) {
            where.purchaseDate = {};
            if (dateFrom) {
                where.purchaseDate.gte = new Date(dateFrom);
            }
            if (dateTo) {
                // Добавляем 1 день для включения конечной даты
                const toDate = new Date(dateTo);
                toDate.setDate(toDate.getDate() + 1);
                where.purchaseDate.lt = toDate;
            }
        }
        const purchases = await prisma.purchase.findMany({
            where,
            include: {
                createdByUser: {
                    select: { id: true, name: true, username: true }
                },
                suppliers: {
                    include: {
                        supplier: {
                            select: { id: true, code: true, name: true }
                        }
                    }
                },
                items: {
                    include: {
                        paymentType: true
                    }
                }
            },
            orderBy: { purchaseDate: 'desc' }
        });
        // Формируем ответ с агрегированными данными
        const result = purchases.map(p => {
            // Определяем тип оплаты (если все одинаковы - показать его, иначе "Смешанный")
            const paymentTypes = [...new Set(p.items.map(i => i.paymentType?.name).filter(Boolean))];
            const paymentTypeSummary = paymentTypes.length === 1
                ? paymentTypes[0]
                : paymentTypes.length > 1 ? 'Смешанный' : '—';
            // Названия поставщиков
            const supplierNames = p.suppliers.map(s => s.supplier.name);
            const supplierSummary = supplierNames.length === 1
                ? supplierNames[0]
                : supplierNames.length > 1 ? `Несколько (${supplierNames.length})` : '—';
            return {
                id: p.id,
                purchaseDate: p.purchaseDate,
                totalAmount: p.totalAmount,
                createdByUser: p.createdByUser,
                isDisabled: p.isDisabled,
                supplierSummary,
                supplierNames,
                paymentTypeSummary,
                suppliersCount: p.suppliers.length,
                itemsCount: p.items.length,
                createdAt: p.createdAt
            };
        });
        res.json(result);
    }
    catch (error) {
        console.error('getPurchases error:', error);
        res.status(500).json({ error: 'Failed to fetch purchases' });
    }
};
exports.getPurchases = getPurchases;
/**
 * Получить закупку по ID с полными данными
 */
const getPurchaseById = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const purchase = await prisma.purchase.findUnique({
            where: { id },
            include: {
                createdByUser: {
                    select: { id: true, name: true, username: true }
                },
                suppliers: {
                    include: {
                        supplier: {
                            select: { id: true, code: true, name: true }
                        }
                    }
                },
                items: {
                    include: {
                        product: {
                            select: { id: true, code: true, name: true, priceListName: true }
                        },
                        supplier: {
                            select: { id: true, code: true, name: true }
                        },
                        paymentType: true
                    },
                    orderBy: [{ supplierId: 'asc' }, { id: 'asc' }]
                }
            }
        });
        if (!purchase) {
            return res.status(404).json({ error: 'Purchase not found' });
        }
        res.json(purchase);
    }
    catch (error) {
        console.error('getPurchaseById error:', error);
        res.status(500).json({ error: 'Failed to fetch purchase' });
    }
};
exports.getPurchaseById = getPurchaseById;
/**
 * Создать новую закупку
 */
const createPurchase = async (req, res) => {
    try {
        const { purchaseDate, suppliers, items } = req.body;
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        // Валидация
        if (!purchaseDate) {
            return res.status(400).json({ error: 'purchaseDate is required' });
        }
        if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
            return res.status(400).json({ error: 'At least one supplier is required' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'At least one item is required' });
        }
        // Проверка что каждый item имеет qty > 0
        for (const item of items) {
            if (!item.qty || Number(item.qty) <= 0) {
                return res.status(400).json({ error: 'Each item must have qty > 0' });
            }
        }
        // Расчёт общей суммы
        const totalAmount = items.reduce((sum, item) => {
            const price = Number(item.price) || 0;
            const qty = Number(item.qty) || 0;
            return sum + (price * qty);
        }, 0);
        // Создание закупки в транзакции
        const purchase = await prisma.$transaction(async (tx) => {
            // 1. Создать шапку закупки
            // Нормализуем дату к UTC полночи для корректного сравнения в своде
            const normalizedDate = new Date(purchaseDate);
            normalizedDate.setUTCHours(0, 0, 0, 0);
            // Генерация IDN: код_первого_поставщика + дата ДДММГГГГ
            let idn = null;
            if (suppliers.length > 0) {
                const firstSupplier = await tx.supplier.findUnique({
                    where: { id: Number(suppliers[0]) },
                    select: { code: true }
                });
                if (firstSupplier) {
                    const day = String(normalizedDate.getUTCDate()).padStart(2, '0');
                    const month = String(normalizedDate.getUTCMonth() + 1).padStart(2, '0');
                    const year = normalizedDate.getUTCFullYear();
                    idn = `${firstSupplier.code}${day}${month}${year}`;
                }
            }
            const newPurchase = await tx.purchase.create({
                data: {
                    idn,
                    purchaseDate: normalizedDate,
                    totalAmount,
                    createdByUserId: userId
                }
            });
            // 2. Добавить поставщиков
            for (const supplierId of suppliers) {
                await tx.purchaseSupplier.create({
                    data: {
                        purchaseId: newPurchase.id,
                        supplierId: Number(supplierId)
                    }
                });
            }
            // 3. Добавить строки товаров
            for (const item of items) {
                const price = Number(item.price) || 0;
                const qty = Number(item.qty) || 0;
                const amount = price * qty;
                await tx.purchaseItem.create({
                    data: {
                        purchaseId: newPurchase.id,
                        supplierId: Number(item.supplierId),
                        productId: Number(item.productId),
                        price,
                        qty,
                        amount,
                        paymentTypeId: item.paymentTypeId ? Number(item.paymentTypeId) : null
                    }
                });
            }
            return newPurchase;
        });
        // Вернуть полную закупку (с защитой от ошибки если пользователь удалён)
        let fullPurchase;
        try {
            fullPurchase = await prisma.purchase.findUnique({
                where: { id: purchase.id },
                include: {
                    createdByUser: { select: { id: true, name: true, username: true } },
                    suppliers: { include: { supplier: true } },
                    items: { include: { product: true, supplier: true, paymentType: true } }
                }
            });
        }
        catch (includeError) {
            // Если ошибка с createdByUser — просто вернём purchase без include
            fullPurchase = await prisma.purchase.findUnique({
                where: { id: purchase.id },
                include: {
                    suppliers: { include: { supplier: true } },
                    items: { include: { product: true, supplier: true, paymentType: true } }
                }
            });
        }
        res.status(201).json(fullPurchase);
    }
    catch (error) {
        console.error('createPurchase error:', error);
        res.status(500).json({ error: 'Failed to create purchase' });
    }
};
exports.createPurchase = createPurchase;
/**
 * Обновить закупку
 */
const updatePurchase = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { purchaseDate, suppliers, items } = req.body;
        const existing = await prisma.purchase.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Purchase not found' });
        }
        // Расчёт общей суммы
        const totalAmount = items?.reduce((sum, item) => {
            const price = Number(item.price) || 0;
            const qty = Number(item.qty) || 0;
            return sum + (price * qty);
        }, 0) || 0;
        // Обновление в транзакции
        await prisma.$transaction(async (tx) => {
            // 1. Обновить шапку
            // Нормализуем дату к UTC полночи для корректного сравнения в своде
            let normalizedDate;
            if (purchaseDate) {
                normalizedDate = new Date(purchaseDate);
                normalizedDate.setUTCHours(0, 0, 0, 0);
            }
            await tx.purchase.update({
                where: { id },
                data: {
                    purchaseDate: normalizedDate,
                    totalAmount
                }
            });
            // 2. Пересоздать поставщиков
            if (suppliers) {
                await tx.purchaseSupplier.deleteMany({ where: { purchaseId: id } });
                for (const supplierId of suppliers) {
                    await tx.purchaseSupplier.create({
                        data: {
                            purchaseId: id,
                            supplierId: Number(supplierId)
                        }
                    });
                }
            }
            // 3. Пересоздать строки товаров
            if (items) {
                await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
                for (const item of items) {
                    const price = Number(item.price) || 0;
                    const qty = Number(item.qty) || 0;
                    const amount = price * qty;
                    await tx.purchaseItem.create({
                        data: {
                            purchaseId: id,
                            supplierId: Number(item.supplierId),
                            productId: Number(item.productId),
                            price,
                            qty,
                            amount,
                            paymentTypeId: item.paymentTypeId ? Number(item.paymentTypeId) : null
                        }
                    });
                }
            }
        });
        // Вернуть обновлённую закупку
        const fullPurchase = await prisma.purchase.findUnique({
            where: { id },
            include: {
                createdByUser: { select: { id: true, name: true, username: true } },
                suppliers: { include: { supplier: true } },
                items: { include: { product: true, supplier: true, paymentType: true } }
            }
        });
        res.json(fullPurchase);
    }
    catch (error) {
        console.error('updatePurchase error:', error);
        res.status(500).json({ error: 'Failed to update purchase' });
    }
};
exports.updatePurchase = updatePurchase;
/**
 * Отключить закупки (массовое скрытие)
 */
const disablePurchases = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'ids array is required' });
        }
        await prisma.purchase.updateMany({
            where: { id: { in: ids.map(Number) } },
            data: { isDisabled: true }
        });
        res.json({ success: true, disabledCount: ids.length });
    }
    catch (error) {
        console.error('disablePurchases error:', error);
        res.status(500).json({ error: 'Failed to disable purchases' });
    }
};
exports.disablePurchases = disablePurchases;
/**
 * Удалить закупку
 */
const deletePurchase = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const existing = await prisma.purchase.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Purchase not found' });
        }
        // Каскадное удаление настроено в схеме
        await prisma.purchase.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (error) {
        console.error('deletePurchase error:', error);
        res.status(500).json({ error: 'Failed to delete purchase' });
    }
};
exports.deletePurchase = deletePurchase;
// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
/**
 * Получить MML (список товаров) поставщика из закупочного прайса
 */
const getSupplierMml = async (req, res) => {
    try {
        const supplierId = Number(req.params.supplierId);
        const { purchaseDate } = req.query;
        // Найти последний активный закупочный прайс-лист для поставщика
        const priceListSupplier = await prisma.purchasePriceListSupplier.findFirst({
            where: {
                supplierId,
                priceList: {
                    isActive: true
                }
            },
            include: {
                priceList: true
            },
            orderBy: {
                priceList: {
                    date: 'desc'
                }
            }
        });
        if (!priceListSupplier) {
            return res.json({ items: [], message: 'No price list found for this supplier' });
        }
        // Получить товары из этого прайс-листа для данного поставщика
        const priceItems = await prisma.purchasePriceItem.findMany({
            where: {
                priceListId: priceListSupplier.priceListId,
                supplierId
            },
            include: {
                product: {
                    select: { id: true, code: true, name: true, priceListName: true }
                }
            },
            orderBy: {
                product: { name: 'asc' }
            }
        });
        res.json({
            priceListId: priceListSupplier.priceListId,
            priceListName: priceListSupplier.priceList.name,
            effectiveDate: priceListSupplier.priceList.date,
            items: priceItems.map(pi => ({
                productId: pi.productId,
                product: pi.product,
                price: pi.purchasePrice
            }))
        });
    }
    catch (error) {
        console.error('getSupplierMml error:', error);
        res.status(500).json({ error: 'Failed to fetch supplier MML' });
    }
};
exports.getSupplierMml = getSupplierMml;
/**
 * Получить последнюю цену товара для поставщика
 */
const getLastPrice = async (req, res) => {
    try {
        const supplierId = Number(req.params.supplierId);
        const productId = Number(req.params.productId);
        const { purchaseDate } = req.query;
        const targetDate = purchaseDate ? new Date(purchaseDate) : new Date();
        // Ищем последнюю цену из закупочного прайса с датой <= targetDate
        let priceItem = await prisma.purchasePriceItem.findFirst({
            where: {
                supplierId,
                productId,
                priceList: {
                    isActive: true,
                    date: { lte: targetDate }
                }
            },
            include: {
                priceList: true
            },
            orderBy: {
                priceList: {
                    date: 'desc'
                }
            }
        });
        // Если не найдено - ищем последнюю вообще
        if (!priceItem) {
            priceItem = await prisma.purchasePriceItem.findFirst({
                where: {
                    supplierId,
                    productId,
                    priceList: {
                        isActive: true
                    }
                },
                include: {
                    priceList: true
                },
                orderBy: {
                    priceList: {
                        date: 'desc'
                    }
                }
            });
        }
        if (!priceItem) {
            return res.json({ price: null, source: null });
        }
        res.json({
            price: priceItem.purchasePrice,
            source: {
                priceListId: priceItem.priceListId,
                priceListName: priceItem.priceList.name,
                effectiveDate: priceItem.priceList.date
            }
        });
    }
    catch (error) {
        console.error('getLastPrice error:', error);
        res.status(500).json({ error: 'Failed to fetch last price' });
    }
};
exports.getLastPrice = getLastPrice;
