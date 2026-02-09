import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import {
    getSvodByDate,
    saveSvod,
    refreshSvod,
    updateSvodLine,
    deleteSvod,
    getMmlForDistribution,
    getShipmentDistribution,
    saveShipmentDistribution
} from '../controllers/svod.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

// Read
router.get('/', requirePermission(PERM.REPORTS_READ), getSvodByDate);

// Manage
router.post('/', requirePermission(PERM.REPORTS_MANAGE), saveSvod);
router.put('/:id/refresh', requirePermission(PERM.REPORTS_MANAGE), refreshSvod);
router.patch('/lines/:lineId', requirePermission(PERM.REPORTS_MANAGE), updateSvodLine);
router.delete('/:id', requirePermission(PERM.REPORTS_MANAGE), deleteSvod);

// ============================================
// РАСПРЕДЕЛЕНИЕ ВЕСА ОТГРУЗКИ
// ============================================
router.get('/mml/:productId', requirePermission(PERM.REPORTS_READ), getMmlForDistribution);
router.get('/lines/:lineId/distribution', requirePermission(PERM.REPORTS_READ), getShipmentDistribution);
router.post('/lines/:lineId/distribution', requirePermission(PERM.REPORTS_MANAGE), saveShipmentDistribution);

export default router;
