// Диагностика заказа: Айриш паб Шевченко, 25.01.2026
// Запуск: npx tsx checkOrder_IrishPub.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeOrder() {
    console.log('='.repeat(70));
    console.log('АНАЛИЗ ЗАКАЗА: Айриш паб Шевченко, 25.01.2026');
    console.log('Позиция: Говяжий почечный жир 3 кг');
    console.log('='.repeat(70));

    // 1. Ищем клиента
    const customer = await prisma.customer.findFirst({
        where: {
            name: { contains: 'Айриш', mode: 'insensitive' }
        }
    });

    console.log('\n📋 КЛИЕНТ:');
    if (customer) {
        console.log(`   ID: ${customer.id}`);
        console.log(`   Название: ${customer.name}`);
        console.log(`   Код: ${customer.code}`);
    } else {
        console.log('   ❌ Клиент не найден!');

        // Поиск похожих
        const similar = await prisma.customer.findMany({
            where: {
                OR: [
                    { name: { contains: 'паб', mode: 'insensitive' } },
                    { name: { contains: 'шевченко', mode: 'insensitive' } }
                ]
            },
            take: 5
        });
        console.log('   Похожие клиенты:', similar.map(c => `${c.id}: ${c.name}`));
    }

    // 2. Ищем заказы этого клиента за 25 января
    const startDate = new Date('2026-01-24T19:00:00.000Z'); // 2026-01-25 00:00 Tashkent
    const endDate = new Date('2026-01-25T19:00:00.000Z');   // 2026-01-26 00:00 Tashkent

    const orders = await prisma.order.findMany({
        where: {
            customer: { name: { contains: 'Айриш', mode: 'insensitive' } },
            date: { gte: startDate, lt: endDate }
        },
        include: {
            customer: true,
            expeditor: true,
            items: { include: { product: true } }
        }
    });

    console.log('\n📦 ЗАКАЗЫ ЗА 25.01.2026:');
    console.log(`   Найдено: ${orders.length}`);

    for (const order of orders) {
        console.log('\n   ────────────────────────────────────');
        console.log(`   Order ID: ${order.id}`);
        console.log(`   IDN: ${order.idn || 'N/A'}`);
        console.log(`   Дата: ${order.date.toISOString()}`);
        console.log(`   Статус: ${order.status}`);
        console.log(`   isDisabled: ${order.isDisabled}`);
        console.log(`   Клиент: ${order.customer.name}`);
        console.log(`   Экспедитор: ${order.expeditor?.name || 'Не назначен'}`);
        console.log(`   Сумма: ${order.totalAmount}`);

        // FSM timestamps
        console.log('\n   🕒 FSM TIMESTAMPS:');
        console.log(`   assemblyStartedAt: ${(order as any).assemblyStartedAt || 'NULL'}`);
        console.log(`   assemblyStartedBy: ${(order as any).assemblyStartedBy || 'NULL'}`);
        console.log(`   assemblyConfirmedAt: ${(order as any).assemblyConfirmedAt || 'NULL'}`);
        console.log(`   assemblyConfirmedBy: ${(order as any).assemblyConfirmedBy || 'NULL'}`);
        console.log(`   dispatchDay: ${(order as any).dispatchDay || 'NULL'}`);
        console.log(`   loadedAt: ${(order as any).loadedAt || 'NULL'}`);
        console.log(`   loadedBy: ${(order as any).loadedBy || 'NULL'}`);
        console.log(`   shippedAt: ${(order as any).shippedAt || 'NULL'}`);
        console.log(`   shippedBy: ${(order as any).shippedBy || 'NULL'}`);
        console.log(`   expeditorId: ${order.expeditorId || 'NULL'}`);
        console.log(`   assignedAt: ${order.assignedAt || 'NULL'}`);
        console.log(`   deliveryStatus: ${order.deliveryStatus}`);

        console.log('\n   📋 ПОЗИЦИИ:');
        for (const item of order.items) {
            console.log(`      - ${item.product.name}: ${item.quantity} × ${item.price} = ${item.amount}`);
        }
    }

    // 3. Проверяем SummaryOrderJournal
    console.log('\n📊 SUMMARY ORDER JOURNAL (для этого клиента за 25.01):');
    const summaryEntries = await prisma.summaryOrderJournal.findMany({
        where: {
            customer: { name: { contains: 'Айриш', mode: 'insensitive' } },
            shipDate: { gte: startDate, lt: endDate }
        },
        include: {
            customer: true,
            product: true
        }
    });

    console.log(`   Найдено записей: ${summaryEntries.length}`);
    for (const entry of summaryEntries) {
        console.log(`   - ID:${entry.id} | ${entry.product?.name || 'N/A'} | qty:${entry.quantity} | status:${entry.status} | idn:${entry.idn}`);
    }

    // 4. Проверяем все заказы со статусом DISTRIBUTING
    console.log('\n🚚 ВСЕ ЗАКАЗЫ В СТАТУСЕ DISTRIBUTING:');
    const distributing = await prisma.order.findMany({
        where: { status: 'DISTRIBUTING' },
        include: { customer: true },
        take: 10
    });
    console.log(`   Количество: ${distributing.length}`);
    for (const o of distributing) {
        console.log(`   - ID:${o.id} | ${o.customer.name} | dispatchDay:${(o as any).dispatchDay?.toISOString().slice(0, 10) || 'NULL'}`);
    }

    // 5. Проверяем все заказы со статусом IN_ASSEMBLY
    console.log('\n🔧 ВСЕ ЗАКАЗЫ В СТАТУСЕ IN_ASSEMBLY:');
    const inAssembly = await prisma.order.findMany({
        where: { status: 'IN_ASSEMBLY' },
        include: { customer: true },
        take: 10
    });
    console.log(`   Количество: ${inAssembly.length}`);
    for (const o of inAssembly) {
        console.log(`   - ID:${o.id} | ${o.customer.name} | assemblyStartedAt:${(o as any).assemblyStartedAt || 'NULL'}`);
    }

    console.log('\n' + '='.repeat(70));
    await prisma.$disconnect();
}

analyzeOrder().catch(console.error);
