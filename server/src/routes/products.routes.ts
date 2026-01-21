import { Router } from 'express';
import { getProducts, getProduct, createProduct, updateProduct, deactivateProduct, upsertProduct, batchUpsertProducts } from '../controllers/products.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken); // Protect all routes

router.get('/', getProducts);
router.post('/', createProduct);
router.post('/upsert', upsertProduct);
router.post('/batch-upsert', batchUpsertProducts);  // Пакетный импорт
router.patch('/toggle/:code', deactivateProduct);  // Переключение статуса - /toggle/CODE
router.get('/:code', getProduct);
router.put('/:code', updateProduct);
router.delete('/:code', deactivateProduct);

export default router;

