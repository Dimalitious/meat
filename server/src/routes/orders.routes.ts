import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import * as orders from '../controllers/orders.controller';

const router = Router();
router.use(authenticateToken);

// Standard CRUD
router.get('/', orders.getOrders);
router.get('/:id', orders.getOrder);
router.post('/', orders.createOrder);
router.patch('/:id', orders.updateOrder);
router.put('/:id', orders.updateOrder);
router.delete('/:id', orders.deleteOrder);

// IDN-related: Get summary data by IDN for auto-populating quantity
router.get('/summary-by-idn/:idn', orders.getSummaryByIdn);

// Expedition: Assign expeditor to order
router.post('/:id/assign-expeditor', orders.assignExpeditor);

// Expedition: Get orders for specific expeditor
router.get('/expeditor/:expeditorId', orders.getExpeditorOrders);

// Expedition: Complete order with signature
router.post('/:id/complete', orders.completeOrder);

// Attachments: Get order attachments (signatures, invoices)
router.get('/:id/attachments', orders.getOrderAttachments);

export default router;
