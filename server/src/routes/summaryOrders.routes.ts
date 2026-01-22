import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import * as summaryOrders from '../controllers/summaryOrders.controller';

const router = Router();
router.use(authenticateToken);

router.get('/', summaryOrders.getSummaryOrders);
router.get('/filter-options', summaryOrders.getFilterOptions);
router.post('/', summaryOrders.createSummaryOrder);
router.post('/bulk', summaryOrders.bulkCreateSummaryOrders);  // Fast Excel import
router.put('/:id', summaryOrders.updateSummaryOrder);
router.delete('/:id', summaryOrders.deleteSummaryOrder);
router.post('/sync', summaryOrders.syncToOrders);
router.post('/rework', summaryOrders.sendToRework);

// Assembly management routes (Управление сборкой)
router.post('/:id/assembly/start', summaryOrders.startAssembly);
router.post('/:id/assembly/return', summaryOrders.returnFromAssembly);
router.post('/assembly/return-batch', summaryOrders.returnFromAssemblyBatch);
router.get('/:id/events', summaryOrders.getOrderEvents);

export default router;
