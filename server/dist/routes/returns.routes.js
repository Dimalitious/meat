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
const returns = __importStar(require("../controllers/returns.controller"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// GET /api/orders/:orderId/returns - История всех возвратов по заказу
router.get('/orders/:orderId/returns', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.RETURNS_READ), returns.getOrderReturns);
// GET /api/orders/:orderId/returns/:expeditionId - Возврат для конкретной экспедиции
router.get('/orders/:orderId/returns/:expeditionId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.RETURNS_READ), returns.getReturnByExpedition);
// POST /api/orders/:orderId/returns - Создать/обновить возврат
router.post('/orders/:orderId/returns', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.RETURNS_CREATE), returns.createOrUpdateReturn);
// DELETE /api/orders/:orderId/returns/:expeditionId - Удалить возврат
router.delete('/orders/:orderId/returns/:expeditionId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.RETURNS_CREATE), returns.deleteReturn);
exports.default = router;
