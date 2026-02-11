"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBindRequest = createBindRequest;
exports.getDrafts = getDrafts;
exports.getDraftCount = getDraftCount;
exports.getDraftById = getDraftById;
exports.updateDraft = updateDraft;
exports.confirmDraftCrm = confirmDraftCrm;
exports.cancelDraftCrm = cancelDraftCrm;
exports.getCustomerBinding = getCustomerBinding;
exports.unbindCustomer = unbindCustomer;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../db");
const draftService_1 = require("../services/draftService");
// ============================================
// Генерация bind-кода (без O/0/I/1)
// ============================================
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode(length = 6) {
    const bytes = crypto_1.default.randomBytes(length);
    return Array.from(bytes)
        .map(b => ALPHABET[b % ALPHABET.length])
        .join('');
}
// ============================================
// POST /api/telegram/customers/:customerId/bind-request
// ============================================
async function createBindRequest(req, res) {
    try {
        const customerId = parseInt(req.params.customerId);
        if (isNaN(customerId)) {
            return res.status(400).json({ error: 'Invalid customerId' });
        }
        const customer = await db_1.prisma.customer.findUnique({ where: { id: customerId } });
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
        const bindRequest = await db_1.prisma.telegramBindRequest.create({
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
    }
    catch (error) {
        console.error('Error creating bind request:', error);
        res.status(500).json({ error: 'Failed to create bind request' });
    }
}
// ============================================
// GET /api/telegram/drafts
// ============================================
async function getDrafts(req, res) {
    try {
        const { status, customerId, from, to, limit = '50' } = req.query;
        const where = {};
        if (status)
            where.status = status;
        if (customerId)
            where.customerId = parseInt(customerId);
        if (from || to) {
            where.createdAt = {};
            if (from)
                where.createdAt.gte = new Date(from);
            if (to)
                where.createdAt.lte = new Date(to);
        }
        const drafts = await db_1.prisma.orderDraft.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
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
    }
    catch (error) {
        console.error('Error fetching drafts:', error);
        res.status(500).json({ error: 'Failed to fetch drafts' });
    }
}
// ============================================
// GET /api/telegram/drafts/count
// ============================================
async function getDraftCount(req, res) {
    try {
        const count = await db_1.prisma.orderDraft.count({
            where: { status: { in: ['NEW', 'CLARIFY', 'WAIT_CONFIRM'] } },
        });
        res.json({ count });
    }
    catch (error) {
        console.error('Error counting drafts:', error);
        res.status(500).json({ error: 'Failed to count drafts' });
    }
}
// ============================================
// GET /api/telegram/drafts/:id
// ============================================
async function getDraftById(req, res) {
    try {
        const id = parseInt(req.params.id);
        const draft = await db_1.prisma.orderDraft.findUnique({
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
    }
    catch (error) {
        console.error('Error fetching draft:', error);
        res.status(500).json({ error: 'Failed to fetch draft' });
    }
}
// ============================================
// PUT /api/telegram/drafts/:id
// ============================================
async function updateDraft(req, res) {
    try {
        const id = parseInt(req.params.id);
        const { items, note } = req.body;
        const draft = await db_1.prisma.orderDraft.findUnique({
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
        await db_1.prisma.orderDraft.update({
            where: { id },
            data: {
                ...(note !== undefined && { note }),
            },
        });
        // Update items if provided
        if (items && Array.isArray(items)) {
            for (const item of items) {
                if (item.id) {
                    await db_1.prisma.orderDraftItem.update({
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
            const updatedItems = await db_1.prisma.orderDraftItem.findMany({ where: { draftId: id } });
            const hasUnresolved = updatedItems.some(i => !i.productId || !i.quantity);
            const newStatus = hasUnresolved ? 'CLARIFY' : 'WAIT_CONFIRM';
            await db_1.prisma.orderDraft.update({
                where: { id },
                data: { status: newStatus },
            });
        }
        const updated = await db_1.prisma.orderDraft.findUnique({
            where: { id },
            include: { items: true, customer: { select: { id: true, name: true } } },
        });
        res.json(updated);
    }
    catch (error) {
        console.error('Error updating draft:', error);
        res.status(500).json({ error: 'Failed to update draft' });
    }
}
// ============================================
// POST /api/telegram/drafts/:id/confirm
// ============================================
async function confirmDraftCrm(req, res) {
    try {
        const id = parseInt(req.params.id);
        const result = await (0, draftService_1.confirmDraft)(id, {
            type: 'CRM',
            userId: req.user.userId,
        });
        if (result.error) {
            return res.status(400).json({ error: result.error });
        }
        res.json({
            success: true,
            orderId: result.orderId,
            totalAmount: result.totalAmount,
        });
    }
    catch (error) {
        console.error('Error confirming draft:', error);
        res.status(500).json({ error: 'Failed to confirm draft' });
    }
}
// ============================================
// POST /api/telegram/drafts/:id/cancel
// ============================================
async function cancelDraftCrm(req, res) {
    try {
        const id = parseInt(req.params.id);
        const result = await (0, draftService_1.cancelDraft)(id, {
            type: 'CRM',
            userId: req.user.userId,
        });
        if (result.error) {
            return res.status(400).json({ error: result.error });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error canceling draft:', error);
        res.status(500).json({ error: 'Failed to cancel draft' });
    }
}
// ============================================
// GET /api/telegram/customers/:customerId/binding
// ============================================
async function getCustomerBinding(req, res) {
    try {
        const customerId = parseInt(req.params.customerId);
        const customer = await db_1.prisma.customer.findUnique({
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
    }
    catch (error) {
        console.error('Error fetching customer binding:', error);
        res.status(500).json({ error: 'Failed to fetch binding' });
    }
}
// ============================================
// DELETE /api/telegram/customers/:customerId/unbind
// ============================================
async function unbindCustomer(req, res) {
    try {
        const customerId = parseInt(req.params.customerId);
        const customer = await db_1.prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        if (!customer.telegramChatId) {
            return res.status(400).json({ error: 'Customer is not bound' });
        }
        const chatId = customer.telegramChatId;
        await db_1.prisma.$transaction(async (tx) => {
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
    }
    catch (error) {
        console.error('Error unbinding customer:', error);
        res.status(500).json({ error: 'Failed to unbind' });
    }
}
