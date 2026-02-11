import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import * as variants from '../controllers/customerProductVariants.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

const perm = requirePermission(PERM.CATALOG_CUSTOMERS);

// GET variants for a customer product
router.get('/:customerProductId', perm, variants.getVariants);

// Create variant (with reactivation logic)
router.post('/:customerProductId', perm, variants.createVariant);

// Update variant (partial update / deactivation)
router.patch('/item/:id', perm, variants.updateVariant);

export default router;
