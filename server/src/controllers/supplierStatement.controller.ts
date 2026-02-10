import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { upsertOpeningBalance } from '../services/supplierLedger.service';

const prisma = new PrismaClient();

// ============================================
// АКТ СВЕРКИ (STATEMENT)
// ============================================

/**
 * Получить акт сверки по поставщику.
 * GET /api/suppliers/:supplierId/statement?dateFrom=&dateTo=
 *
 * Логика:
 * 1. Считаем opening balance = SUM(credit) - SUM(debit) для всех строк ДО dateFrom
 * 2. Получаем строки за период [dateFrom, dateTo]
 * 3. Считаем running saldo
 */
export const getSupplierStatement = async (req: Request, res: Response) => {
    try {
        const supplierId = Number(req.params.supplierId);
        const { dateFrom, dateTo } = req.query;

        if (!supplierId) return res.status(400).json({ error: 'supplierId is required' });

        // Даты
        const from = dateFrom ? new Date(String(dateFrom)) : null;
        const to = dateTo ? (() => { const d = new Date(String(dateTo)); d.setUTCHours(23, 59, 59, 999); return d; })() : null;

        // 1. Opening balance: сумма всех проводок ДО dateFrom
        let openingBalance = 0;
        if (from) {
            const agg = await prisma.supplierLedger.aggregate({
                where: {
                    supplierId,
                    isHidden: false,
                    opDate: { lt: from },
                },
                _sum: { debit: true, credit: true },
            });
            const totalCredit = Number(agg._sum.credit) || 0;
            const totalDebit = Number(agg._sum.debit) || 0;
            openingBalance = totalCredit - totalDebit;
        }

        // 2. Строки за период
        const where: any = { supplierId, isHidden: false };
        if (from || to) {
            where.opDate = {};
            if (from) where.opDate.gte = from;
            if (to) where.opDate.lte = to;
        }

        const rows = await prisma.supplierLedger.findMany({
            where,
            orderBy: [{ opDate: 'asc' }, { id: 'asc' }],
            select: {
                id: true,
                sourceType: true,
                sourceId: true,
                operationName: true,
                opDate: true,
                debit: true,
                credit: true,
            },
        });

        // 3. Вычисляем running saldo
        let saldo = openingBalance;
        let totalDebit = 0;
        let totalCredit = 0;

        const entries = rows.map(r => {
            const d = Number(r.debit);
            const c = Number(r.credit);
            totalDebit += d;
            totalCredit += c;
            saldo += c - d;
            return {
                ...r,
                debit: d,
                credit: c,
                saldoAfter: saldo,
            };
        });

        res.json({
            supplierId,
            openingBalance,
            entries,
            totals: {
                debit: totalDebit,
                credit: totalCredit,
                balance: openingBalance + totalCredit - totalDebit,
            },
        });
    } catch (error) {
        console.error('getSupplierStatement error:', error);
        res.status(500).json({ error: 'Failed to fetch supplier statement' });
    }
};

/**
 * Получить текущее начальное сальдо.
 * GET /api/suppliers/:supplierId/opening-balance
 */
export const getOpeningBalance = async (req: Request, res: Response) => {
    try {
        const supplierId = Number(req.params.supplierId);

        const row = await prisma.supplierLedger.findUnique({
            where: {
                supplierId_sourceType_sourceId_sourceLineId: {
                    supplierId,
                    sourceType: 'OPENING_BALANCE',
                    sourceId: 0,
                    sourceLineId: 0,
                },
            },
        });

        res.json({
            supplierId,
            amount: row ? Number(row.credit) - Number(row.debit) : 0,
            date: row?.opDate || null,
        });
    } catch (error) {
        console.error('getOpeningBalance error:', error);
        res.status(500).json({ error: 'Failed to fetch opening balance' });
    }
};

/**
 * Установить/обновить начальное сальдо.
 * PUT /api/suppliers/:supplierId/opening-balance
 * Body: { amount, date }
 */
export const setOpeningBalance = async (req: Request, res: Response) => {
    try {
        const supplierId = Number(req.params.supplierId);
        const { amount, date } = req.body;

        if (amount === undefined) return res.status(400).json({ error: 'amount is required' });

        const opDate = date ? new Date(date) : new Date('2020-01-01');

        await prisma.$transaction(async (tx) => {
            await upsertOpeningBalance(tx, supplierId, Number(amount), opDate);
        });

        res.json({ success: true, supplierId, amount: Number(amount), date: opDate });
    } catch (error) {
        console.error('setOpeningBalance error:', error);
        res.status(500).json({ error: 'Failed to set opening balance' });
    }
};
