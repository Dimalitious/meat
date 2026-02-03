"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const purchasePriceLists_controller_1 = require("../controllers/purchasePriceLists.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateToken);
// Журнал закупочных прайсов
router.get('/', purchasePriceLists_controller_1.getPurchasePriceLists);
// Шаблон из последнего прайса для создания нового
router.get('/template', purchasePriceLists_controller_1.getLastPriceListTemplate);
// Получить актуальную цену (должен быть перед /:id)
router.get('/active-price', purchasePriceLists_controller_1.getActivePurchasePrice);
// Массовое отключение
router.post('/deactivate', purchasePriceLists_controller_1.deactivatePurchasePriceLists);
// CRUD
router.get('/:id', purchasePriceLists_controller_1.getPurchasePriceList);
router.post('/', purchasePriceLists_controller_1.createPurchasePriceList);
router.put('/:id', purchasePriceLists_controller_1.updatePurchasePriceList);
exports.default = router;
