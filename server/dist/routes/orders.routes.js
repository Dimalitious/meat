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
const orders = __importStar(require("../controllers/orders.controller"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateToken);
// Standard CRUD
router.get('/', orders.getOrders); // GET /api/orders?dateFrom=&dateTo=&showDisabled=
router.post('/', orders.createOrder); // POST /api/orders
router.post('/disable', orders.disableOrders); // POST /api/orders/disable { ids: number[] }
// Dispatch: Get orders pending dispatch (ready for expeditor assignment)
// ВАЖНО: Этот роут ДОЛЖЕН быть ДО /:id, иначе Express примет "pending-dispatch" за ID
router.get('/pending-dispatch', orders.getOrdersPendingDispatch);
// IDN-related: Get summary data by IDN for auto-populating quantity
router.get('/summary-by-idn/:idn', orders.getSummaryByIdn);
// Expedition: Get orders for specific expeditor
router.get('/expeditor/:expeditorId', orders.getExpeditorOrders);
// Dynamic :id routes - ПОСЛЕ статических маршрутов
router.get('/:id', orders.getOrder); // GET /api/orders/:id
router.patch('/:id', orders.updateOrder);
router.put('/:id', orders.updateOrder);
router.delete('/:id', orders.deleteOrder);
// Expedition: Assign expeditor to order
router.post('/:id/assign-expeditor', orders.assignExpeditor);
// Expedition: Complete order with signature
router.post('/:id/complete', orders.completeOrder);
// Attachments: Get order attachments (signatures, invoices)
router.get('/:id/attachments', orders.getOrderAttachments);
// Rework: Send order back to summary for rework
router.post('/:id/rework', orders.sendOrderToRework);
exports.default = router;
