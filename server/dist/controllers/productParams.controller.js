"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteExclusion = exports.createExclusion = exports.getAvailableParams = exports.getAvailableParamsForProductId = void 0;
const db_1 = require("../db");
const productParams_service_1 = require("../services/productParams.service");
Object.defineProperty(exports, "getAvailableParamsForProductId", { enumerable: true, get: function () { return productParams_service_1.getAvailableParamsForProductId; } });
/**
 * Get available params for a product code:
 * = (subcategory params + product overrides) − exclusions
 * Exclusions only apply to subcategory-owned values.
 */
const getAvailableParams = async (req, res) => {
    try {
        const { code } = req.params;
        const product = await db_1.prisma.product.findUnique({
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
            db_1.prisma.paramValue.findMany({
                where: {
                    isActive: true,
                    OR: [
                        { subcategoryId: product.subcategoryId },
                        { productId: product.id },
                    ],
                },
                orderBy: [{ paramType: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
            }),
            db_1.prisma.productParamExclusion.findMany({
                where: { productId: product.id },
                select: { paramValueId: true },
            }),
        ]);
        // Exclusions only filter subcategory-owned values (product overrides never excluded)
        const excludedSet = new Set(exclusions.map(e => e.paramValueId));
        const available = params.filter(p => p.productId !== null || !excludedSet.has(p.id));
        // Group by type
        const lengths = [];
        const widths = [];
        const weights = [];
        const processings = [];
        for (const p of available) {
            switch (p.paramType) {
                case 'LENGTH_CM':
                    lengths.push(p);
                    break;
                case 'WIDTH_CM':
                    widths.push(p);
                    break;
                case 'WEIGHT_G':
                    weights.push(p);
                    break;
                case 'PROCESSING':
                    processings.push(p);
                    break;
            }
        }
        res.json({
            product: { id: product.id, code: product.code, name: product.name, subcategoryId: product.subcategoryId },
            lengths,
            widths,
            weights,
            processings,
        });
    }
    catch (error) {
        console.error('getAvailableParams error:', error);
        res.status(500).json({ error: 'Failed to fetch available params' });
    }
};
exports.getAvailableParams = getAvailableParams;
// getAvailableParamsForProductId is now in services/productParams.service.ts
// POST /api/product-params/:productId/exclusions
const createExclusion = async (req, res) => {
    try {
        const productId = Number(req.params.productId);
        const { paramValueId } = req.body;
        if (!paramValueId) {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'paramValueId обязателен.' });
        }
        // Load product
        const product = await db_1.prisma.product.findUnique({
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
        const pv = await db_1.prisma.paramValue.findUnique({ where: { id: Number(paramValueId) } });
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
        const exclusion = await db_1.prisma.productParamExclusion.create({
            data: { productId, paramValueId: Number(paramValueId) },
        });
        (0, productParams_service_1.invalidateAvailableParams)(productId);
        res.status(201).json(exclusion);
    }
    catch (error) {
        console.error('createExclusion error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'DUPLICATE', message: 'Исключение уже существует.' });
        }
        res.status(400).json({ error: 'Failed to create exclusion' });
    }
};
exports.createExclusion = createExclusion;
// DELETE /api/product-params/:productId/exclusions/:paramValueId
const deleteExclusion = async (req, res) => {
    try {
        const productId = Number(req.params.productId);
        const paramValueId = Number(req.params.paramValueId);
        await db_1.prisma.productParamExclusion.delete({
            where: {
                productId_paramValueId: { productId, paramValueId },
            },
        });
        (0, productParams_service_1.invalidateAvailableParams)(productId);
        res.json({ message: 'Исключение удалено.' });
    }
    catch (error) {
        console.error('deleteExclusion error:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Исключение не найдено.' });
        }
        res.status(400).json({ error: 'Failed to delete exclusion' });
    }
};
exports.deleteExclusion = deleteExclusion;
