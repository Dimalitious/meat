import { Router } from 'express';
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
import { authenticateToken as auth } from '../middleware/auth.middleware';

const router = Router();

// Карточки клиента
router.get('/customer/:customerId', auth, getCustomerCards);
router.get('/:cardId', auth, getCustomerCard);
router.post('/', auth, createCustomerCard);
router.patch('/:cardId', auth, updateCustomerCard);
router.delete('/:cardId', auth, deleteCustomerCard);

// Позиции карточки
router.post('/:cardId/items', auth, addCardItem);
router.patch('/items/:itemId', auth, updateCardItem);
router.delete('/items/:itemId', auth, deleteCardItem);

// Фото позиций
router.post('/items/:itemId/photos', auth, addItemPhoto);
router.delete('/photos/:photoId', auth, deleteItemPhoto);

export default router;
