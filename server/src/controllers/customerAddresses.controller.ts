import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { assertCustomerAccess } from '../services/salesManagerAccess.service';

// ============================================
// Helpers
// ============================================

const toInt = (v: any, name: string): number => {
    const n = Number(v);
    if (!Number.isFinite(n) || !Number.isInteger(n))
        throw { status: 400, error: `Некорректный параметр ${name}` };
    return n;
};

const normCoord = (v: any): number => {
    const s = String(v).replace(',', '.').replace(/[^0-9.\-]/g, '');
    const n = Number(s);
    if (!Number.isFinite(n)) throw { status: 400, error: 'Некорректные координаты' };
    return n;
};

const isValidLat = (v: number) => v >= -90 && v <= 90;
const isValidLng = (v: number) => v >= -180 && v <= 180;
const pickString = (v: any): string | null => (v == null ? null : String(v));

const getUserCtx = (req: Request) => {
    const u = (req as any).user;
    if (!u?.userId) throw { status: 401, error: 'Не авторизован' };
    return u as { userId: number; roles: string[] };
};

// ============================================
// GET /api/sales-manager/customers/:customerId/addresses
// ============================================
export const listCustomerAddresses = async (req: Request, res: Response) => {
    try {
        const customerId = toInt(req.params.customerId, 'customerId');
        const user = getUserCtx(req);
        await assertCustomerAccess(prisma, user, customerId);

        const addresses = await prisma.customerAddress.findMany({
            where: { customerId, deletedAt: null },
            orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        });
        res.json(addresses);
    } catch (e: any) {
        res.status(e?.status ?? 500).json({ error: e?.error ?? 'Failed to list addresses' });
    }
};

// ============================================
// POST /api/sales-manager/customers/:customerId/addresses
// ============================================
export const createCustomerAddress = async (req: Request, res: Response) => {
    try {
        const customerId = toInt(req.params.customerId, 'customerId');
        const user = getUserCtx(req);
        await assertCustomerAccess(prisma, user, customerId);

        const { label, addressText, lat, lng, accuracyM, comment, isDefault } = req.body ?? {};

        if (!addressText || String(addressText).trim().length < 2) {
            throw { status: 400, error: 'addressText обязателен (минимум 2 символа)' };
        }
        const nLat = normCoord(lat);
        const nLng = normCoord(lng);
        if (!isValidLat(nLat)) throw { status: 400, error: 'Некорректная широта (lat): должна быть от -90 до 90' };
        if (!isValidLng(nLng)) throw { status: 400, error: 'Некорректная долгота (lng): должна быть от -180 до 180' };

        const acc = accuracyM != null ? Number(accuracyM) : null;
        if (acc != null && (!Number.isFinite(acc) || acc < 0))
            throw { status: 400, error: 'Некорректная точность (accuracyM)' };

        const created = await prisma.$transaction(async (tx) => {
            const makeDefault = Boolean(isDefault);
            if (makeDefault) {
                await tx.customerAddress.updateMany({
                    where: { customerId, deletedAt: null },
                    data: { isDefault: false },
                });
            }

            return tx.customerAddress.create({
                data: {
                    customerId,
                    label: pickString(label),
                    addressText: String(addressText).trim(),
                    lat: new Prisma.Decimal(nLat),
                    lng: new Prisma.Decimal(nLng),
                    accuracyM: acc,
                    comment: pickString(comment),
                    isDefault: makeDefault,
                },
            });
        });

        res.status(201).json(created);
    } catch (e: any) {
        res.status(e?.status ?? 500).json({ error: e?.error ?? 'Failed to create address' });
    }
};

// ============================================
// PATCH /api/sales-manager/customers/:customerId/addresses/:addressId
// ============================================
export const updateCustomerAddress = async (req: Request, res: Response) => {
    try {
        const customerId = toInt(req.params.customerId, 'customerId');
        const addressId = toInt(req.params.addressId, 'addressId');
        const user = getUserCtx(req);
        await assertCustomerAccess(prisma, user, customerId);

        const existing = await prisma.customerAddress.findFirst({
            where: { id: addressId, customerId, deletedAt: null },
        });
        if (!existing) throw { status: 404, error: 'Адрес не найден' };

        const { label, addressText, lat, lng, accuracyM, comment, isDefault } = req.body ?? {};

        let nLat: number | undefined;
        let nLng: number | undefined;
        if (lat != null) {
            nLat = normCoord(lat);
            if (!isValidLat(nLat)) throw { status: 400, error: 'Некорректная широта (lat)' };
        }
        if (lng != null) {
            nLng = normCoord(lng);
            if (!isValidLng(nLng)) throw { status: 400, error: 'Некорректная долгота (lng)' };
        }

        const acc = accuracyM !== undefined
            ? (accuracyM != null ? Number(accuracyM) : null)
            : undefined;
        if (acc !== undefined && acc != null && (!Number.isFinite(acc) || acc < 0))
            throw { status: 400, error: 'Некорректная точность (accuracyM)' };

        const updated = await prisma.$transaction(async (tx) => {
            const makeDefault = isDefault === true;
            if (makeDefault) {
                await tx.customerAddress.updateMany({
                    where: { customerId, deletedAt: null },
                    data: { isDefault: false },
                });
            }

            return tx.customerAddress.update({
                where: { id: addressId },
                data: {
                    label: label !== undefined ? pickString(label) : undefined,
                    addressText: addressText !== undefined ? String(addressText).trim() : undefined,
                    lat: nLat !== undefined ? new Prisma.Decimal(nLat) : undefined,
                    lng: nLng !== undefined ? new Prisma.Decimal(nLng) : undefined,
                    accuracyM: acc as any,
                    comment: comment !== undefined ? pickString(comment) : undefined,
                    isDefault: isDefault !== undefined ? Boolean(isDefault) : undefined,
                },
            });
        });

        res.json(updated);
    } catch (e: any) {
        res.status(e?.status ?? 500).json({ error: e?.error ?? 'Failed to update address' });
    }
};

// ============================================
// DELETE /api/sales-manager/customers/:customerId/addresses/:addressId
// Soft delete + auto-default rollover
// ============================================
export const deleteCustomerAddress = async (req: Request, res: Response) => {
    try {
        const customerId = toInt(req.params.customerId, 'customerId');
        const addressId = toInt(req.params.addressId, 'addressId');
        const user = getUserCtx(req);
        await assertCustomerAccess(prisma, user, customerId);

        await prisma.$transaction(async (tx) => {
            const existing = await tx.customerAddress.findFirst({
                where: { id: addressId, customerId, deletedAt: null },
            });
            if (!existing) throw { status: 404, error: 'Адрес не найден' };

            // Soft delete
            await tx.customerAddress.update({
                where: { id: addressId },
                data: { deletedAt: new Date(), isDefault: false },
            });

            // Auto-default rollover: if deleted was default, assign next most recent
            if (existing.isDefault) {
                const next = await tx.customerAddress.findFirst({
                    where: { customerId, deletedAt: null, id: { not: addressId } },
                    orderBy: { updatedAt: 'desc' },
                });

                // Strict approach: unset all defaults first to avoid any race condition overlap
                await tx.customerAddress.updateMany({
                    where: { customerId, deletedAt: null },
                    data: { isDefault: false }
                });

                if (next) {
                    await tx.customerAddress.update({
                        where: { id: next.id },
                        data: { isDefault: true },
                    });
                }
            }
        });

        res.status(204).send();
    } catch (e: any) {
        res.status(e?.status ?? 500).json({ error: e?.error ?? 'Failed to delete address' });
    }
};

// ============================================
// POST /api/sales-manager/customers/:customerId/addresses/:addressId/make-default
// ============================================
export const makeDefaultCustomerAddress = async (req: Request, res: Response) => {
    try {
        const customerId = toInt(req.params.customerId, 'customerId');
        const addressId = toInt(req.params.addressId, 'addressId');
        const user = getUserCtx(req);
        await assertCustomerAccess(prisma, user, customerId);

        const updated = await prisma.$transaction(async (tx) => {
            const existing = await tx.customerAddress.findFirst({
                where: { id: addressId, customerId, deletedAt: null },
            });
            if (!existing) throw { status: 404, error: 'Адрес не найден' };

            await tx.customerAddress.updateMany({
                where: { customerId, deletedAt: null },
                data: { isDefault: false },
            });

            return tx.customerAddress.update({
                where: { id: addressId },
                data: { isDefault: true },
            });
        });

        res.json(updated);
    } catch (e: any) {
        res.status(e?.status ?? 500).json({ error: e?.error ?? 'Failed to set default address' });
    }
};
