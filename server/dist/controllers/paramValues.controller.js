"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateParamValue = exports.createParamValueForProduct = exports.createParamValueForSubcategory = exports.getParamValuesByProduct = exports.getParamValuesBySubcategory = void 0;
const db_1 = require("../db");
const client_1 = require("@prisma/client");
const paramValue_utils_1 = require("../utils/paramValue.utils");
const productParams_service_1 = require("../services/productParams.service");
// Helper to group ParamValues by type
function groupByType(params) {
    const lengths = [];
    const widths = [];
    const weights = [];
    const processings = [];
    for (const p of params) {
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
    return { lengths, widths, weights, processings };
}
// GET /api/param-values/subcategory/:subcategoryId?active=all|true
const getParamValuesBySubcategory = async (req, res) => {
    try {
        const subcategoryId = Number(req.params.subcategoryId);
        const { active } = req.query;
        const where = { subcategoryId };
        if (active === 'true') {
            where.isActive = true;
        }
        const params = await db_1.prisma.paramValue.findMany({
            where,
            orderBy: [{ paramType: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
        });
        res.json(groupByType(params));
    }
    catch (error) {
        console.error('getParamValuesBySubcategory error:', error);
        res.status(500).json({ error: 'Failed to fetch param values' });
    }
};
exports.getParamValuesBySubcategory = getParamValuesBySubcategory;
// GET /api/param-values/product/:productId?active=all|true
const getParamValuesByProduct = async (req, res) => {
    try {
        const productId = Number(req.params.productId);
        const { active } = req.query;
        const where = { productId };
        if (active === 'true') {
            where.isActive = true;
        }
        const params = await db_1.prisma.paramValue.findMany({
            where,
            orderBy: [{ paramType: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
        });
        res.json(groupByType(params));
    }
    catch (error) {
        console.error('getParamValuesByProduct error:', error);
        res.status(500).json({ error: 'Failed to fetch param values' });
    }
};
exports.getParamValuesByProduct = getParamValuesByProduct;
// Shared creation logic
async function createParamValue(ownerField, ownerId, body, res) {
    const { paramType, valueNum, valueInt, valueText, label, sortOrder } = body;
    if (!paramType || !['LENGTH_CM', 'WIDTH_CM', 'WEIGHT_G', 'PROCESSING'].includes(paramType)) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Неверный paramType.' });
    }
    // Validate value by type
    if ((paramType === 'LENGTH_CM' || paramType === 'WIDTH_CM') && (valueNum == null || Number(valueNum) <= 0)) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'valueNum обязателен и должен быть > 0.' });
    }
    if (paramType === 'WEIGHT_G' && (valueInt == null || Number(valueInt) <= 0)) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'valueInt обязателен и должен быть > 0.' });
    }
    if (paramType === 'PROCESSING' && (!valueText || !valueText.trim())) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'valueText обязателен.' });
    }
    // Build data
    const data = {
        paramType,
        [ownerField]: ownerId,
        sortOrder: sortOrder != null ? Number(sortOrder) : 0,
    };
    if (paramType === 'LENGTH_CM' || paramType === 'WIDTH_CM') {
        data.valueNum = new client_1.Prisma.Decimal(String(valueNum)).toDecimalPlaces(2);
    }
    else if (paramType === 'WEIGHT_G') {
        data.valueInt = Number(valueInt);
    }
    else if (paramType === 'PROCESSING') {
        data.valueText = (0, paramValue_utils_1.normalizeProcessingText)(valueText);
    }
    // Auto-generate label if not provided
    const trimmedLabel = label?.trim();
    data.label = trimmedLabel || (0, paramValue_utils_1.autoLabel)(paramType, data);
    try {
        const created = await db_1.prisma.paramValue.create({ data });
        return res.status(201).json(created);
    }
    catch (error) {
        console.error('createParamValue error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'DUPLICATE', message: 'Такое значение параметра уже существует.' });
        }
        return res.status(400).json({ error: 'Failed to create param value' });
    }
}
// POST /api/param-values/subcategory/:subcategoryId
const createParamValueForSubcategory = async (req, res) => {
    try {
        const subcategoryId = Number(req.params.subcategoryId);
        // Check subcategory exists and is active
        const sub = await db_1.prisma.productSubcategory.findUnique({ where: { id: subcategoryId } });
        if (!sub) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Подкатегория не найдена.' });
        }
        if (!sub.isActive) {
            return res.status(400).json({ error: 'INACTIVE_OWNER', message: 'Подкатегория деактивирована. Нельзя добавлять новые значения.' });
        }
        const result = await createParamValue('subcategoryId', subcategoryId, req.body, res);
        (0, productParams_service_1.invalidateBySubcategory)(subcategoryId);
        return result;
    }
    catch (error) {
        console.error('createParamValueForSubcategory error:', error);
        res.status(500).json({ error: 'Failed to create param value' });
    }
};
exports.createParamValueForSubcategory = createParamValueForSubcategory;
// POST /api/param-values/product/:productId
const createParamValueForProduct = async (req, res) => {
    try {
        const productId = Number(req.params.productId);
        // Check product exists and has subcategory
        const product = await db_1.prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, subcategoryId: true },
        });
        if (!product) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Товар не найден.' });
        }
        if (!product.subcategoryId) {
            return res.status(400).json({ error: 'PRODUCT_SUBCATEGORY_REQUIRED', message: 'У товара не задана подкатегория.' });
        }
        // Check subcategory is active (#10)
        const subcategory = await db_1.prisma.productSubcategory.findUnique({
            where: { id: product.subcategoryId },
            select: { isActive: true },
        });
        if (!subcategory?.isActive) {
            return res.status(400).json({ error: 'INACTIVE_SUBCATEGORY', message: 'Подкатегория деактивирована. Нельзя добавлять override параметры.' });
        }
        const result = await createParamValue('productId', productId, req.body, res);
        (0, productParams_service_1.invalidateAvailableParams)(productId);
        return result;
    }
    catch (error) {
        console.error('createParamValueForProduct error:', error);
        res.status(500).json({ error: 'Failed to create param value' });
    }
};
exports.createParamValueForProduct = createParamValueForProduct;
// PATCH /api/param-values/:id
// Allowed: label, sortOrder, isActive only. Value fields are immutable.
const updateParamValue = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { label, sortOrder, isActive, valueNum, valueInt, valueText } = req.body;
        // Block attempts to change immutable value fields
        if (valueNum !== undefined || valueInt !== undefined || valueText !== undefined) {
            return res.status(400).json({
                error: 'VALUE_IMMUTABLE',
                message: 'Семантическое значение нельзя менять. Создайте новое и архивируйте старое.',
            });
        }
        const data = {};
        if (label !== undefined)
            data.label = label.trim();
        if (sortOrder !== undefined)
            data.sortOrder = Number(sortOrder);
        if (isActive !== undefined)
            data.isActive = Boolean(isActive);
        if (Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Нет данных для обновления.' });
        }
        // If deactivating, count affected variants for warning
        let affectedVariants = 0;
        if (isActive === false) {
            affectedVariants = await db_1.prisma.customerProductVariant.count({
                where: {
                    isActive: true,
                    OR: [
                        { lengthParamValueId: id },
                        { widthParamValueId: id },
                        { weightParamValueId: id },
                        { processingParamValueId: id },
                    ],
                },
            });
        }
        const updated = await db_1.prisma.paramValue.update({
            where: { id },
            data,
        });
        const response = { ...updated };
        if (isActive === false && affectedVariants > 0) {
            response.affectedVariants = affectedVariants;
            response.warning = `${affectedVariants} активных вариантов используют это значение и будут отмечены как "(архив)".`;
        }
        // Invalidate available params cache only when isActive changes
        if (isActive !== undefined) {
            (0, productParams_service_1.invalidateAllAvailableParams)();
        }
        res.json(response);
    }
    catch (error) {
        console.error('updateParamValue error:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Значение параметра не найдено.' });
        }
        res.status(400).json({ error: 'Failed to update param value' });
    }
};
exports.updateParamValue = updateParamValue;
