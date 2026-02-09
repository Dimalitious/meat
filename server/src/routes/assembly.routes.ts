import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import * as assemblyController from '../controllers/assembly.controller';

const router = Router();

router.get('/', authenticateToken, loadUserContext, requirePermission(PERM.ASSEMBLY_READ), assemblyController.getOrdersForAssembly);
router.get('/:id', authenticateToken, loadUserContext, requirePermission(PERM.ASSEMBLY_READ), assemblyController.getAssemblyOrder);
router.put('/:id', authenticateToken, loadUserContext, requirePermission(PERM.ASSEMBLY_MANAGE), assemblyController.completeAssembly);

export default router;
