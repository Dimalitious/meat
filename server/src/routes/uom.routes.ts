import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import * as uom from '../controllers/uom.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

// Reuse CATALOG_PRODUCTS permission for now
router.get('/', requirePermission(PERM.CATALOG_PRODUCTS), uom.getUnits);
router.post('/fill-defaults', requirePermission(PERM.CATALOG_PRODUCTS), uom.fillDefaults);
router.post('/', requirePermission(PERM.CATALOG_PRODUCTS), uom.createUnit);
router.put('/:id', requirePermission(PERM.CATALOG_PRODUCTS), uom.updateUnit);
router.delete('/:id', requirePermission(PERM.CATALOG_PRODUCTS), uom.deleteUnit);

export default router;
