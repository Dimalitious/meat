"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const customerCards_controller_1 = require("../controllers/customerCards.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Карточки клиента
router.get('/customer/:customerId', auth_middleware_1.authenticateToken, customerCards_controller_1.getCustomerCards);
router.get('/:cardId', auth_middleware_1.authenticateToken, customerCards_controller_1.getCustomerCard);
router.post('/', auth_middleware_1.authenticateToken, customerCards_controller_1.createCustomerCard);
router.patch('/:cardId', auth_middleware_1.authenticateToken, customerCards_controller_1.updateCustomerCard);
router.delete('/:cardId', auth_middleware_1.authenticateToken, customerCards_controller_1.deleteCustomerCard);
// Позиции карточки
router.post('/:cardId/items', auth_middleware_1.authenticateToken, customerCards_controller_1.addCardItem);
router.patch('/items/:itemId', auth_middleware_1.authenticateToken, customerCards_controller_1.updateCardItem);
router.delete('/items/:itemId', auth_middleware_1.authenticateToken, customerCards_controller_1.deleteCardItem);
// Фото позиций
router.post('/items/:itemId/photos', auth_middleware_1.authenticateToken, customerCards_controller_1.addItemPhoto);
router.delete('/photos/:photoId', auth_middleware_1.authenticateToken, customerCards_controller_1.deleteItemPhoto);
exports.default = router;
