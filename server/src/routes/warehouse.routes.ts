import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import { getStock, createArrival, createAdjustment, getHistory } from '../controllers/warehouse.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

router.get('/stock', requirePermission(PERM.WAREHOUSES_READ), getStock);
router.post('/arrival', requirePermission(PERM.WAREHOUSES_MANAGE), createArrival);
router.post('/adjustment', requirePermission(PERM.WAREHOUSES_MANAGE), createAdjustment);
router.get('/history', requirePermission(PERM.WAREHOUSES_READ), getHistory);

export default router;
