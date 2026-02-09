import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import { getSvodReport } from '../controllers/reports.controller';

const router = Router();

router.get('/svod', authenticateToken, loadUserContext, requirePermission(PERM.REPORTS_READ), getSvodReport);

export default router;
