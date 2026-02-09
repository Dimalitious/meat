import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import {
    getAllMmls,
    getMmlById,
    createMml,
    updateMmlItem,
    lockMml,
    deleteMml,
    getAllBatches,
    getBatchById,
    createBatch,
    updateBatch,
    updateBatchItem,
    lockBatch,
    cloneBatch,
    deleteBatch
} from '../controllers/mmlBatch.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

// ========== MML Routes ==========
router.get('/mml', requirePermission(PERM.MML_READ), getAllMmls);
router.get('/mml/:id', requirePermission(PERM.MML_READ), getMmlById);
router.post('/mml', requirePermission(PERM.MML_MANAGE), createMml);
router.put('/mml/:mmlId/item/:lineNo', requirePermission(PERM.MML_MANAGE), updateMmlItem);
router.post('/mml/:id/lock', requirePermission(PERM.MML_LOCK), lockMml);
router.delete('/mml/:id', requirePermission(PERM.MML_MANAGE), deleteMml);

// ========== Batch Routes ==========
router.get('/batch', requirePermission(PERM.PRODUCTION_READ), getAllBatches);
router.get('/batch/:id', requirePermission(PERM.PRODUCTION_READ), getBatchById);
router.post('/batch', requirePermission(PERM.PRODUCTION_CREATE), createBatch);
router.put('/batch/:id', requirePermission(PERM.PRODUCTION_EDIT), updateBatch);
router.put('/batch/:batchId/item/:lineNo', requirePermission(PERM.PRODUCTION_EDIT), updateBatchItem);
router.post('/batch/:id/lock', requirePermission(PERM.PRODUCTION_EDIT), lockBatch);
router.post('/batch/:id/clone', requirePermission(PERM.PRODUCTION_CREATE), cloneBatch);
router.delete('/batch/:id', requirePermission(PERM.PRODUCTION_DELETE), deleteBatch);

export default router;
