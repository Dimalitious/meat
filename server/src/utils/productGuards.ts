import { PrismaClient, Prisma } from '@prisma/client';

// Union type: works both inside $transaction and with standalone PrismaClient
type Client = Prisma.TransactionClient | PrismaClient;

/**
 * Helper: build a structured HTTP-like error to throw from guards.
 */
function httpError(status: number, payload: Record<string, unknown>) {
    const e: any = new Error(String(payload?.error || 'HTTP_ERROR'));
    e.status = status;
    e.payload = payload;
    return e;
}

/**
 * Normalize raw product IDs to valid positive integers.
 * Returns { ids: number[] (deduped, >0), invalidRaw: original values that failed parsing }.
 */
function normalizeIds(raw: Array<number | string>): { ids: number[]; invalidRaw: Array<number | string> } {
    const ids: number[] = [];
    const invalidRaw: Array<number | string> = [];
    const seen = new Set<number>();

    for (const r of raw) {
        const n = Number(String(r ?? '').trim());
        if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
            invalidRaw.push(r);
        } else if (!seen.has(n)) {
            seen.add(n);
            ids.push(n);
        }
    }
    return { ids, invalidRaw };
}

/**
 * Core implementation shared by strict and soft variants.
 */
async function assertActiveInternal(
    client: Client,
    productIds: Array<number | string>,
    opts: { allowEmpty: boolean },
) {
    const { ids, invalidRaw } = normalizeIds(productIds);

    if (invalidRaw.length) {
        throw httpError(400, { error: 'INVALID_PRODUCT_ID', ids: invalidRaw });
    }
    if (!ids.length) {
        if (opts.allowEmpty) return;
        throw httpError(400, { error: 'EMPTY_PRODUCTS', message: 'Не переданы товары (productId)' });
    }

    // Batch lookup
    const products = await (client as any).product.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, code: true, status: true },
    });

    // Check for missing IDs
    const foundIds = new Set(products.map((p: any) => p.id));
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length) {
        throw httpError(404, { error: 'PRODUCT_NOT_FOUND', ids: missing });
    }

    // Check for inactive products
    const inactive = products.filter((p: any) => p.status !== 'active');
    if (inactive.length) {
        throw httpError(400, {
            error: 'INACTIVE_PRODUCT',
            productIds: inactive.map((p: any) => p.id),
            products: inactive.map((p: any) => ({
                id: p.id,
                name: p.name,
                code: p.code,
                status: p.status,
            })),
        });
    }
}

/**
 * STRICT guard: all product IDs must exist and be active.
 * Throws on empty list, invalid IDs, missing products, or inactive products.
 * Use for: createOrder, createPurchasePriceList, createMml, addRootNode, addChildNode.
 */
export async function assertActiveProductsOrThrow(
    client: Client,
    productIds: Array<number | string>,
) {
    return assertActiveInternal(client, productIds, { allowEmpty: false });
}

/**
 * SOFT guard: if IDs are provided, they must exist and be active.
 * Empty list is OK (returns immediately).
 * Use for: updateOrder delta (only new product IDs checked).
 */
export async function assertActiveProductsIfAnyOrThrow(
    client: Client,
    productIds: Array<number | string>,
) {
    return assertActiveInternal(client, productIds, { allowEmpty: true });
}
