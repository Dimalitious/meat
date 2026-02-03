import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import * as returns from '../controllers/returns.controller';

const router = Router();

// Все маршруты требуют авторизации
router.use(authenticateToken);

// GET /api/orders/:orderId/returns - История всех возвратов по заказу
router.get('/orders/:orderId/returns', returns.getOrderReturns);

// GET /api/orders/:orderId/returns/:expeditionId - Возврат для конкретной экспедиции
router.get('/orders/:orderId/returns/:expeditionId', returns.getReturnByExpedition);

// POST /api/orders/:orderId/returns - Создать/обновить возврат (требует expeditionId в body)
router.post('/orders/:orderId/returns', returns.createOrUpdateReturn);

// DELETE /api/orders/:orderId/returns/:expeditionId - Удалить возврат конкретной экспедиции
router.delete('/orders/:orderId/returns/:expeditionId', returns.deleteReturn);

export default router;
