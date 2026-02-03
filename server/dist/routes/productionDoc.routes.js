"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const productionDoc_controller_1 = require("../controllers/productionDoc.controller");
const router = (0, express_1.Router)();
// Все роуты требуют авторизации
router.use(auth_middleware_1.authenticateToken);
// GET /api/production-docs - Список документов
router.get('/', productionDoc_controller_1.getProductionDocs);
// GET /api/production-docs/available-purchases - Закупки для загрузки
router.get('/available-purchases', productionDoc_controller_1.getAvailablePurchases);
// GET /api/production-docs/:id - Получить документ
router.get('/:id', productionDoc_controller_1.getProductionDoc);
// POST /api/production-docs - Создать документ
router.post('/', productionDoc_controller_1.createProductionDoc);
// POST /api/production-docs/:id/load-from-purchase - Загрузить сырьё из закупок
router.post('/:id/load-from-purchase', productionDoc_controller_1.loadFromPurchase);
// POST /api/production-docs/:id/clear-inputs - Очистить загруженное сырьё
router.post('/:id/clear-inputs', productionDoc_controller_1.clearInputs);
// POST /api/production-docs/:id/apply-cutting - Применить разделку
router.post('/:id/apply-cutting', productionDoc_controller_1.applyCutting);
// POST /api/production-docs/:id/finalize - Провести документ
router.post('/:id/finalize', productionDoc_controller_1.finalizeDoc);
// POST /api/production-docs/:id/cancel - Отменить документ
router.post('/:id/cancel', productionDoc_controller_1.cancelDoc);
// DELETE /api/production-docs/:id - Удалить документ (только draft)
router.delete('/:id', productionDoc_controller_1.deleteProductionDoc);
exports.default = router;
