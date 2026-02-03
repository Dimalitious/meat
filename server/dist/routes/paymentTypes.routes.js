"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const paymentTypes_controller_1 = require("../controllers/paymentTypes.controller");
const router = (0, express_1.Router)();
// Все роуты требуют авторизации
router.use(auth_middleware_1.authenticateToken);
// Получить список типов оплат
router.get('/', paymentTypes_controller_1.getPaymentTypes);
// Засеять базовые типы
router.post('/seed', paymentTypes_controller_1.seedDefaultPaymentTypes);
// Получить тип оплаты по умолчанию (ВАЖНО: до /:id!)
router.get('/default', paymentTypes_controller_1.getDefaultPaymentType);
// Получить тип оплаты по ID
router.get('/:id', paymentTypes_controller_1.getPaymentTypeById);
// Создать тип оплаты
router.post('/', paymentTypes_controller_1.createPaymentType);
// Обновить тип оплаты
router.put('/:id', paymentTypes_controller_1.updatePaymentType);
// Переключить статус
router.patch('/:id/toggle', paymentTypes_controller_1.togglePaymentType);
// Удалить тип оплаты
router.delete('/:id', paymentTypes_controller_1.deletePaymentType);
exports.default = router;
