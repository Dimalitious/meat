// Глубокий поиск: где находится заказ?
// Запуск: npx tsx checkOrder_DeepSearch.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deepSearch() {
    console.log('='.repeat(70));
    console.log('ГЛУБОКИЙ ПОИСК ДАННЫХ');
    console.log('='.repeat(70));

    // 1. Общая статистика
    console.log('\n📊 ОБЩАЯ СТАТИСТИКА:');
    const orderCount = await prisma.order.count();
    const customerCount = await prisma.customer.count();
    const summaryJournalCount = await prisma.summaryOrderJournal.count();

    console.log(`   Заказов (Order): ${orderCount}`);
    console.log(`   Клиентов (Customer): ${customerCount}`);
    console.log(`   Записей SummaryOrderJournal: ${summaryJournalCount}`);

    // 2. SummaryOrdersJournal (снимки сводки)
    console.log('\n📋 SUMMARY ORDERS JOURNAL (снимки):');
    try {
        const summarySnapshots = await prisma.summaryOrdersJournal.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5
        });
        console.log(`   Найдено: ${summarySnapshots.length}`);
        for (const s of summarySnapshots) {
            console.log(`   - ID:${s.id} | ${s.summaryDate?.toISOString().slice(0, 10) || 'N/A'} | by:${s.createdBy} | hidden:${s.isHidden}`);
        }
    } catch (e) {
        console.log('   Таблица не существует или пуста');
    }

    // 3. AssemblyOrdersJournal (снимки сборки)
    console.log('\n🔧 ASSEMBLY ORDERS JOURNAL (снимки):');
    try {
        const assemblySnapshots = await prisma.assemblyOrdersJournal.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10
        });
        console.log(`   Найдено: ${assemblySnapshots.length}`);
        for (const s of assemblySnapshots) {
            const data = s.data as any;
            console.log(`   - ID:${s.id} | ${s.assemblyDate?.toISOString().slice(0, 10)} | by:${s.createdBy} | hidden:${s.isHidden}`);
            if (data && Array.isArray(data)) {
                console.log(`     Заказов в снимке: ${data.length}`);
                // Ищем Айриш паб
                const found = data.find((o: any) =>
                    o.customer?.name?.toLowerCase().includes('айриш') ||
                    o.customerName?.toLowerCase().includes('айриш')
                );
                if (found) {
                    console.log(`     🎯 НАЙДЕН ЗАКАЗ АЙРИШ ПАБ:`);
                    console.log(`        ID: ${found.id || found.orderId}`);
                    console.log(`        Статус: ${found.status}`);
                    console.log(`        Данные:`, JSON.stringify(found).slice(0, 500));
                }
            }
        }
    } catch (e) {
        console.log('   Таблица не существует или ошибка:', e);
    }

    // 4. DistributionJournal
    console.log('\n🚚 DISTRIBUTION JOURNAL:');
    try {
        const distSnapshots = await prisma.distributionJournal.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5
        });
        console.log(`   Найдено: ${distSnapshots.length}`);
        for (const s of distSnapshots) {
            console.log(`   - ID:${s.id} | ${s.date?.toISOString().slice(0, 10)} | hidden:${s.isHidden}`);
        }
    } catch (e) {
        console.log('   Таблица не существует или пуста');
    }

    // 5. ExpeditionJournal
    console.log('\n📦 EXPEDITION JOURNAL:');
    try {
        const expeditionSnapshots = await prisma.expeditionJournal.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5
        });
        console.log(`   Найдено: ${expeditionSnapshots.length}`);
        for (const s of expeditionSnapshots) {
            console.log(`   - ID:${s.id} | ${s.dateFrom?.toISOString().slice(0, 10)} - ${s.dateTo?.toISOString().slice(0, 10)} | exp:${s.expeditorName}`);
        }
    } catch (e) {
        console.log('   Таблица не существует или пуста');
    }

    // 6. Последние 10 записей SummaryOrderJournal
    console.log('\n📊 ПОСЛЕДНИЕ 10 ЗАПИСЕЙ SUMMARY ORDER JOURNAL:');
    const lastSummary = await prisma.summaryOrderJournal.findMany({
        orderBy: { createdAt: 'desc' },
        include: { customer: true, product: true },
        take: 10
    });
    console.log(`   Найдено: ${lastSummary.length}`);
    for (const e of lastSummary) {
        console.log(`   - ID:${e.id} | ${e.shipDate?.toISOString().slice(0, 10) || 'N/A'} | ${e.customer?.name || 'N/A'} | ${e.product?.name?.slice(0, 30) || 'N/A'} | status:${e.status}`);
    }

    // 7. Все заказы в системе
    console.log('\n📦 ВСЕ ЗАКАЗЫ В ТАБЛИЦЕ ORDER:');
    const allOrders = await prisma.order.findMany({
        include: { customer: true, items: { include: { product: true } } }
    });
    console.log(`   Всего: ${allOrders.length}`);
    for (const o of allOrders) {
        console.log(`   - ID:${o.id} | ${o.date.toISOString().slice(0, 10)} | ${o.customer.name} | статус:${o.status}`);
        console.log(`     Позиции: ${o.items.map(i => `${i.product.name}(${i.quantity})`).join(', ')}`);
    }

    console.log('\n' + '='.repeat(70));
    await prisma.$disconnect();
}

deepSearch().catch(console.error);
