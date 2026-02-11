"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const svod_controller_1 = require("../controllers/svod.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// Read
router.get('/', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.REPORTS_READ), svod_controller_1.getSvodByDate);
// Manage
router.post('/', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.REPORTS_MANAGE), svod_controller_1.saveSvod);
router.put('/:id/refresh', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.REPORTS_MANAGE), svod_controller_1.refreshSvod);
router.patch('/lines/:lineId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.REPORTS_MANAGE), svod_controller_1.updateSvodLine);
router.delete('/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.REPORTS_MANAGE), svod_controller_1.deleteSvod);
// ============================================
// РАСПРЕДЕЛЕНИЕ ВЕСА ОТГРУЗКИ
// ============================================
router.get('/mml/:productId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.REPORTS_READ), svod_controller_1.getMmlForDistribution);
router.get('/lines/:lineId/distribution', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.REPORTS_READ), svod_controller_1.getShipmentDistribution);
router.post('/lines/:lineId/distribution', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.REPORTS_MANAGE), svod_controller_1.saveShipmentDistribution);
exports.default = router;
