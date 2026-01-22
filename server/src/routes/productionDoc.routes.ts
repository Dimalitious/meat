import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
    getProductionDocs,
    getProductionDoc,
    createProductionDoc,
    loadFromPurchase,
    clearInputs,
    applyCutting,
    finalizeDoc,
    cancelDoc,
    deleteProductionDoc,
    getAvailablePurchases
} from '../controllers/productionDoc.controller';

const router = Router();

// Все роуты требуют авторизации
router.use(authenticateToken);

// GET /api/production-docs - Список документов
router.get('/', getProductionDocs);

// GET /api/production-docs/available-purchases - Закупки для загрузки
router.get('/available-purchases', getAvailablePurchases);

// GET /api/production-docs/:id - Получить документ
router.get('/:id', getProductionDoc);

// POST /api/production-docs - Создать документ
router.post('/', createProductionDoc);

// POST /api/production-docs/:id/load-from-purchase - Загрузить сырьё из закупок
router.post('/:id/load-from-purchase', loadFromPurchase);

// POST /api/production-docs/:id/clear-inputs - Очистить загруженное сырьё
router.post('/:id/clear-inputs', clearInputs);

// POST /api/production-docs/:id/apply-cutting - Применить разделку
router.post('/:id/apply-cutting', applyCutting);

// POST /api/production-docs/:id/finalize - Провести документ
router.post('/:id/finalize', finalizeDoc);

// POST /api/production-docs/:id/cancel - Отменить документ
router.post('/:id/cancel', cancelDoc);

// DELETE /api/production-docs/:id - Удалить документ (только draft)
router.delete('/:id', deleteProductionDoc);

export default router;
