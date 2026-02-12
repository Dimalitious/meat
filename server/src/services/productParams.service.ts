import { prisma } from '../db';

// ─── TTL Cache ─────────────────────────────────────────────────

const CACHE_TTL_MS = 30_000; // 30 seconds

interface CacheEntry {
    data: AvailableParams;
    expiresAt: number;
}

interface AvailableParams {
    lengths: any[];
    widths: any[];
    heights: any[];
    thicknesses: any[];
    weights: any[];
    processings: any[];
}

const cache = new Map<number, CacheEntry>();

/**
 * Invalidate cache for a specific product.
 * Call after creating/deactivating ParamValue or creating/deleting exclusion.
 */
export function invalidateAvailableParams(productId: number): void {
    cache.delete(productId);
}

/**
 * Invalidate all cached entries for products in a given subcategory.
 * Call after creating/deactivating a subcategory-level ParamValue.
 */
export function invalidateBySubcategory(subcategoryId: number): void {
    // Clear all — we don't track subcategory→productId mapping in cache
    cache.clear();
}

/**
 * Clear entire cache. Use sparingly (e.g., bulk operations).
 */
export function invalidateAllAvailableParams(): void {
    cache.clear();
}

// ─── Main Function ─────────────────────────────────────────────

/**
 * Get available params for a given product ID.
 * = (subcategory params + product overrides) − exclusions
 * Results are cached with a 30s TTL.
 */
export async function getAvailableParamsForProductId(productId: number): Promise<AvailableParams> {
    // Check cache
    const cached = cache.get(productId);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }

    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, subcategoryId: true },
    });

    const empty: AvailableParams = { lengths: [], widths: [], heights: [], thicknesses: [], weights: [], processings: [] };

    if (!product || !product.subcategoryId) {
        return empty;
    }

    const [params, exclusions] = await Promise.all([
        prisma.paramValue.findMany({
            where: {
                isActive: true,
                deletedAt: null,
                OR: [
                    { subcategoryId: product.subcategoryId },
                    { productId: product.id },
                ],
            },
        }),
        prisma.productParamExclusion.findMany({
            where: { productId: product.id },
            select: { paramValueId: true },
        }),
    ]);

    const excludedSet = new Set(exclusions.map(e => e.paramValueId));
    const available = params.filter(p => p.productId !== null || !excludedSet.has(p.id));

    const result: AvailableParams = { lengths: [], widths: [], heights: [], thicknesses: [], weights: [], processings: [] };

    for (const p of available) {
        switch (p.paramType) {
            case 'LENGTH_CM': result.lengths.push(p); break;
            case 'WIDTH_CM': result.widths.push(p); break;
            case 'HEIGHT_CM': result.heights.push(p); break;
            case 'THICKNESS_CM': result.thicknesses.push(p); break;
            case 'WEIGHT_G': result.weights.push(p); break;
            case 'PROCESSING': result.processings.push(p); break;
        }
    }

    // Store in cache
    cache.set(productId, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });

    return result;
}
