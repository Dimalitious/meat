"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSupplier = exports.deactivateSuppliers = exports.toggleSupplier = exports.updateSupplier = exports.createSupplier = exports.getSuppliers = void 0;
const db_1 = require("../db");
// Получить список поставщиков с поиском
const getSuppliers = async (req, res) => {
    try {
        const { search, activeOnly } = req.query;
        let where = {};
        if (search) {
            where.OR = [
                { code: { contains: String(search), mode: 'insensitive' } },
                { name: { contains: String(search), mode: 'insensitive' } }
            ];
        }
        // Для выпадающих списков возвращаем только активных
        if (activeOnly === 'true') {
            where.isActive = true;
        }
        const items = await db_1.prisma.supplier.findMany({
            where,
            orderBy: { name: 'asc' },
            include: {
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
        });
        res.json(items);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
};
exports.getSuppliers = getSuppliers;
// Создать поставщика
const createSupplier = async (req, res) => {
    try {
        const { code, name, legalName, altName, phone, telegram, primaryMmlId } = req.body;
        if (!code || !name) {
            return res.status(400).json({ error: 'Код и название обязательны' });
        }
        const existing = await db_1.prisma.supplier.findUnique({ where: { code } });
        if (existing) {
            return res.status(400).json({ error: 'Поставщик с таким кодом уже существует' });
        }
        const item = await db_1.prisma.supplier.create({
            data: {
                code,
                name,
                legalName: legalName || null,
                altName: altName || null,
                phone: phone || null,
                telegram: telegram || null,
                isActive: true,
                primaryMmlId: primaryMmlId || null
            },
            include: {
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
        });
        res.status(201).json(item);
    }
    catch (error) {
        console.error('Create supplier error:', error);
        res.status(400).json({ error: 'Failed to create supplier' });
    }
};
exports.createSupplier = createSupplier;
// Обновить поставщика
const updateSupplier = async (req, res) => {
    try {
        const { code } = req.params;
        const { name, legalName, altName, phone, telegram, isActive, primaryMmlId } = req.body;
        const item = await db_1.prisma.supplier.update({
            where: { code },
            data: {
                ...(name !== undefined && { name }),
                ...(legalName !== undefined && { legalName }),
                ...(altName !== undefined && { altName }),
                ...(phone !== undefined && { phone }),
                ...(telegram !== undefined && { telegram }),
                ...(isActive !== undefined && { isActive }),
                ...(primaryMmlId !== undefined && { primaryMmlId: primaryMmlId || null })
            },
            include: {
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
        });
        res.json(item);
    }
    catch (error) {
        console.error('Update supplier error:', error);
        res.status(400).json({ error: 'Failed to update supplier' });
    }
};
exports.updateSupplier = updateSupplier;
// Переключить статус поставщика (отключить/включить)
const toggleSupplier = async (req, res) => {
    try {
        const { code } = req.params;
        const supplier = await db_1.prisma.supplier.findUnique({ where: { code } });
        if (!supplier) {
            return res.status(404).json({ error: 'Поставщик не найден' });
        }
        const newStatus = !supplier.isActive;
        const updated = await db_1.prisma.supplier.update({
            where: { code },
            data: { isActive: newStatus }
        });
        res.json({
            message: newStatus ? 'Поставщик активирован' : 'Поставщик отключён',
            supplier: updated
        });
    }
    catch (error) {
        console.error('Toggle supplier error:', error);
        res.status(400).json({ error: 'Failed to toggle supplier status' });
    }
};
exports.toggleSupplier = toggleSupplier;
// Массовое отключение поставщиков
const deactivateSuppliers = async (req, res) => {
    try {
        const { codes } = req.body;
        if (!codes || !Array.isArray(codes) || codes.length === 0) {
            return res.status(400).json({ error: 'Не указаны коды поставщиков' });
        }
        const result = await db_1.prisma.supplier.updateMany({
            where: { code: { in: codes } },
            data: { isActive: false }
        });
        res.json({
            message: `Отключено поставщиков: ${result.count}`,
            count: result.count
        });
    }
    catch (error) {
        console.error('Deactivate suppliers error:', error);
        res.status(400).json({ error: 'Failed to deactivate suppliers' });
    }
};
exports.deactivateSuppliers = deactivateSuppliers;
// Удаление поставщика (не используется по ТЗ, но оставляем для совместимости)
const deleteSupplier = async (req, res) => {
    try {
        const { code } = req.params;
        await db_1.prisma.supplier.delete({ where: { code } });
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        res.status(400).json({ error: 'Failed to delete supplier' });
    }
};
exports.deleteSupplier = deleteSupplier;
