"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    // Находим все своды
    const svods = await prisma.svodHeader.findMany({
        include: { lines: { select: { id: true } } },
        orderBy: { svodDate: 'desc' }
    });
    console.log('Все своды:');
    for (const s of svods) {
        console.log(`  ID: ${s.id}, Дата: ${s.svodDate.toISOString().split('T')[0]}, Строк: ${s.lines.length}`);
    }
    // Удаляем ВСЕ своды чтобы начать заново
    if (svods.length > 0) {
        console.log('\nУдаляем все своды...');
        await prisma.svodLine.deleteMany({});
        await prisma.svodHeader.deleteMany({});
        console.log('Готово! Теперь обновите страницу и сохраните свод.');
    }
    await prisma.$disconnect();
}
main();
