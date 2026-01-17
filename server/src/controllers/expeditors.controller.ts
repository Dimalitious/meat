import { Request, Response } from 'express';
import { prisma } from '../db';

export const getExpeditors = async (req: Request, res: Response) => {
    try {
        const expeditors = await prisma.expeditor.findMany({
            orderBy: { name: 'asc' },
            where: { isActive: true }
        });
        res.json(expeditors);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch expeditors' });
    }
};

export const createExpeditor = async (req: Request, res: Response) => {
    try {
        const { name, phone } = req.body;
        const expeditor = await prisma.expeditor.create({
            data: { name, phone }
        });
        res.status(201).json(expeditor);
    } catch (error) {
        res.status(400).json({ error: 'Failed to create expeditor' });
    }
};

export const updateExpeditor = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, phone, isActive } = req.body;
        const expeditor = await prisma.expeditor.update({
            where: { id: parseInt(String(id)) },
            data: { name, phone, isActive }
        });
        res.json(expeditor);
    } catch (error) {
        res.status(400).json({ error: 'Failed to update expeditor' });
    }
};

export const deleteExpeditor = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // Soft delete
        await prisma.expeditor.update({
            where: { id: parseInt(String(id)) },
            data: { isActive: false }
        });
        res.json({ message: 'Expeditor deactivated' });
    } catch (error) {
        res.status(400).json({ error: 'Failed to delete expeditor' });
    }
};
