import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSummaryOrders() {
    console.log('=== Проверка данных в SummaryOrderJournal за 19-20 января 2026 ===\n');

    // Даты для фильтрации
    const startDate = new Date('2026-01-19T00:00:00');
    const endDate = new Date('2026-01-21T00:00:00'); // До 21 (не включая)

    try {
        // Общее количество записей за период
        const totalCount = await prisma.summaryOrderJournal.count({
            where: {
                shipDate: {
                    gte: startDate,
                    lt: endDate,
                },
            },
        });

        console.log(`📊 Всего записей за 19-20 января: ${totalCount}\n`);

        // Группировка по датам
        const byDate = await prisma.summaryOrderJournal.groupBy({
            by: ['shipDate'],
            where: {
                shipDate: {
                    gte: startDate,
                    lt: endDate,
                },
            },
            _count: { id: true },
        });

        console.log('📅 По датам:');
        byDate.forEach((row) => {
            const date = new Date(row.shipDate).toLocaleDateString('ru-RU');
            console.log(`   ${date}: ${row._count.id} записей`);
        });

        // Группировка по статусам
        const byStatus = await prisma.summaryOrderJournal.groupBy({
            by: ['status'],
            where: {
                shipDate: {
                    gte: startDate,
                    lt: endDate,
                },
            },
            _count: { id: true },
        });

        console.log('\n📌 По статусам:');
        byStatus.forEach((row) => {
            console.log(`   ${row.status}: ${row._count.id}`);
        });

        // Уникальные клиенты
        const uniqueCustomers = await prisma.summaryOrderJournal.findMany({
            where: {
                shipDate: {
                    gte: startDate,
                    lt: endDate,
                },
            },
            distinct: ['customerName'],
            select: { customerName: true },
        });

        console.log(`\n👥 Уникальных клиентов: ${uniqueCustomers.length}`);
        if (uniqueCustomers.length <= 10) {
            uniqueCustomers.forEach((c) => console.log(`   - ${c.customerName}`));
        } else {
            uniqueCustomers.slice(0, 10).forEach((c) => console.log(`   - ${c.customerName}`));
            console.log(`   ... и ещё ${uniqueCustomers.length - 10}`);
        }

        // Примеры записей
        const samples = await prisma.summaryOrderJournal.findMany({
            where: {
                shipDate: {
                    gte: startDate,
                    lt: endDate,
                },
            },
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                idn: true,
                shipDate: true,
                customerName: true,
                productFullName: true,
                orderQty: true,
                shippedQty: true,
                status: true,
            },
        });

        if (samples.length > 0) {
            console.log('\n📝 Примеры записей (последние 5):');
            samples.forEach((s) => {
                const date = new Date(s.shipDate).toLocaleDateString('ru-RU');
                console.log(`   [${s.idn}] ${date} | ${s.customerName} | ${s.productFullName} | Заказ: ${s.orderQty}, Факт: ${s.shippedQty} | ${s.status}`);
            });
        }

    } catch (error) {
        console.error('Ошибка:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkSummaryOrders();
