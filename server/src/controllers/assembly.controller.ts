import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get list of orders ready for assembly (status = new or processing)
export const getOrdersForAssembly = async (req: Request, res: Response) => {
    try {
        const orders = await prisma.order.findMany({
            where: {
                status: {
                    in: ['new', 'processing'] // Updated status values
                }
            },
            include: {
                customer: true,
                items: true,
            },
            orderBy: {
                date: 'asc'
            }
        });
        res.json(orders);
    } catch (error) {
        console.error('Error fetching assembly orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
};

// Get single order for assembly
export const getAssemblyOrder = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const order = await prisma.order.findUnique({
            where: { id: Number(id) },
            include: {
                customer: true,
                items: {
                    include: {
                        product: true
                    },
                    orderBy: {
                        product: {
                            name: 'asc' // Sort items by product name for easier finding in warehouse
                        }
                    }
                }
            }
        });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(order);
    } catch (error) {
        console.error('Error fetching assembly order:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
};

// Update assembly data (fact quantities) and close assembly
export const completeAssembly = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { items, status } = req.body; // items: { id: number, shippedQty: number }[]

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Update each item's shippedQty
            for (const item of items) {
                await tx.orderItem.update({
                    where: { id: item.id },
                    data: {
                        shippedQty: Number(item.shippedQty)
                    }
                });
            }

            // 2. Update Order Status
            const order = await tx.order.update({
                where: { id: Number(id) },
                data: {
                    status: 'delivered',  // Updated status value
                },
                include: { items: true } // Need items to deduct stock
            });

            // 3. Deduct Stock for EACH item
            for (const item of order.items) {
                if (item.shippedQty > 0) {
                    // Record consumption
                    await tx.stockTransaction.create({
                        data: {
                            productId: item.productId,
                            type: 'ASSEMBLY',
                            quantity: -item.shippedQty, // Negative
                            orderId: order.id
                        }
                    });

                    // Update Stock
                    await tx.stock.upsert({
                        where: { productId: item.productId },
                        update: { quantity: { decrement: item.shippedQty } },
                        create: { productId: item.productId, quantity: -item.shippedQty }
                    });
                }
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error completing assembly:', error);
        res.status(500).json({ error: 'Failed to complete assembly' });
    }
};
