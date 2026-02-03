// Проверка записей SummaryOrderJournal для Айриш паб
// Запуск: npx tsx checkSummaryIrishPub.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    console.log('='.repeat(70));
    console.log('АНАЛИЗ ЗАПИСЕЙ SUMMARY ORDER JOURNAL');
    console.log('='.repeat(70));

    // Поиск всех записей с customerName содержащим "айриш"
    const entries = await prisma.summaryOrderJournal.findMany({
        where: {
            customerName: { contains: 'айриш', mode: 'insensitive' }
        },
        include: {
            customer: true,
            product: true
        }
    });

    console.log(`\n🔍 Записей с customerName='айриш...': ${entries.length}`);

    for (const entry of entries) {
        console.log('\n' + '─'.repeat(60));
        console.log(`📋 Entry ID: ${entry.id}`);
        console.log(`   idn: ${entry.idn}`);
        console.log(`   shipDate: ${entry.shipDate?.toISOString().slice(0, 10)}`);
        console.log(`   status: ${entry.status}`);
        console.log(`   customerName: ${entry.customerName}`);
        console.log(`   🔴 customerId: ${entry.customerId} ${entry.customerId ? '✅' : '❌ NULL/0 - ПРОБЛЕМА!'}`);
        console.log(`   productId: ${entry.productId}`);
        console.log(`   productName (связь): ${entry.product?.name || 'N/A'}`);
        console.log(`   customer (связь): ${entry.customer?.name || 'N/A - НЕТ СВЯЗИ!'}`);
        console.log(`   orderQty: ${entry.orderQty}`);
        console.log(`   shippedQty: ${entry.shippedQty}`);
    }

    // Также проверим все записи с customerId = null или 0
    console.log('\n\n' + '='.repeat(70));
    console.log('🔴 ВСЕ ЗАПИСИ БЕЗ customerId (будут пропущены sync):');
    const noCustomer = await prisma.summaryOrderJournal.findMany({
        where: {
            OR: [
                { customerId: null },
                { customerId: 0 }
            ]
        },
        take: 20
    });

    console.log(`Найдено: ${noCustomer.length}`);
    for (const e of noCustomer) {
        console.log(`   - ID:${e.id} | ${e.shipDate?.toISOString().slice(0, 10)} | customerName:"${e.customerName}" | customerId:${e.customerId} | status:${e.status}`);
    }

    console.log('\n' + '='.repeat(70));
    await prisma.$disconnect();
}

check().catch(console.error);
