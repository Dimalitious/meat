import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import {
    getCustomerCards,
    getCustomerCard,
    createCustomerCard,
    updateCustomerCard,
    deleteCustomerCard,
    addCardItem,
    updateCardItem,
    deleteCardItem,
    addItemPhoto,
    deleteItemPhoto
} from '../controllers/customerCards.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

// Карточки клиента
router.get('/customer/:customerId', requirePermission(PERM.CATALOG_CUSTOMERS), getCustomerCards);
router.get('/:cardId', requirePermission(PERM.CATALOG_CUSTOMERS), getCustomerCard);
router.post('/', requirePermission(PERM.CATALOG_CUSTOMERS), createCustomerCard);
router.patch('/:cardId', requirePermission(PERM.CATALOG_CUSTOMERS), updateCustomerCard);
router.delete('/:cardId', requirePermission(PERM.CATALOG_CUSTOMERS), deleteCustomerCard);

// Позиции карточки
router.post('/:cardId/items', requirePermission(PERM.CATALOG_CUSTOMERS), addCardItem);
router.patch('/items/:itemId', requirePermission(PERM.CATALOG_CUSTOMERS), updateCardItem);
router.delete('/items/:itemId', requirePermission(PERM.CATALOG_CUSTOMERS), deleteCardItem);

// Фото позиций
router.post('/items/:itemId/photos', requirePermission(PERM.CATALOG_CUSTOMERS), addItemPhoto);
router.delete('/photos/:photoId', requirePermission(PERM.CATALOG_CUSTOMERS), deleteItemPhoto);

export default router;
