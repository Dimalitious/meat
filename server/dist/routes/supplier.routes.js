"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const supplierReturns_controller_1 = require("../controllers/supplierReturns.controller");
const supplierPayments_controller_1 = require("../controllers/supplierPayments.controller");
const supplierStatement_controller_1 = require("../controllers/supplierStatement.controller");
const router = (0, express_1.Router)();
// All routes require authentication + RBAC context
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// ============================================
// Возвраты поставщику
// ============================================
router.get('/returns', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUPPLIER_RETURNS_READ), supplierReturns_controller_1.getSupplierReturns);
router.post('/returns', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUPPLIER_RETURNS_MANAGE), supplierReturns_controller_1.createSupplierReturn);
router.get('/returns/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUPPLIER_RETURNS_READ), supplierReturns_controller_1.getSupplierReturnById);
router.put('/returns/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUPPLIER_RETURNS_MANAGE), supplierReturns_controller_1.updateSupplierReturn);
router.delete('/returns/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUPPLIER_RETURNS_MANAGE), supplierReturns_controller_1.deleteSupplierReturn);
// ============================================
// Оплаты поставщику
// ============================================
router.get('/payments', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUPPLIER_PAYMENTS_READ), supplierPayments_controller_1.getSupplierPayments);
router.post('/payments', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUPPLIER_PAYMENTS_MANAGE), supplierPayments_controller_1.createSupplierPayment);
router.put('/payments/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUPPLIER_PAYMENTS_MANAGE), supplierPayments_controller_1.updateSupplierPayment);
router.delete('/payments/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUPPLIER_PAYMENTS_MANAGE), supplierPayments_controller_1.deleteSupplierPayment);
// ============================================
// Акт сверки + начальное сальдо
// ============================================
router.get('/:supplierId/statement', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUPPLIER_STATEMENT_READ), supplierStatement_controller_1.getSupplierStatement);
router.get('/:supplierId/opening-balance', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUPPLIER_STATEMENT_READ), supplierStatement_controller_1.getOpeningBalance);
router.put('/:supplierId/opening-balance', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUPPLIER_PAYMENTS_MANAGE), supplierStatement_controller_1.setOpeningBalance);
exports.default = router;
