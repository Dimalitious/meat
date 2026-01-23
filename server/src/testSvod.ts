import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSvodPreview() {
    const svodDate = new Date('2026-01-22');
    const dateStart = new Date(svodDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(svodDate);
    dateEnd.setHours(23, 59, 59, 999);

    console.log('Дата:', dateStart, '-', dateEnd);

    // A: Товары из заказов
    const summaryOrders = await prisma.summaryOrderJournal.findMany({
        where: {
            shipDate: { gte: dateStart, lte: dateEnd },
            status: { in: ['draft', 'forming', 'synced'] }
        },
        select: {
            idn: true,
            productId: true,
            orderQty: true,
            status: true
        }
    });

    console.log('Заказов всего:', summaryOrders.length);
    console.log('С productId:', summaryOrders.filter(o => o.productId).length);
    console.log('Без productId:', summaryOrders.filter(o => !o.productId).length);

    // Группируем по productId
    const ordersByProduct = new Map<number, number>();
    for (const order of summaryOrders) {
        if (order.productId) {
            const current = ordersByProduct.get(order.productId) || 0;
            ordersByProduct.set(order.productId, current + order.orderQty);
        }
    }

    console.log('Уникальных товаров в заказах:', ordersByProduct.size);
    console.log('Первые 5:', Array.from(ordersByProduct.entries()).slice(0, 5));

    await prisma.$disconnect();
}

testSvodPreview();
