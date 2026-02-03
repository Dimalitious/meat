"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteExpeditor = exports.updateExpeditor = exports.createExpeditor = exports.getExpeditors = void 0;
const db_1 = require("../db");
const getExpeditors = async (req, res) => {
    try {
        const expeditors = await db_1.prisma.expeditor.findMany({
            orderBy: { name: 'asc' },
            where: { isActive: true }
        });
        res.json(expeditors);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch expeditors' });
    }
};
exports.getExpeditors = getExpeditors;
const createExpeditor = async (req, res) => {
    try {
        const { name, phone } = req.body;
        const expeditor = await db_1.prisma.expeditor.create({
            data: { name, phone }
        });
        res.status(201).json(expeditor);
    }
    catch (error) {
        res.status(400).json({ error: 'Failed to create expeditor' });
    }
};
exports.createExpeditor = createExpeditor;
const updateExpeditor = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, isActive } = req.body;
        const expeditor = await db_1.prisma.expeditor.update({
            where: { id: parseInt(String(id)) },
            data: { name, phone, isActive }
        });
        res.json(expeditor);
    }
    catch (error) {
        res.status(400).json({ error: 'Failed to update expeditor' });
    }
};
exports.updateExpeditor = updateExpeditor;
const deleteExpeditor = async (req, res) => {
    try {
        const { id } = req.params;
        // Soft delete
        await db_1.prisma.expeditor.update({
            where: { id: parseInt(String(id)) },
            data: { isActive: false }
        });
        res.json({ message: 'Expeditor deactivated' });
    }
    catch (error) {
        res.status(400).json({ error: 'Failed to delete expeditor' });
    }
};
exports.deleteExpeditor = deleteExpeditor;
