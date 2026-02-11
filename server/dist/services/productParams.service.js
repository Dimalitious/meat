"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateAvailableParams = invalidateAvailableParams;
exports.invalidateBySubcategory = invalidateBySubcategory;
exports.invalidateAllAvailableParams = invalidateAllAvailableParams;
exports.getAvailableParamsForProductId = getAvailableParamsForProductId;
const db_1 = require("../db");
// ─── TTL Cache ─────────────────────────────────────────────────
const CACHE_TTL_MS = 30000; // 30 seconds
const cache = new Map();
/**
 * Invalidate cache for a specific product.
 * Call after creating/deactivating ParamValue or creating/deleting exclusion.
 */
function invalidateAvailableParams(productId) {
    cache.delete(productId);
}
/**
 * Invalidate all cached entries for products in a given subcategory.
 * Call after creating/deactivating a subcategory-level ParamValue.
 */
function invalidateBySubcategory(subcategoryId) {
    // Clear all — we don't track subcategory→productId mapping in cache
    cache.clear();
}
/**
 * Clear entire cache. Use sparingly (e.g., bulk operations).
 */
function invalidateAllAvailableParams() {
    cache.clear();
}
// ─── Main Function ─────────────────────────────────────────────
/**
 * Get available params for a given product ID.
 * = (subcategory params + product overrides) − exclusions
 * Results are cached with a 30s TTL.
 */
async function getAvailableParamsForProductId(productId) {
    // Check cache
    const cached = cache.get(productId);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }
    const product = await db_1.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, subcategoryId: true },
    });
    const empty = { lengths: [], widths: [], weights: [], processings: [] };
    if (!product || !product.subcategoryId) {
        return empty;
    }
    const [params, exclusions] = await Promise.all([
        db_1.prisma.paramValue.findMany({
            where: {
                isActive: true,
                OR: [
                    { subcategoryId: product.subcategoryId },
                    { productId: product.id },
                ],
            },
        }),
        db_1.prisma.productParamExclusion.findMany({
            where: { productId: product.id },
            select: { paramValueId: true },
        }),
    ]);
    const excludedSet = new Set(exclusions.map(e => e.paramValueId));
    const available = params.filter(p => p.productId !== null || !excludedSet.has(p.id));
    const result = { lengths: [], widths: [], weights: [], processings: [] };
    for (const p of available) {
        switch (p.paramType) {
            case 'LENGTH_CM':
                result.lengths.push(p);
                break;
            case 'WIDTH_CM':
                result.widths.push(p);
                break;
            case 'WEIGHT_G':
                result.weights.push(p);
                break;
            case 'PROCESSING':
                result.processings.push(p);
                break;
        }
    }
    // Store in cache
    cache.set(productId, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
}
