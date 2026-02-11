import { Prisma } from '@prisma/client';

/**
 * Geo snapshot fields for Order creation.
 * Populated from one of three sources with priority:
 *   (1) Explicit customerAddressId
 *   (2) Manual lat/lng from frontend
 *   (3) Customer's default address
 *   (4) Empty (no geo data)
 */
export interface GeoSnapshot {
    deliveryAddress: string | null;
    deliveryLat: Prisma.Decimal | null;
    deliveryLng: Prisma.Decimal | null;
    deliveryComment: string | null;
    deliveryAccuracyM: number | null;
    customerAddressId: number | null;
}

interface GeoInput {
    customerId: number;
    customerAddressId?: any;
    deliveryAddress?: any;
    deliveryLat?: any;
    deliveryLng?: any;
    deliveryComment?: any;
    deliveryAccuracyM?: any;
}

/**
 * Resolve delivery geo snapshot for order creation.
 * Used by both `createOrder` and `acceptDraft` to ensure consistent behavior.
 *
 * @param tx  Prisma transaction client (or plain PrismaClient)
 * @param input  Raw input from request body / draft data
 * @returns GeoSnapshot with resolved values
 * @throws { status, error } on validation failure
 */
export async function resolveGeoSnapshot(tx: any, input: GeoInput): Promise<GeoSnapshot> {
    const {
        customerId,
        customerAddressId,
        deliveryAddress,
        deliveryLat,
        deliveryLng,
        deliveryComment,
        deliveryAccuracyM,
    } = input;

    const snap: GeoSnapshot = {
        deliveryAddress: deliveryAddress ? String(deliveryAddress) : null,
        deliveryLat: null,
        deliveryLng: null,
        deliveryComment: deliveryComment ? String(deliveryComment) : null,
        deliveryAccuracyM: null,
        customerAddressId: null,
    };

    if (customerAddressId != null && customerAddressId !== '') {
        // ── (1) Explicit address from saved list ──
        // IDOR check: customerId in where ensures address belongs to this customer.
        // accuracyM intentionally taken from the saved address, NOT from the request,
        // because accuracy is a property of the geo point, not the order.
        const addr = await tx.customerAddress.findFirst({
            where: { id: Number(customerAddressId), customerId, deletedAt: null },
        });
        if (!addr) throw { status: 400, error: 'Адрес не найден или не принадлежит клиенту' };

        snap.deliveryAddress = snap.deliveryAddress ?? addr.addressText;
        snap.deliveryLat = addr.lat;
        snap.deliveryLng = addr.lng;
        snap.deliveryComment = snap.deliveryComment ?? addr.comment ?? null;
        snap.deliveryAccuracyM = addr.accuracyM ?? null;
        snap.customerAddressId = addr.id;

    } else if (deliveryLat != null && deliveryLat !== '' && deliveryLng != null && deliveryLng !== '') {
        // ── (2) Manual coordinates from frontend ──
        // customerAddressId stays null: manual point is not linked to address catalog.
        // deliveryAddress stays as-is from input (may be empty — MVP decision,
        // recommended to require in future UX iteration).
        const nLat = Number(String(deliveryLat).replace(',', '.'));
        const nLng = Number(String(deliveryLng).replace(',', '.'));

        if (!Number.isFinite(nLat) || Math.abs(nLat) > 90)
            throw { status: 400, error: 'Некорректная широта (lat)' };
        if (!Number.isFinite(nLng) || Math.abs(nLng) > 180)
            throw { status: 400, error: 'Некорректная долгота (lng)' };

        snap.deliveryLat = new Prisma.Decimal(nLat);
        snap.deliveryLng = new Prisma.Decimal(nLng);

        // Strict accuracyM validation: throws 400 on NaN or negative
        if (deliveryAccuracyM != null && deliveryAccuracyM !== '') {
            const acc = Number(deliveryAccuracyM);
            if (!Number.isFinite(acc) || acc < 0)
                throw { status: 400, error: 'Некорректная точность (accuracyM): должно быть число >= 0' };
            snap.deliveryAccuracyM = acc;
        }

    } else {
        // ── (3) Fallback: customer's default address ──
        // orderBy ensures deterministic pick if multiple defaults exist (defensive)
        const def = await tx.customerAddress.findFirst({
            where: { customerId, deletedAt: null, isDefault: true },
            orderBy: { updatedAt: 'desc' },
        });
        if (def) {
            snap.deliveryAddress = snap.deliveryAddress ?? def.addressText;
            snap.deliveryLat = def.lat;
            snap.deliveryLng = def.lng;
            snap.deliveryComment = snap.deliveryComment ?? def.comment ?? null;
            snap.deliveryAccuracyM = def.accuracyM ?? null;
            snap.customerAddressId = def.id;
        }
    }

    return snap;
}
