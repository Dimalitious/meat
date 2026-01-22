import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
    getCustomerProducts,
    addCustomerProduct,
    addCustomerProductsBulk,
    removeCustomerProduct,
    reorderCustomerProducts,
    getCustomersWithProductCounts
} from '../controllers/customerProducts.controller';

const router = Router();

// Все роуты требуют авторизации
router.use(authenticateToken);

// GET /api/customer-products/customers-with-counts - Клиенты с количеством товаров
router.get('/customers-with-counts', getCustomersWithProductCounts);

// GET /api/customer-products/:customerId - Товары клиента
router.get('/:customerId', getCustomerProducts);

// POST /api/customer-products/:customerId - Добавить товар клиенту
router.post('/:customerId', addCustomerProduct);

// POST /api/customer-products/:customerId/bulk - Добавить несколько товаров клиенту
router.post('/:customerId/bulk', addCustomerProductsBulk);

// DELETE /api/customer-products/:customerId/:productId - Удалить товар у клиента
router.delete('/:customerId/:productId', removeCustomerProduct);

// PUT /api/customer-products/:customerId/reorder - Изменить порядок товаров
router.put('/:customerId/reorder', reorderCustomerProducts);

export default router;
