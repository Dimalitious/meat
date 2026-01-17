import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- Testing getStock ---');
    try {
        const stock = await prisma.product.findMany({
            select: {
                id: true,
                name: true,
                stock: {
                    select: { quantity: true, updatedAt: true }
                }
            },
            take: 1
        });
        console.log('getStock Success:', stock);
    } catch (e) {
        console.error('getStock Failed:', e);
    }

    console.log('\n--- Testing createArrival ---');
    try {
        // Assuming product ID 1 exists (from previous tests)
        const productId = 1;
        const quantity = 100;

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Transaction
            await tx.stockTransaction.create({
                data: {
                    productId: Number(productId),
                    type: 'ARRIVAL',
                    quantity: Number(quantity),
                    note: 'Debug Script'
                }
            });

            // 2. Update Stock
            const stock = await tx.stock.upsert({
                where: { productId: Number(productId) },
                update: { quantity: { increment: Number(quantity) } },
                create: { productId: Number(productId), quantity: Number(quantity) }
            });
            return stock;
        });
        console.log('createArrival Success:', result);
    } catch (e) {
        console.error('createArrival Failed:', e);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
