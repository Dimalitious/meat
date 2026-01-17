import { Router } from 'express';
import { getProducts, getProduct, createProduct, updateProduct, deleteProduct } from '../controllers/products.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken); // Protect all routes

router.get('/', getProducts);
router.get('/:code', getProduct);
router.post('/', createProduct);
router.put('/:code', updateProduct);
router.delete('/:code', deleteProduct);

export default router;
