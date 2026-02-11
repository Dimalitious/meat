"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSupplierPayment = exports.updateSupplierPayment = exports.createSupplierPayment = exports.getSupplierPayments = void 0;
const client_1 = require("@prisma/client");
const supplierLedger_service_1 = require("../services/supplierLedger.service");
const prisma = new client_1.PrismaClient();
// ============================================
// ОПЛАТЫ ПОСТАВЩИКУ
// ============================================
/**
 * Список оплат.
 * GET /api/supplier-payments?supplierId=&dateFrom=&dateTo=&includeDeleted=
 */
const getSupplierPayments = async (req, res) => {
    try {
        const { supplierId, dateFrom, dateTo, includeDeleted } = req.query;
        const where = {};
        if (supplierId)
            where.supplierId = Number(supplierId);
        if (!includeDeleted || includeDeleted !== 'true')
            where.deletedAt = null;
        if (dateFrom || dateTo) {
            where.paymentDate = {};
            if (dateFrom)
                where.paymentDate.gte = new Date(String(dateFrom));
            if (dateTo) {
                const to = new Date(String(dateTo));
                to.setUTCHours(23, 59, 59, 999);
                where.paymentDate.lte = to;
            }
        }
        const payments = await prisma.supplierPayment.findMany({
            where,
            orderBy: { paymentDate: 'desc' },
            include: {
                supplier: { select: { id: true, name: true, code: true } },
                createdByUser: { select: { id: true, name: true, username: true } },
            },
        });
        res.json(payments);
    }
    catch (error) {
        console.error('getSupplierPayments error:', error);
        res.status(500).json({ error: 'Failed to fetch supplier payments' });
    }
};
exports.getSupplierPayments = getSupplierPayments;
/**
 * Создать оплату.
 * POST /api/supplier-payments
 * Body: { supplierId, paymentDate, amount, method, reference, comment }
 */
const createSupplierPayment = async (req, res) => {
    try {
        const { supplierId, paymentDate, amount, method, reference, comment } = req.body;
        const userId = req.user?.userId;
        if (!supplierId)
            return res.status(400).json({ error: 'supplierId is required' });
        if (!paymentDate)
            return res.status(400).json({ error: 'paymentDate is required' });
        if (!amount || Number(amount) <= 0)
            return res.status(400).json({ error: 'amount must be > 0' });
        const normalizedDate = new Date(paymentDate);
        normalizedDate.setUTCHours(0, 0, 0, 0);
        // Validate supplier exists
        const supplier = await prisma.supplier.findUnique({ where: { id: Number(supplierId) } });
        if (!supplier)
            return res.status(404).json({ error: 'Supplier not found' });
        const result = await prisma.$transaction(async (tx) => {
            const payment = await tx.supplierPayment.create({
                data: {
                    supplierId: Number(supplierId),
                    paymentDate: normalizedDate,
                    amount: Number(amount),
                    method: method || 'CASH',
                    reference: reference || null,
                    comment: comment || null,
                    createdByUserId: userId || null,
                },
            });
            await (0, supplierLedger_service_1.syncSupplierPaymentLedger)(tx, payment.id);
            return payment;
        });
        const full = await prisma.supplierPayment.findUnique({
            where: { id: result.id },
            include: {
                supplier: { select: { id: true, name: true, code: true } },
                createdByUser: { select: { id: true, name: true, username: true } },
            },
        });
        res.status(201).json(full);
    }
    catch (error) {
        console.error('createSupplierPayment error:', error);
        res.status(500).json({ error: 'Failed to create supplier payment' });
    }
};
exports.createSupplierPayment = createSupplierPayment;
/**
 * Обновить оплату.
 * PUT /api/supplier-payments/:id
 */
const updateSupplierPayment = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { paymentDate, amount, method, reference, comment } = req.body;
        const existing = await prisma.supplierPayment.findUnique({ where: { id } });
        if (!existing)
            return res.status(404).json({ error: 'Payment not found' });
        if (existing.deletedAt)
            return res.status(400).json({ error: 'Cannot edit deleted payment' });
        const normalizedDate = paymentDate
            ? (() => { const d = new Date(paymentDate); d.setUTCHours(0, 0, 0, 0); return d; })()
            : existing.paymentDate;
        await prisma.$transaction(async (tx) => {
            await tx.supplierPayment.update({
                where: { id },
                data: {
                    paymentDate: normalizedDate,
                    amount: amount !== undefined ? Number(amount) : undefined,
                    method: method || undefined,
                    reference: reference !== undefined ? reference : undefined,
                    comment: comment !== undefined ? comment : undefined,
                },
            });
            await (0, supplierLedger_service_1.syncSupplierPaymentLedger)(tx, id);
        });
        const full = await prisma.supplierPayment.findUnique({
            where: { id },
            include: {
                supplier: { select: { id: true, name: true, code: true } },
                createdByUser: { select: { id: true, name: true, username: true } },
            },
        });
        res.json(full);
    }
    catch (error) {
        console.error('updateSupplierPayment error:', error);
        res.status(500).json({ error: 'Failed to update supplier payment' });
    }
};
exports.updateSupplierPayment = updateSupplierPayment;
/**
 * Мягкое удаление оплаты (soft-delete).
 * DELETE /api/supplier-payments/:id
 */
const deleteSupplierPayment = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const userId = req.user?.userId;
        await prisma.$transaction(async (tx) => {
            await tx.supplierPayment.update({
                where: { id },
                data: {
                    deletedAt: new Date(),
                    deletedByUserId: userId || null,
                },
            });
            await (0, supplierLedger_service_1.syncSupplierPaymentLedger)(tx, id);
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('deleteSupplierPayment error:', error);
        res.status(500).json({ error: 'Failed to delete supplier payment' });
    }
};
exports.deleteSupplierPayment = deleteSupplierPayment;
