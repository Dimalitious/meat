import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import * as orders from '../controllers/orders.controller';

const router = Router();
router.use(authenticateToken);

// Standard CRUD
router.get('/', orders.getOrders);                         // GET /api/orders?dateFrom=&dateTo=&showDisabled=
router.post('/', orders.createOrder);                      // POST /api/orders
router.post('/disable', orders.disableOrders);             // POST /api/orders/disable { ids: number[] }

// Dispatch: Get orders pending dispatch (ready for expeditor assignment)
// ВАЖНО: Этот роут ДОЛЖЕН быть ДО /:id, иначе Express примет "pending-dispatch" за ID
router.get('/pending-dispatch', orders.getOrdersPendingDispatch);

// IDN-related: Get summary data by IDN for auto-populating quantity
router.get('/summary-by-idn/:idn', orders.getSummaryByIdn);

// Expedition: Get orders for specific expeditor
router.get('/expeditor/:expeditorId', orders.getExpeditorOrders);

// Dynamic :id routes - ПОСЛЕ статических маршрутов
router.get('/:id', orders.getOrder);                       // GET /api/orders/:id
router.patch('/:id', orders.updateOrder);
router.put('/:id', orders.updateOrder);
router.delete('/:id', orders.deleteOrder);

// Expedition: Assign expeditor to order
router.post('/:id/assign-expeditor', orders.assignExpeditor);

// Expedition: Complete order with signature
router.post('/:id/complete', orders.completeOrder);

// Attachments: Get order attachments (signatures, invoices)
router.get('/:id/attachments', orders.getOrderAttachments);

// Rework: Send order back to summary for rework
router.post('/:id/rework', orders.sendOrderToRework);

export default router;

