import { Request, Response } from 'express';
import { prisma } from '../db';
import { getAvailableParamsForProductId, invalidateAvailableParams } from '../services/productParams.service';

// Re-export for backward compatibility
export { getAvailableParamsForProductId };

/**
 * Get available params for a product code:
 * = (subcategory params + product overrides) − exclusions
 * Exclusions only apply to subcategory-owned values.
 */
export const getAvailableParams = async (req: Request, res: Response) => {
    try {
        const { code } = req.params;

        const product = await prisma.product.findUnique({
            where: { code },
            select: { id: true, code: true, name: true, subcategoryId: true },
        });

        if (!product) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Товар не найден.' });
        }
        if (!product.subcategoryId) {
            // No subcategory → return empty
            return res.json({
                product: { id: product.id, code: product.code, name: product.name, subcategoryId: null },
                lengths: [],
                widths: [],
                weights: [],
                processings: [],
                warning: 'У товара не задана подкатегория.',
            });
        }

        // Single query: get all active params for subcategory + product overrides
        const [params, exclusions] = await Promise.all([
            prisma.paramValue.findMany({
                where: {
                    isActive: true,
                    OR: [
                        { subcategoryId: product.subcategoryId },
                        { productId: product.id },
                    ],
                },
                orderBy: [{ paramType: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
            }),
            prisma.productParamExclusion.findMany({
                where: { productId: product.id },
                select: { paramValueId: true },
            }),
        ]);

        // Exclusions only filter subcategory-owned values (product overrides never excluded)
        const excludedSet = new Set(exclusions.map(e => e.paramValueId));
        const available = params.filter(p => p.productId !== null || !excludedSet.has(p.id));

        // Group by type
        const lengths: any[] = [];
        const widths: any[] = [];
        const weights: any[] = [];
        const processings: any[] = [];

        for (const p of available) {
            switch (p.paramType) {
                case 'LENGTH_CM': lengths.push(p); break;
                case 'WIDTH_CM': widths.push(p); break;
                case 'WEIGHT_G': weights.push(p); break;
                case 'PROCESSING': processings.push(p); break;
            }
        }

        res.json({
            product: { id: product.id, code: product.code, name: product.name, subcategoryId: product.subcategoryId },
            lengths,
            widths,
            weights,
            processings,
        });
    } catch (error) {
        console.error('getAvailableParams error:', error);
        res.status(500).json({ error: 'Failed to fetch available params' });
    }
};

// getAvailableParamsForProductId is now in services/productParams.service.ts

// POST /api/product-params/:productId/exclusions
export const createExclusion = async (req: Request, res: Response) => {
    try {
        const productId = Number(req.params.productId);
        const { paramValueId } = req.body;

        if (!paramValueId) {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'paramValueId обязателен.' });
        }

        // Load product
        const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, subcategoryId: true },
        });
        if (!product) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Товар не найден.' });
        }
        if (!product.subcategoryId) {
            return res.status(400).json({ error: 'PRODUCT_SUBCATEGORY_REQUIRED', message: 'Сначала задайте подкатегорию товара.' });
        }

        // Load paramValue
        const pv = await prisma.paramValue.findUnique({ where: { id: Number(paramValueId) } });
        if (!pv) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Значение параметра не найдено.' });
        }

        // Cannot exclude product-override values
        if (pv.productId !== null) {
            return res.status(400).json({
                error: 'CANNOT_EXCLUDE_PRODUCT_PARAM',
                message: 'Нельзя исключить значение, добавленное специально для товара. Деактивируйте его напрямую.',
            });
        }

        // Cannot exclude already inactive values (#9)
        if (!pv.isActive) {
            return res.status(400).json({
                error: 'INACTIVE_PARAM',
                message: 'Нельзя исключить архивное значение параметра.',
            });
        }

        // Validate: paramValue belongs to same subcategory
        if (pv.subcategoryId !== product.subcategoryId) {
            return res.status(400).json({
                error: 'INVALID_PARAM_OWNER',
                message: 'Значение параметра не принадлежит подкатегории этого товара.',
            });
        }

        const exclusion = await prisma.productParamExclusion.create({
            data: { productId, paramValueId: Number(paramValueId) },
        });
        invalidateAvailableParams(productId);
        res.status(201).json(exclusion);
    } catch (error: any) {
        console.error('createExclusion error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'DUPLICATE', message: 'Исключение уже существует.' });
        }
        res.status(400).json({ error: 'Failed to create exclusion' });
    }
};

// DELETE /api/product-params/:productId/exclusions/:paramValueId
export const deleteExclusion = async (req: Request, res: Response) => {
    try {
        const productId = Number(req.params.productId);
        const paramValueId = Number(req.params.paramValueId);

        await prisma.productParamExclusion.delete({
            where: {
                productId_paramValueId: { productId, paramValueId },
            },
        });

        invalidateAvailableParams(productId);
        res.json({ message: 'Исключение удалено.' });
    } catch (error: any) {
        console.error('deleteExclusion error:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Исключение не найдено.' });
        }
        res.status(400).json({ error: 'Failed to delete exclusion' });
    }
};
