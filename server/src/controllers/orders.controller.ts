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
                    shippedQty: item.shippedQty || 0,
                    sumWithRevaluation: item.sumWithRevaluation || amount,
                    distributionCoef: item.distributionCoef || 0,
                    weightToDistribute: item.weightToDistribute || 0,
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
                    status: 'new',
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

// Update Order (Full update with items)
export const updateOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { customerId, date, paymentType, status, expeditorId, items } = req.body;

        // If items are provided, do a full update with transaction
        if (items && Array.isArray(items)) {
            const result = await prisma.$transaction(async (tx) => {
                // Delete existing items
                await tx.orderItem.deleteMany({
                    where: { orderId: Number(id) }
                });

                // Calculate totals
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
                        shippedQty: item.shippedQty || 0,
                        sumWithRevaluation: item.sumWithRevaluation || amount,
                        distributionCoef: item.distributionCoef || 0,
                        weightToDistribute: item.weightToDistribute || 0,
                    });
                }

                // Update order with new items
                const order = await tx.order.update({
                    where: { id: Number(id) },
                    data: {
                        customerId: customerId ? Number(customerId) : undefined,
                        date: date ? new Date(date) : undefined,
                        paymentType,
                        status,
                        expeditorId: expeditorId !== undefined ? expeditorId : undefined,
                        totalAmount,
                        totalWeight,
                        items: {
                            create: validItems
                        }
                    },
                    include: {
                        items: { include: { product: true } },
                        customer: true
                    }
                });
                return order;
            });
            res.json(result);
        } else {
            // Simple update (just status or expeditor)
            let data: any = {};
            if (status) data.status = status;
            if (expeditorId !== undefined) data.expeditorId = expeditorId;
            if (paymentType) data.paymentType = paymentType;

            const order = await prisma.order.update({
                where: { id: Number(id) },
                data
            });
            res.json(order);
        }
    } catch (error) {
        console.error('Update order error:', error);
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
