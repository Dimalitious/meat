import { Request, Response } from 'express';
import { prisma } from '../db';

export const getProducts = async (req: Request, res: Response) => {
    try {
        const { search, category } = req.query;
        let showInactive = req.query.showInactive as string | undefined;

        // RBAC: only ADMIN can request inactive products
        const isAdmin = req.user?.roles?.includes('ADMIN') ?? false;
        if (!isAdmin) showInactive = 'false';

        let where: any = {};

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

        const products = await prisma.product.findMany({
            where,
            include: {
                uom: true,
                country: true,
                subcategory: { select: { id: true, name: true, isActive: true, deletedAt: true } },
                categoryRel: { select: { id: true, name: true, isActive: true, deletedAt: true } }
            },
            orderBy: { name: 'asc' }
        });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch products' });
    }
};

export const getProduct = async (req: Request, res: Response) => {
    try {
        const { code } = req.params as { code: string };
        const product = await prisma.product.findUnique({
            where: { code },
            include: {
                uom: true,
                country: true,
                subcategory: { select: { id: true, name: true, isActive: true, deletedAt: true } },
                categoryRel: { select: { id: true, name: true, isActive: true, deletedAt: true } }
            }
        });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch product' });
    }
};

export const createProduct = async (req: Request, res: Response) => {
    try {
        const { code, name, altName, priceListName, category, status, coefficient, lossNorm, participatesInProduction, uomId, countryId, subcategoryId, categoryId } = req.body;

        // RBAC: non-ADMIN always gets status='active' (v5.6 §7.1)
        const isAdmin = req.user?.roles?.includes('ADMIN') ?? false;
        const safeStatus = isAdmin && status ? status : 'active';

        // Validate country & subcategory (required for manual create)
        if (!countryId) {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Страна обязательна.' });
        }
        if (!subcategoryId) {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Подкатегория обязательна.' });
        }

        // Validate referenced entities are active
        const queries: Promise<any>[] = [
            prisma.country.findUnique({ where: { id: Number(countryId) }, select: { isActive: true } }),
            prisma.productSubcategory.findUnique({ where: { id: Number(subcategoryId) }, select: { isActive: true, deletedAt: true } }),
        ];
        // UoM isActive validation (v5.6 §7.2)
        if (uomId) {
            queries.push(prisma.unitOfMeasure.findUnique({ where: { id: Number(uomId) }, select: { isActive: true } }));
        }
        // CategoryId validation (v5.6 R2)
        if (categoryId) {
            queries.push(prisma.productCategory.findUnique({ where: { id: Number(categoryId) }, select: { isActive: true, deletedAt: true } }));
        }
        const [country, subcategory, uomCheck, categoryCheck] = await Promise.all(queries);

        if (!country?.isActive) {
            return res.status(400).json({ error: 'INACTIVE_COUNTRY', message: 'Нельзя выбрать архивную страну.' });
        }
        if (!subcategory) {
            return res.status(400).json({ error: 'INVALID_SUBCATEGORY', message: 'Подкатегория не найдена.' });
        }
        if (subcategory.deletedAt) {
            return res.status(400).json({ error: 'DELETED_SUBCATEGORY', message: 'Нельзя выбрать удалённую подкатегорию.' });
        }
        if (!subcategory.isActive) {
            return res.status(400).json({ error: 'INACTIVE_SUBCATEGORY', message: 'Нельзя выбрать архивную подкатегорию.' });
        }
        if (uomId && !uomCheck?.isActive) {
            return res.status(400).json({ error: 'INACTIVE_UOM', message: 'Нельзя выбрать архивную единицу измерения.' });
        }
        if (categoryId) {
            if (!categoryCheck) {
                return res.status(400).json({ error: 'CATEGORY_NOT_FOUND', message: 'Категория не найдена.' });
            }
            if (categoryCheck.deletedAt) {
                return res.status(400).json({ error: 'CATEGORY_DELETED', message: 'Нельзя выбрать удалённую категорию.' });
            }
            if (!categoryCheck.isActive) {
                return res.status(400).json({ error: 'INACTIVE_CATEGORY', message: 'Нельзя выбрать архивную категорию.' });
            }
        }

        const product = await prisma.product.create({
            data: {
                code,
                name,
                altName,
                priceListName,
                category,
                status: safeStatus,
                coefficient,
                lossNorm,
                participatesInProduction,
                uomId: uomId ? Number(uomId) : null,
                countryId: Number(countryId),
                subcategoryId: Number(subcategoryId),
                categoryId: categoryId ? Number(categoryId) : null,
            },
            include: {
                uom: true,
                country: true,
                subcategory: { select: { id: true, name: true, isActive: true, deletedAt: true } },
                categoryRel: { select: { id: true, name: true, isActive: true } },
            }
        });
        res.status(201).json(product);
    } catch (error: any) {
        console.error('createProduct error:', error);
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'DUPLICATE', message: 'Товар с таким кодом уже существует.' });
        }
        res.status(500).json({ error: 'Failed to create product' });
    }
};

export const updateProduct = async (req: Request, res: Response) => {
    try {
        const { code } = req.params as { code: string };
        const { name, altName, priceListName, category, status, coefficient, lossNorm, participatesInProduction, uomId, countryId, subcategoryId, categoryId } = req.body;

        // RBAC: only ADMIN can change product status
        if (status !== undefined) {
            const isAdmin = req.user?.roles?.includes('ADMIN') ?? false;
            if (!isAdmin) {
                return res.status(403).json({ error: 'Недостаточно прав: только администратор может менять статус товара' });
            }
        }

        // Validate country & subcategory (required for manual update)
        if (!countryId) {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Страна обязательна.' });
        }
        if (!subcategoryId) {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Подкатегория обязательна.' });
        }

        // Validate referenced entities are active
        const queries: Promise<any>[] = [
            prisma.country.findUnique({ where: { id: Number(countryId) }, select: { isActive: true } }),
            prisma.productSubcategory.findUnique({ where: { id: Number(subcategoryId) }, select: { isActive: true, deletedAt: true } }),
        ];
        if (uomId) {
            queries.push(prisma.unitOfMeasure.findUnique({ where: { id: Number(uomId) }, select: { isActive: true } }));
        }
        if (categoryId) {
            queries.push(prisma.productCategory.findUnique({ where: { id: Number(categoryId) }, select: { isActive: true, deletedAt: true } }));
        }
        const [country, subcategory, uomCheck, categoryCheck] = await Promise.all(queries);

        if (!country?.isActive) {
            return res.status(400).json({ error: 'INACTIVE_COUNTRY', message: 'Нельзя выбрать архивную страну.' });
        }
        if (!subcategory) {
            return res.status(400).json({ error: 'INVALID_SUBCATEGORY', message: 'Подкатегория не найдена.' });
        }
        if (subcategory.deletedAt) {
            return res.status(400).json({ error: 'DELETED_SUBCATEGORY', message: 'Нельзя выбрать удалённую подкатегорию.' });
        }
        if (!subcategory.isActive) {
            return res.status(400).json({ error: 'INACTIVE_SUBCATEGORY', message: 'Нельзя выбрать выключенную подкатегорию.' });
        }
        if (uomId && !uomCheck?.isActive) {
            return res.status(400).json({ error: 'INACTIVE_UOM', message: 'Нельзя выбрать архивную единицу измерения.' });
        }
        if (categoryId) {
            if (!categoryCheck) {
                return res.status(400).json({ error: 'CATEGORY_NOT_FOUND', message: 'Категория не найдена.' });
            }
            if (categoryCheck.deletedAt) {
                return res.status(400).json({ error: 'CATEGORY_DELETED', message: 'Нельзя выбрать удалённую категорию.' });
            }
            if (!categoryCheck.isActive) {
                return res.status(400).json({ error: 'INACTIVE_CATEGORY', message: 'Нельзя выбрать архивную категорию.' });
            }
        }

        // Guard: changing subcategoryId is blocked if active variants exist
        const existing = await prisma.product.findUnique({ where: { code }, select: { id: true, subcategoryId: true, categoryId: true, category: true } });
        if (existing && existing.subcategoryId && existing.subcategoryId !== Number(subcategoryId)) {
            const activeVariants = await prisma.customerProductVariant.count({
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

        // R2 categoryId fallback (v5.6 §8.1):
        // If categoryId is provided → validate and write it + dual-write legacy
        // If categoryId NOT provided → do NOT touch category/categoryId (preserve existing)
        const data: any = {
            name,
            altName,
            priceListName,
            status,
            coefficient,
            lossNorm,
            participatesInProduction,
            uomId: uomId ? Number(uomId) : null,
            countryId: Number(countryId),
            subcategoryId: Number(subcategoryId),
        };

        if (categoryId !== undefined) {
            data.categoryId = categoryId ? Number(categoryId) : null;
            // Dual-write legacy category string only when categoryId changes (v5.6 §4)
            if (categoryId && categoryCheck && existing && existing.categoryId !== Number(categoryId)) {
                // Resolve name from ProductCategory
                const cat = await prisma.productCategory.findUnique({ where: { id: Number(categoryId) }, select: { name: true } });
                if (cat) data.category = cat.name;
            }
        } else {
            // Do NOT include category in data — preserve existing legacy string
            // Only pass category from body if it's explicitly provided (e.g. from older frontend)
            if (category !== undefined) data.category = category;
        }

        const product = await prisma.product.update({
            where: { code },
            data,
            include: {
                uom: true,
                country: true,
                subcategory: { select: { id: true, name: true, isActive: true, deletedAt: true } },
                categoryRel: { select: { id: true, name: true, isActive: true } },
            }
        });
        res.json(product);
    } catch (error: any) {
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

// Отключить/включить товар (переключение статуса)
export const deactivateProduct = async (req: Request, res: Response) => {
    try {
        const { code } = req.params as { code: string };

        const product = await prisma.product.findUnique({
            where: { code }
        });

        if (!product) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        // Переключить статус: active <-> inactive
        const newStatus = product.status === 'active' ? 'inactive' : 'active';

        await prisma.product.update({
            where: { code },
            data: { status: newStatus }
        });

        const message = newStatus === 'inactive' ? 'Товар отключён' : 'Товар активирован';
        res.json({ message, status: newStatus });
    } catch (error) {
        console.error('Deactivate product error:', error);
        res.status(400).json({ error: 'Не удалось изменить статус товара' });
    }
};

// Upsert: создать или обновить товар по коду
export const upsertProduct = async (req: Request, res: Response) => {
    try {
        const { code, name, altName, priceListName, category, status, coefficient, lossNorm, participatesInProduction, uomId } = req.body;

        if (!code || !name) {
            return res.status(400).json({ error: 'Code and name are required' });
        }

        const product = await prisma.product.upsert({
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
            include: { uom: true, country: true, subcategory: true, categoryRel: true }
        });
        res.json(product);
    } catch (error) {
        console.error('Upsert error:', error);
        res.status(400).json({ error: 'Failed to upsert product' });
    }
};

// ── Helpers for batch category resolution (v5.6 §6) ────
const VALID_STATUSES = new Set(['active', 'inactive']);

const normalizeCategoryName = (raw: any): string =>
    String(raw ?? '').trim().replace(/\s+/g, ' ');

const normalizeCategoryKey = (raw: any): string =>
    normalizeCategoryName(raw).toLowerCase();

async function resolveCategoryId(categoryStr: string): Promise<number | null> {
    const nameNormalized = normalizeCategoryKey(categoryStr);
    if (!nameNormalized) return null;

    // Try to find existing
    let cat = await prisma.productCategory.findUnique({ where: { nameNormalized } });
    if (cat) {
        if (cat.deletedAt) throw new Error('CATEGORY_DELETED');
        if (!cat.isActive) throw new Error('INACTIVE_CATEGORY');
        return cat.id;
    }

    // Auto-create (ADMIN-only batch, v5.6 §2.2)
    try {
        cat = await prisma.productCategory.create({
            data: { name: normalizeCategoryName(categoryStr), nameNormalized, isActive: true },
        });
        return cat.id;
    } catch (e: any) {
        // P2002 race → retry find
        if (e.code === 'P2002') {
            const retry = await prisma.productCategory.findUnique({ where: { nameNormalized } });
            if (retry && retry.isActive && !retry.deletedAt) return retry.id;
        }
        throw e;
    }
}

// Пакетный импорт товаров (batch upsert) - БЫСТРАЯ версия
export const batchUpsertProducts = async (req: Request, res: Response) => {
    try {
        const { products } = req.body as {
            products: Array<{
                code: string;
                name: string;
                altName?: string;
                priceListName?: string;
                category?: string;
                categoryId?: number;
                status?: string;
                coefficient?: number;
                lossNorm?: number;
            }>
        };

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
        const existingProducts = await prisma.product.findMany({
            where: { code: { in: allCodes } },
            select: { code: true }
        });
        const existingCodes = new Set(existingProducts.map(p => p.code));

        console.log(`Found ${existingCodes.size} existing products, ${validProducts.length - existingCodes.size} new`);

        // Разделяем на новые и существующие
        const toCreate: typeof validProducts = [];
        const toUpdate: typeof validProducts = [];

        for (const p of validProducts) {
            if (existingCodes.has(p.code)) {
                toUpdate.push(p);
            } else {
                toCreate.push(p);
            }
        }

        let imported = 0;
        let updated = 0;
        const errors: string[] = [];

        // ── Resolve categories for all items (v5.6 §6.3) ───
        const categoryCache = new Map<string, number | null>();

        async function resolveItemCategory(p: typeof validProducts[0]): Promise<{ categoryId: number | null; category: string | null }> {
            // If explicit categoryId → use it
            if (p.categoryId) return { categoryId: p.categoryId, category: p.category || null };
            // If category string → resolve/auto-create
            if (p.category) {
                const key = normalizeCategoryKey(p.category);
                if (categoryCache.has(key)) return { categoryId: categoryCache.get(key)!, category: p.category };
                try {
                    const id = await resolveCategoryId(p.category);
                    categoryCache.set(key, id);
                    return { categoryId: id, category: p.category };
                } catch (e: any) {
                    errors.push(`${p.code}: category "${p.category}" – ${e.message}`);
                    return { categoryId: null, category: p.category };
                }
            }
            return { categoryId: null, category: null };
        }

        // Создаём новые товары ПАКЕТОМ
        if (toCreate.length > 0) {
            console.log(`Creating ${toCreate.length} new products...`);
            try {
                // Resolve categories first
                const createData = await Promise.all(toCreate.map(async (p) => {
                    const { categoryId, category } = await resolveItemCategory(p);
                    const safeStatus = VALID_STATUSES.has(p.status || '') ? p.status! : 'active';
                    return {
                        code: p.code,
                        name: p.name,
                        altName: p.altName || null,
                        priceListName: p.priceListName || null,
                        category: category || null,
                        status: safeStatus,
                        coefficient: p.coefficient ?? 1.0,
                        lossNorm: p.lossNorm ?? 0.0,
                        categoryId: categoryId,
                    };
                }));

                await prisma.product.createMany({
                    data: createData,
                    skipDuplicates: true,
                });
                imported = toCreate.length;
            } catch (err: any) {
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
                        const { categoryId, category } = await resolveItemCategory(p);
                        const safeStatus = VALID_STATUSES.has(p.status || '') ? p.status! : 'active';
                        await prisma.product.update({
                            where: { code: p.code },
                            data: {
                                name: p.name,
                                altName: p.altName || null,
                                priceListName: p.priceListName || null,
                                category: category || null,
                                status: safeStatus,
                                coefficient: p.coefficient ?? 1.0,
                                lossNorm: p.lossNorm ?? 0.0,
                                categoryId: categoryId,
                            }
                        });
                        updated++;
                    } catch (err: any) {
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
    } catch (error: any) {
        console.error('Batch upsert error:', error);
        res.status(400).json({ error: 'Failed to batch import products: ' + (error.message || 'Unknown error') });
    }
};
