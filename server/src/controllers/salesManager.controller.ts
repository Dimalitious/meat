import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { getAllowedCustomerIds, assertCustomerAccess } from '../services/salesManagerAccess.service';
import { buildStatement } from '../services/salesManagerStatement.service';

// Cast to any: new models (CustomerSalesManager, CustomerMoneyRefund, OrderDraft fields)
// are not in the generated client until `npx prisma generate` is re-run.
const prisma = new PrismaClient() as any;

// ============================================
// HELPERS
// ============================================

function getUserCtx(req: Request) {
    const u = (req as any).user;
    return {
        userId: u?.userId as number,
        roles: (u?.roles || []) as string[],
        username: u?.username as string,
    };
}

// ============================================
// CUSTOMERS
// ============================================

/**
 * GET /api/sales-manager/customers
 * List customers accessible to the current user.
 * Query: ?q=search&page=1&pageSize=50
 */
export const getCustomers = async (req: Request, res: Response) => {
    try {
        const user = getUserCtx(req);
        const { q, page = '1', pageSize = '50' } = req.query;
        const skip = (Number(page) - 1) * Number(pageSize);
        const take = Math.min(Number(pageSize), 200);

        // Build where clause
        const where: any = {};

        // SALES_MANAGER: restrict to assigned customers
        if (!user.roles.includes('ADMIN')) {
            const ids = await getAllowedCustomerIds(prisma, user.userId);
            where.id = { in: ids };
        }

        // Search filter
        if (q) {
            where.OR = [
                { name: { contains: String(q), mode: 'insensitive' } },
                { code: { contains: String(q), mode: 'insensitive' } },
                { inn: { contains: String(q), mode: 'insensitive' } },
            ];
        }

        const [customers, total] = await Promise.all([
            prisma.customer.findMany({
                where,
                skip,
                take,
                orderBy: { name: 'asc' },
                select: {
                    id: true,
                    code: true,
                    name: true,
                    inn: true,
                    telegramChatId: true,
                    telegramGroupName: true,
                    telegramIsEnabled: true,
                    managerId: true,
                },
            }),
            prisma.customer.count({ where }),
        ]);

        res.json({ customers, total, page: Number(page), pageSize: take });
    } catch (err) {
        console.error('SM.getCustomers error:', err);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
};

/**
 * POST /api/sales-manager/customers/:customerId/assign
 * Body: { userIds: number[] }
 */
export const assignManagers = async (req: Request, res: Response) => {
    try {
        const customerId = Number(req.params.customerId);
        const { userIds } = req.body;
        const user = getUserCtx(req);

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ error: 'userIds array is required' });
        }

        // Verify customer exists
        const customer = await prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        await prisma.$transaction(async (tx: any) => {
            for (const uid of userIds) {
                // Skip if already active
                const existing = await tx.customerSalesManager.findFirst({
                    where: { customerId, userId: Number(uid), unassignedAt: null },
                });
                if (existing) continue;

                await tx.customerSalesManager.create({
                    data: {
                        customerId,
                        userId: Number(uid),
                        assignedByUserId: user.userId,
                    },
                });
            }
        });

        res.json({ success: true });
    } catch (err) {
        console.error('SM.assignManagers error:', err);
        res.status(500).json({ error: 'Failed to assign managers' });
    }
};

/**
 * POST /api/sales-manager/customers/:customerId/unassign
 * Body: { userId: number }
 */
export const unassignManager = async (req: Request, res: Response) => {
    try {
        const customerId = Number(req.params.customerId);
        const { userId: targetUserId } = req.body;
        const user = getUserCtx(req);

        if (!targetUserId) return res.status(400).json({ error: 'userId is required' });

        const link = await prisma.customerSalesManager.findFirst({
            where: { customerId, userId: Number(targetUserId), unassignedAt: null },
        });

        if (!link) return res.status(404).json({ error: 'Active assignment not found' });

        await prisma.customerSalesManager.update({
            where: { id: link.id },
            data: {
                unassignedAt: new Date(),
                unassignedByUserId: user.userId,
            },
        });

        res.json({ success: true });
    } catch (err) {
        console.error('SM.unassignManager error:', err);
        res.status(500).json({ error: 'Failed to unassign manager' });
    }
};

// ============================================
// DRAFTS
// ============================================

/**
 * GET /api/sales-manager/drafts
 * Query: ?from&to&status&customerId
 */
export const getDrafts = async (req: Request, res: Response) => {
    try {
        const user = getUserCtx(req);
        const { from, to, status, customerId } = req.query;

        const where: any = {
            status: { in: ['MANAGER_REVIEW', 'MANAGER_REJECTED', 'MANAGER_ACCEPTED'] },
        };

        // Filter by status
        if (status) {
            where.status = String(status);
        }

        // Filter by customer access
        if (!user.roles.includes('ADMIN')) {
            const ids = await getAllowedCustomerIds(prisma, user.userId);
            where.customerId = { in: ids };
        }

        if (customerId) {
            where.customerId = Number(customerId);
        }

        // Date filter
        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(String(from));
            if (to) {
                const d = new Date(String(to));
                d.setUTCHours(23, 59, 59, 999);
                where.createdAt.lte = d;
            }
        }

        const drafts = await prisma.orderDraft.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                customer: { select: { id: true, code: true, name: true } },
                items: true,
                order: { select: { id: true, status: true } },
            },
            take: 200,
        });

        res.json(drafts);
    } catch (err) {
        console.error('SM.getDrafts error:', err);
        res.status(500).json({ error: 'Failed to fetch drafts' });
    }
};

/**
 * POST /api/sales-manager/drafts/:draftId/accept
 * Accept draft → create Order(status=NEW)
 */
export const acceptDraft = async (req: Request, res: Response) => {
    try {
        const draftId = Number(req.params.draftId);
        const user = getUserCtx(req);

        const result = await prisma.$transaction(async (tx: any) => {
            const draft = await tx.orderDraft.findUnique({
                where: { id: draftId },
                include: { items: true },
            });

            if (!draft) throw { status: 404, error: 'Draft not found' };
            if (draft.status !== 'MANAGER_REVIEW') {
                throw { status: 400, error: `Cannot accept draft in status '${draft.status}'` };
            }

            // IDOR check
            await assertCustomerAccess(tx, user, draft.customerId);

            // Filter valid items (productId and quantity must be present)
            const validItems = draft.items.filter((i: any) => i.productId != null && i.quantity != null);
            if (validItems.length === 0) {
                throw { status: 400, error: 'Нет распознанных позиций для создания заказа' };
            }

            // Look up current prices for each product for this customer
            const orderItems: { productId: number; quantity: number; price: Prisma.Decimal; amount: Prisma.Decimal }[] = [];

            for (const item of validItems) {
                // Try to find customer-specific price first
                const priceRow = await tx.salesPriceItem.findFirst({
                    where: {
                        productId: item.productId!,
                        priceList: { customerId: draft.customerId },
                    },
                    orderBy: { priceList: { effectiveDate: 'desc' } },
                    select: { salePrice: true },
                });

                const price = priceRow?.salePrice ?? new Prisma.Decimal(0);
                const qty = item.quantity!;
                const amount = price.mul(qty);

                orderItems.push({
                    productId: item.productId!,
                    quantity: qty,
                    price,
                    amount,
                });
            }

            const totalAmount = orderItems.reduce(
                (sum, i) => sum.add(i.amount),
                new Prisma.Decimal(0),
            );

            // Create Order
            const order = await tx.order.create({
                data: {
                    customerId: draft.customerId,
                    status: 'NEW',
                    date: new Date(),
                    totalAmount,
                    draftId: draft.id,
                    items: {
                        create: orderItems.map(i => ({
                            productId: i.productId,
                            quantity: i.quantity,
                            price: i.price,
                            amount: i.amount,
                        })),
                    },
                },
            });

            // Update draft
            await tx.orderDraft.update({
                where: { id: draftId },
                data: {
                    status: 'MANAGER_ACCEPTED',
                    acceptedAt: new Date(),
                    acceptedByUserId: user.userId,
                },
            });

            return order;
        });

        res.status(201).json({ success: true, orderId: result.id });
    } catch (err: any) {
        if (err?.status) return res.status(err.status).json({ error: err.error });

        // Handle race condition: Order.draftId is @unique
        if (err?.code === 'P2002' && err?.meta?.target?.includes('draftId')) {
            return res.status(409).json({ error: 'Этот черновик уже был принят другим менеджером' });
        }

        console.error('SM.acceptDraft error:', err);
        res.status(500).json({ error: 'Failed to accept draft' });
    }
};

/**
 * POST /api/sales-manager/drafts/:draftId/reject
 * Body: { reason: string }
 */
export const rejectDraft = async (req: Request, res: Response) => {
    try {
        const draftId = Number(req.params.draftId);
        const { reason } = req.body;
        const user = getUserCtx(req);

        if (!reason || !String(reason).trim()) {
            return res.status(400).json({ error: 'Причина отклонения обязательна' });
        }

        const draft = await prisma.orderDraft.findUnique({ where: { id: draftId } });
        if (!draft) return res.status(404).json({ error: 'Draft not found' });
        if (draft.status !== 'MANAGER_REVIEW') {
            return res.status(400).json({ error: `Cannot reject draft in status '${draft.status}'` });
        }

        await assertCustomerAccess(prisma, user, draft.customerId);

        await prisma.orderDraft.update({
            where: { id: draftId },
            data: {
                status: 'MANAGER_REJECTED',
                managerDecisionNote: String(reason).trim(),
                rejectedAt: new Date(),
                rejectedByUserId: user.userId,
            },
        });

        res.json({ success: true });
    } catch (err: any) {
        if (err?.status) return res.status(err.status).json({ error: err.error });
        console.error('SM.rejectDraft error:', err);
        res.status(500).json({ error: 'Failed to reject draft' });
    }
};

/**
 * PUT /api/sales-manager/drafts/:draftId
 * Edit items of a rejected draft. Body: { items: [...], note?: string }
 */
export const updateRejectedDraft = async (req: Request, res: Response) => {
    try {
        const draftId = Number(req.params.draftId);
        const { items, note } = req.body;
        const user = getUserCtx(req);

        const draft = await prisma.orderDraft.findUnique({ where: { id: draftId } });
        if (!draft) return res.status(404).json({ error: 'Draft not found' });
        if (draft.status !== 'MANAGER_REJECTED') {
            return res.status(400).json({ error: 'Редактирование доступно только для отклонённых черновиков' });
        }

        await assertCustomerAccess(prisma, user, draft.customerId);

        await prisma.$transaction(async (tx: any) => {
            // Update items (delete + recreate)
            if (Array.isArray(items)) {
                await tx.orderDraftItem.deleteMany({ where: { draftId } });
                await tx.orderDraftItem.createMany({
                    data: items.map((i: any) => ({
                        draftId,
                        productId: i.productId || null,
                        rawText: i.rawText || '',
                        title: i.title || null,
                        quantity: i.quantity || null,
                        unit: i.unit || null,
                    })),
                });
            }

            // Update note if provided
            if (note !== undefined) {
                await tx.orderDraft.update({
                    where: { id: draftId },
                    data: { note },
                });
            }
        });

        res.json({ success: true });
    } catch (err: any) {
        if (err?.status) return res.status(err.status).json({ error: err.error });
        console.error('SM.updateRejectedDraft error:', err);
        res.status(500).json({ error: 'Failed to update draft' });
    }
};

/**
 * POST /api/sales-manager/drafts/:draftId/return-to-review
 * MANAGER_REJECTED → MANAGER_REVIEW
 */
export const returnDraftToReview = async (req: Request, res: Response) => {
    try {
        const draftId = Number(req.params.draftId);
        const user = getUserCtx(req);

        const draft = await prisma.orderDraft.findUnique({ where: { id: draftId } });
        if (!draft) return res.status(404).json({ error: 'Draft not found' });
        if (draft.status !== 'MANAGER_REJECTED') {
            return res.status(400).json({ error: 'Возврат на проверку доступен только для отклонённых черновиков' });
        }

        await assertCustomerAccess(prisma, user, draft.customerId);

        await prisma.orderDraft.update({
            where: { id: draftId },
            data: { status: 'MANAGER_REVIEW' },
        });

        res.json({ success: true });
    } catch (err: any) {
        if (err?.status) return res.status(err.status).json({ error: err.error });
        console.error('SM.returnDraftToReview error:', err);
        res.status(500).json({ error: 'Failed to return draft to review' });
    }
};

// ============================================
// STATEMENT (АКСВЕРК)
// ============================================

/**
 * GET /api/sales-manager/customers/:customerId/statement?from&to
 */
export const getStatement = async (req: Request, res: Response) => {
    try {
        const customerId = Number(req.params.customerId);
        const { from: fromQ, to: toQ } = req.query;
        const user = getUserCtx(req);

        if (!fromQ || !toQ) {
            return res.status(400).json({ error: 'from and to query params are required' });
        }

        await assertCustomerAccess(prisma, user, customerId);

        const from = new Date(String(fromQ));
        from.setUTCHours(0, 0, 0, 0);
        const to = new Date(String(toQ));

        const statement = await buildStatement(prisma as any, customerId, from, to);

        res.json(statement);
    } catch (err: any) {
        if (err?.status) return res.status(err.status).json({ error: err.error });
        console.error('SM.getStatement error:', err);
        res.status(500).json({ error: 'Failed to build statement' });
    }
};

/**
 * POST /api/sales-manager/customers/:customerId/statement/send
 * Body: { from, to }
 * Creates a TelegramOutbox record.
 */
export const sendStatement = async (req: Request, res: Response) => {
    try {
        const customerId = Number(req.params.customerId);
        const { from: fromBody, to: toBody } = req.body;
        const user = getUserCtx(req);

        if (!fromBody || !toBody) {
            return res.status(400).json({ error: 'from and to are required' });
        }

        await assertCustomerAccess(prisma, user, customerId);

        // Check customer has a chatId
        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            select: { id: true, name: true, telegramChatId: true },
        });

        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        if (!customer.telegramChatId) {
            return res.status(400).json({ error: 'У клиента не привязан Telegram' });
        }

        // Build statement
        const from = new Date(String(fromBody));
        from.setUTCHours(0, 0, 0, 0);
        const to = new Date(String(toBody));
        const statement = await buildStatement(prisma as any, customerId, from, to);

        // Format as text for MVP
        const lines: string[] = [
            `📊 Акт сверки: ${customer.name}`,
            `Период: ${statement.from} — ${statement.to}`,
            ``,
        ];

        for (const op of statement.operations) {
            const d = op.debit ? `Дебет: ${op.debit.toFixed(2)}` : '';
            const c = op.credit ? `Кредит: ${op.credit.toFixed(2)}` : '';
            lines.push(`${op.date} | ${op.title} | ${d || c}`);
        }

        lines.push(``);
        lines.push(`─────────────────────`);
        lines.push(`Дебет:  ${statement.totals.debit.toFixed(2)}`);
        lines.push(`Кредит: ${statement.totals.credit.toFixed(2)}`);
        lines.push(`Сальдо: ${statement.totals.saldo.toFixed(2)}`);

        const text = lines.join('\n');

        // Create TelegramOutbox record
        const outbox = await prisma.telegramOutbox.create({
            data: {
                customerId,
                chatId: customer.telegramChatId,
                text,
                documentType: 'ACT_RECONCILIATION',
                documentParams: { customerId, from: statement.from, to: statement.to },
                createdBy: String(user.userId),
            },
        });

        res.status(201).json({ success: true, outboxId: outbox.id });
    } catch (err: any) {
        if (err?.status) return res.status(err.status).json({ error: err.error });
        console.error('SM.sendStatement error:', err);
        res.status(500).json({ error: 'Failed to send statement' });
    }
};

// ============================================
// REFUNDS (Возврат денег клиенту)
// ============================================

/**
 * GET /api/sales-manager/customers/:customerId/refunds?from&to&showDeleted=0
 */
export const listRefunds = async (req: Request, res: Response) => {
    try {
        const customerId = Number(req.params.customerId);
        const { from, to, showDeleted } = req.query;
        const user = getUserCtx(req);

        await assertCustomerAccess(prisma, user, customerId);

        const where: any = { customerId };

        // By default hide deleted
        if (showDeleted !== '1') {
            where.deletedAt = null;
        }

        if (from || to) {
            where.refundDate = {};
            if (from) where.refundDate.gte = new Date(String(from));
            if (to) {
                const d = new Date(String(to));
                d.setUTCHours(23, 59, 59, 999);
                where.refundDate.lte = d;
            }
        }

        const refunds = await prisma.customerMoneyRefund.findMany({
            where,
            orderBy: [{ refundDate: 'desc' }, { id: 'desc' }],
            include: {
                paymentType: { select: { id: true, name: true } },
                createdByUser: { select: { id: true, name: true, username: true } },
                deletedByUser: { select: { id: true, name: true, username: true } },
            },
        });

        res.json(refunds);
    } catch (err: any) {
        if (err?.status) return res.status(err.status).json({ error: err.error });
        console.error('SM.listRefunds error:', err);
        res.status(500).json({ error: 'Failed to list refunds' });
    }
};

/**
 * POST /api/sales-manager/customers/:customerId/refunds
 * Body: { refundDate, amount, paymentTypeId?, reference?, comment?, proofUrl? }
 */
export const createRefund = async (req: Request, res: Response) => {
    try {
        const customerId = Number(req.params.customerId);
        const { refundDate, amount, paymentTypeId, reference, comment, proofUrl } = req.body;
        const user = getUserCtx(req);

        // Validate
        if (!refundDate) return res.status(400).json({ error: 'refundDate is required' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'amount must be > 0' });

        await assertCustomerAccess(prisma, user, customerId);

        // Verify customer exists
        const customer = await prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        // Verify paymentType if provided
        if (paymentTypeId) {
            const pt = await prisma.paymentType.findUnique({ where: { id: Number(paymentTypeId) } });
            if (!pt) return res.status(404).json({ error: 'PaymentType not found' });
        }

        const normalizedDate = new Date(refundDate);
        normalizedDate.setUTCHours(0, 0, 0, 0);

        const refund = await prisma.customerMoneyRefund.create({
            data: {
                customerId,
                refundDate: normalizedDate,
                amount: Number(amount),
                paymentTypeId: paymentTypeId ? Number(paymentTypeId) : null,
                reference: reference || null,
                comment: comment || null,
                proofUrl: proofUrl || null,
                createdByUserId: user.userId,
            },
            include: {
                paymentType: { select: { id: true, name: true } },
                createdByUser: { select: { id: true, name: true, username: true } },
            },
        });

        res.status(201).json(refund);
    } catch (err: any) {
        if (err?.status) return res.status(err.status).json({ error: err.error });
        console.error('SM.createRefund error:', err);
        res.status(500).json({ error: 'Failed to create refund' });
    }
};

/**
 * PUT /api/sales-manager/refunds/:id
 * Body: { refundDate?, amount?, paymentTypeId?, reference?, comment?, proofUrl? }
 */
export const updateRefund = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const { refundDate, amount, paymentTypeId, reference, comment, proofUrl } = req.body;
        const user = getUserCtx(req);

        const existing = await prisma.customerMoneyRefund.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Refund not found' });
        if (existing.deletedAt) return res.status(400).json({ error: 'Нельзя редактировать удалённый возврат' });

        await assertCustomerAccess(prisma, user, existing.customerId);

        const data: any = { updatedByUserId: user.userId };

        if (refundDate !== undefined) {
            const d = new Date(refundDate);
            d.setUTCHours(0, 0, 0, 0);
            data.refundDate = d;
        }
        if (amount !== undefined) {
            if (Number(amount) <= 0) return res.status(400).json({ error: 'amount must be > 0' });
            data.amount = Number(amount);
        }
        if (paymentTypeId !== undefined) data.paymentTypeId = paymentTypeId ? Number(paymentTypeId) : null;
        if (reference !== undefined) data.reference = reference;
        if (comment !== undefined) data.comment = comment;
        if (proofUrl !== undefined) data.proofUrl = proofUrl;

        const refund = await prisma.customerMoneyRefund.update({
            where: { id },
            data,
            include: {
                paymentType: { select: { id: true, name: true } },
                createdByUser: { select: { id: true, name: true, username: true } },
            },
        });

        res.json(refund);
    } catch (err: any) {
        if (err?.status) return res.status(err.status).json({ error: err.error });
        console.error('SM.updateRefund error:', err);
        res.status(500).json({ error: 'Failed to update refund' });
    }
};

/**
 * DELETE /api/sales-manager/refunds/:id
 * Soft delete: sets deletedAt + deletedByUserId
 */
export const softDeleteRefund = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const user = getUserCtx(req);

        const existing = await prisma.customerMoneyRefund.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Refund not found' });
        if (existing.deletedAt) return res.status(400).json({ error: 'Уже удалено' });

        await assertCustomerAccess(prisma, user, existing.customerId);

        await prisma.customerMoneyRefund.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                deletedByUserId: user.userId,
            },
        });

        res.json({ success: true });
    } catch (err: any) {
        if (err?.status) return res.status(err.status).json({ error: err.error });
        console.error('SM.softDeleteRefund error:', err);
        res.status(500).json({ error: 'Failed to delete refund' });
    }
};
