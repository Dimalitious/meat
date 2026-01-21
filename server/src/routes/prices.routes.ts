import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
    // Закупочный прайс
    getPurchasePriceLists,
    getCurrentPurchasePrice,
    getPurchasePriceById,
    createPurchasePrice,
    savePurchasePrice,
    getPurchasePricesForProduct,
    // Продажный прайс
    getSalesPriceLists,
    getCurrentGeneralPrice,
    getCurrentCustomerPrice,
    getSalesPriceById,
    createSalesPrice,
    saveSalesPrice,
    hideSalesPriceLists,
    // Механизм цен
    resolveSalePrice,
    resolveAllPricesForCustomer
} from '../controllers/prices.controller';

const router = Router();

// Все роуты требуют авторизации
router.use(authenticateToken);

// ============================================
// ЗАКУПОЧНЫЙ ПРАЙС
// ============================================

// Журнал закупочных прайсов
router.get('/purchase', getPurchasePriceLists);          // GET /api/prices/purchase?dateFrom=&dateTo=&supplierId=

// Закупочные цены поставщиков по товару (для формы продажного прайса)
router.get('/purchase/product-prices', getPurchasePricesForProduct);  // GET /api/prices/purchase/product-prices?productId=&targetDate=

// Текущий прайс поставщика
router.get('/purchase/supplier/:supplierId/current', getCurrentPurchasePrice);

// Прайс по ID
router.get('/purchase/:id', getPurchasePriceById);

// Создать новый закупочный прайс
router.post('/purchase', createPurchasePrice);           // POST /api/prices/purchase { supplierId, title }

// Сохранить закупочный прайс
router.put('/purchase/:id', savePurchasePrice);          // PUT /api/prices/purchase/:id { title, items, makeCurrent }

// ============================================
// ПРОДАЖНЫЙ ПРАЙС
// ============================================

// Журнал продажных прайсов
router.get('/sales', getSalesPriceLists);                // GET /api/prices/sales?dateFrom=&dateTo=&listType=&customerId=&showHidden=

// Текущий общий прайс
router.get('/sales/general/current', getCurrentGeneralPrice);

// Текущий прайс заказчика
router.get('/sales/customer/:customerId/current', getCurrentCustomerPrice);

// Прайс по ID
router.get('/sales/:id', getSalesPriceById);

// Создать новый продажный прайс
router.post('/sales', createSalesPrice);                 // POST /api/prices/sales { listType, customerId, title, effectiveDate }

// Скрыть выбранные прайс-листы
router.post('/sales/hide', hideSalesPriceLists);         // POST /api/prices/sales/hide { ids: number[] }

// Сохранить продажный прайс
router.put('/sales/:id', saveSalesPrice);                // PUT /api/prices/sales/:id { title, items, makeCurrent, effectiveDate }

// ============================================
// МЕХАНИЗМ ПОЛУЧЕНИЯ ЦЕНЫ
// ============================================

// Получить цену для заказчика и товара
router.get('/resolve/:customerId/:productId', resolveSalePrice);

// Получить все цены для заказчика
router.get('/resolve/:customerId', resolveAllPricesForCustomer);

export default router;
