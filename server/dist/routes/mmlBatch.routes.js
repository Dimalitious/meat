"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const mmlBatch_controller_1 = require("../controllers/mmlBatch.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// ========== MML Routes ==========
router.get('/mml', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.MML_READ), mmlBatch_controller_1.getAllMmls);
router.get('/mml/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.MML_READ), mmlBatch_controller_1.getMmlById);
router.post('/mml', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.MML_MANAGE), mmlBatch_controller_1.createMml);
router.put('/mml/:mmlId/item/:lineNo', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.MML_MANAGE), mmlBatch_controller_1.updateMmlItem);
router.post('/mml/:id/lock', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.MML_LOCK), mmlBatch_controller_1.lockMml);
router.delete('/mml/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.MML_MANAGE), mmlBatch_controller_1.deleteMml);
// ========== Batch Routes ==========
router.get('/batch', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_READ), mmlBatch_controller_1.getAllBatches);
router.get('/batch/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_READ), mmlBatch_controller_1.getBatchById);
router.post('/batch', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_CREATE), mmlBatch_controller_1.createBatch);
router.put('/batch/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_EDIT), mmlBatch_controller_1.updateBatch);
router.put('/batch/:batchId/item/:lineNo', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_EDIT), mmlBatch_controller_1.updateBatchItem);
router.post('/batch/:id/lock', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_EDIT), mmlBatch_controller_1.lockBatch);
router.post('/batch/:id/clone', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_CREATE), mmlBatch_controller_1.cloneBatch);
router.delete('/batch/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_DELETE), mmlBatch_controller_1.deleteBatch);
exports.default = router;
