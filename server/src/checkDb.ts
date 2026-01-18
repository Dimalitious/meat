import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    const entry = await prisma.summaryOrderJournal.findFirst({
        where: { id: 16 },
        include: { customer: true, product: true }
    });
    console.log('Entry 16:', JSON.stringify(entry, null, 2));

    const allEntries = await prisma.summaryOrderJournal.findMany({
        take: 5,
        include: { customer: true, product: true }
    });
    console.log('\nFirst 5 entries:', allEntries.map(e => ({
        id: e.id,
        customerId: e.customerId,
        productId: e.productId,
        status: e.status
    })));
}

check().catch(console.error).finally(() => prisma.$disconnect());
