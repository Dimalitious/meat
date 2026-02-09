import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import {
    getMaterialReport,
    refreshMaterialReport,
    updateMaterialReportLine,
    saveMaterialReport,
    deleteMaterialReport
} from '../controllers/materialReport.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

// Read
router.get('/', requirePermission(PERM.REPORTS_READ), getMaterialReport);

// Manage
router.post('/refresh', requirePermission(PERM.REPORTS_MANAGE), refreshMaterialReport);
router.patch('/line/:productId', requirePermission(PERM.REPORTS_MANAGE), updateMaterialReportLine);
router.post('/save', requirePermission(PERM.REPORTS_MANAGE), saveMaterialReport);
router.delete('/:id', requirePermission(PERM.REPORTS_MANAGE), deleteMaterialReport);

export default router;
