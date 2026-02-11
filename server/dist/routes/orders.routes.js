"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const orders = __importStar(require("../controllers/orders.controller"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// Standard CRUD
router.get('/', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ORDERS_READ), orders.getOrders);
router.post('/', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ORDERS_CREATE), orders.createOrder);
router.post('/disable', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ORDERS_DELETE), orders.disableOrders);
// Dispatch: Get orders pending dispatch (ready for expeditor assignment)
// ВАЖНО: Этот роут ДОЛЖЕН быть ДО /:id, иначе Express примет "pending-dispatch" за ID
router.get('/pending-dispatch', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ORDERS_READ), orders.getOrdersPendingDispatch);
// Bulk delete orders (ТЗ: Удаление из Сборки заказов)
router.post('/bulk-delete', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ORDERS_DELETE), orders.bulkDeleteOrders);
// IDN-related: Get summary data by IDN for auto-populating quantity
router.get('/summary-by-idn/:idn', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ORDERS_READ), orders.getSummaryByIdn);
// Expedition: Get orders for specific expeditor
router.get('/expeditor/:expeditorId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ORDERS_READ), orders.getExpeditorOrders);
// Dynamic :id routes - ПОСЛЕ статических маршрутов
router.get('/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ORDERS_READ), orders.getOrder);
router.patch('/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ORDERS_EDIT), orders.updateOrder);
router.put('/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ORDERS_EDIT), orders.updateOrder);
router.delete('/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ORDERS_DELETE), orders.deleteOrder);
// Safe Edit с авторизацией (admin/manager -> ORDERS_EDIT)
router.put('/:id/edit', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ORDERS_EDIT), orders.editOrder);
// Переназначение экспедитора
router.patch('/:id/expeditor', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ORDERS_ASSIGN_EXPEDITOR), orders.reassignExpeditor);
// Expedition: Assign expeditor to order
router.post('/:id/assign-expeditor', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ORDERS_ASSIGN_EXPEDITOR), orders.assignExpeditor);
// Expedition: Complete order with signature
router.post('/:id/complete', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ORDERS_CHANGE_STATUS), orders.completeOrder);
// FSM: Начать сборку заказа (NEW → IN_ASSEMBLY)
router.post('/:id/start-assembly', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ORDERS_CHANGE_STATUS), orders.startAssemblyOrder);
// FSM: Подтвердить сборку заказа (IN_ASSEMBLY → DISTRIBUTING)
router.post('/:id/confirm-assembly', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ORDERS_CHANGE_STATUS), orders.confirmAssemblyOrder);
// Attachments: Get order attachments (signatures, invoices)
router.get('/:id/attachments', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ORDERS_READ), orders.getOrderAttachments);
// Rework: Send order back to summary for rework
router.post('/:id/rework', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ORDERS_CHANGE_STATUS), orders.sendOrderToRework);
// Invoice: Generate invoice on-the-fly (ТЗ §6.2)
router.get('/:id/invoice', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ORDERS_READ), orders.generateInvoice);
exports.default = router;
