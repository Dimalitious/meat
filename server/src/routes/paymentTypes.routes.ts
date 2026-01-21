import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
    getPaymentTypes,
    getPaymentTypeById,
    getDefaultPaymentType,
    createPaymentType,
    updatePaymentType,
    togglePaymentType,
    deletePaymentType,
    seedDefaultPaymentTypes
} from '../controllers/paymentTypes.controller';

const router = Router();

// Все роуты требуют авторизации
router.use(authenticateToken);

// Получить список типов оплат
router.get('/', getPaymentTypes);

// Засеять базовые типы
router.post('/seed', seedDefaultPaymentTypes);

// Получить тип оплаты по умолчанию (ВАЖНО: до /:id!)
router.get('/default', getDefaultPaymentType);

// Получить тип оплаты по ID
router.get('/:id', getPaymentTypeById);

// Создать тип оплаты
router.post('/', createPaymentType);

// Обновить тип оплаты
router.put('/:id', updatePaymentType);

// Переключить статус
router.patch('/:id/toggle', togglePaymentType);

// Удалить тип оплаты
router.delete('/:id', deletePaymentType);

export default router;
