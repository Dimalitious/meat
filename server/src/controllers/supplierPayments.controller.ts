import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { syncSupplierPaymentLedger } from '../services/supplierLedger.service';

// ============================================
// ОПЛАТЫ ПОСТАВЩИКУ
// ============================================

/**
 * Список оплат.
 * GET /api/supplier-payments?supplierId=&dateFrom=&dateTo=&includeDeleted=
 */
export const getSupplierPayments = async (req: Request, res: Response) => {
    try {
        const { supplierId, dateFrom, dateTo, includeDeleted } = req.query;

        const where: any = {};
        if (supplierId) where.supplierId = Number(supplierId);
        if (!includeDeleted || includeDeleted !== 'true') where.deletedAt = null;
        if (dateFrom || dateTo) {
            where.paymentDate = {};
            if (dateFrom) where.paymentDate.gte = new Date(String(dateFrom));
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
    } catch (error) {
        console.error('getSupplierPayments error:', error);
        res.status(500).json({ error: 'Failed to fetch supplier payments' });
    }
};

/**
 * Создать оплату.
 * POST /api/supplier-payments
 * Body: { supplierId, paymentDate, amount, method, reference, comment }
 */
export const createSupplierPayment = async (req: Request, res: Response) => {
    try {
        const { supplierId, paymentDate, amount, method, reference, comment } = req.body;
        const userId = (req as any).user?.userId;

        if (!supplierId) return res.status(400).json({ error: 'supplierId is required' });
        if (!paymentDate) return res.status(400).json({ error: 'paymentDate is required' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'amount must be > 0' });

        const normalizedDate = new Date(paymentDate);
        normalizedDate.setUTCHours(0, 0, 0, 0);

        // Validate supplier exists
        const supplier = await prisma.supplier.findUnique({ where: { id: Number(supplierId) } });
        if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

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

            await syncSupplierPaymentLedger(tx, payment.id);
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
    } catch (error) {
        console.error('createSupplierPayment error:', error);
        res.status(500).json({ error: 'Failed to create supplier payment' });
    }
};

/**
 * Обновить оплату.
 * PUT /api/supplier-payments/:id
 */
export const updateSupplierPayment = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const { paymentDate, amount, method, reference, comment } = req.body;

        const existing = await prisma.supplierPayment.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Payment not found' });
        if (existing.deletedAt) return res.status(400).json({ error: 'Cannot edit deleted payment' });

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

            await syncSupplierPaymentLedger(tx, id);
        });

        const full = await prisma.supplierPayment.findUnique({
            where: { id },
            include: {
                supplier: { select: { id: true, name: true, code: true } },
                createdByUser: { select: { id: true, name: true, username: true } },
            },
        });

        res.json(full);
    } catch (error) {
        console.error('updateSupplierPayment error:', error);
        res.status(500).json({ error: 'Failed to update supplier payment' });
    }
};

/**
 * Мягкое удаление оплаты (soft-delete).
 * DELETE /api/supplier-payments/:id
 */
export const deleteSupplierPayment = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const userId = (req as any).user?.userId;

        await prisma.$transaction(async (tx) => {
            await tx.supplierPayment.update({
                where: { id },
                data: {
                    deletedAt: new Date(),
                    deletedByUserId: userId || null,
                },
            });
            await syncSupplierPaymentLedger(tx, id);
        });

        res.json({ success: true });
    } catch (error) {
        console.error('deleteSupplierPayment error:', error);
        res.status(500).json({ error: 'Failed to delete supplier payment' });
    }
};
