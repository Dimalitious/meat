import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import * as paramValues from '../controllers/paramValues.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

const perm = requirePermission(PERM.CATALOG_PRODUCTS);

// By subcategory
router.get('/subcategory/:subcategoryId', perm, paramValues.getParamValuesBySubcategory);
router.post('/subcategory/:subcategoryId', perm, paramValues.createParamValueForSubcategory);

// By product (overrides)
router.get('/product/:productId', perm, paramValues.getParamValuesByProduct);
router.post('/product/:productId', perm, paramValues.createParamValueForProduct);

// Update (label, sortOrder, isActive)
router.patch('/:id', perm, paramValues.updateParamValue);

export default router;
