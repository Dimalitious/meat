"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const purchasePriceLists_controller_1 = require("../controllers/purchasePriceLists.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// Read
router.get('/', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_PURCHASE_READ), purchasePriceLists_controller_1.getPurchasePriceLists);
router.get('/template', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_PURCHASE_READ), purchasePriceLists_controller_1.getLastPriceListTemplate);
router.get('/active-price', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_PURCHASE_READ), purchasePriceLists_controller_1.getActivePurchasePrice);
router.get('/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_PURCHASE_READ), purchasePriceLists_controller_1.getPurchasePriceList);
// Manage
router.post('/deactivate', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_PURCHASE_MANAGE), purchasePriceLists_controller_1.deactivatePurchasePriceLists);
router.post('/', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_PURCHASE_MANAGE), purchasePriceLists_controller_1.createPurchasePriceList);
router.put('/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRICES_PURCHASE_MANAGE), purchasePriceLists_controller_1.updatePurchasePriceList);
exports.default = router;
