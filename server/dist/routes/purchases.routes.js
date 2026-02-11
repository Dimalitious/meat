"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const purchases_controller_1 = require("../controllers/purchases.controller");
const router = (0, express_1.Router)();
// All routes require authentication + RBAC context
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// ============================================
// Вспомогательные эндпоинты (ВАЖНО: до /:id!)
// ============================================
router.get('/supplier/:supplierId/mml', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PURCHASES_READ), purchases_controller_1.getSupplierMml);
router.get('/supplier/:supplierId/product/:productId/price', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PURCHASES_READ), purchases_controller_1.getLastPrice);
router.post('/disable', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PURCHASES_MANAGE), purchases_controller_1.disablePurchases);
// ============================================
// Журнал закупок
// ============================================
router.get('/', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PURCHASES_READ), purchases_controller_1.getPurchases);
router.post('/', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PURCHASES_CREATE), purchases_controller_1.createPurchase);
router.get('/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PURCHASES_READ), purchases_controller_1.getPurchaseById);
router.put('/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PURCHASES_MANAGE), purchases_controller_1.updatePurchase);
router.delete('/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PURCHASES_MANAGE), purchases_controller_1.deletePurchase);
exports.default = router;
