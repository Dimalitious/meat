"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const materialReport_controller_1 = require("../controllers/materialReport.controller");
const router = (0, express_1.Router)();
// Все маршруты требуют аутентификации
router.use(auth_middleware_1.authenticateToken);
// Получить материальный отчёт на дату (или предпросмотр)
router.get('/', materialReport_controller_1.getMaterialReport);
// Обновить отчёт (пересобрать данные, сохраняя введённые факты)
router.post('/refresh', materialReport_controller_1.refreshMaterialReport);
// Обновить фактический остаток для товара
router.patch('/line/:productId', materialReport_controller_1.updateMaterialReportLine);
// Сохранить отчёт в БД
router.post('/save', materialReport_controller_1.saveMaterialReport);
// Удалить отчёт
router.delete('/:id', materialReport_controller_1.deleteMaterialReport);
exports.default = router;
