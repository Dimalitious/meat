"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const reports_controller_1 = require("../controllers/reports.controller");
const router = (0, express_1.Router)();
router.get('/svod', auth_middleware_1.authenticateToken, auth_middleware_1.loadUserContext, (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.REPORTS_READ), reports_controller_1.getSvodReport);
exports.default = router;
