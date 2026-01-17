import { Request, Response } from 'express';
import { prisma } from '../db';

export const getCustomers = async (req: Request, res: Response) => {
    try {
        const { search } = req.query;
        let where: any = {};
        if (search) {
            where.OR = [
                { code: { contains: String(search) } },
                { name: { contains: String(search) } }
            ];
        }
        const items = await prisma.customer.findMany({
            where,
            include: { district: true, manager: true },
            orderBy: { name: 'asc' }
        });
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

export const createCustomer = async (req: Request, res: Response) => {
    try {
        const item = await prisma.customer.create({ data: req.body });
        res.status(201).json(item);
    } catch (error) {
        res.status(400).json({ error: 'Failed' });
    }
};

export const updateCustomer = async (req: Request, res: Response) => {
    try {
        const { code } = req.params as { code: string };
        const item = await prisma.customer.update({ where: { code }, data: req.body });
        res.json(item);
    } catch (error) {
        res.status(400).json({ error: 'Failed' });
    }
};

export const deleteCustomer = async (req: Request, res: Response) => {
    try {
        const { code } = req.params as { code: string };
        await prisma.customer.delete({ where: { code } });
        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(400).json({ error: 'Failed' });
    }
};
