import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import { getProducts, getProduct, createProduct, updateProduct, deactivateProduct, upsertProduct, batchUpsertProducts } from '../controllers/products.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

router.get('/', requirePermission(PERM.CATALOG_PRODUCTS), getProducts);
router.post('/', requirePermission(PERM.CATALOG_PRODUCTS), createProduct);
router.post('/upsert', requirePermission(PERM.CATALOG_PRODUCTS), upsertProduct);
router.post('/batch-upsert', requirePermission(PERM.CATALOG_PRODUCTS), batchUpsertProducts);
router.patch('/toggle/:code', requirePermission(PERM.CATALOG_PRODUCTS), deactivateProduct);
router.get('/:code', requirePermission(PERM.CATALOG_PRODUCTS), getProduct);
router.put('/:code', requirePermission(PERM.CATALOG_PRODUCTS), updateProduct);
router.delete('/:code', requirePermission(PERM.CATALOG_PRODUCTS), deactivateProduct);

export default router;
