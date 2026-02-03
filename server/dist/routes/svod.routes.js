"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const svod_controller_1 = require("../controllers/svod.controller");
const router = (0, express_1.Router)();
// Все маршруты требуют аутентификации
router.use(auth_middleware_1.authenticateToken);
// Получить СВОД на дату (или сформировать предпросмотр)
router.get('/', svod_controller_1.getSvodByDate);
// Сохранить СВОД
router.post('/', svod_controller_1.saveSvod);
// Обновить данные свода из источников (сохраняя ручные правки)
router.put('/:id/refresh', svod_controller_1.refreshSvod);
// Обновить строку свода (ручные правки)
router.patch('/lines/:lineId', svod_controller_1.updateSvodLine);
// Удалить СВОД
router.delete('/:id', svod_controller_1.deleteSvod);
// ============================================
// РАСПРЕДЕЛЕНИЕ ВЕСА ОТГРУЗКИ
// ============================================
// Получить MML (техкарту) по productId для распределения
router.get('/mml/:productId', svod_controller_1.getMmlForDistribution);
// Получить распределение веса для строки свода
router.get('/lines/:lineId/distribution', svod_controller_1.getShipmentDistribution);
// Сохранить распределение веса для строки свода
router.post('/lines/:lineId/distribution', svod_controller_1.saveShipmentDistribution);
exports.default = router;
