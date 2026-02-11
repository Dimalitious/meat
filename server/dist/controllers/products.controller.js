"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchUpsertProducts = exports.upsertProduct = exports.deactivateProduct = exports.updateProduct = exports.createProduct = exports.getProduct = exports.getProducts = void 0;
const db_1 = require("../db");
const getProducts = async (req, res) => {
    try {
        const { search, category, showInactive } = req.query;
        let where = {};
        // По умолчанию показываем только активные товары
        if (showInactive !== 'true') {
            where.status = 'active';
        }
        if (search) {
            where.OR = [
                { code: { contains: String(search) } },
                { name: { contains: String(search) } },
                { priceListName: { contains: String(search) } }
            ];
        }
        if (category && category !== 'All') {
            where.category = String(category);
        }
        const products = await db_1.prisma.product.findMany({
            where,
            include: { uom: true, country: true, subcategory: true },
            orderBy: { name: 'asc' }
        });
        res.json(products);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch products' });
    }
};
exports.getProducts = getProducts;
const getProduct = async (req, res) => {
    try {
        const { code } = req.params;
        const product = await db_1.prisma.product.findUnique({
            where: { code }
        });
        if (!product)
            return res.status(404).json({ error: 'Product not found' });
        res.json(product);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch product' });
    }
};
exports.getProduct = getProduct;
const createProduct = async (req, res) => {
    try {
        const { code, name, altName, priceListName, category, status, coefficient, lossNorm, participatesInProduction, uomId, countryId, subcategoryId } = req.body;
        // Validate country & subcategory (required for manual create)
        if (!countryId) {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Страна обязательна.' });
        }
        if (!subcategoryId) {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Подкатегория обязательна.' });
        }
        // Validate referenced entities are active
        const [country, subcategory] = await Promise.all([
            db_1.prisma.country.findUnique({ where: { id: Number(countryId) }, select: { isActive: true } }),
            db_1.prisma.productSubcategory.findUnique({ where: { id: Number(subcategoryId) }, select: { isActive: true } }),
        ]);
        if (!country?.isActive) {
            return res.status(400).json({ error: 'INACTIVE_COUNTRY', message: 'Нельзя выбрать архивную страну.' });
        }
        if (!subcategory?.isActive) {
            return res.status(400).json({ error: 'INACTIVE_SUBCATEGORY', message: 'Нельзя выбрать архивную подкатегорию.' });
        }
        const product = await db_1.prisma.product.create({
            data: {
                code,
                name,
                altName,
                priceListName,
                category,
                status,
                coefficient,
                lossNorm,
                participatesInProduction,
                uomId: uomId ? Number(uomId) : null,
                countryId: Number(countryId),
                subcategoryId: Number(subcategoryId),
            },
            include: { uom: true, country: true, subcategory: true }
        });
        res.status(201).json(product);
    }
    catch (error) {
        console.error('createProduct error:', error);
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'DUPLICATE', message: 'Товар с таким кодом уже существует.' });
        }
        res.status(500).json({ error: 'Failed to create product' });
    }
};
exports.createProduct = createProduct;
const updateProduct = async (req, res) => {
    try {
        const { code } = req.params;
        const { name, altName, priceListName, category, status, coefficient, lossNorm, participatesInProduction, uomId, countryId, subcategoryId } = req.body;
        // Validate country & subcategory (required for manual update)
        if (!countryId) {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Страна обязательна.' });
        }
        if (!subcategoryId) {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Подкатегория обязательна.' });
        }
        // Validate referenced entities are active
        const [country, subcategory] = await Promise.all([
            db_1.prisma.country.findUnique({ where: { id: Number(countryId) }, select: { isActive: true } }),
            db_1.prisma.productSubcategory.findUnique({ where: { id: Number(subcategoryId) }, select: { isActive: true } }),
        ]);
        if (!country?.isActive) {
            return res.status(400).json({ error: 'INACTIVE_COUNTRY', message: 'Нельзя выбрать архивную страну.' });
        }
        if (!subcategory?.isActive) {
            return res.status(400).json({ error: 'INACTIVE_SUBCATEGORY', message: 'Нельзя выбрать архивную подкатегорию.' });
        }
        // Guard: changing subcategoryId is blocked if active variants exist
        const existing = await db_1.prisma.product.findUnique({ where: { code }, select: { id: true, subcategoryId: true } });
        if (existing && existing.subcategoryId && existing.subcategoryId !== Number(subcategoryId)) {
            const activeVariants = await db_1.prisma.customerProductVariant.count({
                where: {
                    isActive: true,
                    customerProduct: { productId: existing.id },
                },
            });
            if (activeVariants > 0) {
                return res.status(409).json({
                    error: 'SUBCATEGORY_CHANGE_BLOCKED',
                    message: `Сначала деактивируйте ${activeVariants} вариантов в персональных каталогах клиентов.`,
                });
            }
        }
        const product = await db_1.prisma.product.update({
            where: { code },
            data: {
                name,
                altName,
                priceListName,
                category,
                status,
                coefficient,
                lossNorm,
                participatesInProduction,
                uomId: uomId ? Number(uomId) : null,
                countryId: Number(countryId),
                subcategoryId: Number(subcategoryId),
            },
            include: { uom: true, country: true, subcategory: true }
        });
        res.json(product);
    }
    catch (error) {
        console.error('updateProduct error:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Товар не найден.' });
        }
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'DUPLICATE', message: 'Конфликт уникальности.' });
        }
        res.status(500).json({ error: 'Failed to update product' });
    }
};
exports.updateProduct = updateProduct;
// Отключить/включить товар (переключение статуса)
const deactivateProduct = async (req, res) => {
    try {
        const { code } = req.params;
        const product = await db_1.prisma.product.findUnique({
            where: { code }
        });
        if (!product) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        // Переключить статус: active <-> inactive
        const newStatus = product.status === 'active' ? 'inactive' : 'active';
        await db_1.prisma.product.update({
            where: { code },
            data: { status: newStatus }
        });
        const message = newStatus === 'inactive' ? 'Товар отключён' : 'Товар активирован';
        res.json({ message, status: newStatus });
    }
    catch (error) {
        console.error('Deactivate product error:', error);
        res.status(400).json({ error: 'Не удалось изменить статус товара' });
    }
};
exports.deactivateProduct = deactivateProduct;
// Upsert: создать или обновить товар по коду
const upsertProduct = async (req, res) => {
    try {
        const { code, name, altName, priceListName, category, status, coefficient, lossNorm, participatesInProduction, uomId } = req.body;
        if (!code || !name) {
            return res.status(400).json({ error: 'Code and name are required' });
        }
        const product = await db_1.prisma.product.upsert({
            where: { code },
            update: {
                name,
                altName: altName || null,
                priceListName: priceListName || null,
                category: category || null,
                status: status || 'active',
                coefficient: coefficient ?? 1.0,
                lossNorm: lossNorm ?? 0.0,
                participatesInProduction: participatesInProduction ?? false,
                uomId: uomId ? Number(uomId) : null,
            },
            create: {
                code,
                name,
                altName: altName || null,
                priceListName: priceListName || null,
                category: category || null,
                status: status || 'active',
                coefficient: coefficient ?? 1.0,
                lossNorm: lossNorm ?? 0.0,
                participatesInProduction: participatesInProduction ?? false,
                uomId: uomId ? Number(uomId) : null,
            },
            include: { uom: true, country: true, subcategory: true }
        });
        res.json(product);
    }
    catch (error) {
        console.error('Upsert error:', error);
        res.status(400).json({ error: 'Failed to upsert product' });
    }
};
exports.upsertProduct = upsertProduct;
// Пакетный импорт товаров (batch upsert) - БЫСТРАЯ версия
const batchUpsertProducts = async (req, res) => {
    try {
        const { products } = req.body;
        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ error: 'Products array is required' });
        }
        console.log(`Starting FAST batch import for ${products.length} products...`);
        const startTime = Date.now();
        // Фильтруем валидные продукты
        const validProducts = products.filter(p => p.code && p.name);
        const skipped = products.length - validProducts.length;
        // Получаем все существующие коды ОДНИМ запросом
        const allCodes = validProducts.map(p => p.code);
        const existingProducts = await db_1.prisma.product.findMany({
            where: { code: { in: allCodes } },
            select: { code: true }
        });
        const existingCodes = new Set(existingProducts.map(p => p.code));
        console.log(`Found ${existingCodes.size} existing products, ${validProducts.length - existingCodes.size} new`);
        // Разделяем на новые и существующие
        const toCreate = [];
        const toUpdate = [];
        for (const p of validProducts) {
            if (existingCodes.has(p.code)) {
                toUpdate.push(p);
            }
            else {
                toCreate.push(p);
            }
        }
        let imported = 0;
        let updated = 0;
        const errors = [];
        // Создаём новые товары ПАКЕТОМ
        if (toCreate.length > 0) {
            console.log(`Creating ${toCreate.length} new products...`);
            try {
                await db_1.prisma.product.createMany({
                    data: toCreate.map(p => ({
                        code: p.code,
                        name: p.name,
                        altName: p.altName || null,
                        priceListName: p.priceListName || null,
                        category: p.category || null,
                        status: p.status || 'active',
                        coefficient: p.coefficient ?? 1.0,
                        lossNorm: p.lossNorm ?? 0.0,
                    })),
                    skipDuplicates: true,
                });
                imported = toCreate.length;
            }
            catch (err) {
                console.error('CreateMany error:', err.message);
                errors.push(`Ошибка создания: ${err.message}`);
            }
        }
        // Обновляем существующие товары параллельно (по 20 одновременно)
        if (toUpdate.length > 0) {
            console.log(`Updating ${toUpdate.length} existing products...`);
            const PARALLEL_LIMIT = 20;
            for (let i = 0; i < toUpdate.length; i += PARALLEL_LIMIT) {
                const batch = toUpdate.slice(i, i + PARALLEL_LIMIT);
                await Promise.all(batch.map(async (p) => {
                    try {
                        await db_1.prisma.product.update({
                            where: { code: p.code },
                            data: {
                                name: p.name,
                                altName: p.altName || null,
                                priceListName: p.priceListName || null,
                                category: p.category || null,
                                status: p.status || 'active',
                                coefficient: p.coefficient ?? 1.0,
                                lossNorm: p.lossNorm ?? 0.0,
                            }
                        });
                        updated++;
                    }
                    catch (err) {
                        errors.push(`${p.code}: ${err.message}`);
                    }
                }));
            }
        }
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`Batch import completed in ${duration}s: ${imported} imported, ${updated} updated, ${errors.length} errors`);
        res.json({
            success: true,
            imported,
            updated,
            skipped,
            errors: errors.slice(0, 10),
            totalErrors: errors.length,
            duration: `${duration}s`
        });
    }
    catch (error) {
        console.error('Batch upsert error:', error);
        res.status(400).json({ error: 'Failed to batch import products: ' + (error.message || 'Unknown error') });
    }
};
exports.batchUpsertProducts = batchUpsertProducts;
