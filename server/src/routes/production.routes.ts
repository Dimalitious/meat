import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
    // Справочник персонала
    getProductionStaff,
    getStaffByUserId,
    createProductionStaff,
    updateProductionStaff,
    // Журнал
    getOrCreateJournal,
    getJournalList,
    saveJournal,
    // Карточки
    addProductionItem,
    updateProductionItem,
    deleteProductionItem,
    deleteMultipleItems,
    cloneProductionItem,
    lockProductionItem,
    unlockProductionItem,
    updateItemValue
} from '../controllers/production.controller';

const router = Router();

// Все роуты требуют авторизации
router.use(authenticateToken);

// ============================================
// СПРАВОЧНИК ПЕРСОНАЛА
// ============================================
router.get('/staff', getProductionStaff);
router.get('/staff/user/:userId', getStaffByUserId);
router.post('/staff', createProductionStaff);
router.put('/staff/:id', updateProductionStaff);

// ============================================
// ЖУРНАЛ ПРОИЗВОДСТВА
// ============================================
router.get('/journals', getJournalList);              // GET /api/production/journals?dateFrom=&dateTo=
router.get('/journal/:date', getOrCreateJournal);     // GET /api/production/journal/2024-01-20
router.put('/journal/:id', saveJournal);              // PUT /api/production/journal/:id

// ============================================
// КАРТОЧКИ ПРОИЗВОДСТВА
// ============================================
router.post('/journal/:journalId/items', addProductionItem);    // POST - добавить карточку
router.put('/items/:id', updateProductionItem);                  // PUT - обновить карточку
router.delete('/items/:id', deleteProductionItem);               // DELETE - удалить карточку
router.post('/items/delete-multiple', deleteMultipleItems);      // POST - удалить несколько
router.post('/items/:id/clone', cloneProductionItem);            // POST - клонировать
router.post('/items/:id/lock', lockProductionItem);              // POST - заблокировать (галочка)
router.post('/items/:id/unlock', unlockProductionItem);          // POST - разблокировать (карандаш)
router.post('/items/:itemId/values', updateItemValue);           // POST - обновить значение поля

export default router;
