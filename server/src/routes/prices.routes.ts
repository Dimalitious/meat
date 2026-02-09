import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import {
    // Закупочный прайс
    getPurchasePriceLists,
    getCurrentPurchasePrice,
    getPurchasePriceById,
    createPurchasePrice,
    savePurchasePrice,
    getPurchasePricesForProduct,
    // Продажный прайс
    getSalesPriceLists,
    getCurrentGeneralPrice,
    getCurrentCustomerPrice,
    getSalesPriceById,
    createSalesPrice,
    saveSalesPrice,
    hideSalesPriceLists,
    // Механизм цен
    resolveSalePrice,
    resolveAllPricesForCustomer
} from '../controllers/prices.controller';

const router = Router();

// All routes require authentication + RBAC context
router.use(authenticateToken);
router.use(loadUserContext);

// ============================================
// ЗАКУПОЧНЫЙ ПРАЙС (cost-data — prices.purchase.read / manage)
// ============================================

router.get('/purchase', requirePermission(PERM.PRICES_PURCHASE_READ), getPurchasePriceLists);
router.get('/purchase/product-prices', requirePermission(PERM.PRICES_PURCHASE_READ), getPurchasePricesForProduct);
router.get('/purchase/supplier/:supplierId/current', requirePermission(PERM.PRICES_PURCHASE_READ), getCurrentPurchasePrice);
router.get('/purchase/:id', requirePermission(PERM.PRICES_PURCHASE_READ), getPurchasePriceById);
router.post('/purchase', requirePermission(PERM.PRICES_PURCHASE_MANAGE), createPurchasePrice);
router.put('/purchase/:id', requirePermission(PERM.PRICES_PURCHASE_MANAGE), savePurchasePrice);

// ============================================
// ПРОДАЖНЫЙ ПРАЙС (prices.sales.read / manage)
// ============================================

router.get('/sales', requirePermission(PERM.PRICES_SALES_READ), getSalesPriceLists);
router.get('/sales/general/current', requirePermission(PERM.PRICES_SALES_READ), getCurrentGeneralPrice);
router.get('/sales/customer/:customerId/current', requirePermission(PERM.PRICES_SALES_READ), getCurrentCustomerPrice);
router.get('/sales/:id', requirePermission(PERM.PRICES_SALES_READ), getSalesPriceById);
router.post('/sales', requirePermission(PERM.PRICES_SALES_MANAGE), createSalesPrice);
router.post('/sales/hide', requirePermission(PERM.PRICES_SALES_MANAGE), hideSalesPriceLists);
router.put('/sales/:id', requirePermission(PERM.PRICES_SALES_MANAGE), saveSalesPrice);

// ============================================
// МЕХАНИЗМ ПОЛУЧЕНИЯ ЦЕНЫ (sales.read — needed for order creation)
// ============================================

router.get('/resolve/:customerId/:productId', requirePermission(PERM.PRICES_SALES_READ), resolveSalePrice);
router.get('/resolve/:customerId', requirePermission(PERM.PRICES_SALES_READ), resolveAllPricesForCustomer);

export default router;
