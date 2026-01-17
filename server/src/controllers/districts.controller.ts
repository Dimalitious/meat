import { Request, Response } from 'express';
import { prisma } from '../db';

export const getDistricts = async (req: Request, res: Response) => {
    try {
        const items = await prisma.district.findMany({ orderBy: { name: 'asc' } });
        res.json(items);
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const createDistrict = async (req: Request, res: Response) => {
    try {
        const item = await prisma.district.create({ data: req.body });
        res.status(201).json(item);
    } catch (error) { res.status(400).json({ error: 'Failed' }); }
};

export const updateDistrict = async (req: Request, res: Response) => {
    try {
        const { code } = req.params as { code: string };
        const item = await prisma.district.update({ where: { code }, data: req.body });
        res.json(item);
    } catch (error) { res.status(400).json({ error: 'Failed' }); }
};

export const deleteDistrict = async (req: Request, res: Response) => {
    try {
        const { code } = req.params as { code: string };
        await prisma.district.delete({ where: { code } });
        res.json({ message: 'Deleted' });
    } catch (error) { res.status(400).json({ error: 'Failed' }); }
};
