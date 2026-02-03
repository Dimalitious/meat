"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const production_controller_1 = require("../controllers/production.controller");
const router = (0, express_1.Router)();
// Все роуты требуют авторизации
router.use(auth_middleware_1.authenticateToken);
// ============================================
// СПРАВОЧНИК ПЕРСОНАЛА
// ============================================
router.get('/staff', production_controller_1.getProductionStaff);
router.get('/staff/user/:userId', production_controller_1.getStaffByUserId);
router.post('/staff', production_controller_1.createProductionStaff);
router.put('/staff/:id', production_controller_1.updateProductionStaff);
// ============================================
// ЖУРНАЛ ПРОИЗВОДСТВА
// ============================================
router.get('/journals', production_controller_1.getJournalList); // GET /api/production/journals?dateFrom=&dateTo=
router.get('/journal/:date', production_controller_1.getOrCreateJournal); // GET /api/production/journal/2024-01-20
router.put('/journal/:id', production_controller_1.saveJournal); // PUT /api/production/journal/:id
// ============================================
// КАРТОЧКИ ПРОИЗВОДСТВА
// ============================================
router.post('/journal/:journalId/items', production_controller_1.addProductionItem); // POST - добавить карточку
router.put('/items/:id', production_controller_1.updateProductionItem); // PUT - обновить карточку
router.delete('/items/:id', production_controller_1.deleteProductionItem); // DELETE - удалить карточку
router.post('/items/delete-multiple', production_controller_1.deleteMultipleItems); // POST - удалить несколько
router.post('/items/:id/clone', production_controller_1.cloneProductionItem); // POST - клонировать
router.post('/items/:id/lock', production_controller_1.lockProductionItem); // POST - заблокировать (галочка)
router.post('/items/:id/unlock', production_controller_1.unlockProductionItem); // POST - разблокировать (карандаш)
router.post('/items/:itemId/values', production_controller_1.updateItemValue); // POST - обновить значение поля
exports.default = router;
