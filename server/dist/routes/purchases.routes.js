"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const purchases_controller_1 = require("../controllers/purchases.controller");
const router = (0, express_1.Router)();
// Все роуты требуют авторизации
router.use(auth_middleware_1.authenticateToken);
// ============================================
// Вспомогательные эндпоинты (ВАЖНО: до /:id!)
// ============================================
// Получить MML (товары) поставщика из закупочного прайса
router.get('/supplier/:supplierId/mml', purchases_controller_1.getSupplierMml);
// Получить последнюю цену товара для поставщика
router.get('/supplier/:supplierId/product/:productId/price', purchases_controller_1.getLastPrice);
// Массовое отключение (скрытие) - до /:id
router.post('/disable', purchases_controller_1.disablePurchases);
// ============================================
// Журнал закупок
// ============================================
// Список закупок (с фильтрацией)
router.get('/', purchases_controller_1.getPurchases);
// Создать закупку
router.post('/', purchases_controller_1.createPurchase);
// Закупка по ID - ПОСЛЕ специфичных роутов
router.get('/:id', purchases_controller_1.getPurchaseById);
// Обновить закупку
router.put('/:id', purchases_controller_1.updatePurchase);
// Удалить закупку
router.delete('/:id', purchases_controller_1.deletePurchase);
exports.default = router;
