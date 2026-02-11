"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const customerCards_controller_1 = require("../controllers/customerCards.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// Карточки клиента
router.get('/customer/:customerId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customerCards_controller_1.getCustomerCards);
router.get('/:cardId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customerCards_controller_1.getCustomerCard);
router.post('/', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customerCards_controller_1.createCustomerCard);
router.patch('/:cardId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customerCards_controller_1.updateCustomerCard);
router.delete('/:cardId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customerCards_controller_1.deleteCustomerCard);
// Позиции карточки
router.post('/:cardId/items', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customerCards_controller_1.addCardItem);
router.patch('/items/:itemId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customerCards_controller_1.updateCardItem);
router.delete('/items/:itemId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customerCards_controller_1.deleteCardItem);
// Фото позиций
router.post('/items/:itemId/photos', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customerCards_controller_1.addItemPhoto);
router.delete('/photos/:photoId', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customerCards_controller_1.deleteItemPhoto);
exports.default = router;
