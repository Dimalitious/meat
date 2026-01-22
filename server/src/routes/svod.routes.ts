import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
    getSvodByDate,
    saveSvod,
    refreshSvod,
    updateSvodLine,
    deleteSvod
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

export default router;
