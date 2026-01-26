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
    getCurrentProductionStaff,
    getRunValuesWithStaff,
    addRunValueEntry,
    updateRunValueEntry,
    deleteRunValueEntry,
    getMmlCategories
} from '../controllers/production-v2.controller';

const router = Router();

// Все роуты требуют авторизации
router.use(authenticateToken);

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

// Получить производственного сотрудника для текущего пользователя
router.get('/staff/me', getCurrentProductionStaff);

export default router;

