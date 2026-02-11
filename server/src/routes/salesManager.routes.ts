import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import {
    getCustomers,
    assignManagers,
    unassignManager,
    getDrafts,
    acceptDraft,
    rejectDraft,
    updateRejectedDraft,
    returnDraftToReview,
    getStatement,
    sendStatement,
    listRefunds,
    createRefund,
    updateRefund,
    softDeleteRefund,
} from '../controllers/salesManager.controller';

const router = Router();

// All routes require authentication + RBAC context
router.use(authenticateToken);
router.use(loadUserContext);

// ============================================
// Customers
// ============================================
router.get('/customers', requirePermission(PERM.SALES_MANAGER_CUSTOMERS_READ), getCustomers);
router.post('/customers/:customerId/assign', requirePermission(PERM.SALES_MANAGER_CUSTOMERS_ASSIGN), assignManagers);
router.post('/customers/:customerId/unassign', requirePermission(PERM.SALES_MANAGER_CUSTOMERS_ASSIGN), unassignManager);

// ============================================
// Drafts (OrderDraft workflow)
// ============================================
router.get('/drafts', requirePermission(PERM.SALES_MANAGER_DRAFTS_READ), getDrafts);
router.post('/drafts/:draftId/accept', requirePermission(PERM.SALES_MANAGER_DRAFTS_ACCEPT), acceptDraft);
router.post('/drafts/:draftId/reject', requirePermission(PERM.SALES_MANAGER_DRAFTS_REJECT), rejectDraft);
router.put('/drafts/:draftId', requirePermission(PERM.SALES_MANAGER_DRAFTS_EDIT), updateRejectedDraft);
router.post('/drafts/:draftId/return-to-review', requirePermission(PERM.SALES_MANAGER_DRAFTS_EDIT), returnDraftToReview);

// ============================================
// Statement (Аксверк)
// ============================================
router.get('/customers/:customerId/statement', requirePermission(PERM.SALES_MANAGER_STATEMENT_READ), getStatement);
router.post('/customers/:customerId/statement/send', requirePermission(PERM.SALES_MANAGER_STATEMENT_SEND), sendStatement);

// ============================================
// Refunds (Возврат денег клиенту)
// ============================================
router.get('/customers/:customerId/refunds', requirePermission(PERM.SALES_MANAGER_REFUNDS_READ), listRefunds);
router.post('/customers/:customerId/refunds', requirePermission(PERM.SALES_MANAGER_REFUNDS_MANAGE), createRefund);
router.put('/refunds/:id', requirePermission(PERM.SALES_MANAGER_REFUNDS_MANAGE), updateRefund);
router.delete('/refunds/:id', requirePermission(PERM.SALES_MANAGER_REFUNDS_MANAGE), softDeleteRefund);

export default router;
