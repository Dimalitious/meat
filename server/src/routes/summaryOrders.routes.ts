import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import * as summaryOrders from '../controllers/summaryOrders.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

// Read
router.get('/', requirePermission(PERM.SUMMARY_READ), summaryOrders.getSummaryOrders);
router.get('/filter-options', requirePermission(PERM.SUMMARY_READ), summaryOrders.getFilterOptions);

// Create / Edit
router.post('/', requirePermission(PERM.SUMMARY_CREATE), summaryOrders.createSummaryOrder);
router.post('/bulk', requirePermission(PERM.SUMMARY_CREATE), summaryOrders.bulkCreateSummaryOrders);
router.put('/:id', requirePermission(PERM.SUMMARY_CREATE), summaryOrders.updateSummaryOrder);
router.delete('/:id', requirePermission(PERM.SUMMARY_CREATE), summaryOrders.deleteSummaryOrder);
router.post('/bulk-delete', requirePermission(PERM.SUMMARY_CREATE), summaryOrders.bulkDeleteSummaryOrders);

// Sync
router.post('/sync', requirePermission(PERM.SUMMARY_SYNC), summaryOrders.syncToOrders);
router.post('/rework', requirePermission(PERM.SUMMARY_SYNC), summaryOrders.sendToRework);

// Assembly management routes (Управление сборкой)
router.post('/:id/assembly/start', requirePermission(PERM.ASSEMBLY_MANAGE), summaryOrders.startAssembly);
router.post('/:id/assembly/return', requirePermission(PERM.ASSEMBLY_MANAGE), summaryOrders.returnFromAssembly);
router.post('/assembly/return-batch', requirePermission(PERM.ASSEMBLY_MANAGE), summaryOrders.returnFromAssemblyBatch);
router.get('/:id/events', requirePermission(PERM.SUMMARY_READ), summaryOrders.getOrderEvents);

export default router;
