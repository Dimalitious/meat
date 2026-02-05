/**
 * FIFO Allocation Service (Production V3)
 * 
 * Core FIFO logic for allocating production weight across purchase items (lots).
 * Implements Mode B (denormalized qtyRemaining) for concurrency control.
 * 
 * INV-1: Truth = allocations by lots
 * INV-2: History preserved via isVoided
 * INV-4: Order by allocatedAt
 * INV-7: Concurrency via conditional UPDATE
 * INV-8: Full coverage or 400
 */

import { Prisma, PrismaClient } from '@prisma/client';

// Types
type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export interface AllocationResult {
    purchaseItemId: number;
    qtyAllocated: Prisma.Decimal;
}

export interface AllocationError {
    code: 'INSUFFICIENT_AVAILABLE_QTY';
    needed: number;
    allocated: number;
    shortage: number;
    productId: number;
    date: string;
}

// Constants
const ABS_TOL_KG = new Prisma.Decimal('0.3');  // 300g tolerance

/**
 * Build FIFO allocations for a document (RUN or ADJ)
 * 
 * Algorithm:
 * 1. Get available purchase items ordered by purchaseDate ASC, id ASC
 * 2. For each item, try to allocate from qtyRemaining
 * 3. Use conditional UPDATE for concurrency safety
 * 4. If total allocated < documentWeight (with tolerance), throw error
 * 
 * @param tx - Transaction client
 * @param productId - Product ID
 * @param dayEnd - End of the day (exclusive) - lots with purchaseDate < dayEnd are available
 * @param documentWeight - Weight to allocate
 * @param excludeSourceId - Optional: exclude allocations from this source (for repost)
 * @param excludeSourceType - Optional: source type to exclude
 * @returns Array of allocations
 */
export async function buildFifoAllocations(
    tx: TransactionClient,
    productId: number,
    dayEnd: Date,
    documentWeight: Prisma.Decimal,
    excludeSourceId?: number,
    excludeSourceType?: 'RUN' | 'ADJ'
): Promise<AllocationResult[]> {

    // Get purchase items with remaining qty, ordered for FIFO
    const purchaseItems = await tx.purchaseItem.findMany({
        where: {
            productId,
            purchase: {
                purchaseDate: { lt: dayEnd },
                isDisabled: false
            },
            qtyRemaining: { gt: 0 }
        },
        select: {
            id: true,
            qty: true,
            qtyRemaining: true,
            purchase: { select: { purchaseDate: true } }
        },
        orderBy: [
            { purchase: { purchaseDate: 'asc' } },
            { id: 'asc' }
        ]
    });

    if (purchaseItems.length === 0 && documentWeight.gt(ABS_TOL_KG)) {
        throw {
            code: 'INSUFFICIENT_AVAILABLE_QTY',
            needed: documentWeight.toNumber(),
            allocated: 0,
            shortage: documentWeight.toNumber(),
            productId,
            date: dayEnd.toISOString()
        } as AllocationError;
    }

    let remainingNeed = documentWeight;
    const allocations: AllocationResult[] = [];

    for (const pi of purchaseItems) {
        if (remainingNeed.lte(0)) break;

        const available = new Prisma.Decimal(pi.qtyRemaining);
        if (available.lte(0)) continue;

        const take = Prisma.Decimal.min(available, remainingNeed);

        // Mode B: Conditional UPDATE for concurrency (INV-7)
        // If another transaction took this qty, rowsAffected = 0
        const result = await tx.$executeRaw`
      UPDATE "PurchaseItem" 
      SET "qtyRemaining" = "qtyRemaining" - ${take}, "updatedAt" = NOW()
      WHERE id = ${pi.id} AND "qtyRemaining" >= ${take}
    `;

        if (result === 0) {
            // Another transaction took this qty - skip to next lot (no retry per P14)
            continue;
        }

        allocations.push({
            purchaseItemId: pi.id,
            qtyAllocated: take
        });

        remainingNeed = remainingNeed.sub(take);
    }

    // Check if we allocated enough (INV-8)
    const totalAllocated = allocations.reduce(
        (sum, a) => sum.add(a.qtyAllocated),
        new Prisma.Decimal(0)
    );
    const shortage = documentWeight.sub(totalAllocated);

    if (shortage.gt(ABS_TOL_KG)) {
        // Rollback the qtyRemaining updates we made
        for (const alloc of allocations) {
            await tx.$executeRaw`
        UPDATE "PurchaseItem" 
        SET "qtyRemaining" = "qtyRemaining" + ${alloc.qtyAllocated}, "updatedAt" = NOW()
        WHERE id = ${alloc.purchaseItemId}
      `;
        }

        throw {
            code: 'INSUFFICIENT_AVAILABLE_QTY',
            needed: documentWeight.toNumber(),
            allocated: totalAllocated.toNumber(),
            shortage: shortage.toNumber(),
            productId,
            date: dayEnd.toISOString()
        } as AllocationError;
    }

    return allocations;
}

/**
 * Void allocations for a document (when hiding/voiding)
 * Restores qtyRemaining and marks allocations as voided
 * 
 * @param tx - Transaction client
 * @param sourceType - 'RUN' or 'ADJ'
 * @param sourceId - Document ID
 * @param voidReason - Reason for voiding
 * @returns Number of allocations voided
 */
export async function voidAllocations(
    tx: TransactionClient,
    sourceType: 'RUN' | 'ADJ',
    sourceId: number,
    voidReason: string
): Promise<number> {
    // Get active allocations for this document
    const allocations = await tx.productionAllocation.findMany({
        where: {
            sourceType,
            sourceId,
            isVoided: false
        }
    });

    if (allocations.length === 0) return 0;

    // Restore qtyRemaining for each allocation
    for (const alloc of allocations) {
        await tx.$executeRaw`
      UPDATE "PurchaseItem" 
      SET "qtyRemaining" = "qtyRemaining" + ${alloc.qtyAllocated}, "updatedAt" = NOW()
      WHERE id = ${alloc.purchaseItemId}
    `;
    }

    // Mark allocations as voided (INV-2: preserve history)
    const result = await tx.productionAllocation.updateMany({
        where: {
            sourceType,
            sourceId,
            isVoided: false
        },
        data: {
            isVoided: true,
            voidedAt: new Date(),
            voidReason
        }
    });

    return result.count;
}

/**
 * Create allocation records in the database
 * 
 * @param tx - Transaction client
 * @param sourceType - 'RUN' or 'ADJ'
 * @param sourceId - Document ID
 * @param productId - Product ID
 * @param allocations - Allocation results from buildFifoAllocations
 */
export async function createAllocationRecords(
    tx: TransactionClient,
    sourceType: 'RUN' | 'ADJ',
    sourceId: number,
    productId: number,
    allocations: AllocationResult[]
): Promise<void> {
    if (allocations.length === 0) return;

    const now = new Date();

    await tx.productionAllocation.createMany({
        data: allocations.map(alloc => ({
            sourceType,
            sourceId,
            purchaseItemId: alloc.purchaseItemId,
            productId,
            qtyAllocated: alloc.qtyAllocated,
            allocatedAt: now,
            isVoided: false
        }))
    });
}

/**
 * Initialize qtyRemaining for a purchase item (equal to qty)
 * Called when creating new purchase items
 * 
 * @param tx - Transaction client
 * @param purchaseItemId - Purchase item ID
 */
export async function initializeQtyRemaining(
    tx: TransactionClient,
    purchaseItemId: number
): Promise<void> {
    await tx.$executeRaw`
    UPDATE "PurchaseItem" 
    SET "qtyRemaining" = "qty", "updatedAt" = NOW()
    WHERE id = ${purchaseItemId} AND "qtyRemaining" = 0
  `;
}

/**
 * Recalculate qtyRemaining for a purchase item based on allocations
 * Used for data integrity checks and migration
 * 
 * @param tx - Transaction client
 * @param purchaseItemId - Purchase item ID
 */
export async function recalculateQtyRemaining(
    tx: TransactionClient,
    purchaseItemId: number
): Promise<Prisma.Decimal> {
    const item = await tx.purchaseItem.findUnique({
        where: { id: purchaseItemId },
        select: { qty: true }
    });

    if (!item) throw new Error(`PurchaseItem ${purchaseItemId} not found`);

    const allocatedAgg = await tx.productionAllocation.aggregate({
        where: {
            purchaseItemId,
            isVoided: false
        },
        _sum: { qtyAllocated: true }
    });

    const totalAllocated = allocatedAgg._sum.qtyAllocated ?? new Prisma.Decimal(0);
    const qtyRemaining = new Prisma.Decimal(item.qty).sub(totalAllocated);

    await tx.purchaseItem.update({
        where: { id: purchaseItemId },
        data: { qtyRemaining }
    });

    return qtyRemaining;
}

/**
 * Get affected purchase item IDs from allocations of a document
 * Used for targeted closure recalculation
 * 
 * @param tx - Transaction client
 * @param sourceType - 'RUN' or 'ADJ'
 * @param sourceId - Document ID  
 */
export async function getAffectedPurchaseItemIds(
    tx: TransactionClient,
    sourceType: 'RUN' | 'ADJ',
    sourceId: number
): Promise<number[]> {
    const allocations = await tx.productionAllocation.findMany({
        where: { sourceType, sourceId },
        select: { purchaseItemId: true },
        distinct: ['purchaseItemId']
    });

    return allocations.map(a => a.purchaseItemId);
}

// Re-export constants for use in other modules
export const FIFO_TOLERANCE_KG = ABS_TOL_KG;
