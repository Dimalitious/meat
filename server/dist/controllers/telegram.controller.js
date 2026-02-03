"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// ============================================
// TELEGRAM GROUPS
// ============================================
/**
 * GET /api/telegram/groups
 * Get all telegram groups (with optional filter)
 */
router.get('/groups', async (req, res) => {
    try {
        const { isActive } = req.query;
        const where = {};
        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }
        const groups = await prisma.telegramGroup.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { orderDrafts: true }
                }
            }
        });
        res.json(groups);
    }
    catch (error) {
        console.error('Error fetching telegram groups:', error);
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
});
/**
 * POST /api/telegram/groups
 * Create a new telegram group
 */
router.post('/groups', async (req, res) => {
    try {
        const { chatId, title, username, isActive, parsePatterns } = req.body;
        if (!chatId || !title) {
            return res.status(400).json({ error: 'chatId and title are required' });
        }
        const group = await prisma.telegramGroup.create({
            data: {
                chatId: String(chatId),
                title,
                username: username || null,
                isActive: isActive !== false,
                parsePatterns: parsePatterns || null,
            }
        });
        res.status(201).json(group);
    }
    catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Group with this chatId already exists' });
        }
        console.error('Error creating telegram group:', error);
        res.status(500).json({ error: 'Failed to create group' });
    }
});
/**
 * PUT /api/telegram/groups/:id
 * Update a telegram group
 */
router.put('/groups/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { title, username, isActive, parsePatterns } = req.body;
        const group = await prisma.telegramGroup.update({
            where: { id },
            data: {
                ...(title !== undefined && { title }),
                ...(username !== undefined && { username }),
                ...(isActive !== undefined && { isActive }),
                ...(parsePatterns !== undefined && { parsePatterns }),
            }
        });
        res.json(group);
    }
    catch (error) {
        console.error('Error updating telegram group:', error);
        res.status(500).json({ error: 'Failed to update group' });
    }
});
/**
 * PATCH /api/telegram/groups/:id
 * Partial update (for agent to update lastMessageId)
 */
router.patch('/groups/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { lastMessageId, isActive } = req.body;
        const group = await prisma.telegramGroup.update({
            where: { id },
            data: {
                ...(lastMessageId !== undefined && { lastMessageId }),
                ...(isActive !== undefined && { isActive }),
            }
        });
        res.json(group);
    }
    catch (error) {
        console.error('Error patching telegram group:', error);
        res.status(500).json({ error: 'Failed to patch group' });
    }
});
/**
 * DELETE /api/telegram/groups/:id
 * Delete a telegram group
 */
router.delete('/groups/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await prisma.telegramGroup.delete({
            where: { id }
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting telegram group:', error);
        res.status(500).json({ error: 'Failed to delete group' });
    }
});
// ============================================
// TELEGRAM ORDER DRAFTS
// ============================================
/**
 * GET /api/telegram/drafts
 * Get all order drafts with filters
 */
router.get('/drafts', async (req, res) => {
    try {
        const { status, groupId, dateFrom, dateTo, limit = '50' } = req.query;
        const where = {};
        if (status) {
            where.status = status;
        }
        if (groupId) {
            where.groupId = parseInt(groupId);
        }
        if (dateFrom || dateTo) {
            where.messageDate = {};
            if (dateFrom)
                where.messageDate.gte = new Date(dateFrom);
            if (dateTo)
                where.messageDate.lte = new Date(dateTo);
        }
        const drafts = await prisma.telegramOrderDraft.findMany({
            where,
            orderBy: { messageDate: 'desc' },
            take: parseInt(limit),
            include: {
                group: {
                    select: { id: true, title: true, username: true }
                },
                items: true
            }
        });
        res.json(drafts);
    }
    catch (error) {
        console.error('Error fetching telegram drafts:', error);
        res.status(500).json({ error: 'Failed to fetch drafts' });
    }
});
/**
 * GET /api/telegram/drafts/count
 * Get count of pending drafts (for badge)
 */
router.get('/drafts/count', async (req, res) => {
    try {
        const count = await prisma.telegramOrderDraft.count({
            where: { status: 'pending' }
        });
        res.json({ count });
    }
    catch (error) {
        console.error('Error counting telegram drafts:', error);
        res.status(500).json({ error: 'Failed to count drafts' });
    }
});
/**
 * GET /api/telegram/drafts/:id
 * Get a single draft with details
 */
router.get('/drafts/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const draft = await prisma.telegramOrderDraft.findUnique({
            where: { id },
            include: {
                group: true,
                items: true
            }
        });
        if (!draft) {
            return res.status(404).json({ error: 'Draft not found' });
        }
        res.json(draft);
    }
    catch (error) {
        console.error('Error fetching telegram draft:', error);
        res.status(500).json({ error: 'Failed to fetch draft' });
    }
});
/**
 * POST /api/telegram/drafts
 * Create a new order draft (called by agent)
 */
router.post('/drafts', async (req, res) => {
    try {
        const { groupId, messageId, messageText, messageDate, senderName, senderId, parsedOrderNumber, parsedCustomer, parsedAddress, items } = req.body;
        if (!groupId || !messageId || !messageText) {
            return res.status(400).json({ error: 'groupId, messageId, and messageText are required' });
        }
        // Check for duplicate
        const existing = await prisma.telegramOrderDraft.findUnique({
            where: {
                groupId_messageId: {
                    groupId,
                    messageId: String(messageId)
                }
            }
        });
        if (existing) {
            return res.status(409).json({ error: 'Draft already exists', draft: existing });
        }
        // Create draft with items
        const draft = await prisma.telegramOrderDraft.create({
            data: {
                groupId,
                messageId: String(messageId),
                messageText,
                messageDate: new Date(messageDate),
                senderName: senderName || null,
                senderId: senderId || null,
                parsedOrderNumber: parsedOrderNumber || null,
                parsedCustomer: parsedCustomer || null,
                parsedAddress: parsedAddress || null,
                items: {
                    create: (items || []).map((item) => ({
                        rawProductName: item.rawProductName,
                        rawQuantity: item.rawQuantity,
                        rawPrice: item.rawPrice || null,
                    }))
                }
            },
            include: {
                group: true,
                items: true
            }
        });
        // Emit socket event for real-time notification
        const io = req.io;
        if (io) {
            io.emit('telegram:new-draft', {
                id: draft.id,
                groupTitle: draft.group.title,
                itemCount: draft.items.length,
                messageDate: draft.messageDate
            });
        }
        res.status(201).json(draft);
    }
    catch (error) {
        console.error('Error creating telegram draft:', error);
        res.status(500).json({ error: 'Failed to create draft' });
    }
});
/**
 * PUT /api/telegram/drafts/:id
 * Update draft items (for manual corrections)
 */
router.put('/drafts/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { items, parsedCustomer, parsedAddress } = req.body;
        // Update draft
        const draft = await prisma.telegramOrderDraft.update({
            where: { id },
            data: {
                ...(parsedCustomer !== undefined && { parsedCustomer }),
                ...(parsedAddress !== undefined && { parsedAddress }),
            }
        });
        // Update items if provided
        if (items && Array.isArray(items)) {
            for (const item of items) {
                if (item.id) {
                    await prisma.telegramOrderDraftItem.update({
                        where: { id: item.id },
                        data: {
                            productId: item.productId || null,
                            quantity: item.quantity || null,
                            price: item.price || null,
                        }
                    });
                }
            }
        }
        // Fetch updated draft
        const updatedDraft = await prisma.telegramOrderDraft.findUnique({
            where: { id },
            include: { items: true, group: true }
        });
        res.json(updatedDraft);
    }
    catch (error) {
        console.error('Error updating telegram draft:', error);
        res.status(500).json({ error: 'Failed to update draft' });
    }
});
/**
 * POST /api/telegram/drafts/:id/approve
 * Approve draft and create Order
 */
router.post('/drafts/:id/approve', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { customerId, items, approvedBy } = req.body;
        if (!customerId || !items || items.length === 0) {
            return res.status(400).json({ error: 'customerId and items are required' });
        }
        // Get draft
        const draft = await prisma.telegramOrderDraft.findUnique({
            where: { id },
            include: { items: true }
        });
        if (!draft) {
            return res.status(404).json({ error: 'Draft not found' });
        }
        if (draft.status !== 'pending') {
            return res.status(400).json({ error: 'Draft is not in pending status' });
        }
        // Create order
        const order = await prisma.order.create({
            data: {
                customerId,
                date: draft.messageDate,
                status: 'new',
                deliveryAddress: draft.parsedAddress,
                items: {
                    create: items.map((item) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        price: item.price,
                        amount: item.quantity * item.price,
                    }))
                }
            },
            include: { items: true }
        });
        // Calculate totals
        const totalAmount = order.items.reduce((sum, i) => sum + Number(i.amount), 0);
        const totalWeight = order.items.reduce((sum, i) => sum + i.quantity, 0);
        await prisma.order.update({
            where: { id: order.id },
            data: { totalAmount, totalWeight }
        });
        // Update draft status
        await prisma.telegramOrderDraft.update({
            where: { id },
            data: {
                status: 'transferred',
                transferredOrderId: order.id,
                approvedBy: approvedBy || 'system',
                approvedAt: new Date(),
            }
        });
        res.json({
            success: true,
            orderId: order.id,
            message: `Order #${order.id} created successfully`
        });
    }
    catch (error) {
        console.error('Error approving telegram draft:', error);
        res.status(500).json({ error: 'Failed to approve draft' });
    }
});
/**
 * POST /api/telegram/drafts/:id/reject
 * Reject a draft
 */
router.post('/drafts/:id/reject', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { reason, rejectedBy } = req.body;
        const draft = await prisma.telegramOrderDraft.update({
            where: { id },
            data: {
                status: 'rejected',
                rejectedReason: reason || 'No reason provided',
                approvedBy: rejectedBy || 'system',
                approvedAt: new Date(),
            }
        });
        res.json({ success: true, draft });
    }
    catch (error) {
        console.error('Error rejecting telegram draft:', error);
        res.status(500).json({ error: 'Failed to reject draft' });
    }
});
/**
 * GET /api/telegram/products/search
 * Search products with fuzzy matching (for UI autocomplete)
 */
router.get('/products/search', async (req, res) => {
    try {
        const { q, limit = '10' } = req.query;
        if (!q || typeof q !== 'string') {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }
        const products = await prisma.product.findMany({
            where: {
                status: 'active',
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { altName: { contains: q, mode: 'insensitive' } },
                    { code: { contains: q, mode: 'insensitive' } },
                ]
            },
            take: parseInt(limit),
            select: {
                id: true,
                code: true,
                name: true,
                altName: true,
            }
        });
        res.json(products);
    }
    catch (error) {
        console.error('Error searching products:', error);
        res.status(500).json({ error: 'Failed to search products' });
    }
});
exports.default = router;
