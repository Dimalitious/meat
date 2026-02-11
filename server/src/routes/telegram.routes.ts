import { Router, Request, Response } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import { createWebhookHandler } from '../telegram/bot';
import {
    createBindRequest,
    getDrafts,
    getDraftCount,
    getDraftById,
    updateDraft,
    confirmDraftCrm,
    cancelDraftCrm,
    getCustomerBinding,
    unbindCustomer,
} from '../controllers/telegramCrm.controller';

const router = Router();

// ============================================
// Webhook (NO auth — Telegram calls this!)
// ============================================

const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

router.post('/webhook', (req: Request, res: Response) => {
    // Проверка secret token
    const headerSecret = req.headers['x-telegram-bot-api-secret-token'];
    if (!webhookSecret || headerSecret !== webhookSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const handler = createWebhookHandler();
    if (!handler) {
        return res.status(503).json({ error: 'Bot not configured' });
    }

    return handler(req, res);
});

// ============================================
// CRM routes (require auth + RBAC)
// ============================================

router.use(authenticateToken);
router.use(loadUserContext);

// Bind request
router.post(
    '/customers/:customerId/bind-request',
    requirePermission(PERM.TELEGRAM_BIND),
    createBindRequest
);

// Customer binding info
router.get(
    '/customers/:customerId/binding',
    requirePermission(PERM.TELEGRAM_DRAFTS_READ),
    getCustomerBinding
);

// Customer unbind (CRM)
router.delete(
    '/customers/:customerId/unbind',
    requirePermission(PERM.TELEGRAM_BIND),
    unbindCustomer
);

// Drafts
router.get('/drafts', requirePermission(PERM.TELEGRAM_DRAFTS_READ), getDrafts);
router.get('/drafts/count', requirePermission(PERM.TELEGRAM_DRAFTS_READ), getDraftCount);
router.get('/drafts/:id', requirePermission(PERM.TELEGRAM_DRAFTS_READ), getDraftById);
router.put('/drafts/:id', requirePermission(PERM.TELEGRAM_DRAFTS_MANAGE), updateDraft);
router.post('/drafts/:id/confirm', requirePermission(PERM.TELEGRAM_DRAFTS_MANAGE), confirmDraftCrm);
router.post('/drafts/:id/cancel', requirePermission(PERM.TELEGRAM_DRAFTS_MANAGE), cancelDraftCrm);

export default router;
