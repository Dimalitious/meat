"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeDefaultCustomerAddress = exports.deleteCustomerAddress = exports.updateCustomerAddress = exports.createCustomerAddress = exports.listCustomerAddresses = void 0;
const client_1 = require("@prisma/client");
const db_1 = require("../db");
const salesManagerAccess_service_1 = require("../services/salesManagerAccess.service");
// ============================================
// Helpers
// ============================================
const toInt = (v, name) => {
    const n = Number(v);
    if (!Number.isFinite(n) || !Number.isInteger(n))
        throw { status: 400, error: `Некорректный параметр ${name}` };
    return n;
};
const normCoord = (v) => {
    const s = String(v).replace(',', '.').replace(/[^0-9.\-]/g, '');
    const n = Number(s);
    if (!Number.isFinite(n))
        throw { status: 400, error: 'Некорректные координаты' };
    return n;
};
const isValidLat = (v) => v >= -90 && v <= 90;
const isValidLng = (v) => v >= -180 && v <= 180;
const pickString = (v) => (v == null ? null : String(v));
const getUserCtx = (req) => {
    const u = req.user;
    if (!u?.userId)
        throw { status: 401, error: 'Не авторизован' };
    return u;
};
// ============================================
// GET /api/sales-manager/customers/:customerId/addresses
// ============================================
const listCustomerAddresses = async (req, res) => {
    try {
        const customerId = toInt(req.params.customerId, 'customerId');
        const user = getUserCtx(req);
        await (0, salesManagerAccess_service_1.assertCustomerAccess)(db_1.prisma, user, customerId);
        const addresses = await db_1.prisma.customerAddress.findMany({
            where: { customerId, deletedAt: null },
            orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        });
        res.json(addresses);
    }
    catch (e) {
        res.status(e?.status ?? 500).json({ error: e?.error ?? 'Failed to list addresses' });
    }
};
exports.listCustomerAddresses = listCustomerAddresses;
// ============================================
// POST /api/sales-manager/customers/:customerId/addresses
// ============================================
const createCustomerAddress = async (req, res) => {
    try {
        const customerId = toInt(req.params.customerId, 'customerId');
        const user = getUserCtx(req);
        await (0, salesManagerAccess_service_1.assertCustomerAccess)(db_1.prisma, user, customerId);
        const { label, addressText, lat, lng, accuracyM, comment, isDefault } = req.body ?? {};
        if (!addressText || String(addressText).trim().length < 2) {
            throw { status: 400, error: 'addressText обязателен (минимум 2 символа)' };
        }
        const nLat = normCoord(lat);
        const nLng = normCoord(lng);
        if (!isValidLat(nLat))
            throw { status: 400, error: 'Некорректная широта (lat): должна быть от -90 до 90' };
        if (!isValidLng(nLng))
            throw { status: 400, error: 'Некорректная долгота (lng): должна быть от -180 до 180' };
        const acc = accuracyM != null ? Number(accuracyM) : null;
        if (acc != null && (!Number.isFinite(acc) || acc < 0))
            throw { status: 400, error: 'Некорректная точность (accuracyM)' };
        const created = await db_1.prisma.$transaction(async (tx) => {
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
                    lat: new client_1.Prisma.Decimal(nLat),
                    lng: new client_1.Prisma.Decimal(nLng),
                    accuracyM: acc,
                    comment: pickString(comment),
                    isDefault: makeDefault,
                },
            });
        });
        res.status(201).json(created);
    }
    catch (e) {
        res.status(e?.status ?? 500).json({ error: e?.error ?? 'Failed to create address' });
    }
};
exports.createCustomerAddress = createCustomerAddress;
// ============================================
// PATCH /api/sales-manager/customers/:customerId/addresses/:addressId
// ============================================
const updateCustomerAddress = async (req, res) => {
    try {
        const customerId = toInt(req.params.customerId, 'customerId');
        const addressId = toInt(req.params.addressId, 'addressId');
        const user = getUserCtx(req);
        await (0, salesManagerAccess_service_1.assertCustomerAccess)(db_1.prisma, user, customerId);
        const existing = await db_1.prisma.customerAddress.findFirst({
            where: { id: addressId, customerId, deletedAt: null },
        });
        if (!existing)
            throw { status: 404, error: 'Адрес не найден' };
        const { label, addressText, lat, lng, accuracyM, comment, isDefault } = req.body ?? {};
        let nLat;
        let nLng;
        if (lat != null) {
            nLat = normCoord(lat);
            if (!isValidLat(nLat))
                throw { status: 400, error: 'Некорректная широта (lat)' };
        }
        if (lng != null) {
            nLng = normCoord(lng);
            if (!isValidLng(nLng))
                throw { status: 400, error: 'Некорректная долгота (lng)' };
        }
        const acc = accuracyM !== undefined
            ? (accuracyM != null ? Number(accuracyM) : null)
            : undefined;
        if (acc !== undefined && acc != null && (!Number.isFinite(acc) || acc < 0))
            throw { status: 400, error: 'Некорректная точность (accuracyM)' };
        const updated = await db_1.prisma.$transaction(async (tx) => {
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
                    lat: nLat !== undefined ? new client_1.Prisma.Decimal(nLat) : undefined,
                    lng: nLng !== undefined ? new client_1.Prisma.Decimal(nLng) : undefined,
                    accuracyM: acc,
                    comment: comment !== undefined ? pickString(comment) : undefined,
                    isDefault: isDefault !== undefined ? Boolean(isDefault) : undefined,
                },
            });
        });
        res.json(updated);
    }
    catch (e) {
        res.status(e?.status ?? 500).json({ error: e?.error ?? 'Failed to update address' });
    }
};
exports.updateCustomerAddress = updateCustomerAddress;
// ============================================
// DELETE /api/sales-manager/customers/:customerId/addresses/:addressId
// Soft delete + auto-default rollover
// ============================================
const deleteCustomerAddress = async (req, res) => {
    try {
        const customerId = toInt(req.params.customerId, 'customerId');
        const addressId = toInt(req.params.addressId, 'addressId');
        const user = getUserCtx(req);
        await (0, salesManagerAccess_service_1.assertCustomerAccess)(db_1.prisma, user, customerId);
        await db_1.prisma.$transaction(async (tx) => {
            const existing = await tx.customerAddress.findFirst({
                where: { id: addressId, customerId, deletedAt: null },
            });
            if (!existing)
                throw { status: 404, error: 'Адрес не найден' };
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
    }
    catch (e) {
        res.status(e?.status ?? 500).json({ error: e?.error ?? 'Failed to delete address' });
    }
};
exports.deleteCustomerAddress = deleteCustomerAddress;
// ============================================
// POST /api/sales-manager/customers/:customerId/addresses/:addressId/make-default
// ============================================
const makeDefaultCustomerAddress = async (req, res) => {
    try {
        const customerId = toInt(req.params.customerId, 'customerId');
        const addressId = toInt(req.params.addressId, 'addressId');
        const user = getUserCtx(req);
        await (0, salesManagerAccess_service_1.assertCustomerAccess)(db_1.prisma, user, customerId);
        const updated = await db_1.prisma.$transaction(async (tx) => {
            const existing = await tx.customerAddress.findFirst({
                where: { id: addressId, customerId, deletedAt: null },
            });
            if (!existing)
                throw { status: 404, error: 'Адрес не найден' };
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
    }
    catch (e) {
        res.status(e?.status ?? 500).json({ error: e?.error ?? 'Failed to set default address' });
    }
};
exports.makeDefaultCustomerAddress = makeDefaultCustomerAddress;
