import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import * as subcategories from '../controllers/subcategories.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

router.get('/', requirePermission(PERM.CATALOG_PRODUCTS), subcategories.getSubcategories);
router.post('/', requirePermission(PERM.CATALOG_PRODUCTS), subcategories.createSubcategory);
router.patch('/:id', requirePermission(PERM.CATALOG_PRODUCTS), subcategories.updateSubcategory);

export default router;
