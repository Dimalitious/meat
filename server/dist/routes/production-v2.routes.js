"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const production_v2_controller_1 = require("../controllers/production-v2.controller");
const router = (0, express_1.Router)();
// Все роуты требуют авторизации
router.use(auth_middleware_1.authenticateToken);
// ============================================
// MML - Техкарты
// ============================================
// Список MML
router.get('/mml', production_v2_controller_1.getMmlList);
// MML по ID
router.get('/mml/:id', production_v2_controller_1.getMmlById);
// MML по productId
router.get('/mml/product/:productId', production_v2_controller_1.getMmlByProductId);
// Категории MML (группировка по категориям продуктов)
router.get('/mml/:mmlId/categories', production_v2_controller_1.getMmlCategories);
// Создать MML
router.post('/mml', production_v2_controller_1.createMml);
// Добавить корневой узел
router.post('/mml/:id/node', production_v2_controller_1.addRootNode);
// Добавить дочерний узел
router.post('/mml/:id/node/:parentNodeId/child', production_v2_controller_1.addChildNode);
// Удалить узел
router.delete('/mml/node/:nodeId', production_v2_controller_1.deleteNode);
// Зафиксировать/разблокировать MML
router.patch('/mml/:id/lock', production_v2_controller_1.toggleMmlLock);
// Мягкое удаление MML
router.patch('/mml/:id/soft-delete', production_v2_controller_1.softDeleteMml);
// Восстановить MML
router.patch('/mml/:id/restore', production_v2_controller_1.restoreMml);
// Удалить MML
router.delete('/mml/:id', production_v2_controller_1.deleteMml);
// ============================================
// Production Run - Выработка
// ============================================
// Список выработок
router.get('/runs', production_v2_controller_1.getProductionRuns);
// Выработка по ID
router.get('/runs/:id', production_v2_controller_1.getProductionRunById);
// Значения выработки с информацией о сотрудниках
router.get('/runs/:id/values-staff', production_v2_controller_1.getRunValuesWithStaff);
// Создать выработку
router.post('/runs', production_v2_controller_1.createProductionRun);
// Сохранить значения выработки
router.put('/runs/:id/values', production_v2_controller_1.saveProductionRunValues);
// Добавить запись значения (с трекингом сотрудника)
router.post('/runs/:id/values', production_v2_controller_1.addRunValueEntry);
// Обновить запись значения
router.patch('/runs/values/:valueId', production_v2_controller_1.updateRunValueEntry);
// Удалить запись значения
router.delete('/runs/values/:valueId', production_v2_controller_1.deleteRunValueEntry);
// Зафиксировать/разблокировать
router.patch('/runs/:id/lock', production_v2_controller_1.toggleProductionRunLock);
// Клонировать выработку
router.post('/runs/:id/clone', production_v2_controller_1.cloneProductionRun);
// Удалить выработку
router.delete('/runs/:id', production_v2_controller_1.deleteProductionRun);
// Массовое скрытие выработок
router.post('/runs/hide', production_v2_controller_1.hideProductionRuns);
// Отмена массового скрытия выработок
router.post('/runs/unhide', production_v2_controller_1.unhideProductionRuns);
// ============================================
// Расширенный функционал
// ============================================
// Загрузить позиции закупок в производство
router.get('/purchases', production_v2_controller_1.loadPurchasesToProduction);
// Загрузить остатки на начало
router.get('/opening-balances', production_v2_controller_1.loadOpeningBalances);
// Загрузить невыработанные позиции с предыдущих дат
router.get('/unfinished', production_v2_controller_1.loadUnfinishedItems);
// Получить производственного сотрудника для текущего пользователя
router.get('/staff/me', production_v2_controller_1.getCurrentProductionStaff);
exports.default = router;
