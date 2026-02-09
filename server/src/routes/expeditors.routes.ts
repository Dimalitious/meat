import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import { getExpeditors, createExpeditor, updateExpeditor, deleteExpeditor } from '../controllers/expeditors.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

router.get('/', requirePermission(PERM.EXPEDITION_READ), getExpeditors);
router.post('/', requirePermission(PERM.EXPEDITION_MANAGE), createExpeditor);
router.put('/:id', requirePermission(PERM.EXPEDITION_MANAGE), updateExpeditor);
router.delete('/:id', requirePermission(PERM.EXPEDITION_MANAGE), deleteExpeditor);

export default router;
