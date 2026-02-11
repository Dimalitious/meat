"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const materialReport_controller_1 = require("../controllers/materialReport.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// Read
router.get('/', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.REPORTS_READ), materialReport_controller_1.getMaterialReport);
// Manage
router.post('/refresh', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.REPORTS_MANAGE), materialReport_controller_1.refreshMaterialReport);
router.patch('/line/:productId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.REPORTS_MANAGE), materialReport_controller_1.updateMaterialReportLine);
router.post('/save', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.REPORTS_MANAGE), materialReport_controller_1.saveMaterialReport);
router.delete('/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.REPORTS_MANAGE), materialReport_controller_1.deleteMaterialReport);
exports.default = router;
