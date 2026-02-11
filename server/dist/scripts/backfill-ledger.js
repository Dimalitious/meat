"use strict";
/**
 * Backfill скрипт для заполнения SupplierLedger из существующих Purchase.
 * Запуск: npx ts-node server/src/scripts/backfill-ledger.ts
 *
 * Что делает:
 * 1. Очищает все PURCHASE записи в ledger
 * 2. Проходит по всем Purchase
 * 3. Вызывает syncPurchaseLedger для каждой
 */
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const supplierLedger_service_1 = require("../services/supplierLedger.service");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('=== Backfill Supplier Ledger ===');
    // 1. Удалить все PURCHASE записи ledger (пересоздадим)
    const deleted = await prisma.supplierLedger.deleteMany({
        where: { sourceType: 'PURCHASE' },
    });
    console.log(`Deleted ${deleted.count} existing PURCHASE ledger entries`);
    // 2. Получить все закупки
    const purchases = await prisma.purchase.findMany({
        select: { id: true },
        orderBy: { id: 'asc' },
    });
    console.log(`Found ${purchases.length} purchases to process`);
    // 3. Обработать каждую в отдельной транзакции
    let processed = 0;
    let errors = 0;
    for (const p of purchases) {
        try {
            await prisma.$transaction(async (tx) => {
                await (0, supplierLedger_service_1.syncPurchaseLedger)(tx, p.id);
            });
            processed++;
            if (processed % 100 === 0) {
                console.log(`  Processed ${processed}/${purchases.length}...`);
            }
        }
        catch (err) {
            errors++;
            console.error(`  ERROR on purchase #${p.id}:`, err);
        }
    }
    console.log(`\n=== Done ===`);
    console.log(`Processed: ${processed}, Errors: ${errors}`);
    await prisma.$disconnect();
}
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
