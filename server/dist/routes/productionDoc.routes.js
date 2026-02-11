"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const productionDoc_controller_1 = require("../controllers/productionDoc.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// Read
router.get('/', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_READ), productionDoc_controller_1.getProductionDocs);
router.get('/available-purchases', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_READ), productionDoc_controller_1.getAvailablePurchases);
router.get('/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_READ), productionDoc_controller_1.getProductionDoc);
// Create / Edit
router.post('/', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_CREATE), productionDoc_controller_1.createProductionDoc);
router.post('/:id/load-from-purchase', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_EDIT), productionDoc_controller_1.loadFromPurchase);
router.post('/:id/clear-inputs', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_EDIT), productionDoc_controller_1.clearInputs);
router.post('/:id/apply-cutting', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_EDIT), productionDoc_controller_1.applyCutting);
// Finalize / Cancel
router.post('/:id/finalize', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_POST), productionDoc_controller_1.finalizeDoc);
router.post('/:id/cancel', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_VOID), productionDoc_controller_1.cancelDoc);
// Delete
router.delete('/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_DELETE), productionDoc_controller_1.deleteProductionDoc);
exports.default = router;
