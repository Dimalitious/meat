// Check SummaryOrderJournal for January 25
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSummary() {
    console.log('=== Checking SummaryOrderJournal for January 25, 2026 ===\n');

    // All summary entries (no select - get all fields)
    const allEntries = await prisma.summaryOrderJournal.findMany({
        take: 20,
        orderBy: { id: 'desc' }
    });

    console.log(`Total entries in SummaryOrderJournal (last 20): ${allEntries.length}\n`);

    if (allEntries.length > 0) {
        console.log('Recent entries:');
        allEntries.forEach((e: any) => {
            console.log(`  ID: ${e.id}, IDN: ${e.idn}, ShipDate: ${e.shipDate?.toISOString?.().slice(0, 10) || '-'}, Status: ${e.status}, Customer: ${e.customerName}`);
        });
    } else {
        console.log('No entries found in SummaryOrderJournal!');
    }

    // Total count
    const total = await prisma.summaryOrderJournal.count();
    console.log(`\nTotal records in SummaryOrderJournal: ${total}`);

    await prisma.$disconnect();
}

checkSummary().catch(console.error);
