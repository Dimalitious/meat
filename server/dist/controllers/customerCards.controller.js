"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteItemPhoto = exports.addItemPhoto = exports.deleteCardItem = exports.updateCardItem = exports.addCardItem = exports.deleteCustomerCard = exports.updateCustomerCard = exports.createCustomerCard = exports.getCustomerCard = exports.getCustomerCards = void 0;
const db_1 = require("../db");
// Получить все карточки клиента
const getCustomerCards = async (req, res) => {
    try {
        const { customerId } = req.params;
        const cards = await db_1.prisma.customerCard.findMany({
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
    }
    catch (error) {
        console.error('Failed to get customer cards:', error);
        res.status(500).json({ error: 'Failed to get customer cards' });
    }
};
exports.getCustomerCards = getCustomerCards;
// Получить одну карточку
const getCustomerCard = async (req, res) => {
    try {
        const { cardId } = req.params;
        const card = await db_1.prisma.customerCard.findUnique({
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
    }
    catch (error) {
        console.error('Failed to get customer card:', error);
        res.status(500).json({ error: 'Failed to get customer card' });
    }
};
exports.getCustomerCard = getCustomerCard;
// Создать карточку
const createCustomerCard = async (req, res) => {
    try {
        const { customerId, name } = req.body;
        const card = await db_1.prisma.customerCard.create({
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
    }
    catch (error) {
        console.error('Failed to create customer card:', error);
        res.status(400).json({ error: 'Failed to create customer card' });
    }
};
exports.createCustomerCard = createCustomerCard;
// Обновить карточку
const updateCustomerCard = async (req, res) => {
    try {
        const { cardId } = req.params;
        const { name, isActive } = req.body;
        const card = await db_1.prisma.customerCard.update({
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
    }
    catch (error) {
        console.error('Failed to update customer card:', error);
        res.status(400).json({ error: 'Failed to update customer card' });
    }
};
exports.updateCustomerCard = updateCustomerCard;
// Удалить карточку
const deleteCustomerCard = async (req, res) => {
    try {
        const { cardId } = req.params;
        await db_1.prisma.customerCard.delete({ where: { id: Number(cardId) } });
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        console.error('Failed to delete customer card:', error);
        res.status(400).json({ error: 'Failed to delete customer card' });
    }
};
exports.deleteCustomerCard = deleteCustomerCard;
// Добавить позицию в карточку (upsert - обновить если существует, создать если нет)
const addCardItem = async (req, res) => {
    try {
        const { cardId } = req.params;
        const { productId, description, sortOrder } = req.body;
        const item = await db_1.prisma.customerCardItem.upsert({
            where: {
                cardId_productId: {
                    cardId: Number(cardId),
                    productId: Number(productId)
                }
            },
            update: {
                description: description || null,
                sortOrder: sortOrder || 0
            },
            create: {
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
    }
    catch (error) {
        console.error('Failed to add card item:', error);
        res.status(400).json({ error: 'Failed to add card item' });
    }
};
exports.addCardItem = addCardItem;
// Обновить позицию карточки
const updateCardItem = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { description, sortOrder } = req.body;
        const item = await db_1.prisma.customerCardItem.update({
            where: { id: Number(itemId) },
            data: { description, sortOrder },
            include: {
                product: true,
                photos: { orderBy: { sortOrder: 'asc' } }
            }
        });
        res.json(item);
    }
    catch (error) {
        console.error('Failed to update card item:', error);
        res.status(400).json({ error: 'Failed to update card item' });
    }
};
exports.updateCardItem = updateCardItem;
// Удалить позицию из карточки
const deleteCardItem = async (req, res) => {
    try {
        const { itemId } = req.params;
        await db_1.prisma.customerCardItem.delete({ where: { id: Number(itemId) } });
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        console.error('Failed to delete card item:', error);
        res.status(400).json({ error: 'Failed to delete card item' });
    }
};
exports.deleteCardItem = deleteCardItem;
// Добавить фото к позиции (до 3 фото)
const addItemPhoto = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { url } = req.body;
        // Проверяем количество фото
        const existingPhotos = await db_1.prisma.customerCardItemPhoto.count({
            where: { itemId: Number(itemId) }
        });
        if (existingPhotos >= 3) {
            return res.status(400).json({ error: 'Maximum 3 photos per item' });
        }
        const photo = await db_1.prisma.customerCardItemPhoto.create({
            data: {
                itemId: Number(itemId),
                url,
                sortOrder: existingPhotos
            }
        });
        res.status(201).json(photo);
    }
    catch (error) {
        console.error('Failed to add item photo:', error);
        res.status(400).json({ error: 'Failed to add item photo' });
    }
};
exports.addItemPhoto = addItemPhoto;
// Удалить фото
const deleteItemPhoto = async (req, res) => {
    try {
        const { photoId } = req.params;
        await db_1.prisma.customerCardItemPhoto.delete({ where: { id: Number(photoId) } });
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        console.error('Failed to delete item photo:', error);
        res.status(400).json({ error: 'Failed to delete item photo' });
    }
};
exports.deleteItemPhoto = deleteItemPhoto;
