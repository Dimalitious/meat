import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import * as orders from '../controllers/orders.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

// Standard CRUD
router.get('/', requirePermission(PERM.ORDERS_READ), orders.getOrders);
router.post('/', requirePermission(PERM.ORDERS_CREATE), orders.createOrder);
router.post('/disable', requirePermission(PERM.ORDERS_DELETE), orders.disableOrders);

// Dispatch: Get orders pending dispatch (ready for expeditor assignment)
// ВАЖНО: Этот роут ДОЛЖЕН быть ДО /:id, иначе Express примет "pending-dispatch" за ID
router.get('/pending-dispatch', requirePermission(PERM.ORDERS_READ), orders.getOrdersPendingDispatch);

// Bulk delete orders (ТЗ: Удаление из Сборки заказов)
router.post('/bulk-delete', requirePermission(PERM.ORDERS_DELETE), orders.bulkDeleteOrders);

// IDN-related: Get summary data by IDN for auto-populating quantity
router.get('/summary-by-idn/:idn', requirePermission(PERM.ORDERS_READ), orders.getSummaryByIdn);

// Expedition: Get orders for specific expeditor
router.get('/expeditor/:expeditorId', requirePermission(PERM.ORDERS_READ), orders.getExpeditorOrders);

// Dynamic :id routes - ПОСЛЕ статических маршрутов
router.get('/:id', requirePermission(PERM.ORDERS_READ), orders.getOrder);
router.patch('/:id', requirePermission(PERM.ORDERS_EDIT), orders.updateOrder);
router.put('/:id', requirePermission(PERM.ORDERS_EDIT), orders.updateOrder);
router.delete('/:id', requirePermission(PERM.ORDERS_DELETE), orders.deleteOrder);

// Safe Edit с авторизацией (admin/manager -> ORDERS_EDIT)
router.put('/:id/edit', requirePermission(PERM.ORDERS_EDIT), orders.editOrder);

// Переназначение экспедитора
router.patch('/:id/expeditor', requirePermission(PERM.ORDERS_ASSIGN_EXPEDITOR), orders.reassignExpeditor);

// Expedition: Assign expeditor to order
router.post('/:id/assign-expeditor', requirePermission(PERM.ORDERS_ASSIGN_EXPEDITOR), orders.assignExpeditor);

// Expedition: Complete order with signature
router.post('/:id/complete', requirePermission(PERM.ORDERS_CHANGE_STATUS), orders.completeOrder);

// FSM: Начать сборку заказа (NEW → IN_ASSEMBLY)
router.post('/:id/start-assembly', requirePermission(PERM.ORDERS_CHANGE_STATUS), orders.startAssemblyOrder);

// FSM: Подтвердить сборку заказа (IN_ASSEMBLY → DISTRIBUTING)
router.post('/:id/confirm-assembly', requirePermission(PERM.ORDERS_CHANGE_STATUS), orders.confirmAssemblyOrder);

// Attachments: Get order attachments (signatures, invoices)
router.get('/:id/attachments', requirePermission(PERM.ORDERS_READ), orders.getOrderAttachments);

// Rework: Send order back to summary for rework
router.post('/:id/rework', requirePermission(PERM.ORDERS_CHANGE_STATUS), orders.sendOrderToRework);

// Invoice: Generate invoice on-the-fly (ТЗ §6.2)
router.get('/:id/invoice', requirePermission(PERM.ORDERS_READ), orders.generateInvoice);

export default router;
