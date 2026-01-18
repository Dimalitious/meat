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

        const entry = await prisma.summaryOrderJournal.create({
            data: {
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

// Sync entries with status "forming" to Orders table
export const syncToOrders = async (req: Request, res: Response) => {
    try {
        const { entryIds } = req.body;

        // Get entries to sync
        const entries = await prisma.summaryOrderJournal.findMany({
            where: {
                id: { in: entryIds.map((id: number) => Number(id)) },
                status: 'forming'
            },
            include: { customer: true, product: true }
        });

        if (entries.length === 0) {
            return res.json({ message: 'No entries to sync', synced: 0 });
        }

        // Group by customerId + shipDate
        const grouped: { [key: string]: SummaryOrderJournal[] } = {};
        for (const entry of entries) {
            const dateStr = entry.shipDate.toISOString().split('T')[0];
            const key = `${entry.customerId}_${dateStr}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(entry);
        }

        const results = [];

        for (const [key, groupEntries] of Object.entries(grouped)) {
            const [customerIdStr, dateStr] = key.split('_');
            const customerId = Number(customerIdStr);
            const shipDate = new Date(dateStr);

            if (!customerId || isNaN(customerId)) continue;

            // Check if order exists for this customer + date
            let order = await prisma.order.findFirst({
                where: {
                    customerId,
                    date: {
                        gte: shipDate,
                        lt: new Date(shipDate.getTime() + 24 * 60 * 60 * 1000)
                    }
                }
            });

            const validEntries = groupEntries.filter(e => e.productId);
            if (validEntries.length === 0) continue;

            if (order) {
                // Add items to existing order
                for (const entry of validEntries) {
                    await prisma.orderItem.create({
                        data: {
                            orderId: order.id,
                            productId: entry.productId!,
                            quantity: entry.orderQty,
                            price: entry.price,
                            amount: Number(entry.price) * entry.orderQty,
                            shippedQty: entry.shippedQty,
                            sumWithRevaluation: entry.sumWithRevaluation,
                            distributionCoef: entry.distributionCoef,
                            weightToDistribute: entry.weightToDistribute
                        }
                    });
                }

                // Update order totals
                const totalAmount = validEntries.reduce((sum: number, e: SummaryOrderJournal) => sum + Number(e.price) * e.orderQty, 0);
                const totalWeight = validEntries.reduce((sum: number, e: SummaryOrderJournal) => sum + e.orderQty, 0);

                await prisma.order.update({
                    where: { id: order.id },
                    data: {
                        totalAmount: { increment: totalAmount },
                        totalWeight: { increment: totalWeight }
                    }
                });

                results.push({ action: 'updated', orderId: order.id, items: validEntries.length });
            } else {
                // Create new order
                const totalAmount = validEntries.reduce((sum: number, e: SummaryOrderJournal) => sum + Number(e.price) * e.orderQty, 0);
                const totalWeight = validEntries.reduce((sum: number, e: SummaryOrderJournal) => sum + e.orderQty, 0);

                order = await prisma.order.create({
                    data: {
                        customerId,
                        date: shipDate,
                        paymentType: validEntries[0].paymentType,
                        status: 'new',
                        totalAmount,
                        totalWeight,
                        items: {
                            create: validEntries.map((entry: SummaryOrderJournal) => ({
                                productId: entry.productId!,
                                quantity: entry.orderQty,
                                price: entry.price,
                                amount: Number(entry.price) * entry.orderQty,
                                shippedQty: entry.shippedQty,
                                sumWithRevaluation: entry.sumWithRevaluation,
                                distributionCoef: entry.distributionCoef,
                                weightToDistribute: entry.weightToDistribute
                            }))
                        }
                    }
                });

                results.push({ action: 'created', orderId: order.id, items: validEntries.length });
            }

            // Mark entries as synced
            await prisma.summaryOrderJournal.updateMany({
                where: { id: { in: validEntries.map((e: SummaryOrderJournal) => e.id) } },
                data: { status: 'synced' }
            });
        }

        res.json({ message: 'Sync completed', results });
    } catch (error) {
        console.error('Sync to orders error:', error);
        res.status(500).json({ error: 'Failed to sync to orders' });
    }
};
