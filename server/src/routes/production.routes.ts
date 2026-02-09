import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import {
    // Справочник персонала
    getProductionStaff,
    getStaffByUserId,
    createProductionStaff,
    updateProductionStaff,
    // Журнал
    getOrCreateJournal,
    getJournalList,
    saveJournal,
    // Карточки
    addProductionItem,
    updateProductionItem,
    deleteProductionItem,
    deleteMultipleItems,
    cloneProductionItem,
    lockProductionItem,
    unlockProductionItem,
    updateItemValue
} from '../controllers/production.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

// ============================================
// СПРАВОЧНИК ПЕРСОНАЛА
// ============================================
router.get('/staff', requirePermission(PERM.PRODUCTION_READ), getProductionStaff);
router.get('/staff/user/:userId', requirePermission(PERM.PRODUCTION_READ), getStaffByUserId);
router.post('/staff', requirePermission(PERM.PRODUCTION_EDIT), createProductionStaff);
router.put('/staff/:id', requirePermission(PERM.PRODUCTION_EDIT), updateProductionStaff);

// ============================================
// ЖУРНАЛ ПРОИЗВОДСТВА
// ============================================
router.get('/journals', requirePermission(PERM.PRODUCTION_READ), getJournalList);
router.get('/journal/:date', requirePermission(PERM.PRODUCTION_READ), getOrCreateJournal);
router.put('/journal/:id', requirePermission(PERM.PRODUCTION_EDIT), saveJournal);

// ============================================
// КАРТОЧКИ ПРОИЗВОДСТВА
// ============================================
router.post('/journal/:journalId/items', requirePermission(PERM.PRODUCTION_CREATE), addProductionItem);
router.put('/items/:id', requirePermission(PERM.PRODUCTION_EDIT), updateProductionItem);
router.delete('/items/:id', requirePermission(PERM.PRODUCTION_DELETE), deleteProductionItem);
router.post('/items/delete-multiple', requirePermission(PERM.PRODUCTION_DELETE), deleteMultipleItems);
router.post('/items/:id/clone', requirePermission(PERM.PRODUCTION_CREATE), cloneProductionItem);
router.post('/items/:id/lock', requirePermission(PERM.PRODUCTION_EDIT), lockProductionItem);
router.post('/items/:id/unlock', requirePermission(PERM.PRODUCTION_EDIT), unlockProductionItem);
router.post('/items/:itemId/values', requirePermission(PERM.PRODUCTION_EDIT), updateItemValue);

export default router;
