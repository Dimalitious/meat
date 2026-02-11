"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncPurchaseLedger = syncPurchaseLedger;
exports.syncSupplierReturnLedger = syncSupplierReturnLedger;
exports.syncSupplierPaymentLedger = syncSupplierPaymentLedger;
exports.upsertOpeningBalance = upsertOpeningBalance;
const client_1 = require("@prisma/client");
/**
 * Синхронизация ledger для закупки (Purchase).
 * Одна закупка может содержать товары от нескольких поставщиков →
 * создаём по одной ledger-строке на каждую пару (purchaseId, supplierId).
 */
async function syncPurchaseLedger(tx, purchaseId) {
    const purchase = await tx.purchase.findUnique({
        where: { id: purchaseId },
        select: { id: true, purchaseDate: true, isDisabled: true, idn: true },
    });
    if (!purchase)
        return;
    // Группировка сумм по поставщикам
    const sums = await tx.purchaseItem.groupBy({
        by: ['supplierId'],
        where: { purchaseId },
        _sum: { amount: true },
    });
    const supplierIdsNow = sums.map(s => s.supplierId);
    // Upsert ledger для каждого поставщика
    for (const s of sums) {
        const credit = s._sum.amount ?? new client_1.Prisma.Decimal(0);
        await tx.supplierLedger.upsert({
            where: {
                supplierId_sourceType_sourceId_sourceLineId: {
                    supplierId: s.supplierId,
                    sourceType: 'PURCHASE',
                    sourceId: purchaseId,
                    sourceLineId: 0,
                },
            },
            create: {
                supplierId: s.supplierId,
                sourceType: 'PURCHASE',
                sourceId: purchaseId,
                sourceLineId: 0,
                operationName: `Закупка${purchase.idn ? ' ' + purchase.idn : ' #' + purchaseId}`,
                opDate: purchase.purchaseDate,
                debit: new client_1.Prisma.Decimal(0),
                credit,
                isHidden: purchase.isDisabled,
            },
            update: {
                operationName: `Закупка${purchase.idn ? ' ' + purchase.idn : ' #' + purchaseId}`,
                opDate: purchase.purchaseDate,
                debit: new client_1.Prisma.Decimal(0),
                credit,
                isHidden: purchase.isDisabled,
            },
        });
    }
    // Удалить ledger у поставщиков, которых больше нет в закупке
    if (supplierIdsNow.length === 0) {
        await tx.supplierLedger.deleteMany({
            where: { sourceType: 'PURCHASE', sourceId: purchaseId },
        });
    }
    else {
        await tx.supplierLedger.deleteMany({
            where: {
                sourceType: 'PURCHASE',
                sourceId: purchaseId,
                supplierId: { notIn: supplierIdsNow },
            },
        });
    }
}
/**
 * Синхронизация ledger для возврата поставщику.
 * Один возврат = один поставщик → одна строка ledger.
 */
async function syncSupplierReturnLedger(tx, returnId) {
    const r = await tx.supplierReturn.findUnique({
        where: { id: returnId },
        select: { id: true, supplierId: true, returnDate: true, totalAmount: true, isDisabled: true },
    });
    if (!r)
        return;
    await tx.supplierLedger.upsert({
        where: {
            supplierId_sourceType_sourceId_sourceLineId: {
                supplierId: r.supplierId,
                sourceType: 'SUPPLIER_RETURN',
                sourceId: r.id,
                sourceLineId: 0,
            },
        },
        create: {
            supplierId: r.supplierId,
            sourceType: 'SUPPLIER_RETURN',
            sourceId: r.id,
            sourceLineId: 0,
            operationName: `Возврат поставщику #${r.id}`,
            opDate: r.returnDate,
            debit: r.totalAmount,
            credit: new client_1.Prisma.Decimal(0),
            isHidden: r.isDisabled,
        },
        update: {
            operationName: `Возврат поставщику #${r.id}`,
            opDate: r.returnDate,
            debit: r.totalAmount,
            credit: new client_1.Prisma.Decimal(0),
            isHidden: r.isDisabled,
        },
    });
}
/**
 * Синхронизация ledger для оплаты поставщику.
 */
async function syncSupplierPaymentLedger(tx, paymentId) {
    const p = await tx.supplierPayment.findUnique({
        where: { id: paymentId },
        select: { id: true, supplierId: true, paymentDate: true, amount: true, deletedAt: true },
    });
    if (!p)
        return;
    await tx.supplierLedger.upsert({
        where: {
            supplierId_sourceType_sourceId_sourceLineId: {
                supplierId: p.supplierId,
                sourceType: 'SUPPLIER_PAYMENT',
                sourceId: p.id,
                sourceLineId: 0,
            },
        },
        create: {
            supplierId: p.supplierId,
            sourceType: 'SUPPLIER_PAYMENT',
            sourceId: p.id,
            sourceLineId: 0,
            operationName: `Оплата #${p.id}`,
            opDate: p.paymentDate,
            debit: p.amount,
            credit: new client_1.Prisma.Decimal(0),
            isHidden: !!p.deletedAt,
        },
        update: {
            operationName: `Оплата #${p.id}`,
            opDate: p.paymentDate,
            debit: p.amount,
            credit: new client_1.Prisma.Decimal(0),
            isHidden: !!p.deletedAt,
        },
    });
}
/**
 * Upsert начального сальдо для поставщика.
 * credit = сумма долга, debit = 0 (или наоборот если переплата).
 */
async function upsertOpeningBalance(tx, supplierId, amount, date) {
    const isDebt = amount >= 0;
    await tx.supplierLedger.upsert({
        where: {
            supplierId_sourceType_sourceId_sourceLineId: {
                supplierId,
                sourceType: 'OPENING_BALANCE',
                sourceId: 0,
                sourceLineId: 0,
            },
        },
        create: {
            supplierId,
            sourceType: 'OPENING_BALANCE',
            sourceId: 0,
            sourceLineId: 0,
            operationName: 'Начальное сальдо',
            opDate: date,
            debit: isDebt ? new client_1.Prisma.Decimal(0) : new client_1.Prisma.Decimal(Math.abs(amount)),
            credit: isDebt ? new client_1.Prisma.Decimal(amount) : new client_1.Prisma.Decimal(0),
            isHidden: false,
        },
        update: {
            opDate: date,
            debit: isDebt ? new client_1.Prisma.Decimal(0) : new client_1.Prisma.Decimal(Math.abs(amount)),
            credit: isDebt ? new client_1.Prisma.Decimal(amount) : new client_1.Prisma.Decimal(0),
        },
    });
}
