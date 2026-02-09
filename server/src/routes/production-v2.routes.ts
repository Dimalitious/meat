import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import {
    // MML
    getMmlList,
    getMmlById,
    getMmlByProductId,
    createMml,
    addRootNode,
    addChildNode,
    deleteNode,
    toggleMmlLock,
    deleteMml,
    softDeleteMml,
    restoreMml,
    // Production Run
    getProductionRuns,
    getProductionRunById,
    createProductionRun,
    saveProductionRunValues,
    toggleProductionRunLock,
    cloneProductionRun,
    deleteProductionRun,
    hideProductionRuns,
    unhideProductionRuns,
    // Extended functionality
    loadPurchasesToProduction,
    loadOpeningBalances,
    loadUnfinishedItems,
    getCurrentProductionStaff,
    getRunValuesWithStaff,
    addRunValueEntry,
    updateRunValueEntry,
    deleteRunValueEntry,
    getMmlCategories,
    // Production V3 - Closures
    getPurchasesByDate,
    getCarryoverBreakdown,
    getClosuresByDate,
    recalcClosuresManual,
    reopenLot,
    reopenProductForDate,
    // Production V3 - FIFO Allocations
    postProductionRun,
    voidProductionRun,
    getLotAllocations,
    // Production V3 - Adjustments
    getAdjustments,
    createAdjustment,
    updateAdjustment,
    postAdjustment,
    voidAdjustment,
    deleteAdjustment
} from '../controllers/production-v2.controller';
import { uploadMiddleware, uploadPhoto } from '../controllers/uploads.controller';
import { ocrWeight } from '../controllers/ocr.controller';

const router = Router();

// All routes require authentication + RBAC context
router.use(authenticateToken);
router.use(loadUserContext);

// ============================================
// PRODUCTION V3 - Photo Uploads & OCR
// ============================================

router.post('/uploads/photo', requirePermission(PERM.PRODUCTION_CREATE, PERM.PRODUCTION_EDIT), uploadMiddleware.single('file'), uploadPhoto);
router.post('/ocr/weight', requirePermission(PERM.PRODUCTION_CREATE, PERM.PRODUCTION_EDIT), ocrWeight);

// ============================================
// MML - Техкарты
// ============================================

// Read MML
router.get('/mml', requirePermission(PERM.MML_READ), getMmlList);
router.get('/mml/:id', requirePermission(PERM.MML_READ), getMmlById);
router.get('/mml/product/:productId', requirePermission(PERM.MML_READ), getMmlByProductId);
router.get('/mml/:mmlId/categories', requirePermission(PERM.MML_READ), getMmlCategories);

// Manage MML
router.post('/mml', requirePermission(PERM.MML_MANAGE), createMml);
router.post('/mml/:id/node', requirePermission(PERM.MML_MANAGE), addRootNode);
router.post('/mml/:id/node/:parentNodeId/child', requirePermission(PERM.MML_MANAGE), addChildNode);
router.delete('/mml/node/:nodeId', requirePermission(PERM.MML_MANAGE), deleteNode);
router.patch('/mml/:id/soft-delete', requirePermission(PERM.MML_MANAGE), softDeleteMml);
router.patch('/mml/:id/restore', requirePermission(PERM.MML_MANAGE), restoreMml);
router.delete('/mml/:id', requirePermission(PERM.MML_MANAGE), deleteMml);

// Lock/unlock MML (separate permission)
router.patch('/mml/:id/lock', requirePermission(PERM.MML_LOCK), toggleMmlLock);

// ============================================
// Production Run - Выработка
// ============================================

// Read
router.get('/runs', requirePermission(PERM.PRODUCTION_READ), getProductionRuns);
router.get('/runs/:id', requirePermission(PERM.PRODUCTION_READ), getProductionRunById);
router.get('/runs/:id/values-staff', requirePermission(PERM.PRODUCTION_READ), getRunValuesWithStaff);

// Create
router.post('/runs', requirePermission(PERM.PRODUCTION_CREATE), createProductionRun);

// Edit values
router.put('/runs/:id/values', requirePermission(PERM.PRODUCTION_EDIT), saveProductionRunValues);
router.post('/runs/:id/values', requirePermission(PERM.PRODUCTION_EDIT), addRunValueEntry);
router.patch('/runs/values/:valueId', requirePermission(PERM.PRODUCTION_EDIT), updateRunValueEntry);
router.delete('/runs/values/:valueId', requirePermission(PERM.PRODUCTION_EDIT), deleteRunValueEntry);

// Lock
router.patch('/runs/:id/lock', requirePermission(PERM.PRODUCTION_EDIT), toggleProductionRunLock);

// Clone
router.post('/runs/:id/clone', requirePermission(PERM.PRODUCTION_CREATE), cloneProductionRun);

// Delete
router.delete('/runs/:id', requirePermission(PERM.PRODUCTION_DELETE), deleteProductionRun);

// Hide/unhide
router.post('/runs/hide', requirePermission(PERM.PRODUCTION_HIDE), hideProductionRuns);
router.post('/runs/unhide', requirePermission(PERM.PRODUCTION_HIDE), unhideProductionRuns);

// ============================================
// Расширенный функционал
// ============================================

router.get('/purchases', requirePermission(PERM.PRODUCTION_READ), loadPurchasesToProduction);
router.get('/opening-balances', requirePermission(PERM.PRODUCTION_READ), loadOpeningBalances);
router.get('/unfinished', requirePermission(PERM.PRODUCTION_READ), loadUnfinishedItems);
router.get('/staff/me', requirePermission(PERM.PRODUCTION_READ), getCurrentProductionStaff);

// ============================================
// PRODUCTION V3 - Closures System
// ============================================

router.get('/purchases-by-date', requirePermission(PERM.PRODUCTION_CLOSURES), getPurchasesByDate);
router.get('/carryover-breakdown', requirePermission(PERM.PRODUCTION_CLOSURES), getCarryoverBreakdown);
router.get('/closures', requirePermission(PERM.PRODUCTION_CLOSURES), getClosuresByDate);
router.post('/closures/recalc', requirePermission(PERM.PRODUCTION_CLOSURES), recalcClosuresManual);
router.post('/closures/lot/:purchaseItemId/reopen', requirePermission(PERM.PRODUCTION_CLOSURES), reopenLot);
router.post('/closures/product/:productId/reopen', requirePermission(PERM.PRODUCTION_CLOSURES), reopenProductForDate);

// ============================================
// PRODUCTION V3 - FIFO Workflow
// ============================================

router.post('/runs/:id/post', requirePermission(PERM.PRODUCTION_POST), postProductionRun);
router.post('/runs/:id/void', requirePermission(PERM.PRODUCTION_VOID), voidProductionRun);
router.get('/lots/:purchaseItemId/allocations', requirePermission(PERM.PRODUCTION_READ), getLotAllocations);

// ============================================
// PRODUCTION V3 - Adjustments
// ============================================

router.get('/adjustments', requirePermission(PERM.PRODUCTION_ADJUST), getAdjustments);
router.post('/adjustments', requirePermission(PERM.PRODUCTION_ADJUST), createAdjustment);
router.patch('/adjustments/:id', requirePermission(PERM.PRODUCTION_ADJUST), updateAdjustment);
router.post('/adjustments/:id/post', requirePermission(PERM.PRODUCTION_ADJUST), postAdjustment);
router.post('/adjustments/:id/void', requirePermission(PERM.PRODUCTION_ADJUST), voidAdjustment);
router.delete('/adjustments/:id', requirePermission(PERM.PRODUCTION_ADJUST), deleteAdjustment);

export default router;
