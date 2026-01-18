import { Request, Response } from 'express';
import { PrismaClient, SummaryOrderJournal } from '@prisma/client';

const prisma = new PrismaClient();

// Get all summary orders (with optional date filter)
export const getSummaryOrders = async (req: Request, res: Response) => {
    try {
        const { date } = req.query;

        const where: any = {};
        if (date) {
            const startDate = new Date(date as string);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1);
            where.shipDate = { gte: startDate, lt: endDate };
        }

        const orders = await prisma.summaryOrderJournal.findMany({
            where,
            include: {
                customer: true,
                product: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(orders);
    } catch (error) {
        console.error('Get summary orders error:', error);
        res.status(500).json({ error: 'Failed to fetch summary orders' });
    }
};

// Create summary order entry
export const createSummaryOrder = async (req: Request, res: Response) => {
    try {
        const {
            shipDate,
            paymentType,
            customerId,
            customerName,
            productId,
            productFullName,
            category,
            shortNameMorning,
            priceType,
            price,
            shippedQty,
            orderQty,
            distributionCoef,
            weightToDistribute,
            managerId,
            managerName,
            status
        } = req.body;

        const priceNum = Number(price) || 0;
        const shippedNum = Number(shippedQty) || 0;
        const dateObj = new Date(shipDate);

        // Generate IDN based on date: format DDMMYYYY (same for all records on same day)
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        const idn = `${day}${month}${year}`;

        const entry = await prisma.summaryOrderJournal.create({
            data: {
                idn,
                shipDate: new Date(shipDate),
                paymentType,
                customerId: customerId ? Number(customerId) : null,
                customerName: customerName || '',
                productId: productId ? Number(productId) : null,
                productFullName: productFullName || '',
                category,
                shortNameMorning,
                priceType,
                price: priceNum,
                shippedQty: shippedNum,
                orderQty: Number(orderQty) || 0,
                sumWithRevaluation: priceNum * shippedNum,
                distributionCoef: Number(distributionCoef) || 0,
                weightToDistribute: Number(weightToDistribute) || 0,
                managerId,
                managerName,
                status: status || 'draft'
            },
            include: { customer: true, product: true }
        });
        res.json(entry);
    } catch (error: any) {
        console.error('Create summary order error:', error);
        console.error('Error details:', error.message);
        res.status(400).json({ error: 'Failed to create summary order', details: error.message });
    }
};


// Update summary order entry
export const updateSummaryOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data: any = { ...req.body };

        // Remove null values for optional relations
        if (data.price !== undefined) data.price = Number(data.price);
        if (data.shippedQty !== undefined) data.shippedQty = Number(data.shippedQty);
        if (data.orderQty !== undefined) data.orderQty = Number(data.orderQty);
        if (data.distributionCoef !== undefined) data.distributionCoef = Number(data.distributionCoef);
        if (data.weightToDistribute !== undefined) data.weightToDistribute = Number(data.weightToDistribute);

        // Recalculate sumWithRevaluation if price or shippedQty changed
        if (data.price !== undefined || data.shippedQty !== undefined) {
            const existing = await prisma.summaryOrderJournal.findUnique({ where: { id: Number(id) } });
            if (existing) {
                const price = data.price !== undefined ? data.price : Number(existing.price);
                const shippedQty = data.shippedQty !== undefined ? data.shippedQty : existing.shippedQty;
                data.sumWithRevaluation = price * shippedQty;
            }
        }

        const entry = await prisma.summaryOrderJournal.update({
            where: { id: Number(id) },
            data,
            include: { customer: true, product: true }
        });
        res.json(entry);
    } catch (error) {
        console.error('Update summary order error:', error);
        res.status(400).json({ error: 'Failed to update summary order' });
    }
};

// Delete summary order entry
export const deleteSummaryOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.summaryOrderJournal.delete({
            where: { id: Number(id) }
        });
        res.json({ message: 'Entry deleted' });
    } catch (error) {
        console.error('Delete summary order error:', error);
        res.status(400).json({ error: 'Failed to delete summary order' });
    }
};

// Sync entries to Orders table (called after status changed to synced)
export const syncToOrders = async (req: Request, res: Response) => {
    try {
        const { entryIds } = req.body;
        console.log('[SYNC] Called with entryIds:', entryIds);

        // Get entries to sync
        const entries = await prisma.summaryOrderJournal.findMany({
            where: {
                id: { in: entryIds.map((id: number) => Number(id)) }
            },
            include: { customer: true, product: true }
        });

        console.log('[SYNC] Found entries:', entries.length);
        if (entries.length > 0) {
            console.log('[SYNC] First entry:', JSON.stringify(entries[0], null, 2));
        }

        if (entries.length === 0) {
            return res.json({
                message: 'DEBUG: No entries found for sync',
                synced: 0,
                debug: {
                    receivedIds: entryIds,
                    parsedIds: entryIds.map((id: number) => Number(id))
                }
            });
        }

        const results = [];

        // Process each entry individually to handle IDN + customer correctly
        for (const entry of entries) {
            if (!entry.customerId || !entry.productId) continue;

            const idn = entry.idn || null;

            // Find existing order by IDN + customer
            let order = await prisma.order.findFirst({
                where: {
                    customerId: entry.customerId,
                    ...(idn ? { idn } : { date: entry.shipDate })
                }
            });

            if (order) {
                // Check if this product is already in the order
                const existingItem = await prisma.orderItem.findFirst({
                    where: {
                        orderId: order.id,
                        productId: entry.productId
                    }
                });

                if (existingItem) {
                    // Update existing item
                    await prisma.orderItem.update({
                        where: { id: existingItem.id },
                        data: {
                            quantity: entry.orderQty,
                            shippedQty: entry.shippedQty,
                            price: entry.price,
                            amount: Number(entry.price) * entry.orderQty
                        }
                    });
                    results.push({ action: 'item_updated', orderId: order.id, productId: entry.productId });
                } else {
                    // Add new item to existing order
                    await prisma.orderItem.create({
                        data: {
                            orderId: order.id,
                            productId: entry.productId,
                            quantity: entry.orderQty,
                            price: entry.price,
                            amount: Number(entry.price) * entry.orderQty,
                            shippedQty: entry.shippedQty,
                            sumWithRevaluation: entry.sumWithRevaluation,
                            distributionCoef: entry.distributionCoef,
                            weightToDistribute: entry.weightToDistribute
                        }
                    });

                    // Update order totals
                    await prisma.order.update({
                        where: { id: order.id },
                        data: {
                            totalAmount: { increment: Number(entry.price) * entry.orderQty },
                            totalWeight: { increment: entry.orderQty }
                        }
                    });

                    results.push({ action: 'item_added', orderId: order.id, productId: entry.productId });
                }
            } else {
                // Create new order with IDN
                order = await prisma.order.create({
                    data: {
                        customerId: entry.customerId,
                        date: entry.shipDate,
                        idn: idn,
                        paymentType: entry.paymentType,
                        status: 'new',
                        totalAmount: Number(entry.price) * entry.orderQty,
                        totalWeight: entry.orderQty,
                        items: {
                            create: {
                                productId: entry.productId,
                                quantity: entry.orderQty,
                                price: entry.price,
                                amount: Number(entry.price) * entry.orderQty,
                                shippedQty: entry.shippedQty,
                                sumWithRevaluation: entry.sumWithRevaluation,
                                distributionCoef: entry.distributionCoef,
                                weightToDistribute: entry.weightToDistribute
                            }
                        }
                    }
                });

                results.push({ action: 'order_created', orderId: order.id, customerId: entry.customerId, idn });
            }
        }

        res.json({ message: 'Sync completed', results });
    } catch (error) {
        console.error('Sync to orders error:', error);
        res.status(500).json({ error: 'Failed to sync to orders' });
    }
};

// Send to rework - mark summary orders with given IDN as needing rework
export const sendToRework = async (req: Request, res: Response) => {
    try {
        const { idn } = req.body;

        if (!idn) {
            return res.status(400).json({ error: 'IDN is required' });
        }

        // Find all summary orders with this IDN and mark as rework
        const updated = await prisma.summaryOrderJournal.updateMany({
            where: { idn },
            data: { status: 'rework' }
        });

        res.json({ message: 'Sent to rework', count: updated.count });
    } catch (error) {
        console.error('Send to rework error:', error);
        res.status(500).json({ error: 'Failed to send to rework' });
    }
};
