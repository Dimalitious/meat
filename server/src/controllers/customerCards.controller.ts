import { Request, Response } from 'express';
import { prisma } from '../db';

// Получить все карточки клиента
export const getCustomerCards = async (req: Request, res: Response) => {
    try {
        const { customerId } = req.params;
        const cards = await prisma.customerCard.findMany({
            where: { customerId: Number(customerId) },
            include: {
                items: {
                    include: {
                        product: true,
                        photos: { orderBy: { sortOrder: 'asc' } }
                    },
                    orderBy: { sortOrder: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(cards);
    } catch (error) {
        console.error('Failed to get customer cards:', error);
        res.status(500).json({ error: 'Failed to get customer cards' });
    }
};

// Получить одну карточку
export const getCustomerCard = async (req: Request, res: Response) => {
    try {
        const { cardId } = req.params;
        const card = await prisma.customerCard.findUnique({
            where: { id: Number(cardId) },
            include: {
                customer: true,
                items: {
                    include: {
                        product: true,
                        photos: { orderBy: { sortOrder: 'asc' } }
                    },
                    orderBy: { sortOrder: 'asc' }
                }
            }
        });
        if (!card) {
            return res.status(404).json({ error: 'Card not found' });
        }
        res.json(card);
    } catch (error) {
        console.error('Failed to get customer card:', error);
        res.status(500).json({ error: 'Failed to get customer card' });
    }
};

// Создать карточку
export const createCustomerCard = async (req: Request, res: Response) => {
    try {
        const { customerId, name } = req.body;
        const card = await prisma.customerCard.create({
            data: {
                customerId: Number(customerId),
                name: name || 'Основной ассортимент'
            },
            include: {
                customer: true,
                items: {
                    include: {
                        product: true,
                        photos: true
                    }
                }
            }
        });
        res.status(201).json(card);
    } catch (error) {
        console.error('Failed to create customer card:', error);
        res.status(400).json({ error: 'Failed to create customer card' });
    }
};

// Обновить карточку
export const updateCustomerCard = async (req: Request, res: Response) => {
    try {
        const { cardId } = req.params;
        const { name, isActive } = req.body;
        const card = await prisma.customerCard.update({
            where: { id: Number(cardId) },
            data: { name, isActive },
            include: {
                items: {
                    include: {
                        product: true,
                        photos: true
                    }
                }
            }
        });
        res.json(card);
    } catch (error) {
        console.error('Failed to update customer card:', error);
        res.status(400).json({ error: 'Failed to update customer card' });
    }
};

// Удалить карточку
export const deleteCustomerCard = async (req: Request, res: Response) => {
    try {
        const { cardId } = req.params;
        await prisma.customerCard.delete({ where: { id: Number(cardId) } });
        res.json({ message: 'Deleted' });
    } catch (error) {
        console.error('Failed to delete customer card:', error);
        res.status(400).json({ error: 'Failed to delete customer card' });
    }
};

// Добавить позицию в карточку
export const addCardItem = async (req: Request, res: Response) => {
    try {
        const { cardId } = req.params;
        const { productId, description, sortOrder } = req.body;

        const item = await prisma.customerCardItem.create({
            data: {
                cardId: Number(cardId),
                productId: Number(productId),
                description: description || null,
                sortOrder: sortOrder || 0
            },
            include: {
                product: true,
                photos: true
            }
        });
        res.status(201).json(item);
    } catch (error) {
        console.error('Failed to add card item:', error);
        res.status(400).json({ error: 'Failed to add card item' });
    }
};

// Обновить позицию карточки
export const updateCardItem = async (req: Request, res: Response) => {
    try {
        const { itemId } = req.params;
        const { description, sortOrder } = req.body;

        const item = await prisma.customerCardItem.update({
            where: { id: Number(itemId) },
            data: { description, sortOrder },
            include: {
                product: true,
                photos: { orderBy: { sortOrder: 'asc' } }
            }
        });
        res.json(item);
    } catch (error) {
        console.error('Failed to update card item:', error);
        res.status(400).json({ error: 'Failed to update card item' });
    }
};

// Удалить позицию из карточки
export const deleteCardItem = async (req: Request, res: Response) => {
    try {
        const { itemId } = req.params;
        await prisma.customerCardItem.delete({ where: { id: Number(itemId) } });
        res.json({ message: 'Deleted' });
    } catch (error) {
        console.error('Failed to delete card item:', error);
        res.status(400).json({ error: 'Failed to delete card item' });
    }
};

// Добавить фото к позиции (до 3 фото)
export const addItemPhoto = async (req: Request, res: Response) => {
    try {
        const { itemId } = req.params;
        const { url } = req.body;

        // Проверяем количество фото
        const existingPhotos = await prisma.customerCardItemPhoto.count({
            where: { itemId: Number(itemId) }
        });

        if (existingPhotos >= 3) {
            return res.status(400).json({ error: 'Maximum 3 photos per item' });
        }

        const photo = await prisma.customerCardItemPhoto.create({
            data: {
                itemId: Number(itemId),
                url,
                sortOrder: existingPhotos
            }
        });
        res.status(201).json(photo);
    } catch (error) {
        console.error('Failed to add item photo:', error);
        res.status(400).json({ error: 'Failed to add item photo' });
    }
};

// Удалить фото
export const deleteItemPhoto = async (req: Request, res: Response) => {
    try {
        const { photoId } = req.params;
        await prisma.customerCardItemPhoto.delete({ where: { id: Number(photoId) } });
        res.json({ message: 'Deleted' });
    } catch (error) {
        console.error('Failed to delete item photo:', error);
        res.status(400).json({ error: 'Failed to delete item photo' });
    }
};
