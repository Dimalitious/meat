"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeAssembly = exports.getAssemblyOrder = exports.getOrdersForAssembly = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Get list of orders ready for assembly (status = new or processing)
const getOrdersForAssembly = async (req, res) => {
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
    }
    catch (error) {
        console.error('Error fetching assembly orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
};
exports.getOrdersForAssembly = getOrdersForAssembly;
// Get single order for assembly
const getAssemblyOrder = async (req, res) => {
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
    }
    catch (error) {
        console.error('Error fetching assembly order:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
};
exports.getAssemblyOrder = getAssemblyOrder;
// Update assembly data (fact quantities) and close assembly
const completeAssembly = async (req, res) => {
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
                    status: 'delivered', // Updated status value
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
    }
    catch (error) {
        console.error('Error completing assembly:', error);
        res.status(500).json({ error: 'Failed to complete assembly' });
    }
};
exports.completeAssembly = completeAssembly;
