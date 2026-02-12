import { Request, Response } from 'express';
import { prisma } from '../db';
import { Prisma } from '@prisma/client';
import { getAvailableParamsForProductId } from '../services/productParams.service';

const VARIANT_LIMIT = 200;

const variantInclude = {
    lengthParamValue: { select: { id: true, paramType: true, valueNum: true, valueNumMin: true, valueNumMax: true, label: true, isActive: true } },
    widthParamValue: { select: { id: true, paramType: true, valueNum: true, valueNumMin: true, valueNumMax: true, label: true, isActive: true } },
    weightParamValue: { select: { id: true, paramType: true, valueInt: true, valueIntMin: true, valueIntMax: true, label: true, isActive: true } },
    processingParamValue: { select: { id: true, paramType: true, valueText: true, label: true, isActive: true } },
};

// GET /api/customer-product-variants/:customerProductId
export const getVariants = async (req: Request, res: Response) => {
    try {
        const customerProductId = Number(req.params.customerProductId);

        const items = await prisma.customerProductVariant.findMany({
            where: { customerProductId },
            include: variantInclude,
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        });

        res.json({ items });
    } catch (error) {
        console.error('getVariants error:', error);
        res.status(500).json({ error: 'Failed to fetch variants' });
    }
};

// POST /api/customer-product-variants/:customerProductId
export const createVariant = async (req: Request, res: Response) => {
    try {
        const customerProductId = Number(req.params.customerProductId);
        const {
            lengthParamValueId,
            widthParamValueId,
            weightParamValueId,
            processingParamValueId,
        } = req.body ?? {};

        // 1) Required fields
        if (!lengthParamValueId || !widthParamValueId || !weightParamValueId || !processingParamValueId) {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Все 4 параметра обязательны.' });
        }

        // 2) Load CustomerProduct + product info
        const cp = await prisma.customerProduct.findUnique({
            where: { id: customerProductId },
            include: { product: { select: { id: true, code: true, subcategoryId: true } } },
        });
        if (!cp) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Товар клиента не найден.' });
        }
        if (!cp.product.subcategoryId) {
            return res.status(400).json({ error: 'PRODUCT_SUBCATEGORY_REQUIRED', message: 'У товара не задана подкатегория.' });
        }

        // Check subcategory is active
        const subcategory = await prisma.productSubcategory.findUnique({
            where: { id: cp.product.subcategoryId },
            select: { isActive: true },
        });
        if (!subcategory?.isActive) {
            return res.status(400).json({ error: 'INACTIVE_SUBCATEGORY', message: 'Подкатегория деактивирована. Нельзя создавать варианты.' });
        }

        // 3) Load selected ParamValues and cross-check paramType + isActive
        const selectedIds = [lengthParamValueId, widthParamValueId, weightParamValueId, processingParamValueId].map(Number);
        const pvs = await prisma.paramValue.findMany({ where: { id: { in: selectedIds } } });
        const byId = new Map(pvs.map(p => [p.id, p]));

        const lengthPV = byId.get(Number(lengthParamValueId));
        const widthPV = byId.get(Number(widthParamValueId));
        const weightPV = byId.get(Number(weightParamValueId));
        const procPV = byId.get(Number(processingParamValueId));

        if (!lengthPV || !widthPV || !weightPV || !procPV) {
            return res.status(400).json({ error: 'INVALID_PARAM_SELECTION', message: 'Один или несколько параметров не найдены.' });
        }

        // Explicit paramType cross-check
        if (lengthPV.paramType !== 'LENGTH_CM') return res.status(400).json({ error: 'INVALID_PARAM_TYPE', message: 'Неверный тип параметра длины.' });
        if (widthPV.paramType !== 'WIDTH_CM') return res.status(400).json({ error: 'INVALID_PARAM_TYPE', message: 'Неверный тип параметра ширины.' });
        if (weightPV.paramType !== 'WEIGHT_G') return res.status(400).json({ error: 'INVALID_PARAM_TYPE', message: 'Неверный тип параметра веса.' });
        if (procPV.paramType !== 'PROCESSING') return res.status(400).json({ error: 'INVALID_PARAM_TYPE', message: 'Неверный тип параметра обработки.' });

        // Selected values must be active
        if (!lengthPV.isActive || !widthPV.isActive || !weightPV.isActive || !procPV.isActive) {
            return res.status(400).json({ error: 'INACTIVE_PARAM', message: 'Нельзя выбрать архивное значение параметра.' });
        }

        // 4) Validate that chosen IDs are in available params for this product
        const available = await getAvailableParamsForProductId(cp.product.id);
        const inBucket = (bucket: { id: number }[], id: number) => bucket.some(x => x.id === id);

        if (!inBucket(available.lengths, lengthPV.id) ||
            !inBucket(available.widths, widthPV.id) ||
            !inBucket(available.weights, weightPV.id) ||
            !inBucket(available.processings, procPV.id)) {
            return res.status(400).json({ error: 'INVALID_PARAM_SELECTION', message: 'Выбранное значение параметра недоступно для этого товара.' });
        }

        // 5–7) Serializable transaction: limit check + combo lookup + reactivate/create
        const comboKey = {
            customerProductId,
            lengthParamValueId: lengthPV.id,
            widthParamValueId: widthPV.id,
            weightParamValueId: weightPV.id,
            processingParamValueId: procPV.id,
        };
        const comboWhere = {
            customerProductId_lengthParamValueId_widthParamValueId_weightParamValueId_processingParamValueId: comboKey,
        };

        const MAX_RETRIES = 1;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const result = await prisma.$transaction(async (tx) => {
                    // 5) Limit check inside transaction
                    const activeCount = await tx.customerProductVariant.count({
                        where: { customerProductId, isActive: true },
                    });

                    // 6) Combo lookup
                    const existing = await tx.customerProductVariant.findUnique({
                        where: comboWhere,
                        select: { id: true, isActive: true },
                    });

                    if (existing?.isActive) {
                        return { status: 409, body: { error: 'DUPLICATE_VARIANT', message: 'Такая комбинация уже существует в каталоге клиента.' } };
                    }

                    if (existing && !existing.isActive) {
                        // Reactivation — also check limit
                        if (activeCount >= VARIANT_LIMIT) {
                            return { status: 400, body: { error: 'VARIANT_LIMIT', message: `Максимум ${VARIANT_LIMIT} активных вариантов на товар.` } };
                        }
                        const reactivated = await tx.customerProductVariant.update({
                            where: { id: existing.id },
                            data: { isActive: true, updatedAt: new Date() },
                            include: variantInclude,
                        });
                        return { status: 200, body: reactivated };
                    }

                    // New creation — check limit
                    if (activeCount >= VARIANT_LIMIT) {
                        return { status: 400, body: { error: 'VARIANT_LIMIT', message: `Максимум ${VARIANT_LIMIT} активных вариантов на товар.` } };
                    }

                    // 7) Create
                    const created = await tx.customerProductVariant.create({
                        data: { ...comboKey, isActive: true },
                        include: variantInclude,
                    });
                    return { status: 201, body: created };
                }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

                return res.status(result.status).json(result.body);
            } catch (e: any) {
                // Retry on serialization failure (Postgres error code 40001)
                const isPgSerializationFailure =
                    (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') ||
                    (e.message?.includes('could not serialize'));
                if (isPgSerializationFailure && attempt < MAX_RETRIES) {
                    console.warn('createVariant serialization retry', { attempt: attempt + 1, customerProductId, comboKey });
                    continue;
                }
                // P2002 = unique constraint (race condition fallback) → try reactivate
                if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                    console.warn('createVariant P2002 fallback', { target: (e as any).meta?.target, comboKey });
                    const fallback = await prisma.customerProductVariant.findUnique({
                        where: comboWhere,
                        select: { id: true, isActive: true },
                    });
                    if (fallback && !fallback.isActive) {
                        // Check limit before fallback reactivation
                        const activeCount = await prisma.customerProductVariant.count({
                            where: { customerProductId, isActive: true },
                        });
                        if (activeCount >= VARIANT_LIMIT) {
                            return res.status(400).json({ error: 'VARIANT_LIMIT', message: `Максимум ${VARIANT_LIMIT} активных вариантов на товар.` });
                        }
                        const reactivated = await prisma.customerProductVariant.update({
                            where: { id: fallback.id },
                            data: { isActive: true },
                            include: variantInclude,
                        });
                        return res.status(200).json(reactivated);
                    }
                    return res.status(409).json({ error: 'DUPLICATE_VARIANT', message: 'Такая комбинация уже существует.' });
                }
                throw e;
            }
        }
    } catch (error) {
        console.error('createVariant error:', error);
        res.status(500).json({ error: 'Failed to create variant' });
    }
};

// PATCH /api/customer-product-variants/item/:id
export const updateVariant = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const { isActive, lengthParamValueId, widthParamValueId, weightParamValueId, processingParamValueId, sortOrder } = req.body;

        // Load current variant
        const current = await prisma.customerProductVariant.findUnique({
            where: { id },
            include: { customerProduct: { select: { id: true, product: { select: { id: true, subcategoryId: true } } } } },
        });
        if (!current) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Вариант не найден.' });
        }

        // If deactivating → only deactivate, ignore other fields
        if (isActive === false) {
            const updated = await prisma.customerProductVariant.update({
                where: { id },
                data: { isActive: false },
                include: variantInclude,
            });
            return res.json(updated);
        }

        // If reactivating → check subcategory + limit
        if (isActive === true && !current.isActive) {
            // Block reactivation if subcategory is inactive
            const sid = current.customerProduct.product.subcategoryId;
            if (!sid) {
                return res.status(400).json({ error: 'PRODUCT_SUBCATEGORY_REQUIRED', message: 'У товара не задана подкатегория.' });
            }
            const subcatForReactivation = await prisma.productSubcategory.findUnique({
                where: { id: sid },
                select: { isActive: true },
            });
            if (!subcatForReactivation?.isActive) {
                return res.status(400).json({
                    error: 'INACTIVE_SUBCATEGORY',
                    message: 'Подкатегория деактивирована. Нельзя реактивировать вариант.',
                });
            }

            const activeCount = await prisma.customerProductVariant.count({
                where: { customerProductId: current.customerProductId, isActive: true },
            });
            if (activeCount >= VARIANT_LIMIT) {
                return res.status(400).json({
                    error: 'VARIANT_LIMIT',
                    message: `Максимум ${VARIANT_LIMIT} активных вариантов на товар.`,
                });
            }
        }

        // Build merged combo for partial update
        const merged = {
            lengthParamValueId: lengthParamValueId != null ? Number(lengthParamValueId) : current.lengthParamValueId,
            widthParamValueId: widthParamValueId != null ? Number(widthParamValueId) : current.widthParamValueId,
            weightParamValueId: weightParamValueId != null ? Number(weightParamValueId) : current.weightParamValueId,
            processingParamValueId: processingParamValueId != null ? Number(processingParamValueId) : current.processingParamValueId,
        };

        const comboChanged =
            merged.lengthParamValueId !== current.lengthParamValueId ||
            merged.widthParamValueId !== current.widthParamValueId ||
            merged.weightParamValueId !== current.weightParamValueId ||
            merged.processingParamValueId !== current.processingParamValueId;

        // Check subcategory is active (same as createVariant)
        if (comboChanged) {
            const comboSid = current.customerProduct.product.subcategoryId;
            if (!comboSid) {
                return res.status(400).json({ error: 'PRODUCT_SUBCATEGORY_REQUIRED', message: 'У товара не задана подкатегория.' });
            }
            const subcategory = await prisma.productSubcategory.findUnique({
                where: { id: comboSid },
                select: { isActive: true },
            });
            if (!subcategory?.isActive) {
                return res.status(400).json({ error: 'INACTIVE_SUBCATEGORY', message: 'Подкатегория деактивирована. Нельзя менять комбинацию.' });
            }
            // Validate new combo
            const selectedIds = [merged.lengthParamValueId, merged.widthParamValueId, merged.weightParamValueId, merged.processingParamValueId];
            const pvs = await prisma.paramValue.findMany({ where: { id: { in: selectedIds } } });
            const byId = new Map(pvs.map(p => [p.id, p]));

            const lengthPV = byId.get(merged.lengthParamValueId);
            const widthPV = byId.get(merged.widthParamValueId);
            const weightPV = byId.get(merged.weightParamValueId);
            const procPV = byId.get(merged.processingParamValueId);

            if (!lengthPV || !widthPV || !weightPV || !procPV) {
                return res.status(400).json({ error: 'INVALID_PARAM_SELECTION', message: 'Параметр не найден.' });
            }
            if (lengthPV.paramType !== 'LENGTH_CM') return res.status(400).json({ error: 'INVALID_PARAM_TYPE', message: 'Неверный тип длины.' });
            if (widthPV.paramType !== 'WIDTH_CM') return res.status(400).json({ error: 'INVALID_PARAM_TYPE', message: 'Неверный тип ширины.' });
            if (weightPV.paramType !== 'WEIGHT_G') return res.status(400).json({ error: 'INVALID_PARAM_TYPE', message: 'Неверный тип веса.' });
            if (procPV.paramType !== 'PROCESSING') return res.status(400).json({ error: 'INVALID_PARAM_TYPE', message: 'Неверный тип обработки.' });

            if (!lengthPV.isActive || !widthPV.isActive || !weightPV.isActive || !procPV.isActive) {
                return res.status(400).json({ error: 'INACTIVE_PARAM', message: 'Нельзя выбрать архивное значение.' });
            }

            const available = await getAvailableParamsForProductId(current.customerProduct.product.id);
            const inBucket = (bucket: { id: number }[], bid: number) => bucket.some(x => x.id === bid);

            if (!inBucket(available.lengths, lengthPV.id) ||
                !inBucket(available.widths, widthPV.id) ||
                !inBucket(available.weights, weightPV.id) ||
                !inBucket(available.processings, procPV.id)) {
                return res.status(400).json({ error: 'INVALID_PARAM_SELECTION', message: 'Значение недоступно для этого товара.' });
            }

            // Check unique conflict
            const conflict = await prisma.customerProductVariant.findUnique({
                where: {
                    customerProductId_lengthParamValueId_widthParamValueId_weightParamValueId_processingParamValueId: {
                        customerProductId: current.customerProductId,
                        ...merged,
                    },
                },
                select: { id: true, isActive: true },
            });
            if (conflict && conflict.id !== id) {
                const msg = conflict.isActive
                    ? 'Такая комбинация уже активна.'
                    : 'Комбинация занята архивной записью. Восстановите её через создание нового варианта.';
                return res.status(409).json({ error: 'DUPLICATE_VARIANT', message: msg });
            }
        }

        const data: any = { ...merged };
        if (isActive !== undefined) data.isActive = Boolean(isActive);
        if (sortOrder !== undefined) data.sortOrder = Number(sortOrder);

        const updated = await prisma.customerProductVariant.update({
            where: { id },
            data,
            include: variantInclude,
        });
        res.json(updated);
    } catch (error: any) {
        console.error('updateVariant error:', error);
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'DUPLICATE_VARIANT', message: 'Такая комбинация уже существует.' });
        }
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Вариант не найден.' });
        }
        res.status(500).json({ error: 'Failed to update variant' });
    }
};
