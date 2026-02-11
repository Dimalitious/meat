import { Request, Response } from 'express';
import { prisma } from '../db';

// GET /api/countries?active=true|all
export const getCountries = async (req: Request, res: Response) => {
    try {
        const { active } = req.query;
        const where: any = {};
        if (active === 'true') {
            where.isActive = true;
        }
        // active=all or not specified → return all

        const items = await prisma.country.findMany({
            where,
            orderBy: { name: 'asc' },
        });
        res.json({ items });
    } catch (error) {
        console.error('getCountries error:', error);
        res.status(500).json({ error: 'Failed to fetch countries' });
    }
};

// POST /api/countries
export const createCountry = async (req: Request, res: Response) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Название обязательно.' });
        }

        const country = await prisma.country.create({
            data: { name: name.trim() },
        });
        res.status(201).json(country);
    } catch (error: any) {
        console.error('createCountry error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'DUPLICATE', message: 'Страна с таким названием уже существует.' });
        }
        res.status(500).json({ error: 'Failed to create country' });
    }
};

// PATCH /api/countries/:id
export const updateCountry = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const { name, isActive } = req.body;

        const data: any = {};
        if (name !== undefined) data.name = name.trim();
        if (isActive !== undefined) data.isActive = Boolean(isActive);

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Нет данных для обновления.' });
        }

        const country = await prisma.country.update({
            where: { id },
            data,
        });
        res.json(country);
    } catch (error: any) {
        console.error('updateCountry error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'DUPLICATE', message: 'Страна с таким названием уже существует.' });
        }
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Страна не найдена.' });
        }
        res.status(500).json({ error: 'Failed to update country' });
    }
};
