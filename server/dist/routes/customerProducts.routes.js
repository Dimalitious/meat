"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const customerProducts_controller_1 = require("../controllers/customerProducts.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// Read
router.get('/customers-with-counts', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customerProducts_controller_1.getCustomersWithProductCounts);
router.get('/:customerId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customerProducts_controller_1.getCustomerProducts);
// Manage
router.post('/:customerId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customerProducts_controller_1.addCustomerProduct);
router.post('/:customerId/bulk', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customerProducts_controller_1.addCustomerProductsBulk);
router.delete('/:customerId/:productId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customerProducts_controller_1.removeCustomerProduct);
router.put('/:customerId/reorder', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customerProducts_controller_1.reorderCustomerProducts);
exports.default = router;
