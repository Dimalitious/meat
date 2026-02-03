// Скрипт для исправления записей с customerId = null
// Запуск: npx tsx fixCustomerIds.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixCustomerIds() {
    console.log('='.repeat(70));
    console.log('ИСПРАВЛЕНИЕ customerId В SUMMARY ORDER JOURNAL');
    console.log('='.repeat(70));

    // 1. Получаем все записи без customerId
    const entriesWithoutCustomerId = await prisma.summaryOrderJournal.findMany({
        where: {
            customerId: null,
            customerName: { not: '' }
        }
    });

    console.log(`\n📊 Записей без customerId: ${entriesWithoutCustomerId.length}`);

    if (entriesWithoutCustomerId.length === 0) {
        console.log('✅ Все записи уже имеют customerId!');
        await prisma.$disconnect();
        return;
    }

    // 2. Получаем всех клиентов
    const customers = await prisma.customer.findMany({
        select: { id: true, name: true }
    });

    // 3. Создаём карту: lowercase name -> id
    const customerByName = new Map<string, number>();
    for (const c of customers) {
        if (c.name) {
            customerByName.set(c.name.toLowerCase().trim(), c.id);
        }
    }
    console.log(`📋 Клиентов в базе: ${customerByName.size}`);

    // 4. Исправляем записи
    let fixed = 0;
    let notFound = 0;
    const notFoundNames = new Set<string>();

    for (const entry of entriesWithoutCustomerId) {
        const customerNameLower = (entry.customerName || '').toLowerCase().trim();
        const customerId = customerByName.get(customerNameLower);

        if (customerId) {
            await prisma.summaryOrderJournal.update({
                where: { id: entry.id },
                data: { customerId }
            });
            fixed++;
        } else {
            notFound++;
            notFoundNames.add(entry.customerName || 'N/A');
        }
    }

    console.log('\n' + '─'.repeat(50));
    console.log(`✅ Исправлено: ${fixed}`);
    console.log(`❌ Не найден клиент: ${notFound}`);

    if (notFoundNames.size > 0) {
        console.log('\n🔴 Клиенты не найдены в базе:');
        for (const name of notFoundNames) {
            console.log(`   - "${name}"`);
        }
    }

    console.log('\n' + '='.repeat(70));
    await prisma.$disconnect();
}

fixCustomerIds().catch(console.error);
