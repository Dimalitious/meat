export type StatementOperation = {
    date: string;
    type: 'SHIPMENT' | 'RETURN_GOODS' | 'REFUND_MONEY' | 'PAYMENT';
    ref: { entity: string; id: number };
    title: string;
    debit: number;
    credit: number;
};

export type StatementResult = {
    from: string;
    to: string;
    operations: StatementOperation[];
    totals: { debit: number; credit: number; saldo: number };
};

/**
 * Build customer statement (Аксверк) for a date range.
 *
 * Polarity (AR perspective):
 *   Debit  = client owes us more (shipments, money refunds to client)
 *   Credit = client owes us less (goods returns, payments from client)
 *   Saldo  = Debit - Credit
 */
export async function buildStatement(
    prisma: any,
    customerId: number,
    from: Date,
    to: Date,
): Promise<StatementResult> {
    // End of day for 'to'
    const toEnd = new Date(to);
    toEnd.setUTCHours(23, 59, 59, 999);

    const operations: StatementOperation[] = [];

    // 1. SHIPMENTS (Debit): Orders with status SHIPPED, shippedAt in range
    const shipped = await prisma.order.findMany({
        where: {
            customerId,
            status: 'SHIPPED',
            isDisabled: false,
            shippedAt: { gte: from, lte: toEnd },
        },
        select: {
            id: true,
            idn: true,
            shippedAt: true,
            totalAmount: true,
        },
        orderBy: { shippedAt: 'asc' },
    });

    for (const o of shipped) {
        operations.push({
            date: (o.shippedAt as Date).toISOString().slice(0, 10),
            type: 'SHIPMENT',
            ref: { entity: 'Order', id: o.id },
            title: `Отгрузка ${o.idn || `#${o.id}`}`,
            debit: Number(o.totalAmount),
            credit: 0,
        });
    }

    // 2. RETURN_GOODS (Credit): OrderReturn totals via orderId → customerId
    const returns = await prisma.orderReturn.findMany({
        where: {
            order: { customerId, isDisabled: false },
            createdAt: { gte: from, lte: toEnd },
        },
        select: {
            id: true,
            orderId: true,
            totalSum: true,
            createdAt: true,
            order: { select: { idn: true } },
        },
        orderBy: { createdAt: 'asc' },
    });

    for (const r of returns) {
        operations.push({
            date: (r.createdAt as Date).toISOString().slice(0, 10),
            type: 'RETURN_GOODS',
            ref: { entity: 'OrderReturn', id: r.id },
            title: `Возврат товара (заказ ${r.order?.idn || `#${r.orderId}`})`,
            debit: 0,
            credit: Number(r.totalSum) || 0,
        });
    }

    // 3. REFUND_MONEY (Debit): CustomerMoneyRefund in range, not soft-deleted
    const refunds = await prisma.customerMoneyRefund.findMany({
        where: {
            customerId,
            deletedAt: null,
            refundDate: { gte: from, lte: toEnd },
        },
        select: {
            id: true,
            refundDate: true,
            amount: true,
            reference: true,
        },
        orderBy: { refundDate: 'asc' },
    });

    for (const f of refunds) {
        operations.push({
            date: (f.refundDate as Date).toISOString().slice(0, 10),
            type: 'REFUND_MONEY',
            ref: { entity: 'CustomerMoneyRefund', id: f.id },
            title: `Возврат денег${f.reference ? ` (${f.reference})` : ''}`,
            debit: Number(f.amount),
            credit: 0,
        });
    }

    // 4. PAYMENT (placeholder — no payment module yet)

    // Sort all by date, then by type weight for stable ordering
    const typeWeight: Record<string, number> = {
        SHIPMENT: 1,
        RETURN_GOODS: 2,
        REFUND_MONEY: 3,
        PAYMENT: 4,
    };
    operations.sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        if (d !== 0) return d;
        return (typeWeight[a.type] || 99) - (typeWeight[b.type] || 99);
    });

    // Totals
    let totalDebit = 0;
    let totalCredit = 0;
    for (const op of operations) {
        totalDebit += op.debit;
        totalCredit += op.credit;
    }

    return {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        operations,
        totals: {
            debit: totalDebit,
            credit: totalCredit,
            saldo: totalDebit - totalCredit,
        },
    };
}
