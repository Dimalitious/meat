import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import {
    getPurchasePriceLists,
    getPurchasePriceList,
    createPurchasePriceList,
    updatePurchasePriceList,
    deactivatePurchasePriceLists,
    getActivePurchasePrice,
    getLastPriceListTemplate
} from '../controllers/purchasePriceLists.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

// Read
router.get('/', requirePermission(PERM.PRICES_PURCHASE_READ), getPurchasePriceLists);
router.get('/template', requirePermission(PERM.PRICES_PURCHASE_READ), getLastPriceListTemplate);
router.get('/active-price', requirePermission(PERM.PRICES_PURCHASE_READ), getActivePurchasePrice);
router.get('/:id', requirePermission(PERM.PRICES_PURCHASE_READ), getPurchasePriceList);

// Manage
router.post('/deactivate', requirePermission(PERM.PRICES_PURCHASE_MANAGE), deactivatePurchasePriceLists);
router.post('/', requirePermission(PERM.PRICES_PURCHASE_MANAGE), createPurchasePriceList);
router.put('/:id', requirePermission(PERM.PRICES_PURCHASE_MANAGE), updatePurchasePriceList);

export default router;
