import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    const total = await prisma.summaryOrderJournal.count();
    console.log('Всего записей:', total);

    const byDate = await prisma.summaryOrderJournal.count({
        where: {
            shipDate: {
                gte: new Date('2026-01-22'),
                lt: new Date('2026-01-23')
            }
        }
    });
    console.log('На 22.01.2026:', byDate);

    // Последние 5 записей
    const recent = await prisma.summaryOrderJournal.findMany({
        take: 5,
        orderBy: { id: 'desc' },
        select: { id: true, shipDate: true, productFullName: true }
    });
    console.log('Последние записи:', recent);

    await prisma.$disconnect();
}

check();
