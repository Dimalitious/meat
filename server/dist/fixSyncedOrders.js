"use strict";
/**
 * Скрипт для исправления записей со статусом 'synced' без связанных Order
 * Запуск: npx ts-node src/fixSyncedOrders.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function fixSyncedOrders() {
    console.log('=== Исправление записей synced без Order ===\n');
    // 1. Находим записи со статусом synced без orderItemId
    const orphanedEntries = await prisma.summaryOrderJournal.findMany({
        where: {
            status: 'synced',
            orderItemId: null
        },
        include: {
            customer: true,
            product: true
        }
    });
    console.log(`Найдено записей synced без Order: ${orphanedEntries.length}`);
    if (orphanedEntries.length === 0) {
        console.log('Все записи synced имеют связанные Order. Исправление не требуется.');
        return;
    }
    // 2. Группируем по customerId + shipDate (один Order на клиента на дату)
    const grouped = new Map();
    for (const entry of orphanedEntries) {
        if (!entry.customerId || !entry.productId) {
            console.log(`  Пропущено: entry #${entry.id} - нет customerId или productId`);
            continue;
        }
        const dateStr = entry.shipDate.toISOString().split('T')[0];
        const key = `${entry.customerId}_${dateStr}`;
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key).push(entry);
    }
    console.log(`Будет создано Order: ${grouped.size}\n`);
    let ordersCreated = 0;
    let itemsLinked = 0;
    for (const [key, entries] of grouped) {
        const firstEntry = entries[0];
        const customerId = firstEntry.customerId;
        const shipDate = firstEntry.shipDate;
        const idn = firstEntry.idn;
        try {
            // Проверяем, нет ли уже Order для этого клиента на эту дату
            let order = await prisma.order.findFirst({
                where: {
                    customerId,
                    ...(idn ? { idn } : { date: shipDate })
                }
            });
            if (!order) {
                // Создаём Order
                let totalAmount = 0;
                let totalWeight = 0;
                for (const e of entries) {
                    totalAmount += Number(e.price) * e.orderQty;
                    totalWeight += e.orderQty;
                }
                order = await prisma.order.create({
                    data: {
                        customerId,
                        date: shipDate,
                        idn: idn || null,
                        paymentType: firstEntry.paymentType || 'bank',
                        status: 'new',
                        totalAmount,
                        totalWeight
                    }
                });
                ordersCreated++;
                console.log(`✓ Создан Order #${order.id} для ${firstEntry.customerName} (${entries.length} позиций)`);
            }
            else {
                console.log(`• Order #${order.id} уже существует для ${firstEntry.customerName}`);
            }
            // Создаём OrderItem и связываем с SummaryOrderJournal
            for (const entry of entries) {
                // Проверяем, нет ли уже такого OrderItem
                const existingItem = await prisma.orderItem.findFirst({
                    where: {
                        orderId: order.id,
                        productId: entry.productId
                    }
                });
                let orderItemId;
                if (existingItem) {
                    orderItemId = existingItem.id;
                }
                else {
                    const newItem = await prisma.orderItem.create({
                        data: {
                            orderId: order.id,
                            productId: entry.productId,
                            quantity: entry.orderQty,
                            price: entry.price,
                            amount: Number(entry.price) * entry.orderQty,
                            shippedQty: entry.shippedQty,
                            sumWithRevaluation: entry.sumWithRevaluation,
                            distributionCoef: entry.distributionCoef,
                            weightToDistribute: entry.weightToDistribute
                        }
                    });
                    orderItemId = newItem.id;
                }
                // Связываем SummaryOrderJournal с OrderItem
                await prisma.summaryOrderJournal.update({
                    where: { id: entry.id },
                    data: { orderItemId }
                });
                itemsLinked++;
            }
        }
        catch (err) {
            console.error(`✗ Ошибка для группы ${key}:`, err);
        }
    }
    console.log(`\n=== Результат ===`);
    console.log(`Создано Order: ${ordersCreated}`);
    console.log(`Связано позиций: ${itemsLinked}`);
}
fixSyncedOrders()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
