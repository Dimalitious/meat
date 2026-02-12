import { Request, Response } from 'express';
import { prisma } from '../db';

// GET /api/subcategories?active=true|all
export const getSubcategories = async (req: Request, res: Response) => {
    try {
        const { active } = req.query;
        const where: any = {};
        if (active === 'true') {
            where.isActive = true;
        }

        const items = await prisma.productSubcategory.findMany({
            where,
            orderBy: { name: 'asc' },
        });
        res.json({ items });
    } catch (error) {
        console.error('getSubcategories error:', error);
        res.status(500).json({ error: 'Failed to fetch subcategories' });
    }
};

// POST /api/subcategories
export const createSubcategory = async (req: Request, res: Response) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Название обязательно.' });
        }

        const subcategory = await prisma.productSubcategory.create({
            data: { name: name.trim() },
        });
        res.status(201).json(subcategory);
    } catch (error: any) {
        console.error('createSubcategory error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'DUPLICATE', message: 'Подкатегория с таким названием уже существует.' });
        }
        res.status(500).json({ error: 'SERVER_ERROR', message: 'Не удалось создать подкатегорию. Проверьте логи сервера.' });
    }
};

// PATCH /api/subcategories/:id
export const updateSubcategory = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const { name, isActive } = req.body;

        const data: any = {};
        if (name !== undefined) data.name = name.trim();
        if (isActive !== undefined) data.isActive = Boolean(isActive);

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Нет данных для обновления.' });
        }

        const subcategory = await prisma.productSubcategory.update({
            where: { id },
            data,
        });
        res.json(subcategory);
    } catch (error: any) {
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
