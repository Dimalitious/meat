"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSubcategory = exports.createSubcategory = exports.getSubcategories = void 0;
const db_1 = require("../db");
// GET /api/subcategories?active=true|all
const getSubcategories = async (req, res) => {
    try {
        const { active } = req.query;
        const where = {};
        if (active === 'true') {
            where.isActive = true;
        }
        const items = await db_1.prisma.productSubcategory.findMany({
            where,
            orderBy: { name: 'asc' },
        });
        res.json({ items });
    }
    catch (error) {
        console.error('getSubcategories error:', error);
        res.status(500).json({ error: 'Failed to fetch subcategories' });
    }
};
exports.getSubcategories = getSubcategories;
// POST /api/subcategories
const createSubcategory = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Название обязательно.' });
        }
        const subcategory = await db_1.prisma.productSubcategory.create({
            data: { name: name.trim() },
        });
        res.status(201).json(subcategory);
    }
    catch (error) {
        console.error('createSubcategory error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'DUPLICATE', message: 'Подкатегория с таким названием уже существует.' });
        }
        res.status(500).json({ error: 'Failed to create subcategory' });
    }
};
exports.createSubcategory = createSubcategory;
// PATCH /api/subcategories/:id
const updateSubcategory = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { name, isActive } = req.body;
        const data = {};
        if (name !== undefined)
            data.name = name.trim();
        if (isActive !== undefined)
            data.isActive = Boolean(isActive);
        if (Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Нет данных для обновления.' });
        }
        const subcategory = await db_1.prisma.productSubcategory.update({
            where: { id },
            data,
        });
        res.json(subcategory);
    }
    catch (error) {
        console.error('updateSubcategory error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'DUPLICATE', message: 'Подкатегория с таким названием уже существует.' });
        }
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Подкатегория не найдена.' });
        }
        res.status(500).json({ error: 'Failed to update subcategory' });
    }
};
exports.updateSubcategory = updateSubcategory;
