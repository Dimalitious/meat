import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
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

// Все роуты требуют авторизации
router.use(authenticateToken);

// ============================================
// PRODUCTION V3 - Photo Uploads & OCR
// ============================================

// Upload photo
router.post('/uploads/photo', uploadMiddleware.single('file'), uploadPhoto);

// OCR weight recognition
router.post('/ocr/weight', ocrWeight);


// ============================================
// MML - Техкарты
// ============================================

// Список MML
router.get('/mml', getMmlList);

// MML по ID
router.get('/mml/:id', getMmlById);

// MML по productId
router.get('/mml/product/:productId', getMmlByProductId);

// Категории MML (группировка по категориям продуктов)
router.get('/mml/:mmlId/categories', getMmlCategories);

// Создать MML
router.post('/mml', createMml);

// Добавить корневой узел
router.post('/mml/:id/node', addRootNode);

// Добавить дочерний узел
router.post('/mml/:id/node/:parentNodeId/child', addChildNode);

// Удалить узел
router.delete('/mml/node/:nodeId', deleteNode);

// Зафиксировать/разблокировать MML
router.patch('/mml/:id/lock', toggleMmlLock);

// Мягкое удаление MML
router.patch('/mml/:id/soft-delete', softDeleteMml);

// Восстановить MML
router.patch('/mml/:id/restore', restoreMml);

// Удалить MML
router.delete('/mml/:id', deleteMml);

// ============================================
// Production Run - Выработка
// ============================================

// Список выработок
router.get('/runs', getProductionRuns);

// Выработка по ID
router.get('/runs/:id', getProductionRunById);

// Значения выработки с информацией о сотрудниках
router.get('/runs/:id/values-staff', getRunValuesWithStaff);

// Создать выработку
router.post('/runs', createProductionRun);

// Сохранить значения выработки
router.put('/runs/:id/values', saveProductionRunValues);

// Добавить запись значения (с трекингом сотрудника)
router.post('/runs/:id/values', addRunValueEntry);

// Обновить запись значения
router.patch('/runs/values/:valueId', updateRunValueEntry);

// Удалить запись значения
router.delete('/runs/values/:valueId', deleteRunValueEntry);

// Зафиксировать/разблокировать
router.patch('/runs/:id/lock', toggleProductionRunLock);

// Клонировать выработку
router.post('/runs/:id/clone', cloneProductionRun);

// Удалить выработку
router.delete('/runs/:id', deleteProductionRun);

// Массовое скрытие выработок
router.post('/runs/hide', hideProductionRuns);

// Отмена массового скрытия выработок
router.post('/runs/unhide', unhideProductionRuns);

// ============================================
// Расширенный функционал
// ============================================

// Загрузить позиции закупок в производство
router.get('/purchases', loadPurchasesToProduction);

// Загрузить остатки на начало
router.get('/opening-balances', loadOpeningBalances);

// Загрузить невыработанные позиции с предыдущих дат
router.get('/unfinished', loadUnfinishedItems);

// Получить производственного сотрудника для текущего пользователя
router.get('/staff/me', getCurrentProductionStaff);

// ============================================
// PRODUCTION V3 - Closures System
// ============================================

// Закупки за одну дату
router.get('/purchases-by-date', getPurchasesByDate);

// Carryover breakdown по партиям
router.get('/carryover-breakdown', getCarryoverBreakdown);

// Статусы закрытий на дату
router.get('/closures', getClosuresByDate);

// Ручной пересчёт закрытий
router.post('/closures/recalc', recalcClosuresManual);

// Восстановить партию
router.post('/closures/lot/:purchaseItemId/reopen', reopenLot);

// Восстановить продукт на дату
router.post('/closures/product/:productId/reopen', reopenProductForDate);

// ============================================
// PRODUCTION V3 - FIFO Workflow
// ============================================

// Провести документ (draft → posted)
router.post('/runs/:id/post', postProductionRun);

// Аннулировать документ (posted → voided)
router.post('/runs/:id/void', voidProductionRun);

// История allocations для партии
router.get('/lots/:purchaseItemId/allocations', getLotAllocations);

// ============================================
// PRODUCTION V3 - Adjustments
// ============================================

// Список корректировок
router.get('/adjustments', getAdjustments);

// Создать корректировку (draft)
router.post('/adjustments', createAdjustment);

// Обновить корректировку (только draft)
router.patch('/adjustments/:id', updateAdjustment);

// Провести корректировку (draft → posted)
router.post('/adjustments/:id/post', postAdjustment);

// Аннулировать корректировку (posted → voided)
router.post('/adjustments/:id/void', voidAdjustment);

// Удалить корректировку (только draft)
router.delete('/adjustments/:id', deleteAdjustment);

export default router;
