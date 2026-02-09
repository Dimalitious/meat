import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import {
    getCustomerProducts,
    addCustomerProduct,
    addCustomerProductsBulk,
    removeCustomerProduct,
    reorderCustomerProducts,
    getCustomersWithProductCounts
} from '../controllers/customerProducts.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

// Read
router.get('/customers-with-counts', requirePermission(PERM.CATALOG_CUSTOMERS), getCustomersWithProductCounts);
router.get('/:customerId', requirePermission(PERM.CATALOG_CUSTOMERS), getCustomerProducts);

// Manage
router.post('/:customerId', requirePermission(PERM.CATALOG_CUSTOMERS), addCustomerProduct);
router.post('/:customerId/bulk', requirePermission(PERM.CATALOG_CUSTOMERS), addCustomerProductsBulk);
router.delete('/:customerId/:productId', requirePermission(PERM.CATALOG_CUSTOMERS), removeCustomerProduct);
router.put('/:customerId/reorder', requirePermission(PERM.CATALOG_CUSTOMERS), reorderCustomerProducts);

export default router;
