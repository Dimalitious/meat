import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import * as returns from '../controllers/returns.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

// GET /api/orders/:orderId/returns - История всех возвратов по заказу
router.get('/orders/:orderId/returns', requirePermission(PERM.RETURNS_READ), returns.getOrderReturns);

// GET /api/orders/:orderId/returns/:expeditionId - Возврат для конкретной экспедиции
router.get('/orders/:orderId/returns/:expeditionId', requirePermission(PERM.RETURNS_READ), returns.getReturnByExpedition);

// POST /api/orders/:orderId/returns - Создать/обновить возврат
router.post('/orders/:orderId/returns', requirePermission(PERM.RETURNS_CREATE), returns.createOrUpdateReturn);

// DELETE /api/orders/:orderId/returns/:expeditionId - Удалить возврат
router.delete('/orders/:orderId/returns/:expeditionId', requirePermission(PERM.RETURNS_CREATE), returns.deleteReturn);

export default router;
