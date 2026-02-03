"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const customerProducts_controller_1 = require("../controllers/customerProducts.controller");
const router = (0, express_1.Router)();
// Все роуты требуют авторизации
router.use(auth_middleware_1.authenticateToken);
// GET /api/customer-products/customers-with-counts - Клиенты с количеством товаров
router.get('/customers-with-counts', customerProducts_controller_1.getCustomersWithProductCounts);
// GET /api/customer-products/:customerId - Товары клиента
router.get('/:customerId', customerProducts_controller_1.getCustomerProducts);
// POST /api/customer-products/:customerId - Добавить товар клиенту
router.post('/:customerId', customerProducts_controller_1.addCustomerProduct);
// POST /api/customer-products/:customerId/bulk - Добавить несколько товаров клиенту
router.post('/:customerId/bulk', customerProducts_controller_1.addCustomerProductsBulk);
// DELETE /api/customer-products/:customerId/:productId - Удалить товар у клиента
router.delete('/:customerId/:productId', customerProducts_controller_1.removeCustomerProduct);
// PUT /api/customer-products/:customerId/reorder - Изменить порядок товаров
router.put('/:customerId/reorder', customerProducts_controller_1.reorderCustomerProducts);
exports.default = router;
