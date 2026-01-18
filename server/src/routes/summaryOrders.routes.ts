import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import * as summaryOrders from '../controllers/summaryOrders.controller';

const router = Router();
router.use(authenticateToken);

router.get('/', summaryOrders.getSummaryOrders);
router.post('/', summaryOrders.createSummaryOrder);
router.put('/:id', summaryOrders.updateSummaryOrder);
router.delete('/:id', summaryOrders.deleteSummaryOrder);
router.post('/sync', summaryOrders.syncToOrders);

export default router;
