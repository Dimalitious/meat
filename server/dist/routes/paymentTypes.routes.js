"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const paymentTypes_controller_1 = require("../controllers/paymentTypes.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// Read (needed by operators creating purchases)
router.get('/', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PURCHASES_READ), paymentTypes_controller_1.getPaymentTypes);
router.get('/default', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PURCHASES_READ), paymentTypes_controller_1.getDefaultPaymentType);
router.get('/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PURCHASES_READ), paymentTypes_controller_1.getPaymentTypeById);
// Manage (admin only via ADMIN bypass, but explicit permission for audit)
router.post('/seed', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ADMIN_USERS), paymentTypes_controller_1.seedDefaultPaymentTypes);
router.post('/', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PURCHASES_MANAGE), paymentTypes_controller_1.createPaymentType);
router.put('/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PURCHASES_MANAGE), paymentTypes_controller_1.updatePaymentType);
router.patch('/:id/toggle', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PURCHASES_MANAGE), paymentTypes_controller_1.togglePaymentType);
router.delete('/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PURCHASES_MANAGE), paymentTypes_controller_1.deletePaymentType);
exports.default = router;
