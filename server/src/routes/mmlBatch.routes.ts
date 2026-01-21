import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
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

// All routes require authentication
router.use(authenticateToken);

// ========== MML Routes ==========
router.get('/mml', getAllMmls);
router.get('/mml/:id', getMmlById);
router.post('/mml', createMml);
router.put('/mml/:mmlId/item/:lineNo', updateMmlItem);
router.post('/mml/:id/lock', lockMml);
router.delete('/mml/:id', deleteMml);

// ========== Batch Routes ==========
router.get('/batch', getAllBatches);
router.get('/batch/:id', getBatchById);
router.post('/batch', createBatch);
router.put('/batch/:id', updateBatch);
router.put('/batch/:batchId/item/:lineNo', updateBatchItem);
router.post('/batch/:id/lock', lockBatch);
router.post('/batch/:id/clone', cloneBatch);
router.delete('/batch/:id', deleteBatch);

export default router;
