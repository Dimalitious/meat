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
    // Production Run
    getProductionRuns,
    getProductionRunById,
    createProductionRun,
    saveProductionRunValues,
    toggleProductionRunLock,
    cloneProductionRun,
    deleteProductionRun,
    hideProductionRuns,
    unhideProductionRuns
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

// ============================================
// Production Run - Выработка
// ============================================

// Список выработок
router.get('/runs', getProductionRuns);

// Выработка по ID
router.get('/runs/:id', getProductionRunById);

// Создать выработку
router.post('/runs', createProductionRun);

// Сохранить значения выработки
router.put('/runs/:id/values', saveProductionRunValues);

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

export default router;

