import { Router } from 'express';
import { requirePermission, requireRole } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import * as c from '../controllers/productCategories.controller';

const router = Router();

// /active MUST be declared before any /:id routes to avoid collision
router.get(
    '/active',
    requirePermission(PERM.CATALOG_PRODUCTS),
    c.getActiveProductCategories,
);

router.get(
    '/',
    requirePermission(PERM.CATALOG_PRODUCTS),
    requireRole(['ADMIN']),
    c.getAllProductCategories,
);

router.post(
    '/',
    requirePermission(PERM.CATALOG_PRODUCTS),
    requireRole(['ADMIN']),
    c.createProductCategory,
);

router.put(
    '/:id',
    requirePermission(PERM.CATALOG_PRODUCTS),
    requireRole(['ADMIN']),
    c.updateProductCategory,
);

router.patch(
    '/:id/toggle',
    requirePermission(PERM.CATALOG_PRODUCTS),
    requireRole(['ADMIN']),
    c.toggleProductCategory,
);

router.delete(
    '/:id',
    requirePermission(PERM.CATALOG_PRODUCTS),
    requireRole(['ADMIN']),
    c.deleteProductCategory,
);

router.post(
    '/bulk',
    requirePermission(PERM.CATALOG_PRODUCTS),
    requireRole(['ADMIN']),
    c.bulkProductCategories,
);

export default router;
