"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const production_v2_controller_1 = require("../controllers/production-v2.controller");
const uploads_controller_1 = require("../controllers/uploads.controller");
const ocr_controller_1 = require("../controllers/ocr.controller");
const router = (0, express_1.Router)();
// All routes require authentication + RBAC context
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// ============================================
// PRODUCTION V3 - Photo Uploads & OCR
// ============================================
router.post('/uploads/photo', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_CREATE, rbac_constants_1.PERM.PRODUCTION_EDIT), uploads_controller_1.uploadMiddleware.single('file'), uploads_controller_1.uploadPhoto);
router.post('/ocr/weight', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_CREATE, rbac_constants_1.PERM.PRODUCTION_EDIT), ocr_controller_1.ocrWeight);
// ============================================
// MML - Техкарты
// ============================================
// Read MML
router.get('/mml', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.MML_READ), production_v2_controller_1.getMmlList);
router.get('/mml/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.MML_READ), production_v2_controller_1.getMmlById);
router.get('/mml/product/:productId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.MML_READ), production_v2_controller_1.getMmlByProductId);
router.get('/mml/:mmlId/categories', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.MML_READ), production_v2_controller_1.getMmlCategories);
// Manage MML
router.post('/mml', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.MML_MANAGE), production_v2_controller_1.createMml);
router.post('/mml/:id/node', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.MML_MANAGE), production_v2_controller_1.addRootNode);
router.post('/mml/:id/node/:parentNodeId/child', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.MML_MANAGE), production_v2_controller_1.addChildNode);
router.delete('/mml/node/:nodeId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.MML_MANAGE), production_v2_controller_1.deleteNode);
router.patch('/mml/:id/soft-delete', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.MML_MANAGE), production_v2_controller_1.softDeleteMml);
router.patch('/mml/:id/restore', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.MML_MANAGE), production_v2_controller_1.restoreMml);
router.delete('/mml/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.MML_MANAGE), production_v2_controller_1.deleteMml);
// Lock/unlock MML (separate permission)
router.patch('/mml/:id/lock', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.MML_LOCK), production_v2_controller_1.toggleMmlLock);
// ============================================
// Production Run - Выработка
// ============================================
// Read
router.get('/runs', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_READ), production_v2_controller_1.getProductionRuns);
router.get('/runs/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_READ), production_v2_controller_1.getProductionRunById);
router.get('/runs/:id/values-staff', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_READ), production_v2_controller_1.getRunValuesWithStaff);
// Create
router.post('/runs', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_CREATE), production_v2_controller_1.createProductionRun);
// Edit values
router.put('/runs/:id/values', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_EDIT), production_v2_controller_1.saveProductionRunValues);
router.post('/runs/:id/values', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_EDIT), production_v2_controller_1.addRunValueEntry);
router.patch('/runs/values/:valueId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_EDIT), production_v2_controller_1.updateRunValueEntry);
router.delete('/runs/values/:valueId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_EDIT), production_v2_controller_1.deleteRunValueEntry);
// Lock
router.patch('/runs/:id/lock', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_EDIT), production_v2_controller_1.toggleProductionRunLock);
// Clone
router.post('/runs/:id/clone', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_CREATE), production_v2_controller_1.cloneProductionRun);
// Delete
router.delete('/runs/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_DELETE), production_v2_controller_1.deleteProductionRun);
// Hide/unhide
router.post('/runs/hide', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_HIDE), production_v2_controller_1.hideProductionRuns);
router.post('/runs/unhide', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_HIDE), production_v2_controller_1.unhideProductionRuns);
// ============================================
// Расширенный функционал
// ============================================
router.get('/purchases', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_READ), production_v2_controller_1.loadPurchasesToProduction);
router.get('/opening-balances', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_READ), production_v2_controller_1.loadOpeningBalances);
router.get('/unfinished', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_READ), production_v2_controller_1.loadUnfinishedItems);
router.get('/staff/me', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_READ), production_v2_controller_1.getCurrentProductionStaff);
// ============================================
// PRODUCTION V3 - Closures System
// ============================================
router.get('/purchases-by-date', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_CLOSURES), production_v2_controller_1.getPurchasesByDate);
router.get('/carryover-breakdown', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_CLOSURES), production_v2_controller_1.getCarryoverBreakdown);
router.get('/closures', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_CLOSURES), production_v2_controller_1.getClosuresByDate);
router.post('/closures/recalc', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_CLOSURES), production_v2_controller_1.recalcClosuresManual);
router.post('/closures/lot/:purchaseItemId/reopen', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_CLOSURES), production_v2_controller_1.reopenLot);
router.post('/closures/product/:productId/reopen', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_CLOSURES), production_v2_controller_1.reopenProductForDate);
// ============================================
// PRODUCTION V3 - FIFO Workflow
// ============================================
router.post('/runs/:id/post', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_POST), production_v2_controller_1.postProductionRun);
router.post('/runs/:id/void', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_VOID), production_v2_controller_1.voidProductionRun);
router.get('/lots/:purchaseItemId/allocations', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_READ), production_v2_controller_1.getLotAllocations);
// ============================================
// PRODUCTION V3 - Adjustments
// ============================================
router.get('/adjustments', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_ADJUST), production_v2_controller_1.getAdjustments);
router.post('/adjustments', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_ADJUST), production_v2_controller_1.createAdjustment);
router.patch('/adjustments/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_ADJUST), production_v2_controller_1.updateAdjustment);
router.post('/adjustments/:id/post', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_ADJUST), production_v2_controller_1.postAdjustment);
router.post('/adjustments/:id/void', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_ADJUST), production_v2_controller_1.voidAdjustment);
router.delete('/adjustments/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.PRODUCTION_ADJUST), production_v2_controller_1.deleteAdjustment);
exports.default = router;
