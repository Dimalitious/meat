import { Request, Response } from 'express';
import { prisma } from '../db';

export const getSuppliers = async (req: Request, res: Response) => {
    try {
        const items = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
        res.json(items);
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const createSupplier = async (req: Request, res: Response) => {
    try {
        const item = await prisma.supplier.create({ data: req.body });
        res.status(201).json(item);
    } catch (error) { res.status(400).json({ error: 'Failed' }); }
};

export const updateSupplier = async (req: Request, res: Response) => {
    try {
        const { code } = req.params as { code: string };
        const item = await prisma.supplier.update({ where: { code }, data: req.body });
        res.json(item);
    } catch (error) { res.status(400).json({ error: 'Failed' }); }
};

export const deleteSupplier = async (req: Request, res: Response) => {
    try {
        const { code } = req.params as { code: string };
        await prisma.supplier.delete({ where: { code } });
        res.json({ message: 'Deleted' });
    } catch (error) { res.status(400).json({ error: 'Failed' }); }
};
