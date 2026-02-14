import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { syncSupplierReturnLedger } from '../services/supplierLedger.service';

// ============================================
// ВОЗВРАТЫ ПОСТАВЩИКУ
// ============================================

/**
 * Список возвратов (журнал).
 * GET /api/supplier-returns?supplierId=&dateFrom=&dateTo=&includeDisabled=
 */
export const getSupplierReturns = async (req: Request, res: Response) => {
    try {
        const { supplierId, dateFrom, dateTo, includeDisabled } = req.query;

        const where: any = {};
        if (supplierId) where.supplierId = Number(supplierId);
        if (!includeDisabled || includeDisabled !== 'true') where.isDisabled = false;
        if (dateFrom || dateTo) {
            where.returnDate = {};
            if (dateFrom) where.returnDate.gte = new Date(String(dateFrom));
            if (dateTo) {
                const to = new Date(String(dateTo));
                to.setUTCHours(23, 59, 59, 999);
                where.returnDate.lte = to;
            }
        }

        const returns = await prisma.supplierReturn.findMany({
            where,
            orderBy: { returnDate: 'desc' },
            include: {
                supplier: { select: { id: true, name: true, code: true } },
                createdByUser: { select: { id: true, name: true, username: true } },
                _count: { select: { items: true } },
            },
        });

        res.json(returns);
    } catch (error) {
        console.error('getSupplierReturns error:', error);
        res.status(500).json({ error: 'Failed to fetch supplier returns' });
    }
};

/**
 * Один возврат по ID.
 * GET /api/supplier-returns/:id
 */
export const getSupplierReturnById = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const ret = await prisma.supplierReturn.findUnique({
            where: { id },
            include: {
                supplier: { select: { id: true, name: true, code: true } },
                createdByUser: { select: { id: true, name: true, username: true } },
                items: {
                    include: { product: { select: { id: true, code: true, name: true } } },
                },
            },
        });
        if (!ret) return res.status(404).json({ error: 'Return not found' });
        res.json(ret);
    } catch (error) {
        console.error('getSupplierReturnById error:', error);
        res.status(500).json({ error: 'Failed to fetch supplier return' });
    }
};

/**
 * Создать возврат поставщику.
 * POST /api/supplier-returns
 * Body: { supplierId, returnDate, items: [{ productId, qty, price }] }
 */
export const createSupplierReturn = async (req: Request, res: Response) => {
    try {
        const { supplierId, returnDate, items } = req.body;
        const userId = (req as any).user?.userId;

        if (!supplierId) return res.status(400).json({ error: 'supplierId is required' });
        if (!returnDate) return res.status(400).json({ error: 'returnDate is required' });
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'At least one item is required' });
        }

        const normalizedDate = new Date(returnDate);
        normalizedDate.setUTCHours(0, 0, 0, 0);

        // Validate supplier exists
        const supplier = await prisma.supplier.findUnique({ where: { id: Number(supplierId) } });
        if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

        const totalAmount = items.reduce((sum: number, item: any) => {
            return sum + (Number(item.price) || 0) * (Number(item.qty) || 0);
        }, 0);

        const result = await prisma.$transaction(async (tx) => {
            const ret = await tx.supplierReturn.create({
                data: {
                    supplierId: Number(supplierId),
                    returnDate: normalizedDate,
                    totalAmount,
                    createdByUserId: userId || null,
                },
            });

            for (const item of items) {
                const price = Number(item.price) || 0;
                const qty = Number(item.qty) || 0;
                await tx.supplierReturnItem.create({
                    data: {
                        returnId: ret.id,
                        productId: Number(item.productId),
                        price,
                        qty,
                        amount: price * qty,
                    },
                });
            }

            // Sync ledger
            await syncSupplierReturnLedger(tx, ret.id);

            return ret;
        });

        // Return full object
        const full = await prisma.supplierReturn.findUnique({
            where: { id: result.id },
            include: {
                supplier: { select: { id: true, name: true, code: true } },
                createdByUser: { select: { id: true, name: true, username: true } },
                items: { include: { product: { select: { id: true, code: true, name: true } } } },
            },
        });

        res.status(201).json(full);
    } catch (error) {
        console.error('createSupplierReturn error:', error);
        res.status(500).json({ error: 'Failed to create supplier return' });
    }
};

/**
 * Обновить возврат (дата, items).
 * PUT /api/supplier-returns/:id
 */
export const updateSupplierReturn = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const { returnDate, items } = req.body;

        const existing = await prisma.supplierReturn.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Return not found' });
        if (existing.isDisabled) return res.status(400).json({ error: 'Cannot edit disabled return' });

        const normalizedDate = returnDate ? (() => { const d = new Date(returnDate); d.setUTCHours(0, 0, 0, 0); return d; })() : existing.returnDate;

        const totalAmount = items
            ? items.reduce((sum: number, item: any) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0)
            : Number(existing.totalAmount);

        const result = await prisma.$transaction(async (tx) => {
            // Обновить шапку
            await tx.supplierReturn.update({
                where: { id },
                data: { returnDate: normalizedDate, totalAmount },
            });

            // Пересоздать items если переданы
            if (items && Array.isArray(items)) {
                await tx.supplierReturnItem.deleteMany({ where: { returnId: id } });
                for (const item of items) {
                    const price = Number(item.price) || 0;
                    const qty = Number(item.qty) || 0;
                    await tx.supplierReturnItem.create({
                        data: {
                            returnId: id,
                            productId: Number(item.productId),
                            price,
                            qty,
                            amount: price * qty,
                        },
                    });
                }
            }

            await syncSupplierReturnLedger(tx, id);
            return true;
        });

        const full = await prisma.supplierReturn.findUnique({
            where: { id },
            include: {
                supplier: { select: { id: true, name: true, code: true } },
                createdByUser: { select: { id: true, name: true, username: true } },
                items: { include: { product: { select: { id: true, code: true, name: true } } } },
            },
        });

        res.json(full);
    } catch (error) {
        console.error('updateSupplierReturn error:', error);
        res.status(500).json({ error: 'Failed to update supplier return' });
    }
};

/**
 * Soft-disable возврата.
 * DELETE /api/supplier-returns/:id
 */
export const deleteSupplierReturn = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        await prisma.$transaction(async (tx) => {
            await tx.supplierReturn.update({
                where: { id },
                data: { isDisabled: true },
            });
            await syncSupplierReturnLedger(tx, id);
        });

        res.json({ success: true });
    } catch (error) {
        console.error('deleteSupplierReturn error:', error);
        res.status(500).json({ error: 'Failed to disable supplier return' });
    }
};
