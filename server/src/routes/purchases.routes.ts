import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import {
    getPurchases,
    getPurchaseById,
    createPurchase,
    updatePurchase,
    disablePurchases,
    deletePurchase,
    getSupplierMml,
    getLastPrice
} from '../controllers/purchases.controller';

const router = Router();

// All routes require authentication + RBAC context
router.use(authenticateToken);
router.use(loadUserContext);

// ============================================
// Вспомогательные эндпоинты (ВАЖНО: до /:id!)
// ============================================

router.get('/supplier/:supplierId/mml', requirePermission(PERM.PURCHASES_READ), getSupplierMml);
router.get('/supplier/:supplierId/product/:productId/price', requirePermission(PERM.PURCHASES_READ), getLastPrice);
router.post('/disable', requirePermission(PERM.PURCHASES_MANAGE), disablePurchases);

// ============================================
// Журнал закупок
// ============================================

router.get('/', requirePermission(PERM.PURCHASES_READ), getPurchases);
router.post('/', requirePermission(PERM.PURCHASES_CREATE), createPurchase);
router.get('/:id', requirePermission(PERM.PURCHASES_READ), getPurchaseById);
router.put('/:id', requirePermission(PERM.PURCHASES_MANAGE), updatePurchase);
router.delete('/:id', requirePermission(PERM.PURCHASES_MANAGE), deletePurchase);

export default router;
