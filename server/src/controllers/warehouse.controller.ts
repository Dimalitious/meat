import { Request, Response } from 'express';
import { prisma } from '../db';

// Get Current Stock (All Products)
export const getStock = async (req: Request, res: Response) => {
    try {
        const stock = await prisma.product.findMany({
            select: {
                id: true,
                code: true,
                name: true,
                category: true,
                stock: {
                    select: { quantity: true, updatedAt: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        // Flatten structure for easier frontend consumption
        const flatStock = stock.map(p => ({
            id: p.id,
            code: p.code,
            name: p.name,
            category: p.category,
            quantity: p.stock ? p.stock.quantity : 0,
            updatedAt: p.stock ? p.stock.updatedAt : null
        }));

        res.json(flatStock);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch stock' });
    }
};

// Create Arrival (Prihod)
export const createArrival = async (req: Request, res: Response) => {
    try {
        const { productId, quantity, note } = req.body; // quantity > 0

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Transaction
            await tx.stockTransaction.create({
                data: {
                    productId: Number(productId),
                    type: 'ARRIVAL',
                    quantity: Number(quantity),
                    note
                }
            });

            // 2. Update Stock
            const stock = await tx.stock.upsert({
                where: { productId: Number(productId) },
                update: { quantity: { increment: Number(quantity) } },
                create: { productId: Number(productId), quantity: Number(quantity) }
            });

            return stock;
        });

        res.status(201).json(result);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Failed to create arrival' });
    }
};

// Create Adjustment (Correction)
export const createAdjustment = async (req: Request, res: Response) => {
    try {
        const { productId, quantity, note } = req.body; // quantity can be +/-

        const result = await prisma.$transaction(async (tx) => {
            await tx.stockTransaction.create({
                data: {
                    productId: Number(productId),
                    type: 'ADJUSTMENT',
                    quantity: Number(quantity),
                    note
                }
            });

            const stock = await tx.stock.upsert({
                where: { productId: Number(productId) },
                update: { quantity: { increment: Number(quantity) } },
                create: { productId: Number(productId), quantity: Number(quantity) }
            });

            return stock;
        });

        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ error: 'Failed to create adjustment' });
    }
};

// Get Transaction History
export const getHistory = async (req: Request, res: Response) => {
    try {
        const history = await prisma.stockTransaction.findMany({
            include: { product: true },
            orderBy: { createdAt: 'desc' },
            take: 50 // Limit to last 50
        });
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
};
