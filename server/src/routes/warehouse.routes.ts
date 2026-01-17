import { Router } from 'express';
import { getStock, createArrival, createAdjustment, getHistory } from '../controllers/warehouse.controller';

const router = Router();

router.get('/stock', getStock);
router.post('/arrival', createArrival);
router.post('/adjustment', createAdjustment);
router.get('/history', getHistory);

export default router;
