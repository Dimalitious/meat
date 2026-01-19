import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.count();
    const customers = await prisma.customer.count();
    const summaries = await prisma.summaryOrderJournal.count();
    const orders = await prisma.order.count();

    console.log('=== DATABASE STATS ===');
    console.log('Products:', products);
    console.log('Customers:', customers);
    console.log('SummaryOrders:', summaries);
    console.log('Orders:', orders);

    await prisma.$disconnect();
}

main();
