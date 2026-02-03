// Расширенный поиск заказа: Айриш паб Шевченко
// Запуск: npx tsx checkOrder_IrishPub2.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeOrder() {
    console.log('='.repeat(70));
    console.log('РАСШИРЕННЫЙ ПОИСК: Айриш паб Шевченко');
    console.log('='.repeat(70));

    // 1. Все заказы клиента (любая дата)
    const allOrders = await prisma.order.findMany({
        where: {
            customer: { name: { contains: 'Айриш', mode: 'insensitive' } }
        },
        include: {
            customer: true,
            items: { include: { product: true } }
        },
        orderBy: { date: 'desc' },
        take: 20
    });

    console.log('\n📦 ВСЕ ЗАКАЗЫ КЛИЕНТА (последние 20):');
    console.log(`   Найдено: ${allOrders.length}`);

    for (const order of allOrders) {
        const hasJir = order.items.some(i =>
            i.product.name.toLowerCase().includes('жир') ||
            i.product.name.toLowerCase().includes('почечн')
        );
        const marker = hasJir ? '🎯' : '  ';

        console.log(`\n${marker} Order ID: ${order.id}`);
        console.log(`   Дата: ${order.date.toISOString().slice(0, 10)}`);
        console.log(`   Статус: ${order.status}`);
        console.log(`   isDisabled: ${order.isDisabled}`);
        console.log(`   dispatchDay: ${(order as any).dispatchDay?.toISOString?.().slice(0, 10) || 'NULL'}`);
        console.log(`   Позиции: ${order.items.map(i => `${i.product.name.slice(0, 30)}(${i.quantity})`).join(', ')}`);
    }

    // 2. Поиск заказов с "жир" в позициях
    console.log('\n\n🔍 ПОИСК ЗАКАЗОВ С "ЖИР" В ПОЗИЦИЯХ (все клиенты):');
    const ordersWithFat = await prisma.order.findMany({
        where: {
            items: {
                some: {
                    product: {
                        name: { contains: 'жир', mode: 'insensitive' }
                    }
                }
            }
        },
        include: {
            customer: true,
            items: { include: { product: true } }
        },
        orderBy: { date: 'desc' },
        take: 10
    });

    console.log(`   Найдено: ${ordersWithFat.length}`);
    for (const order of ordersWithFat) {
        const fatItems = order.items.filter(i => i.product.name.toLowerCase().includes('жир'));
        console.log(`   - ID:${order.id} | ${order.date.toISOString().slice(0, 10)} | ${order.customer.name} | статус:${order.status} | позиции: ${fatItems.map(i => i.product.name).join(', ')}`);
    }

    // 3. Все уникальные статусы в системе
    console.log('\n\n📊 СТАТИСТИКА ПО СТАТУСАМ:');
    const statusStats = await prisma.$queryRaw`
        SELECT status, COUNT(*) as count 
        FROM "Order" 
        GROUP BY status 
        ORDER BY count DESC
    `;
    console.log(statusStats);

    // 4. SummaryOrderJournal для клиента за все время
    console.log('\n📊 SUMMARY ORDER JOURNAL (Айриш паб, все записи):');
    const summaryEntries = await prisma.summaryOrderJournal.findMany({
        where: {
            customer: { name: { contains: 'Айриш', mode: 'insensitive' } }
        },
        include: {
            customer: true,
            product: true
        },
        orderBy: { shipDate: 'desc' },
        take: 10
    });

    console.log(`   Найдено записей: ${summaryEntries.length}`);
    for (const entry of summaryEntries) {
        console.log(`   - ID:${entry.id} | ${entry.shipDate?.toISOString().slice(0, 10) || 'N/A'} | ${entry.product?.name || 'N/A'} | qty:${entry.quantity} | status:${entry.status}`);
    }

    // 5. Заказы за 25 января без фильтра по клиенту
    console.log('\n📅 ЗАКАЗЫ ЗА 25.01.2026 (все клиенты):');
    const jan25Orders = await prisma.order.findMany({
        where: {
            date: {
                gte: new Date('2026-01-24T19:00:00.000Z'),
                lt: new Date('2026-01-25T19:00:00.000Z')
            }
        },
        include: { customer: true },
        take: 20
    });
    console.log(`   Найдено: ${jan25Orders.length}`);
    for (const o of jan25Orders) {
        console.log(`   - ID:${o.id} | ${o.customer.name} | статус:${o.status} | isDisabled:${o.isDisabled}`);
    }

    console.log('\n' + '='.repeat(70));
    await prisma.$disconnect();
}

analyzeOrder().catch(console.error);
