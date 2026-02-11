"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const bot_1 = require("../telegram/bot");
const telegramCrm_controller_1 = require("../controllers/telegramCrm.controller");
const router = (0, express_1.Router)();
// ============================================
// Webhook (NO auth — Telegram calls this!)
// ============================================
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
router.post('/webhook', (req, res) => {
    // Проверка secret token
    const headerSecret = req.headers['x-telegram-bot-api-secret-token'];
    if (!webhookSecret || headerSecret !== webhookSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const handler = (0, bot_1.createWebhookHandler)();
    if (!handler) {
        return res.status(503).json({ error: 'Bot not configured' });
    }
    return handler(req, res);
});
// ============================================
// CRM routes (require auth + RBAC)
// ============================================
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// Bind request
router.post('/customers/:customerId/bind-request', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.TELEGRAM_BIND), telegramCrm_controller_1.createBindRequest);
// Customer binding info
router.get('/customers/:customerId/binding', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.TELEGRAM_DRAFTS_READ), telegramCrm_controller_1.getCustomerBinding);
// Customer unbind (CRM)
router.delete('/customers/:customerId/unbind', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.TELEGRAM_BIND), telegramCrm_controller_1.unbindCustomer);
// Drafts
router.get('/drafts', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.TELEGRAM_DRAFTS_READ), telegramCrm_controller_1.getDrafts);
router.get('/drafts/count', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.TELEGRAM_DRAFTS_READ), telegramCrm_controller_1.getDraftCount);
router.get('/drafts/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.TELEGRAM_DRAFTS_READ), telegramCrm_controller_1.getDraftById);
router.put('/drafts/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.TELEGRAM_DRAFTS_MANAGE), telegramCrm_controller_1.updateDraft);
router.post('/drafts/:id/confirm', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.TELEGRAM_DRAFTS_MANAGE), telegramCrm_controller_1.confirmDraftCrm);
router.post('/drafts/:id/cancel', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.TELEGRAM_DRAFTS_MANAGE), telegramCrm_controller_1.cancelDraftCrm);
exports.default = router;
