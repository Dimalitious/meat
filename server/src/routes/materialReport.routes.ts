import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
    getMaterialReport,
    refreshMaterialReport,
    updateMaterialReportLine,
    saveMaterialReport,
    deleteMaterialReport
} from '../controllers/materialReport.controller';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authenticateToken);

// Получить материальный отчёт на дату (или предпросмотр)
router.get('/', getMaterialReport);

// Обновить отчёт (пересобрать данные, сохраняя введённые факты)
router.post('/refresh', refreshMaterialReport);

// Обновить фактический остаток для товара
router.patch('/line/:productId', updateMaterialReportLine);

// Сохранить отчёт в БД
router.post('/save', saveMaterialReport);

// Удалить отчёт
router.delete('/:id', deleteMaterialReport);

export default router;
