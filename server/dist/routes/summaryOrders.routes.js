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
const summaryOrders = __importStar(require("../controllers/summaryOrders.controller"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// Read
router.get('/', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUMMARY_READ), summaryOrders.getSummaryOrders);
router.get('/filter-options', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUMMARY_READ), summaryOrders.getFilterOptions);
// Create / Edit
router.post('/', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUMMARY_CREATE), summaryOrders.createSummaryOrder);
router.post('/bulk', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUMMARY_CREATE), summaryOrders.bulkCreateSummaryOrders);
router.put('/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUMMARY_CREATE), summaryOrders.updateSummaryOrder);
router.delete('/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUMMARY_CREATE), summaryOrders.deleteSummaryOrder);
router.post('/bulk-delete', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUMMARY_CREATE), summaryOrders.bulkDeleteSummaryOrders);
// Sync
router.post('/sync', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUMMARY_SYNC), summaryOrders.syncToOrders);
router.post('/rework', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUMMARY_SYNC), summaryOrders.sendToRework);
// Assembly management routes (Управление сборкой)
router.post('/:id/assembly/start', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ASSEMBLY_MANAGE), summaryOrders.startAssembly);
router.post('/:id/assembly/return', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ASSEMBLY_MANAGE), summaryOrders.returnFromAssembly);
router.post('/assembly/return-batch', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ASSEMBLY_MANAGE), summaryOrders.returnFromAssemblyBatch);
router.get('/:id/events', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.SUMMARY_READ), summaryOrders.getOrderEvents);
exports.default = router;
