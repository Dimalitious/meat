import { Router } from 'express';
import {
    getPurchasePriceLists,
    getPurchasePriceList,
    createPurchasePriceList,
    updatePurchasePriceList,
    deactivatePurchasePriceLists,
    getActivePurchasePrice,
    getLastPriceListTemplate
} from '../controllers/purchasePriceLists.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

// Журнал закупочных прайсов
router.get('/', getPurchasePriceLists);

// Шаблон из последнего прайса для создания нового
router.get('/template', getLastPriceListTemplate);

// Получить актуальную цену (должен быть перед /:id)
router.get('/active-price', getActivePurchasePrice);

// Массовое отключение
router.post('/deactivate', deactivatePurchasePriceLists);

// CRUD
router.get('/:id', getPurchasePriceList);
router.post('/', createPurchasePriceList);
router.put('/:id', updatePurchasePriceList);

export default router;
