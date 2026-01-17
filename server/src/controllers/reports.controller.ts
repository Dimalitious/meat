import { Request, Response } from 'express';
import { prisma } from '../db';

export const getSvodReport = async (req: Request, res: Response) => {
    try {
        const { date } = req.query;

        // Default to today if no date provided, otherwise parse
        let targetDate: Date;
        if (date && typeof date === 'string') {
            targetDate = new Date(date);
        } else {
            targetDate = new Date();
        }

        // Set start and end of day
        // Note: This relies on the server's local time if not specified.
        // For consistent YYYY-MM-DD handling, we construct logical bounds.
        // Assuming the input is YYYY-MM-DD

        const start = new Date(targetDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(targetDate);
        end.setHours(23, 59, 59, 999);

        // Fetch aggregated stats
        // We want: Sum(quantity) GROUP BY productId
        // conditions: order.date in [start, end] AND order.status != 'cancelled'

        const groupings = await prisma.orderItem.groupBy({
            by: ['productId'],
            where: {
                order: {
                    date: {
                        gte: start,
                        lte: end
                    },
                    status: {
                        not: 'cancelled'
                    }
                }
            },
            _sum: {
                quantity: true,
                amount: true
            }
        });

        // We also need Product details (name, code)
        const productIds = groupings.map(g => g.productId);
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, code: true } // Removed unit as it is not in schema
        });

        const productMap = new Map(products.map(p => [p.id, p]));

        // Combine data
        const report = groupings.map(group => {
            const product = productMap.get(group.productId);
            // Calculate effective average price if needed, or just return total amount
            // Amount is Decimal, Quantity is Float
            const totalQty = group._sum.quantity || 0;
            const totalAmount = Number(group._sum.amount) || 0;

            return {
                productId: group.productId,
                productName: product?.name || 'Unknown Product',
                productCode: product?.code || '',
                totalQuantity: totalQty,
                totalAmount: totalAmount,
                averagePrice: totalQty ? (totalAmount / totalQty).toFixed(2) : 0
            };
        });

        // Sort by product name for easier reading
        report.sort((a, b) => a.productName.localeCompare(b.productName));

        res.json({
            date: date || start.toISOString().split('T')[0],
            items: report,
            totalSum: report.reduce((acc, item) => acc + item.totalAmount, 0)
        });

    } catch (error) {
        console.error('Error generating Svod report:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
