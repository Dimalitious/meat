import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
    getSvodByDate,
    saveSvod,
    refreshSvod,
    updateSvodLine,
    deleteSvod,
    getMmlForDistribution,
    getShipmentDistribution,
    saveShipmentDistribution
} from '../controllers/svod.controller';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authenticateToken);

// Получить СВОД на дату (или сформировать предпросмотр)
router.get('/', getSvodByDate);

// Сохранить СВОД
router.post('/', saveSvod);

// Обновить данные свода из источников (сохраняя ручные правки)
router.put('/:id/refresh', refreshSvod);

// Обновить строку свода (ручные правки)
router.patch('/lines/:lineId', updateSvodLine);

// Удалить СВОД
router.delete('/:id', deleteSvod);

// ============================================
// РАСПРЕДЕЛЕНИЕ ВЕСА ОТГРУЗКИ
// ============================================

// Получить MML (техкарту) по productId для распределения
router.get('/mml/:productId', getMmlForDistribution);

// Получить распределение веса для строки свода
router.get('/lines/:lineId/distribution', getShipmentDistribution);

// Сохранить распределение веса для строки свода
router.post('/lines/:lineId/distribution', saveShipmentDistribution);

export default router;
