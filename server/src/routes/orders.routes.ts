import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import * as orders from '../controllers/orders.controller';

const router = Router();
router.use(authenticateToken);

router.get('/', orders.getOrders);
router.get('/:id', orders.getOrder);
router.post('/', orders.createOrder);
router.patch('/:id', orders.updateOrder);
router.delete('/:id', orders.deleteOrder);

export default router;
