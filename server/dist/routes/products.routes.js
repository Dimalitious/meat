"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const products_controller_1 = require("../controllers/products.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateToken); // Protect all routes
router.get('/', products_controller_1.getProducts);
router.post('/', products_controller_1.createProduct);
router.post('/upsert', products_controller_1.upsertProduct);
router.post('/batch-upsert', products_controller_1.batchUpsertProducts); // Пакетный импорт
router.patch('/toggle/:code', products_controller_1.deactivateProduct); // Переключение статуса - /toggle/CODE
router.get('/:code', products_controller_1.getProduct);
router.put('/:code', products_controller_1.updateProduct);
router.delete('/:code', products_controller_1.deactivateProduct);
exports.default = router;
