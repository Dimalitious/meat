"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const prices_controller_1 = require("../controllers/prices.controller");
const router = (0, express_1.Router)();
// Все роуты требуют авторизации
router.use(auth_middleware_1.authenticateToken);
// ============================================
// ЗАКУПОЧНЫЙ ПРАЙС
// ============================================
// Журнал закупочных прайсов
router.get('/purchase', prices_controller_1.getPurchasePriceLists); // GET /api/prices/purchase?dateFrom=&dateTo=&supplierId=
// Закупочные цены поставщиков по товару (для формы продажного прайса)
router.get('/purchase/product-prices', prices_controller_1.getPurchasePricesForProduct); // GET /api/prices/purchase/product-prices?productId=&targetDate=
// Текущий прайс поставщика
router.get('/purchase/supplier/:supplierId/current', prices_controller_1.getCurrentPurchasePrice);
// Прайс по ID
router.get('/purchase/:id', prices_controller_1.getPurchasePriceById);
// Создать новый закупочный прайс
router.post('/purchase', prices_controller_1.createPurchasePrice); // POST /api/prices/purchase { supplierId, title }
// Сохранить закупочный прайс
router.put('/purchase/:id', prices_controller_1.savePurchasePrice); // PUT /api/prices/purchase/:id { title, items, makeCurrent }
// ============================================
// ПРОДАЖНЫЙ ПРАЙС
// ============================================
// Журнал продажных прайсов
router.get('/sales', prices_controller_1.getSalesPriceLists); // GET /api/prices/sales?dateFrom=&dateTo=&listType=&customerId=&showHidden=
// Текущий общий прайс
router.get('/sales/general/current', prices_controller_1.getCurrentGeneralPrice);
// Текущий прайс заказчика
router.get('/sales/customer/:customerId/current', prices_controller_1.getCurrentCustomerPrice);
// Прайс по ID
router.get('/sales/:id', prices_controller_1.getSalesPriceById);
// Создать новый продажный прайс
router.post('/sales', prices_controller_1.createSalesPrice); // POST /api/prices/sales { listType, customerId, title, effectiveDate }
// Скрыть выбранные прайс-листы
router.post('/sales/hide', prices_controller_1.hideSalesPriceLists); // POST /api/prices/sales/hide { ids: number[] }
// Сохранить продажный прайс
router.put('/sales/:id', prices_controller_1.saveSalesPrice); // PUT /api/prices/sales/:id { title, items, makeCurrent, effectiveDate }
// ============================================
// МЕХАНИЗМ ПОЛУЧЕНИЯ ЦЕНЫ
// ============================================
// Получить цену для заказчика и товара
router.get('/resolve/:customerId/:productId', prices_controller_1.resolveSalePrice);
// Получить все цены для заказчика
router.get('/resolve/:customerId', prices_controller_1.resolveAllPricesForCustomer);
exports.default = router;
