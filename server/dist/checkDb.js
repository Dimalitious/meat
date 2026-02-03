"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function checkProducts() {
    console.log('=== Проверка справочника Товары (Product) ===\n');
    try {
        const totalCount = await prisma.product.count();
        console.log(`📦 Всего товаров: ${totalCount}\n`);
        if (totalCount === 0) {
            console.log('⚠️ Справочник товаров пуст!');
            return;
        }
        // По статусам
        const byStatus = await prisma.product.groupBy({
            by: ['status'],
            _count: { id: true },
        });
        console.log('📌 По статусам:');
        byStatus.forEach((row) => {
            console.log(`   ${row.status}: ${row._count.id}`);
        });
        // По категориям
        const byCategory = await prisma.product.groupBy({
            by: ['category'],
            _count: { id: true },
        });
        console.log('\n📂 По категориям:');
        byCategory.forEach((row) => {
            console.log(`   ${row.category || '(без категории)'}: ${row._count.id}`);
        });
        // Примеры товаров
        const samples = await prisma.product.findMany({
            take: 10,
            orderBy: { id: 'asc' },
            select: {
                id: true,
                code: true,
                name: true,
                category: true,
                status: true,
            },
        });
        console.log('\n📝 Примеры товаров (первые 10):');
        samples.forEach((p) => {
            console.log(`   [${p.code}] ${p.name} | ${p.category || '-'} | ${p.status}`);
        });
    }
    catch (error) {
        console.error('Ошибка:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
checkProducts();
