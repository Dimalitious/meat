import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import * as productParams from '../controllers/productParams.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

const perm = requirePermission(PERM.CATALOG_PRODUCTS);

// Available params for a product (merged view)
router.get('/:code/available', perm, productParams.getAvailableParams);

// Exclusions (hard create / hard delete)
router.post('/:productId/exclusions', perm, productParams.createExclusion);
router.delete('/:productId/exclusions/:paramValueId', perm, productParams.deleteExclusion);

export default router;
