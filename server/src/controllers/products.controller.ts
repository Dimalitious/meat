import { Request, Response } from 'express';
import { prisma } from '../db';

export const getProducts = async (req: Request, res: Response) => {
    try {
        const { search, category } = req.query;

        let where: any = {};
        if (search) {
            where.OR = [
                { code: { contains: String(search) } },
                { name: { contains: String(search) } },
                { shortNameMorning: { contains: String(search) } }
            ];
        }
        if (category && category !== 'All') {
            where.category = String(category);
        }

        const products = await prisma.product.findMany({
            where,
            orderBy: { name: 'asc' }
        });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch products' });
    }
};

export const getProduct = async (req: Request, res: Response) => {
    try {
        const { code } = req.params as { code: string };
        const product = await prisma.product.findUnique({
            where: { code }
        });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch product' });
    }
};

export const createProduct = async (req: Request, res: Response) => {
    try {
        const product = await prisma.product.create({
            data: req.body
        });
        res.status(201).json(product);
    } catch (error) {
        res.status(400).json({ error: 'Failed to create product. Code might be unique.' });
    }
};

export const updateProduct = async (req: Request, res: Response) => {
    try {
        const { code } = req.params as { code: string };
        const product = await prisma.product.update({
            where: { code },
            data: req.body
        });
        res.json(product);
    } catch (error) {
        res.status(400).json({ error: 'Failed to update product' });
    }
};

export const deleteProduct = async (req: Request, res: Response) => {
    try {
        const { code } = req.params as { code: string };
        await prisma.product.delete({
            where: { code }
        });
        res.json({ message: 'Product deleted' });
    } catch (error) {
        res.status(400).json({ error: 'Failed to delete product' });
    }
};
