// Анализ снимков AssemblyOrdersJournal
// Запуск: npx tsx checkAssemblySnapshots.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyze() {
    console.log('='.repeat(70));
    console.log('АНАЛИЗ СНИМКОВ ASSEMBLY ORDERS JOURNAL');
    console.log('='.repeat(70));

    const snapshots = await prisma.assemblyOrdersJournal.findMany({
        orderBy: { id: 'asc' }
    });

    console.log(`\nНайдено снимков: ${snapshots.length}\n`);

    for (const snap of snapshots) {
        console.log('─'.repeat(70));
        console.log(`📸 Снимок ID: ${snap.id}`);
        console.log(`   Дата сборки: ${snap.assemblyDate?.toISOString().slice(0, 10)}`);
        console.log(`   Создан: ${snap.createdAt?.toISOString()}`);
        console.log(`   Автор: ${snap.createdBy}`);
        console.log(`   Скрыт: ${snap.isHidden}`);
        console.log(`   sourceSummaryId: ${snap.sourceSummaryId}`);

        const data = snap.data as any;
        if (Array.isArray(data)) {
            console.log(`\n   📦 Заказы в снимке (${data.length}):`);
            for (const order of data) {
                console.log(`\n      Order ID: ${order.id || order.orderId || 'N/A'}`);
                console.log(`      Клиент: ${order.customer?.name || order.customerName || 'N/A'}`);
                console.log(`      Статус: ${order.status || 'N/A'}`);
                console.log(`      Дата: ${order.date || 'N/A'}`);

                if (order.items && Array.isArray(order.items)) {
                    console.log(`      Позиции:`);
                    for (const item of order.items) {
                        const productName = item.product?.name || item.productName || 'N/A';
                        console.log(`         - ${productName}: ${item.quantity}`);
                    }
                }

                // Полный JSON для детального анализа
                console.log(`\n      📋 ПОЛНЫЙ JSON:`);
                console.log(JSON.stringify(order, null, 2).split('\n').map((l: string) => '      ' + l).join('\n').slice(0, 2000));
            }
        } else if (data && typeof data === 'object') {
            console.log(`\n   📦 Данные (объект):`);
            console.log(JSON.stringify(data, null, 2).slice(0, 2000));
        }
    }

    console.log('\n' + '='.repeat(70));
    await prisma.$disconnect();
}

analyze().catch(console.error);
