"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPurchasePricesForProduct = exports.resolveAllPricesForCustomer = exports.resolveSalePrice = exports.hideSalesPriceLists = exports.saveSalesPrice = exports.createSalesPrice = exports.getSalesPriceById = exports.getCurrentCustomerPrice = exports.getCurrentGeneralPrice = exports.getSalesPriceLists = exports.savePurchasePrice = exports.createPurchasePrice = exports.getPurchasePriceById = exports.getCurrentPurchasePrice = exports.getPurchasePriceLists = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// ============================================
// ЗАКУПОЧНЫЙ ПРАЙС
// ============================================
// Получить список закупочных прайсов (журнал)
const getPurchasePriceLists = async (req, res) => {
    try {
        const { dateFrom, dateTo, supplierId } = req.query;
        const where = {};
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom)
                where.createdAt.gte = new Date(dateFrom);
            if (dateTo)
                where.createdAt.lte = new Date(dateTo);
        }
        if (supplierId) {
            where.supplierId = Number(supplierId);
        }
        const lists = await prisma.purchasePriceList.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                supplier: true,
                _count: { select: { items: true } }
            }
        });
        res.json(lists);
    }
    catch (error) {
        console.error('Get purchase price lists error:', error);
        res.status(500).json({ error: 'Failed to get purchase price lists' });
    }
};
exports.getPurchasePriceLists = getPurchasePriceLists;
// Получить текущий прайс поставщика
const getCurrentPurchasePrice = async (req, res) => {
    try {
        const supplierId = Number(req.params.supplierId);
        let priceList = await prisma.purchasePriceList.findFirst({
            where: { supplierId, isCurrent: true },
            include: {
                supplier: true,
                items: {
                    include: { product: true },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });
        res.json(priceList);
    }
    catch (error) {
        console.error('Get current purchase price error:', error);
        res.status(500).json({ error: 'Failed to get current purchase price' });
    }
};
exports.getCurrentPurchasePrice = getCurrentPurchasePrice;
// Получить прайс по ID
const getPurchasePriceById = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const priceList = await prisma.purchasePriceList.findUnique({
            where: { id },
            include: {
                supplier: true,
                items: {
                    include: { product: true },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });
        res.json(priceList);
    }
    catch (error) {
        console.error('Get purchase price by id error:', error);
        res.status(500).json({ error: 'Failed to get purchase price' });
    }
};
exports.getPurchasePriceById = getPurchasePriceById;
// Создать новый закупочный прайс
const createPurchasePrice = async (req, res) => {
    try {
        const { supplierId, title } = req.body;
        const user = req.user?.username || 'system';
        const priceList = await prisma.purchasePriceList.create({
            data: {
                supplierId,
                title,
                status: 'draft',
                createdBy: user,
                updatedBy: user
            },
            include: {
                supplier: true,
                items: { include: { product: true } }
            }
        });
        res.json(priceList);
    }
    catch (error) {
        console.error('Create purchase price error:', error);
        res.status(500).json({ error: 'Failed to create purchase price' });
    }
};
exports.createPurchasePrice = createPurchasePrice;
// Сохранить закупочный прайс
const savePurchasePrice = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { title, items, makeCurrent } = req.body;
        const user = req.user?.username || 'system';
        await prisma.$transaction(async (tx) => {
            // Если делаем текущим - снять флаг с других
            if (makeCurrent) {
                const current = await tx.purchasePriceList.findUnique({ where: { id } });
                if (current) {
                    await tx.purchasePriceList.updateMany({
                        where: { supplierId: current.supplierId, isCurrent: true },
                        data: { isCurrent: false }
                    });
                }
            }
            // Обновить шапку
            await tx.purchasePriceList.update({
                where: { id },
                data: {
                    title,
                    status: 'saved',
                    isCurrent: makeCurrent || false,
                    updatedBy: user
                }
            });
            // Пересоздать строки
            if (items && Array.isArray(items)) {
                await tx.purchasePriceItem.deleteMany({ where: { priceListId: id } });
                for (const item of items) {
                    await tx.purchasePriceItem.create({
                        data: {
                            priceListId: id,
                            productId: item.productId,
                            purchasePrice: item.purchasePrice,
                            rowDate: item.rowDate ? new Date(item.rowDate) : new Date(),
                            updatedBy: user
                        }
                    });
                }
            }
        });
        const updated = await prisma.purchasePriceList.findUnique({
            where: { id },
            include: {
                supplier: true,
                items: { include: { product: true } }
            }
        });
        res.json(updated);
    }
    catch (error) {
        console.error('Save purchase price error:', error);
        res.status(500).json({ error: 'Failed to save purchase price' });
    }
};
exports.savePurchasePrice = savePurchasePrice;
// ============================================
// ПРОДАЖНЫЙ ПРАЙС
// ============================================
// Получить список продажных прайсов (журнал)
const getSalesPriceLists = async (req, res) => {
    try {
        const { dateFrom, dateTo, listType, customerId, showHidden } = req.query;
        const where = {};
        // Фильтрация по дате вступления в силу (effectiveDate)
        if (dateFrom || dateTo) {
            where.effectiveDate = {};
            if (dateFrom)
                where.effectiveDate.gte = new Date(dateFrom);
            if (dateTo) {
                // Устанавливаем конец дня для корректной фильтрации
                const endDate = new Date(dateTo);
                endDate.setHours(23, 59, 59, 999);
                where.effectiveDate.lte = endDate;
            }
        }
        if (listType)
            where.listType = listType;
        if (customerId)
            where.customerId = Number(customerId);
        // По умолчанию скрытые прайсы не показываются
        if (showHidden !== 'true') {
            where.isHidden = false;
        }
        const lists = await prisma.salesPriceList.findMany({
            where,
            orderBy: { effectiveDate: 'desc' },
            include: {
                customer: true,
                _count: { select: { items: true } }
            }
        });
        res.json(lists);
    }
    catch (error) {
        console.error('Get sales price lists error:', error);
        res.status(500).json({ error: 'Failed to get sales price lists' });
    }
};
exports.getSalesPriceLists = getSalesPriceLists;
// Получить текущий общий прайс (самый актуальный по effectiveDate)
const getCurrentGeneralPrice = async (req, res) => {
    try {
        const now = new Date();
        const priceList = await prisma.salesPriceList.findFirst({
            where: {
                listType: 'GENERAL',
                isHidden: false,
                effectiveDate: { lte: now }
            },
            orderBy: [
                { effectiveDate: 'desc' },
                { createdAt: 'desc' }
            ],
            include: {
                items: {
                    include: { product: true },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });
        res.json(priceList);
    }
    catch (error) {
        console.error('Get current general price error:', error);
        res.status(500).json({ error: 'Failed to get current general price' });
    }
};
exports.getCurrentGeneralPrice = getCurrentGeneralPrice;
// Получить текущий прайс заказчика (самый актуальный по effectiveDate)
const getCurrentCustomerPrice = async (req, res) => {
    try {
        const customerId = Number(req.params.customerId);
        const now = new Date();
        const priceList = await prisma.salesPriceList.findFirst({
            where: {
                listType: 'CUSTOMER',
                customerId,
                isHidden: false,
                effectiveDate: { lte: now }
            },
            orderBy: [
                { effectiveDate: 'desc' },
                { createdAt: 'desc' }
            ],
            include: {
                customer: true,
                items: {
                    include: { product: true },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });
        res.json(priceList);
    }
    catch (error) {
        console.error('Get current customer price error:', error);
        res.status(500).json({ error: 'Failed to get current customer price' });
    }
};
exports.getCurrentCustomerPrice = getCurrentCustomerPrice;
// Получить прайс по ID
const getSalesPriceById = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const priceList = await prisma.salesPriceList.findUnique({
            where: { id },
            include: {
                customer: true,
                items: {
                    include: { product: true },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });
        res.json(priceList);
    }
    catch (error) {
        console.error('Get sales price by id error:', error);
        res.status(500).json({ error: 'Failed to get sales price' });
    }
};
exports.getSalesPriceById = getSalesPriceById;
// Создать новый продажный прайс или вернуть существующий (upsert-логика)
const createSalesPrice = async (req, res) => {
    try {
        const { listType, customerId, title, effectiveDate } = req.body;
        const user = req.user?.username || 'system';
        // Валидация
        if (listType === 'CUSTOMER' && !customerId) {
            return res.status(400).json({ error: 'Customer ID required for CUSTOMER price list' });
        }
        if (!effectiveDate) {
            return res.status(400).json({ error: 'Effective date is required' });
        }
        const parsedDate = new Date(effectiveDate);
        // Нормализуем дату до начала дня для точного сравнения
        const dateStart = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
        const dateEnd = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 23, 59, 59, 999);
        // Сначала ищем существующий прайс на эту дату
        const existingPriceList = await prisma.salesPriceList.findFirst({
            where: {
                listType,
                customerId: listType === 'CUSTOMER' ? customerId : null,
                effectiveDate: {
                    gte: dateStart,
                    lte: dateEnd
                },
                isHidden: false
            },
            orderBy: [
                { createdAt: 'desc' }
            ],
            include: {
                customer: true,
                items: {
                    include: { product: true },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });
        // Если нашли — возвращаем его
        if (existingPriceList) {
            return res.json(existingPriceList);
        }
        // Если не нашли — создаём новый
        const priceList = await prisma.salesPriceList.create({
            data: {
                listType,
                customerId: listType === 'CUSTOMER' ? customerId : null,
                title,
                effectiveDate: new Date(effectiveDate),
                status: 'draft',
                isHidden: false,
                createdBy: user,
                updatedBy: user
            },
            include: {
                customer: true,
                items: { include: { product: true } }
            }
        });
        res.json(priceList);
    }
    catch (error) {
        console.error('Create sales price error:', error);
        res.status(500).json({ error: 'Failed to create sales price' });
    }
};
exports.createSalesPrice = createSalesPrice;
// Сохранить продажный прайс
const saveSalesPrice = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { title, items, makeCurrent, effectiveDate } = req.body;
        const user = req.user?.username || 'system';
        await prisma.$transaction(async (tx) => {
            const current = await tx.salesPriceList.findUnique({ where: { id } });
            if (!current)
                throw new Error('Price list not found');
            // Если делаем текущим - снять флаг с других того же типа
            if (makeCurrent) {
                if (current.listType === 'GENERAL') {
                    await tx.salesPriceList.updateMany({
                        where: { listType: 'GENERAL', isCurrent: true },
                        data: { isCurrent: false }
                    });
                }
                else {
                    await tx.salesPriceList.updateMany({
                        where: { listType: 'CUSTOMER', customerId: current.customerId, isCurrent: true },
                        data: { isCurrent: false }
                    });
                }
            }
            // Обновить шапку
            const updateData = {
                title,
                status: 'saved',
                isCurrent: makeCurrent || false,
                updatedBy: user
            };
            // Если передана дата вступления в силу - обновляем
            if (effectiveDate) {
                updateData.effectiveDate = new Date(effectiveDate);
            }
            await tx.salesPriceList.update({
                where: { id },
                data: updateData
            });
            // Пересоздать строки
            if (items && Array.isArray(items)) {
                await tx.salesPriceItem.deleteMany({ where: { priceListId: id } });
                for (const item of items) {
                    await tx.salesPriceItem.create({
                        data: {
                            priceListId: id,
                            productId: item.productId,
                            salePrice: item.salePrice,
                            rowDate: item.rowDate ? new Date(item.rowDate) : new Date(),
                            updatedBy: user
                        }
                    });
                }
            }
        });
        const updated = await prisma.salesPriceList.findUnique({
            where: { id },
            include: {
                customer: true,
                items: { include: { product: true } }
            }
        });
        res.json(updated);
    }
    catch (error) {
        console.error('Save sales price error:', error);
        res.status(500).json({ error: 'Failed to save sales price' });
    }
};
exports.saveSalesPrice = saveSalesPrice;
// Скрыть выбранные продажные прайсы (массовое скрытие)
const hideSalesPriceLists = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No price list IDs provided' });
        }
        const result = await prisma.salesPriceList.updateMany({
            where: { id: { in: ids.map((id) => Number(id)) } },
            data: { isHidden: true }
        });
        res.json({
            success: true,
            hiddenCount: result.count,
            message: `${result.count} прайс-лист(ов) скрыто`
        });
    }
    catch (error) {
        console.error('Hide sales price lists error:', error);
        res.status(500).json({ error: 'Failed to hide sales price lists' });
    }
};
exports.hideSalesPriceLists = hideSalesPriceLists;
// ============================================
// МЕХАНИЗМ ПОЛУЧЕНИЯ ЦЕНЫ (бизнес-логика)
// ============================================
/**
 * Новая логика приоритетов (согласно ТЗ):
 * 1. Если есть персональный прайс для заказчика (активный по дате) —
 *    общий прайс НЕ используется ВООБЩЕ, даже для отсутствующих товаров.
 * 2. Если персонального прайса нет — применяется общий прайс.
 * 3. Учитываются: isHidden = false, effectiveDate <= текущая дата
 * 4. При равных условиях берётся самый свежий по effectiveDate, затем по createdAt
 */
// Получить активный прайс-лист для заказчика или общий
const findActivePriceList = async (prisma, listType, customerId, targetDate) => {
    const now = targetDate || new Date();
    const where = {
        listType,
        isHidden: false,
        effectiveDate: { lte: now }
    };
    if (listType === 'CUSTOMER' && customerId) {
        where.customerId = customerId;
    }
    return prisma.salesPriceList.findFirst({
        where,
        orderBy: [
            { effectiveDate: 'desc' },
            { createdAt: 'desc' }
        ],
        include: {
            items: { include: { product: true } }
        }
    });
};
// Получить цену продажи для заказчика и товара
const resolveSalePrice = async (req, res) => {
    try {
        const { customerId, productId } = req.params;
        const targetDate = req.query.date ? new Date(req.query.date) : new Date();
        // 1. Проверить наличие персонального прайса для заказчика
        const customerPriceList = await findActivePriceList(prisma, 'CUSTOMER', Number(customerId), targetDate);
        if (customerPriceList) {
            // Есть персональный прайс — ищем товар ТОЛЬКО в нём
            const item = customerPriceList.items.find((i) => i.productId === Number(productId));
            if (item) {
                return res.json({
                    source: 'CUSTOMER',
                    price: item.salePrice,
                    productId: Number(productId),
                    priceListId: customerPriceList.id,
                    effectiveDate: customerPriceList.effectiveDate
                });
            }
            // Товар не найден в персональном прайсе, но персональный прайс есть
            // Согласно ТЗ: общий прайс НЕ применяется
            return res.json({
                source: null,
                price: null,
                productId: Number(productId),
                message: 'Product not found in customer price list (general price not applied per policy)'
            });
        }
        // 2. Персонального прайса нет — проверить общий прайс
        const generalPriceList = await findActivePriceList(prisma, 'GENERAL', undefined, targetDate);
        if (generalPriceList) {
            const item = generalPriceList.items.find((i) => i.productId === Number(productId));
            if (item) {
                return res.json({
                    source: 'GENERAL',
                    price: item.salePrice,
                    productId: Number(productId),
                    priceListId: generalPriceList.id,
                    effectiveDate: generalPriceList.effectiveDate
                });
            }
        }
        // 3. Цена не найдена
        res.json({
            source: null,
            price: null,
            productId: Number(productId),
            message: 'Price not found'
        });
    }
    catch (error) {
        console.error('Resolve sale price error:', error);
        res.status(500).json({ error: 'Failed to resolve sale price' });
    }
};
exports.resolveSalePrice = resolveSalePrice;
// Получить все цены для заказчика (для формы заказа)
const resolveAllPricesForCustomer = async (req, res) => {
    try {
        const customerId = Number(req.params.customerId);
        const targetDate = req.query.date ? new Date(req.query.date) : new Date();
        // 1. Проверить наличие персонального прайса
        const customerPriceList = await findActivePriceList(prisma, 'CUSTOMER', customerId, targetDate);
        if (customerPriceList) {
            // Есть персональный прайс — возвращаем ТОЛЬКО его цены
            // Общий прайс полностью игнорируется
            const prices = customerPriceList.items.map((item) => ({
                ...item,
                source: 'CUSTOMER',
                priceListId: customerPriceList.id,
                effectiveDate: customerPriceList.effectiveDate
            }));
            return res.json(prices);
        }
        // 2. Персонального прайса нет — используем общий
        const generalPriceList = await findActivePriceList(prisma, 'GENERAL', undefined, targetDate);
        if (generalPriceList) {
            const prices = generalPriceList.items.map((item) => ({
                ...item,
                source: 'GENERAL',
                priceListId: generalPriceList.id,
                effectiveDate: generalPriceList.effectiveDate
            }));
            return res.json(prices);
        }
        // 3. Нет активных прайсов
        res.json([]);
    }
    catch (error) {
        console.error('Resolve all prices error:', error);
        res.status(500).json({ error: 'Failed to resolve prices' });
    }
};
exports.resolveAllPricesForCustomer = resolveAllPricesForCustomer;
// ============================================
// ЗАКУПОЧНЫЕ ЦЕНЫ ДЛЯ ФОРМЫ ПРОДАЖНОГО ПРАЙСА
// ============================================
/**
 * Получить закупочные цены всех поставщиков по товару
 * Возвращает последнюю закупочную цену по каждому поставщику
 * где дата закупочного прайса <= targetDate
 *
 * Query params:
 *   - productId: number (обязательный)
 *   - targetDate: string (ISO date) - дата вступления в силу продажного прайса
 */
const getPurchasePricesForProduct = async (req, res) => {
    try {
        const { productId, targetDate } = req.query;
        if (!productId) {
            return res.status(400).json({ error: 'productId is required' });
        }
        const pId = Number(productId);
        const date = targetDate ? new Date(String(targetDate)) : new Date();
        // Устанавливаем конец дня для корректного сравнения
        date.setHours(23, 59, 59, 999);
        // Получаем все закупочные цены по товару из активных прайсов до targetDate
        const purchasePrices = await prisma.purchasePriceItem.findMany({
            where: {
                productId: pId,
                priceList: {
                    isActive: true,
                    date: { lte: date }
                }
            },
            include: {
                supplier: {
                    select: {
                        id: true,
                        name: true,
                        legalName: true,
                        isActive: true
                    }
                },
                priceList: {
                    select: {
                        id: true,
                        date: true,
                        name: true
                    }
                }
            },
            orderBy: [
                { priceList: { date: 'desc' } }
            ]
        });
        // Группируем по поставщику и берём только последнюю цену (самую свежую по дате прайса)
        const supplierPricesMap = new Map();
        for (const item of purchasePrices) {
            // Пропускаем неактивных поставщиков
            if (!item.supplier.isActive)
                continue;
            // Если поставщик ещё не добавлен — добавляем (первый = самый свежий по дате)
            if (!supplierPricesMap.has(item.supplierId)) {
                supplierPricesMap.set(item.supplierId, {
                    supplierId: item.supplierId,
                    supplierName: item.supplier.name,
                    supplierLegalName: item.supplier.legalName,
                    purchasePrice: Number(item.purchasePrice),
                    priceListDate: item.priceList.date,
                    priceListId: item.priceList.id,
                    priceListName: item.priceList.name
                });
            }
        }
        // Преобразуем Map в массив и сортируем по имени поставщика
        const result = Array.from(supplierPricesMap.values()).sort((a, b) => a.supplierName.localeCompare(b.supplierName, 'ru'));
        res.json({
            productId: pId,
            targetDate: date.toISOString(),
            supplierPrices: result,
            count: result.length
        });
    }
    catch (error) {
        console.error('getPurchasePricesForProduct error:', error);
        res.status(500).json({ error: 'Failed to get purchase prices' });
    }
};
exports.getPurchasePricesForProduct = getPurchasePricesForProduct;
