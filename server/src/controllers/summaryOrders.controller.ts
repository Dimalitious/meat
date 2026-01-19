import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get summary orders with filters and pagination
export const getSummaryOrders = async (req: Request, res: Response) => {
    try {
        const {
            date,
            customerId,
            productId,
            category,
            district,
            managerId,
            status, // NEW: filter by status
            page = '1',
            limit = '50'
        } = req.query;

        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {};

        // Date filter (optional now)
        if (date) {
            const startDate = new Date(date as string);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1);
            where.shipDate = { gte: startDate, lt: endDate };
        }

        // Status filter - support multiple statuses separated by comma
        if (status) {
            const statuses = (status as string).split(',');
            if (statuses.length === 1) {
                where.status = statuses[0];
            } else {
                where.status = { in: statuses };
            }
        }

        // Customer filter
        if (customerId) {
            where.customerId = Number(customerId);
        }

        // Product filter
        if (productId) {
            where.productId = Number(productId);
        }

        // Category filter
        if (category) {
            where.category = category;
        }

        // District filter
        if (district) {
            where.district = district;
        }

        // Manager filter
        if (managerId) {
            where.managerId = managerId;
        }

        // Get total count for pagination
        const total = await prisma.summaryOrderJournal.count({ where });

        // Get paginated data
        const orders = await prisma.summaryOrderJournal.findMany({
            where,
            include: {
                customer: true,
                product: true
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limitNum
        });

        res.json({
            data: orders,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + orders.length < total
            }
        });
    } catch (error) {
        console.error('Get summary orders error:', error);
        res.status(500).json({ error: 'Failed to fetch summary orders' });
    }
};

// Get filter options (unique values for dropdowns)
export const getFilterOptions = async (req: Request, res: Response) => {
    try {
        let categories: string[] = [];
        let districts: string[] = [];
        let managers: { id: string; name: string | null }[] = [];

        // Get unique categories
        try {
            const catData = await prisma.summaryOrderJournal.findMany({
                where: { category: { not: null } },
                select: { category: true },
                distinct: ['category']
            });
            categories = catData.map(c => c.category).filter(Boolean) as string[];
        } catch (e) {
            console.log('Categories field not available');
        }

        // Get unique districts (may not exist yet)
        try {
            const distData = await prisma.$queryRaw`SELECT DISTINCT district FROM "SummaryOrderJournal" WHERE district IS NOT NULL`;
            districts = (distData as any[]).map(d => d.district).filter(Boolean);
        } catch (e) {
            console.log('Districts field not available');
        }

        // Get managers
        try {
            const mgrData = await prisma.summaryOrderJournal.findMany({
                where: { managerId: { not: null } },
                select: { managerId: true, managerName: true },
                distinct: ['managerId']
            });
            managers = mgrData.filter(m => m.managerId).map(m => ({
                id: m.managerId!,
                name: m.managerName
            }));
        } catch (e) {
            console.log('Managers field not available');
        }

        res.json({ categories, districts, managers });
    } catch (error) {
        console.error('Get filter options error:', error);
        // Return empty data instead of error
        res.json({ categories: [], districts: [], managers: [] });
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
            productCode,
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
            district,
            pointAddress,
            status
        } = req.body;

        const priceNum = Number(price) || 0;
        const shippedNum = Number(shippedQty) || 0;
        const dateObj = new Date(shipDate);

        // Generate IDN based on date: format DDMMYYYY
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        const idn = `${day}${month}${year}`;

        // Get customer info for district if not provided
        let finalDistrict = district;
        let finalPointAddress = pointAddress;
        if (customerId && !district) {
            const customer = await prisma.customer.findUnique({
                where: { id: Number(customerId) }
            });
            if (customer) {
                // Use districtId as district fallback
                finalDistrict = district || customer.districtId || null;
            }
        }

        const entry = await prisma.summaryOrderJournal.create({
            data: {
                idn,
                shipDate: new Date(shipDate),
                paymentType: paymentType || 'bank', // "Перечисление" по умолчанию
                customerId: customerId ? Number(customerId) : null,
                customerName: customerName || '',
                productId: productId ? Number(productId) : null,
                // productCode: productCode || null, // Uncomment after prisma generate
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
                // district: finalDistrict, // Uncomment after prisma generate
                // pointAddress: finalPointAddress, // Uncomment after prisma generate
                status: status || 'draft'
            },
            include: { customer: true, product: true }
        });
        res.json(entry);
    } catch (error: any) {
        console.error('Create summary order error:', error);
        res.status(400).json({ error: 'Failed to create summary order', details: error.message });
    }
};

// Update summary order entry
export const updateSummaryOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data: any = { ...req.body };

        // Convert numeric fields
        if (data.price !== undefined) data.price = Number(data.price);
        if (data.shippedQty !== undefined) data.shippedQty = Number(data.shippedQty);
        if (data.orderQty !== undefined) data.orderQty = Number(data.orderQty);
        if (data.distributionCoef !== undefined) data.distributionCoef = Number(data.distributionCoef);
        if (data.weightToDistribute !== undefined) data.weightToDistribute = Number(data.weightToDistribute);

        // Recalculate sumWithRevaluation
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

// Sync entries to Orders table
export const syncToOrders = async (req: Request, res: Response) => {
    try {
        const { entryIds } = req.body;
        console.log('[SYNC] Called with entryIds:', entryIds);

        const entries = await prisma.summaryOrderJournal.findMany({
            where: {
                id: { in: entryIds.map((id: number) => Number(id)) }
            },
            include: { customer: true, product: true }
        });

        console.log('[SYNC] Found entries:', entries.length);

        if (entries.length === 0) {
            return res.json({ message: 'No entries found for sync', synced: 0 });
        }

        const results = [];

        for (const entry of entries) {
            if (!entry.customerId || !entry.productId) continue;

            const idn = entry.idn || null;

            let order = await prisma.order.findFirst({
                where: {
                    customerId: entry.customerId,
                    ...(idn ? { idn } : { date: entry.shipDate })
                }
            });

            if (order) {
                const existingItem = await prisma.orderItem.findFirst({
                    where: { orderId: order.id, productId: entry.productId }
                });

                if (existingItem) {
                    await prisma.orderItem.update({
                        where: { id: existingItem.id },
                        data: {
                            quantity: entry.orderQty,
                            shippedQty: entry.shippedQty,
                            price: entry.price,
                            amount: Number(entry.price) * entry.orderQty
                        }
                    });
                    results.push({ action: 'item_updated', orderId: order.id });
                } else {
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

                    await prisma.order.update({
                        where: { id: order.id },
                        data: {
                            totalAmount: { increment: Number(entry.price) * entry.orderQty },
                            totalWeight: { increment: entry.orderQty }
                        }
                    });
                    results.push({ action: 'item_added', orderId: order.id });
                }
            } else {
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
                results.push({ action: 'order_created', orderId: order.id });
            }
        }

        res.json({ message: 'Sync completed', results });
    } catch (error) {
        console.error('Sync to orders error:', error);
        res.status(500).json({ error: 'Failed to sync to orders' });
    }
};

// Send to rework
export const sendToRework = async (req: Request, res: Response) => {
    try {
        const { idn } = req.body;

        if (!idn) {
            return res.status(400).json({ error: 'IDN is required' });
        }

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
