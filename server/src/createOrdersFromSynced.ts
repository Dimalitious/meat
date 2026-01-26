/**
 * Принудительное создание Order из записей synced
 * Запуск: npx ts-node src/createOrdersFromSynced.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createOrdersFromSynced() {
    console.log('=== Создание Order из записей synced ===\n');

    // 1. Находим ВСЕ записи со статусом synced
    const syncedEntries = await prisma.summaryOrderJournal.findMany({
        where: {
            status: 'synced'
        },
        include: {
            customer: true,
            product: true
        }
    });

    console.log(`Найдено записей synced: ${syncedEntries.length}`);

    if (syncedEntries.length === 0) {
        console.log('Нет записей для обработки.');
        return;
    }

    // 2. Группируем по customerId + shipDate
    const grouped = new Map<string, typeof syncedEntries>();

    for (const entry of syncedEntries) {
        if (!entry.customerId || !entry.productId) {
            console.log(`  Пропущено: entry #${entry.id} - нет customerId или productId`);
            continue;
        }

        const dateStr = entry.shipDate.toISOString().split('T')[0];
        const key = `${entry.customerId}_${dateStr}`;

        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key)!.push(entry);
    }

    console.log(`Будет создано Order: ${grouped.size}\n`);

    let ordersCreated = 0;
    let itemsCreated = 0;

    for (const [key, entries] of grouped) {
        const firstEntry = entries[0];
        const customerId = firstEntry.customerId!;
        const shipDate = firstEntry.shipDate;
        const idn = firstEntry.idn;

        try {
            // Подсчёт итогов
            let totalAmount = 0;
            let totalWeight = 0;

            for (const e of entries) {
                totalAmount += Number(e.price) * e.orderQty;
                totalWeight += e.orderQty;
            }

            // Создаём Order
            const order = await prisma.order.create({
                data: {
                    customerId,
                    date: shipDate,
                    idn: idn || null,
                    paymentType: firstEntry.paymentType || 'bank',
                    status: 'new',
                    totalAmount,
                    totalWeight,
                    isDisabled: false
                }
            });
            ordersCreated++;
            console.log(`✓ Создан Order #${order.id} для ${firstEntry.customerName} (${entries.length} позиций)`);

            // Создаём OrderItem для каждой записи
            for (const entry of entries) {
                await prisma.orderItem.create({
                    data: {
                        orderId: order.id,
                        productId: entry.productId!,
                        quantity: entry.orderQty,
                        price: entry.price,
                        amount: Number(entry.price) * entry.orderQty,
                        shippedQty: entry.shippedQty,
                        sumWithRevaluation: entry.sumWithRevaluation,
                        distributionCoef: entry.distributionCoef,
                        weightToDistribute: entry.weightToDistribute
                    }
                });
                itemsCreated++;
            }
        } catch (err) {
            console.error(`✗ Ошибка для группы ${key}:`, err);
        }
    }

    console.log(`\n=== Результат ===`);
    console.log(`Создано Order: ${ordersCreated}`);
    console.log(`Создано OrderItem: ${itemsCreated}`);
}

createOrdersFromSynced()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
