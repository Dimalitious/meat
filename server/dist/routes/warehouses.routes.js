"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const db_1 = require("../db");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// GET /api/warehouses - Get all warehouses
router.get('/', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.WAREHOUSES_READ), async (req, res) => {
    try {
        const { includeDisabled } = req.query;
        const where = includeDisabled === 'true' ? {} : { isDisabled: false };
        const warehouses = await db_1.prisma.warehouse.findMany({
            where,
            orderBy: { name: 'asc' },
            include: {
                responsibleUser: {
                    select: { id: true, name: true, username: true }
                }
            }
        });
        res.json(warehouses);
    }
    catch (error) {
        console.error('Error fetching warehouses:', error);
        res.status(500).json({ error: 'Failed to fetch warehouses' });
    }
});
// GET /api/warehouses/:code - Get warehouse by code
router.get('/:code', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.WAREHOUSES_READ), async (req, res) => {
    try {
        const code = req.params.code;
        const warehouse = await db_1.prisma.warehouse.findUnique({
            where: { code },
            include: {
                responsibleUser: {
                    select: { id: true, name: true, username: true }
                }
            }
        });
        if (!warehouse) {
            return res.status(404).json({ error: 'Warehouse not found' });
        }
        res.json(warehouse);
    }
    catch (error) {
        console.error('Error fetching warehouse:', error);
        res.status(500).json({ error: 'Failed to fetch warehouse' });
    }
});
// POST /api/warehouses - Create new warehouse
router.post('/', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.WAREHOUSES_MANAGE), async (req, res) => {
    try {
        const { code, name, address, phone, responsibleUserId, comment } = req.body;
        if (!code || !name || !address) {
            return res.status(400).json({ error: 'Код, название и адрес обязательны' });
        }
        const existing = await db_1.prisma.warehouse.findUnique({ where: { code } });
        if (existing) {
            return res.status(409).json({ error: 'Склад с таким кодом уже существует' });
        }
        const warehouse = await db_1.prisma.warehouse.create({
            data: {
                code,
                name,
                address,
                phone: phone || null,
                responsibleUserId: responsibleUserId || null,
                comment: comment || null,
            },
            include: {
                responsibleUser: {
                    select: { id: true, name: true, username: true }
                }
            }
        });
        res.status(201).json(warehouse);
    }
    catch (error) {
        console.error('Error creating warehouse:', error);
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Склад с таким кодом уже существует' });
        }
        res.status(500).json({ error: 'Failed to create warehouse' });
    }
});
// PUT /api/warehouses/:code - Update warehouse
router.put('/:code', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.WAREHOUSES_MANAGE), async (req, res) => {
    try {
        const code = req.params.code;
        const { name, address, phone, responsibleUserId, comment } = req.body;
        const existing = await db_1.prisma.warehouse.findUnique({ where: { code } });
        if (!existing) {
            return res.status(404).json({ error: 'Склад не найден' });
        }
        const warehouse = await db_1.prisma.warehouse.update({
            where: { code: code },
            data: {
                ...(name !== undefined && { name }),
                ...(address !== undefined && { address }),
                ...(phone !== undefined && { phone: phone || null }),
                ...(responsibleUserId !== undefined && { responsibleUserId: responsibleUserId || null }),
                ...(comment !== undefined && { comment: comment || null }),
            },
            include: {
                responsibleUser: {
                    select: { id: true, name: true, username: true }
                }
            }
        });
        res.json(warehouse);
    }
    catch (error) {
        console.error('Error updating warehouse:', error);
        res.status(500).json({ error: 'Failed to update warehouse' });
    }
});
// PUT /api/warehouses/toggle/:code - Toggle warehouse status
router.put('/toggle/:code', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.WAREHOUSES_MANAGE), async (req, res) => {
    try {
        const code = req.params.code;
        const existing = await db_1.prisma.warehouse.findUnique({ where: { code } });
        if (!existing) {
            return res.status(404).json({ error: 'Склад не найден' });
        }
        const warehouse = await db_1.prisma.warehouse.update({
            where: { code: code },
            data: { isDisabled: !existing.isDisabled }
        });
        const action = warehouse.isDisabled ? 'отключён' : 'активирован';
        res.json({ message: `Склад "${warehouse.name}" ${action}`, warehouse });
    }
    catch (error) {
        console.error('Error toggling warehouse:', error);
        res.status(500).json({ error: 'Failed to toggle warehouse' });
    }
});
// POST /api/warehouses/deactivate - Deactivate multiple warehouses
router.post('/deactivate', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.WAREHOUSES_MANAGE), async (req, res) => {
    try {
        const { codes } = req.body;
        if (!codes || !Array.isArray(codes) || codes.length === 0) {
            return res.status(400).json({ error: 'Codes array is required' });
        }
        const result = await db_1.prisma.warehouse.updateMany({
            where: { code: { in: codes } },
            data: { isDisabled: true }
        });
        res.json({ message: `Отключено складов: ${result.count}`, count: result.count });
    }
    catch (error) {
        console.error('Error deactivating warehouses:', error);
        res.status(500).json({ error: 'Failed to deactivate warehouses' });
    }
});
// DELETE /api/warehouses/:code - Delete warehouse (soft delete = disable)
router.delete('/:code', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.WAREHOUSES_MANAGE), async (req, res) => {
    try {
        const { code } = req.params;
        const warehouse = await db_1.prisma.warehouse.update({
            where: { code: req.params.code },
            data: { isDisabled: true }
        });
        res.json({ message: `Склад "${warehouse.name}" удалён (отключён)` });
    }
    catch (error) {
        console.error('Error deleting warehouse:', error);
        res.status(500).json({ error: 'Failed to delete warehouse' });
    }
});
exports.default = router;
