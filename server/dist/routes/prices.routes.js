"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const prices_controller_1 = require("../controllers/prices.controller");
const router = (0, express_1.Router)();
// All routes require authentication + RBAC context
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// ============================================
// ЗАКУПОЧНЫЙ ПРАЙС (cost-data — prices.purchase.read / manage)
// ============================================
router.get('/purchase', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_PURCHASE_READ), prices_controller_1.getPurchasePriceLists);
router.get('/purchase/product-prices', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_PURCHASE_READ), prices_controller_1.getPurchasePricesForProduct);
router.get('/purchase/supplier/:supplierId/current', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_PURCHASE_READ), prices_controller_1.getCurrentPurchasePrice);
router.get('/purchase/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_PURCHASE_READ), prices_controller_1.getPurchasePriceById);
router.post('/purchase', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_PURCHASE_MANAGE), prices_controller_1.createPurchasePrice);
router.put('/purchase/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_PURCHASE_MANAGE), prices_controller_1.savePurchasePrice);
// ============================================
// ПРОДАЖНЫЙ ПРАЙС (prices.sales.read / manage)
// ============================================
router.get('/sales', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_SALES_READ), prices_controller_1.getSalesPriceLists);
router.get('/sales/general/current', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_SALES_READ), prices_controller_1.getCurrentGeneralPrice);
router.get('/sales/customer/:customerId/current', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_SALES_READ), prices_controller_1.getCurrentCustomerPrice);
router.get('/sales/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_SALES_READ), prices_controller_1.getSalesPriceById);
router.post('/sales', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_SALES_MANAGE), prices_controller_1.createSalesPrice);
router.post('/sales/hide', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_SALES_MANAGE), prices_controller_1.hideSalesPriceLists);
router.put('/sales/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_SALES_MANAGE), prices_controller_1.saveSalesPrice);
// ============================================
// МЕХАНИЗМ ПОЛУЧЕНИЯ ЦЕНЫ (sales.read — needed for order creation)
// ============================================
router.get('/resolve/:customerId/:productId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_SALES_READ), prices_controller_1.resolveSalePrice);
router.get('/resolve/:customerId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_SALES_READ), prices_controller_1.resolveAllPricesForCustomer);
exports.default = router;
