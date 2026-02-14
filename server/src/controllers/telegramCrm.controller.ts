import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../db';
import { confirmDraft, cancelDraft } from '../services/draftService';
import { assertActiveProductsOrThrow } from '../utils/productGuards';

// ============================================
// Генерация bind-кода (без O/0/I/1)
// ============================================

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode(length = 6): string {
    const bytes = crypto.randomBytes(length);
    return Array.from(bytes)
        .map(b => ALPHABET[b % ALPHABET.length])
        .join('');
}

// ============================================
// POST /api/telegram/customers/:customerId/bind-request
// ============================================

export async function createBindRequest(req: Request, res: Response) {
    try {
        const customerId = parseInt(req.params.customerId as string);
        if (isNaN(customerId)) {
            return res.status(400).json({ error: 'Invalid customerId' });
        }

        const customer = await prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Проверить: уже привязан?
        if (customer.telegramChatId) {
            return res.status(409).json({
                error: 'Клиент уже привязан к Telegram-группе',
                telegramGroupName: customer.telegramGroupName,
            });
        }

        const code = generateCode();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 минут

        const bindRequest = await prisma.telegramBindRequest.create({
            data: {
                customerId,
                code,
                expiresAt,
                createdByUserId: req.user?.userId || null,
            },
        });

        res.status(201).json({
            code: bindRequest.code,
            expiresAt: bindRequest.expiresAt,
            instruction: `Отправьте в нужную Telegram-группу: /bind ${bindRequest.code}`,
        });
    } catch (error) {
        console.error('Error creating bind request:', error);
        res.status(500).json({ error: 'Failed to create bind request' });
    }
}

// ============================================
// GET /api/telegram/drafts
// ============================================

export async function getDrafts(req: Request, res: Response) {
    try {
        const { status, customerId, from, to, limit = '50' } = req.query;

        const where: any = {};
        if (status) where.status = status;
        if (customerId) where.customerId = parseInt(customerId as string);
        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from as string);
            if (to) where.createdAt.lte = new Date(to as string);
        }

        const drafts = await prisma.orderDraft.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit as string),
            include: {
                customer: { select: { id: true, name: true, code: true } },
                items: true,
                _count: { select: { messages: true } },
            },
        });

        // Serialize BigInt
        const serialized = drafts.map(d => ({
            ...d,
            sourceChatId: d.sourceChatId?.toString() || null,
            confirmedByChatId: d.confirmedByChatId?.toString() || null,
        }));

        res.json(serialized);
    } catch (error) {
        console.error('Error fetching drafts:', error);
        res.status(500).json({ error: 'Failed to fetch drafts' });
    }
}

// ============================================
// GET /api/telegram/drafts/count
// ============================================

export async function getDraftCount(req: Request, res: Response) {
    try {
        const count = await prisma.orderDraft.count({
            where: { status: { in: ['NEW', 'CLARIFY', 'WAIT_CONFIRM'] } },
        });
        res.json({ count });
    } catch (error) {
        console.error('Error counting drafts:', error);
        res.status(500).json({ error: 'Failed to count drafts' });
    }
}

// ============================================
// GET /api/telegram/drafts/:id
// ============================================

export async function getDraftById(req: Request, res: Response) {
    try {
        const id = parseInt(req.params.id as string);
        const draft = await prisma.orderDraft.findUnique({
            where: { id },
            include: {
                customer: { select: { id: true, name: true, code: true } },
                items: true,
                messages: {
                    include: {
                        inbox: { select: { id: true, text: true, messageDate: true, fromUserId: true } },
                    },
                },
                order: { select: { id: true, status: true, totalAmount: true } },
            },
        });

        if (!draft) {
            return res.status(404).json({ error: 'Draft not found' });
        }

        res.json({
            ...draft,
            sourceChatId: draft.sourceChatId?.toString() || null,
            confirmedByChatId: draft.confirmedByChatId?.toString() || null,
            messages: draft.messages.map(m => ({
                ...m,
                inbox: {
                    ...m.inbox,
                    fromUserId: m.inbox.fromUserId?.toString() || null,
                },
            })),
        });
    } catch (error) {
        console.error('Error fetching draft:', error);
        res.status(500).json({ error: 'Failed to fetch draft' });
    }
}

// ============================================
// PUT /api/telegram/drafts/:id
// ============================================

export async function updateDraft(req: Request, res: Response) {
    try {
        const id = parseInt(req.params.id as string);
        const { items, note } = req.body;

        const draft = await prisma.orderDraft.findUnique({
            where: { id },
            include: { items: true },
        });

        if (!draft) {
            return res.status(404).json({ error: 'Draft not found' });
        }

        if (['CONFIRMED', 'CANCELED'].includes(draft.status)) {
            return res.status(400).json({ error: 'Cannot edit finalized draft' });
        }

        // Update note
        await prisma.orderDraft.update({
            where: { id },
            data: {
                ...(note !== undefined && { note }),
            },
        });

        // Update items if provided
        if (items && Array.isArray(items)) {
            // Guard: new productIds must be active (soft-delta)
            const existingProductIds = new Set(draft.items.map((i: any) => i.productId).filter(Boolean));
            const newProductIds = items
                .filter((i: any) => i.productId && !existingProductIds.has(i.productId))
                .map((i: any) => i.productId);
            if (newProductIds.length > 0) {
                await assertActiveProductsOrThrow(prisma, newProductIds);
            }

            for (const item of items) {
                if (item.id) {
                    await prisma.orderDraftItem.update({
                        where: { id: item.id },
                        data: {
                            ...(item.productId !== undefined && { productId: item.productId }),
                            ...(item.title !== undefined && { title: item.title }),
                            ...(item.quantity !== undefined && { quantity: item.quantity }),
                            ...(item.unit !== undefined && { unit: item.unit }),
                        },
                    });
                }
            }

            // Пересчитать статус
            const updatedItems = await prisma.orderDraftItem.findMany({ where: { draftId: id } });
            const hasUnresolved = updatedItems.some(i => !i.productId || !i.quantity);
            const newStatus = hasUnresolved ? 'CLARIFY' : 'WAIT_CONFIRM';

            await prisma.orderDraft.update({
                where: { id },
                data: { status: newStatus },
            });
        }

        const updated = await prisma.orderDraft.findUnique({
            where: { id },
            include: { items: true, customer: { select: { id: true, name: true } } },
        });

        res.json(updated);
    } catch (error) {
        console.error('Error updating draft:', error);
        res.status(500).json({ error: 'Failed to update draft' });
    }
}

// ============================================
// POST /api/telegram/drafts/:id/confirm
// ============================================

export async function confirmDraftCrm(req: Request, res: Response) {
    try {
        const id = parseInt(req.params.id as string);
        const result = await confirmDraft(id, {
            type: 'CRM',
            userId: req.user!.userId,
        });

        if (result.error) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            success: true,
            orderId: result.orderId,
            totalAmount: result.totalAmount,
        });
    } catch (error) {
        console.error('Error confirming draft:', error);
        res.status(500).json({ error: 'Failed to confirm draft' });
    }
}

// ============================================
// POST /api/telegram/drafts/:id/cancel
// ============================================

export async function cancelDraftCrm(req: Request, res: Response) {
    try {
        const id = parseInt(req.params.id as string);
        const result = await cancelDraft(id, {
            type: 'CRM',
            userId: req.user!.userId,
        });

        if (result.error) {
            return res.status(400).json({ error: result.error });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error canceling draft:', error);
        res.status(500).json({ error: 'Failed to cancel draft' });
    }
}

// ============================================
// GET /api/telegram/customers/:customerId/binding
// ============================================

export async function getCustomerBinding(req: Request, res: Response) {
    try {
        const customerId = parseInt(req.params.customerId as string);
        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            select: {
                id: true,
                name: true,
                telegramChatId: true,
                telegramChatType: true,
                telegramIsEnabled: true,
                telegramBoundAt: true,
                telegramGroupName: true,
                telegramGroupUsername: true,
            },
        });

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        res.json({
            ...customer,
            telegramChatId: customer.telegramChatId?.toString() || null,
            isBound: !!customer.telegramChatId,
        });
    } catch (error) {
        console.error('Error fetching customer binding:', error);
        res.status(500).json({ error: 'Failed to fetch binding' });
    }
}

// ============================================
// DELETE /api/telegram/customers/:customerId/unbind
// ============================================

export async function unbindCustomer(req: Request, res: Response) {
    try {
        const customerId = parseInt(req.params.customerId as string);
        const customer = await prisma.customer.findUnique({ where: { id: customerId } });

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        if (!customer.telegramChatId) {
            return res.status(400).json({ error: 'Customer is not bound' });
        }

        const chatId = customer.telegramChatId;

        await prisma.$transaction(async (tx) => {
            await tx.customer.update({
                where: { id: customerId },
                data: {
                    telegramChatId: null,
                    telegramIsEnabled: false,
                },
            });

            await tx.orderDraft.updateMany({
                where: {
                    customerId,
                    status: { in: ['NEW', 'CLARIFY', 'WAIT_CONFIRM'] },
                },
                data: { status: 'CANCELED' },
            });

            await tx.telegramOutbox.updateMany({
                where: {
                    chatId,
                    status: { in: ['QUEUED', 'SENDING'] },
                },
                data: { status: 'CANCELED' },
            });
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error unbinding customer:', error);
        res.status(500).json({ error: 'Failed to unbind' });
    }
}
