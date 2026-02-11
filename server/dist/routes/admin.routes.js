"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const admin_controller_1 = require("../controllers/admin.controller");
const router = (0, express_1.Router)();
// All admin routes: auth + admin.users permission
// (admin.roles exists in PERM but is unused — single permission gates the whole admin UI)
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// Users CRUD
router.get('/users', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ADMIN_USERS), admin_controller_1.getUsers);
router.post('/users', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ADMIN_USERS), admin_controller_1.createUser);
router.put('/users/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ADMIN_USERS), admin_controller_1.updateUser);
router.post('/users/:id/reset-password', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ADMIN_USERS), admin_controller_1.resetPassword);
// Roles listing (read-only, same permission as users — one admin screen)
router.get('/roles', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.ADMIN_USERS), admin_controller_1.getRoles);
exports.default = router;
