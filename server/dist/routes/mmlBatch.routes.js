"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const mmlBatch_controller_1 = require("../controllers/mmlBatch.controller");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.authenticateToken);
// ========== MML Routes ==========
router.get('/mml', mmlBatch_controller_1.getAllMmls);
router.get('/mml/:id', mmlBatch_controller_1.getMmlById);
router.post('/mml', mmlBatch_controller_1.createMml);
router.put('/mml/:mmlId/item/:lineNo', mmlBatch_controller_1.updateMmlItem);
router.post('/mml/:id/lock', mmlBatch_controller_1.lockMml);
router.delete('/mml/:id', mmlBatch_controller_1.deleteMml);
// ========== Batch Routes ==========
router.get('/batch', mmlBatch_controller_1.getAllBatches);
router.get('/batch/:id', mmlBatch_controller_1.getBatchById);
router.post('/batch', mmlBatch_controller_1.createBatch);
router.put('/batch/:id', mmlBatch_controller_1.updateBatch);
router.put('/batch/:batchId/item/:lineNo', mmlBatch_controller_1.updateBatchItem);
router.post('/batch/:id/lock', mmlBatch_controller_1.lockBatch);
router.post('/batch/:id/clone', mmlBatch_controller_1.cloneBatch);
router.delete('/batch/:id', mmlBatch_controller_1.deleteBatch);
exports.default = router;
