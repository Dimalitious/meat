import { Request, Response } from 'express';
import { prisma } from '../db';

// Get all orders (with optional filters)
export const getOrders = async (req: Request, res: Response) => {
    try {
        const { date, customerId, status } = req.query;

        let where: any = {};
        if (date) where.date = new Date(String(date));
        if (customerId) where.customerId = Number(customerId);
        if (status) where.status = String(status);

        const orders = await prisma.order.findMany({
            where,
            include: {
                customer: true,
                items: {
                    include: { product: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
};

// Get single order
export const getOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const order = await prisma.order.findUnique({
            where: { id: Number(id) },
            include: {
                customer: true,
                items: { include: { product: true } }
            }
        });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch order' });
    }
};

// Create new order
export const createOrder = async (req: Request, res: Response) => {
    try {
        const { customerId, date, paymentType, items } = req.body;
        // items: [{ productId, quantity, price }]

        // Transaction to create order and items
        const result = await prisma.$transaction(async (tx) => {
            // 1. Calculate totals
            let totalAmount = 0;
            let totalWeight = 0;
            const validItems = [];

            for (const item of items) {
                const amount = item.price * item.quantity;
                totalAmount += amount;
                totalWeight += item.quantity;
                validItems.push({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price,
                    amount: amount,
                });
            }

            // 2. Create Order
            const order = await tx.order.create({
                data: {
                    customerId: Number(customerId),
                    date: new Date(date),
                    paymentType,
                    totalAmount,
                    totalWeight,
                    status: 'draft',
                    items: {
                        create: validItems
                    }
                },
                include: { items: true }
            });
            return order;
        });

        res.status(201).json(result);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Failed to create order' });
    }
};

// Update Order (Status or Driver)
export const updateOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, expeditorId } = req.body;

        let data: any = {};
        if (status) data.status = status;
        if (expeditorId !== undefined) data.expeditorId = expeditorId;

        const order = await prisma.order.update({
            where: { id: Number(id) },
            data
        });
        res.json(order);
    } catch (error) {
        res.status(400).json({ error: 'Failed to update order' });
    }
};

// Delete Order
export const deleteOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.order.delete({
            where: { id: Number(id) }
        });
        res.json({ message: 'Order deleted' });
    } catch (error) {
        res.status(400).json({ error: 'Failed to delete order' });
    }
};
