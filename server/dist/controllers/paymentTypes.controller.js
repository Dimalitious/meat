"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDefaultPaymentTypes = exports.deletePaymentType = exports.togglePaymentType = exports.updatePaymentType = exports.createPaymentType = exports.getPaymentTypeById = exports.getDefaultPaymentType = exports.getPaymentTypes = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
/**
 * Получить список типов оплат
 */
const getPaymentTypes = async (req, res) => {
    try {
        const { includeDisabled } = req.query;
        const where = includeDisabled === 'true' ? {} : { isDisabled: false };
        const paymentTypes = await prisma.paymentType.findMany({
            where,
            orderBy: [
                { isDefault: 'desc' }, // Сначала дефолтный
                { name: 'asc' }
            ]
        });
        res.json(paymentTypes);
    }
    catch (error) {
        console.error('getPaymentTypes error:', error);
        res.status(500).json({ error: 'Failed to fetch payment types' });
    }
};
exports.getPaymentTypes = getPaymentTypes;
/**
 * Получить тип оплаты по умолчанию
 */
const getDefaultPaymentType = async (req, res) => {
    try {
        // 1. Ищем по isDefault = true
        let defaultType = await prisma.paymentType.findFirst({
            where: { isDefault: true, isDisabled: false }
        });
        // 2. Если нет - ищем по имени "Перечисление"
        if (!defaultType) {
            defaultType = await prisma.paymentType.findFirst({
                where: { name: 'Перечисление', isDisabled: false }
            });
        }
        // 3. Если всё ещё нет - берём первый активный
        if (!defaultType) {
            defaultType = await prisma.paymentType.findFirst({
                where: { isDisabled: false },
                orderBy: { name: 'asc' }
            });
        }
        if (!defaultType) {
            return res.status(404).json({
                error: 'No active payment types found. Please add payment types first.',
                warning: true
            });
        }
        res.json(defaultType);
    }
    catch (error) {
        console.error('getDefaultPaymentType error:', error);
        res.status(500).json({ error: 'Failed to fetch default payment type' });
    }
};
exports.getDefaultPaymentType = getDefaultPaymentType;
/**
 * Получить тип оплаты по ID
 */
const getPaymentTypeById = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const paymentType = await prisma.paymentType.findUnique({
            where: { id }
        });
        if (!paymentType) {
            return res.status(404).json({ error: 'Payment type not found' });
        }
        res.json(paymentType);
    }
    catch (error) {
        console.error('getPaymentTypeById error:', error);
        res.status(500).json({ error: 'Failed to fetch payment type' });
    }
};
exports.getPaymentTypeById = getPaymentTypeById;
/**
 * Создать тип оплаты
 */
const createPaymentType = async (req, res) => {
    try {
        const { name, isDefault } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name is required' });
        }
        // Проверка уникальности
        const existing = await prisma.paymentType.findUnique({
            where: { name: name.trim() }
        });
        if (existing) {
            return res.status(400).json({ error: 'Payment type with this name already exists' });
        }
        // Если устанавливаем как дефолтный - сбросить у других
        if (isDefault) {
            await prisma.paymentType.updateMany({
                where: { isDefault: true },
                data: { isDefault: false }
            });
        }
        const paymentType = await prisma.paymentType.create({
            data: {
                name: name.trim(),
                isDefault: isDefault || false
            }
        });
        res.status(201).json(paymentType);
    }
    catch (error) {
        console.error('createPaymentType error:', error);
        res.status(500).json({ error: 'Failed to create payment type' });
    }
};
exports.createPaymentType = createPaymentType;
/**
 * Обновить тип оплаты
 */
const updatePaymentType = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { name, isDisabled, isDefault } = req.body;
        const existing = await prisma.paymentType.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Payment type not found' });
        }
        // Проверка уникальности имени при изменении
        if (name && name.trim() !== existing.name) {
            const duplicate = await prisma.paymentType.findUnique({
                where: { name: name.trim() }
            });
            if (duplicate) {
                return res.status(400).json({ error: 'Payment type with this name already exists' });
            }
        }
        // Если устанавливаем как дефолтный - сбросить у других
        if (isDefault === true && !existing.isDefault) {
            await prisma.paymentType.updateMany({
                where: { isDefault: true, id: { not: id } },
                data: { isDefault: false }
            });
        }
        const paymentType = await prisma.paymentType.update({
            where: { id },
            data: {
                ...(name !== undefined && { name: name.trim() }),
                ...(isDisabled !== undefined && { isDisabled }),
                ...(isDefault !== undefined && { isDefault })
            }
        });
        res.json(paymentType);
    }
    catch (error) {
        console.error('updatePaymentType error:', error);
        res.status(500).json({ error: 'Failed to update payment type' });
    }
};
exports.updatePaymentType = updatePaymentType;
/**
 * Отключить/включить тип оплаты
 */
const togglePaymentType = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const existing = await prisma.paymentType.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Payment type not found' });
        }
        const paymentType = await prisma.paymentType.update({
            where: { id },
            data: { isDisabled: !existing.isDisabled }
        });
        res.json(paymentType);
    }
    catch (error) {
        console.error('togglePaymentType error:', error);
        res.status(500).json({ error: 'Failed to toggle payment type' });
    }
};
exports.togglePaymentType = togglePaymentType;
/**
 * Удалить тип оплаты (только если не используется)
 */
const deletePaymentType = async (req, res) => {
    try {
        const id = Number(req.params.id);
        // Проверка использования
        const usageCount = await prisma.purchaseItem.count({
            where: { paymentTypeId: id }
        });
        if (usageCount > 0) {
            return res.status(400).json({
                error: `Cannot delete: payment type is used in ${usageCount} purchase items. Use disable instead.`
            });
        }
        await prisma.paymentType.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (error) {
        console.error('deletePaymentType error:', error);
        res.status(500).json({ error: 'Failed to delete payment type' });
    }
};
exports.deletePaymentType = deletePaymentType;
/**
 * Засеять базовые типы оплат
 * "Перечисление" устанавливается как дефолтный
 */
const seedDefaultPaymentTypes = async (req, res) => {
    try {
        const defaultTypes = [
            { name: 'Нал', isDefault: false },
            { name: 'Перечисление', isDefault: true }, // Дефолтный!
            { name: 'Карта', isDefault: false }
        ];
        const created = [];
        for (const typeData of defaultTypes) {
            const existing = await prisma.paymentType.findUnique({ where: { name: typeData.name } });
            if (!existing) {
                const pt = await prisma.paymentType.create({
                    data: {
                        name: typeData.name,
                        isDefault: typeData.isDefault
                    }
                });
                created.push(pt);
            }
            else if (typeData.isDefault && !existing.isDefault) {
                // Обновляем существующий, если это должен быть дефолтный
                await prisma.paymentType.update({
                    where: { id: existing.id },
                    data: { isDefault: true }
                });
            }
        }
        // Убедимся, что только один дефолтный
        const defaultCount = await prisma.paymentType.count({ where: { isDefault: true } });
        if (defaultCount > 1) {
            // Оставить только "Перечисление" как дефолтный
            await prisma.paymentType.updateMany({
                where: { isDefault: true, name: { not: 'Перечисление' } },
                data: { isDefault: false }
            });
        }
        res.json({
            message: `Created ${created.length} default payment types. "Перечисление" is set as default.`,
            created
        });
    }
    catch (error) {
        console.error('seedDefaultPaymentTypes error:', error);
        res.status(500).json({ error: 'Failed to seed payment types' });
    }
};
exports.seedDefaultPaymentTypes = seedDefaultPaymentTypes;
