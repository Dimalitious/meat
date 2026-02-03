// Диагностика: статусы заказов для экспедиции
// Запуск: npx tsx checkExpedition.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    console.log('='.repeat(70));
    console.log('ДИАГНОСТИКА ЭКСПЕДИЦИИ');
    console.log('='.repeat(70));

    // 1. Все заказы и их статусы
    console.log('\n📦 ВСЕ ЗАКАЗЫ:');
    const orders = await prisma.order.findMany({
        include: { customer: true, expeditor: true }
    });

    for (const o of orders) {
        console.log(`\n   ID:${o.id} | ${o.customer.name}`);
        console.log(`      status: ${o.status}`);
        console.log(`      expeditorId: ${o.expeditorId || 'NULL'}`);
        console.log(`      expeditor: ${o.expeditor?.name || 'Не назначен'}`);
        console.log(`      dispatchDay: ${(o as any).dispatchDay?.toISOString?.().slice(0, 10) || 'NULL'}`);
        console.log(`      loadedAt: ${(o as any).loadedAt || 'NULL'}`);
        console.log(`      assignedAt: ${o.assignedAt?.toISOString() || 'NULL'}`);
    }

    // 2. Что ищет страница Экспедиции (LOADED статус)
    console.log('\n\n🚚 ЗАКАЗЫ ДЛЯ ЭКСПЕДИЦИИ (status=LOADED):');
    const loadedOrders = await prisma.order.findMany({
        where: { status: 'LOADED' },
        include: { customer: true, expeditor: true }
    });
    console.log(`   Найдено: ${loadedOrders.length}`);
    for (const o of loadedOrders) {
        console.log(`   - ID:${o.id} | ${o.customer.name} | exp:${o.expeditor?.name}`);
    }

    // 3. Экспедиторы
    console.log('\n\n👤 ЭКСПЕДИТОРЫ:');
    const expeditors = await prisma.expeditor.findMany();
    console.log(`   Всего: ${expeditors.length}`);
    for (const e of expeditors) {
        console.log(`   - ID:${e.id} | ${e.name} | active:${!(e as any).isHidden}`);
    }

    console.log('\n' + '='.repeat(70));
    await prisma.$disconnect();
}

check().catch(console.error);
