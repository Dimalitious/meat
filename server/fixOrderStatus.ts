// Скрипт для обновления статуса существующего заказа "Айриш паб"
// Запуск: npx tsx fixOrderStatus.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixOrderStatus() {
    console.log('='.repeat(70));
    console.log('ОБНОВЛЕНИЕ СТАТУСА ЗАКАЗОВ');
    console.log('='.repeat(70));

    // Calculate dispatchDay in Asia/Tashkent timezone (UTC+5)
    const now = new Date();
    const tashkentOffset = 5 * 60; // UTC+5 in minutes
    const tashkentTime = new Date(now.getTime() + (tashkentOffset + now.getTimezoneOffset()) * 60 * 1000);
    const dispatchDay = new Date(tashkentTime.getFullYear(), tashkentTime.getMonth(), tashkentTime.getDate());

    // Находим заказы со статусом 'new' которые должны быть в DISTRIBUTING
    const ordersToFix = await prisma.order.findMany({
        where: { status: 'new' },
        include: { customer: true }
    });

    console.log(`\n📦 Заказов со статусом 'new': ${ordersToFix.length}`);

    for (const order of ordersToFix) {
        console.log(`\n   Обновляю Order ID:${order.id} | ${order.customer.name}`);

        await prisma.order.update({
            where: { id: order.id },
            data: {
                status: 'DISTRIBUTING',
                assemblyConfirmedAt: now,
                dispatchDay: dispatchDay
            }
        });

        console.log(`   ✅ Статус: new → DISTRIBUTING`);
        console.log(`   ✅ assemblyConfirmedAt: ${now.toISOString()}`);
        console.log(`   ✅ dispatchDay: ${dispatchDay.toISOString().slice(0, 10)}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Готово!');
    await prisma.$disconnect();
}

fixOrderStatus().catch(console.error);
