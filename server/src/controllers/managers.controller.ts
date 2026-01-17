import { Request, Response } from 'express';
import { prisma } from '../db';

export const getManagers = async (req: Request, res: Response) => {
    try {
        const items = await prisma.manager.findMany({ orderBy: { name: 'asc' } });
        res.json(items);
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const createManager = async (req: Request, res: Response) => {
    try {
        const item = await prisma.manager.create({ data: req.body });
        res.status(201).json(item);
    } catch (error) { res.status(400).json({ error: 'Failed' }); }
};

export const updateManager = async (req: Request, res: Response) => {
    try {
        const { code } = req.params as { code: string };
        const item = await prisma.manager.update({ where: { code }, data: req.body });
        res.json(item);
    } catch (error) { res.status(400).json({ error: 'Failed' }); }
};

export const deleteManager = async (req: Request, res: Response) => {
    try {
        const { code } = req.params as { code: string };
        await prisma.manager.delete({ where: { code } });
        res.json({ message: 'Deleted' });
    } catch (error) { res.status(400).json({ error: 'Failed' }); }
};
