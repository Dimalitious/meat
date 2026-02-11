"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const salesManager_controller_1 = require("../controllers/salesManager.controller");
const customerAddresses_controller_1 = require("../controllers/customerAddresses.controller");
const router = (0, express_1.Router)();
// All routes require authentication + RBAC context
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// ============================================
// Customers
// ============================================
router.get('/customers', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SALES_MANAGER_CUSTOMERS_READ), salesManager_controller_1.getCustomers);
router.post('/customers/:customerId/assign', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SALES_MANAGER_CUSTOMERS_ASSIGN), salesManager_controller_1.assignManagers);
router.post('/customers/:customerId/unassign', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SALES_MANAGER_CUSTOMERS_ASSIGN), salesManager_controller_1.unassignManager);
// ============================================
// Customer Addresses (Геолокации доставки)
// ============================================
router.get('/customers/:customerId/addresses', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SALES_MANAGER_ADDRESSES_MANAGE), customerAddresses_controller_1.listCustomerAddresses);
router.post('/customers/:customerId/addresses', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SALES_MANAGER_ADDRESSES_MANAGE), customerAddresses_controller_1.createCustomerAddress);
router.patch('/customers/:customerId/addresses/:addressId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SALES_MANAGER_ADDRESSES_MANAGE), customerAddresses_controller_1.updateCustomerAddress);
router.delete('/customers/:customerId/addresses/:addressId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SALES_MANAGER_ADDRESSES_MANAGE), customerAddresses_controller_1.deleteCustomerAddress);
router.post('/customers/:customerId/addresses/:addressId/make-default', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SALES_MANAGER_ADDRESSES_MANAGE), customerAddresses_controller_1.makeDefaultCustomerAddress);
// ============================================
// Drafts (OrderDraft workflow)
// ============================================
router.get('/drafts', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SALES_MANAGER_DRAFTS_READ), salesManager_controller_1.getDrafts);
router.post('/drafts/:draftId/accept', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SALES_MANAGER_DRAFTS_ACCEPT), salesManager_controller_1.acceptDraft);
router.post('/drafts/:draftId/reject', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SALES_MANAGER_DRAFTS_REJECT), salesManager_controller_1.rejectDraft);
router.put('/drafts/:draftId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SALES_MANAGER_DRAFTS_EDIT), salesManager_controller_1.updateRejectedDraft);
router.post('/drafts/:draftId/return-to-review', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SALES_MANAGER_DRAFTS_EDIT), salesManager_controller_1.returnDraftToReview);
// ============================================
// Statement (Аксверк)
// ============================================
router.get('/customers/:customerId/statement', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SALES_MANAGER_STATEMENT_READ), salesManager_controller_1.getStatement);
router.post('/customers/:customerId/statement/send', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SALES_MANAGER_STATEMENT_SEND), salesManager_controller_1.sendStatement);
// ============================================
// Refunds (Возврат денег клиенту)
// ============================================
router.get('/customers/:customerId/refunds', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SALES_MANAGER_REFUNDS_READ), salesManager_controller_1.listRefunds);
router.post('/customers/:customerId/refunds', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SALES_MANAGER_REFUNDS_MANAGE), salesManager_controller_1.createRefund);
router.put('/refunds/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SALES_MANAGER_REFUNDS_MANAGE), salesManager_controller_1.updateRefund);
router.delete('/refunds/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SALES_MANAGER_REFUNDS_MANAGE), salesManager_controller_1.softDeleteRefund);
exports.default = router;
