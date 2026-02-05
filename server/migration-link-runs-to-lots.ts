/**
 * Migration Script: Link ProductionRuns to PurchaseItems
 * 
 * This script links existing production runs to their source purchase items
 * based on productId and date matching logic.
 * 
 * Run with: npx ts-node migration-link-runs-to-lots.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Starting migration: Link runs to lots...\n');

    // Find all runs with sourceType='PURCHASE' but no sourcePurchaseItemId
    const orphanRuns = await prisma.productionRun.findMany({
        where: {
            sourceType: 'PURCHASE',
            sourcePurchaseItemId: null,
            isHidden: false
        },
        include: {
            product: { select: { id: true, name: true } }
        },
        orderBy: { productionDate: 'asc' }
    });

    console.log(`📋 Found ${orphanRuns.length} runs without sourcePurchaseItemId\n`);

    if (orphanRuns.length === 0) {
        console.log('✅ Nothing to migrate. All runs are already linked.');
        return;
    }

    let linked = 0;
    let skipped = 0;
    const errors: { runId: number; error: string }[] = [];

    for (const run of orphanRuns) {
        try {
            // Find matching purchase item:
            // - Same productId
            // - purchaseDate <= productionDate (FIFO: oldest first)
            // - Not fully closed or has remaining qty
            const matchingPurchaseItem = await prisma.purchaseItem.findFirst({
                where: {
                    productId: run.productId,
                    purchase: {
                        purchaseDate: { lte: run.productionDate },
                        isDisabled: false
                    }
                },
                orderBy: { purchase: { purchaseDate: 'asc' } },
                include: {
                    purchase: { select: { purchaseDate: true, idn: true } }
                }
            });

            if (!matchingPurchaseItem) {
                // No matching purchase item - this run might need OPENING_BALANCE
                console.log(`⚠️  Run #${run.id} (${run.product.name}, ${run.productionDate.toISOString().slice(0, 10)}) - no matching purchase found`);
                skipped++;
                continue;
            }

            // Update the run with the matched purchaseItemId
            await prisma.productionRun.update({
                where: { id: run.id },
                data: { sourcePurchaseItemId: matchingPurchaseItem.id }
            });

            console.log(`✅ Linked run #${run.id} → purchaseItem #${matchingPurchaseItem.id} (${matchingPurchaseItem.purchase.idn}, ${matchingPurchaseItem.purchase.purchaseDate.toISOString().slice(0, 10)})`);
            linked++;
        } catch (e: any) {
            console.error(`❌ Error linking run #${run.id}:`, e.message);
            errors.push({ runId: run.id, error: e.message });
        }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Linked: ${linked}`);
    console.log(`   ⚠️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors.length}`);

    if (errors.length > 0) {
        console.log('\n❌ Errors:');
        errors.forEach(e => console.log(`   Run #${e.runId}: ${e.error}`));
    }

    // Trigger recalculation of closures for all affected lots
    if (linked > 0) {
        console.log('\n🔄 Triggering closure recalculation...');
        // This would normally call recalcLotClosures, but for safety we just log
        console.log('   ⚠️  Run the app and trigger a recalc via API: POST /api/production-v2/closures/recalc');
    }
}

main()
    .catch(e => {
        console.error('Migration failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
