import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
    getPurchases,
    getPurchaseById,
    createPurchase,
    updatePurchase,
    disablePurchases,
    deletePurchase,
    getSupplierMml,
    getLastPrice
} from '../controllers/purchases.controller';

const router = Router();

// Все роуты требуют авторизации
router.use(authenticateToken);

// ============================================
// Вспомогательные эндпоинты (ВАЖНО: до /:id!)
// ============================================

// Получить MML (товары) поставщика из закупочного прайса
router.get('/supplier/:supplierId/mml', getSupplierMml);

// Получить последнюю цену товара для поставщика
router.get('/supplier/:supplierId/product/:productId/price', getLastPrice);

// Массовое отключение (скрытие) - до /:id
router.post('/disable', disablePurchases);

// ============================================
// Журнал закупок
// ============================================

// Список закупок (с фильтрацией)
router.get('/', getPurchases);

// Создать закупку
router.post('/', createPurchase);

// Закупка по ID - ПОСЛЕ специфичных роутов
router.get('/:id', getPurchaseById);

// Обновить закупку
router.put('/:id', updatePurchase);

// Удалить закупку
router.delete('/:id', deletePurchase);

export default router;
