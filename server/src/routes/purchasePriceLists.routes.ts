import { Router } from 'express';
import {
    getPurchasePriceLists,
    getPurchasePriceList,
    createPurchasePriceList,
    updatePurchasePriceList,
    deactivatePurchasePriceLists,
    getActivePurchasePrice
} from '../controllers/purchasePriceLists.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

// Журнал закупочных прайсов
router.get('/', getPurchasePriceLists);

// Получить актуальную цену (должен быть перед /:id)
router.get('/active-price', getActivePurchasePrice);

// Массовое отключение
router.post('/deactivate', deactivatePurchasePriceLists);

// CRUD
router.get('/:id', getPurchasePriceList);
router.post('/', createPurchasePriceList);
router.put('/:id', updatePurchasePriceList);

export default router;
