import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// ЗАКУПОЧНЫЙ ПРАЙС
// ============================================

// Получить список закупочных прайсов (журнал)
export const getPurchasePriceLists = async (req: Request, res: Response) => {
    try {
        const { dateFrom, dateTo, supplierId } = req.query;

        const where: any = {};
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
            if (dateTo) where.createdAt.lte = new Date(dateTo as string);
        }
        if (supplierId) {
            where.supplierId = Number(supplierId);
        }

        const lists = await prisma.purchasePriceList.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                supplier: true,
                _count: { select: { items: true } }
            }
        });

        res.json(lists);
    } catch (error) {
        console.error('Get purchase price lists error:', error);
        res.status(500).json({ error: 'Failed to get purchase price lists' });
    }
};

// Получить текущий прайс поставщика
export const getCurrentPurchasePrice = async (req: Request, res: Response) => {
    try {
        const supplierId = Number(req.params.supplierId);

        let priceList = await prisma.purchasePriceList.findFirst({
            where: { supplierId, isCurrent: true },
            include: {
                supplier: true,
                items: {
                    include: { product: true },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        res.json(priceList);
    } catch (error) {
        console.error('Get current purchase price error:', error);
        res.status(500).json({ error: 'Failed to get current purchase price' });
    }
};

// Получить прайс по ID
export const getPurchasePriceById = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        const priceList = await prisma.purchasePriceList.findUnique({
            where: { id },
            include: {
                supplier: true,
                items: {
                    include: { product: true },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        res.json(priceList);
    } catch (error) {
        console.error('Get purchase price by id error:', error);
        res.status(500).json({ error: 'Failed to get purchase price' });
    }
};

// Создать новый закупочный прайс
export const createPurchasePrice = async (req: Request, res: Response) => {
    try {
        const { supplierId, title } = req.body;
        const user = (req as any).user?.username || 'system';

        const priceList = await prisma.purchasePriceList.create({
            data: {
                supplierId,
                title,
                status: 'draft',
                createdBy: user,
                updatedBy: user
            },
            include: {
                supplier: true,
                items: { include: { product: true } }
            }
        });

        res.json(priceList);
    } catch (error) {
        console.error('Create purchase price error:', error);
        res.status(500).json({ error: 'Failed to create purchase price' });
    }
};

// Сохранить закупочный прайс
export const savePurchasePrice = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const { title, items, makeCurrent } = req.body;
        const user = (req as any).user?.username || 'system';

        await prisma.$transaction(async (tx) => {
            // Если делаем текущим - снять флаг с других
            if (makeCurrent) {
                const current = await tx.purchasePriceList.findUnique({ where: { id } });
                if (current) {
                    await tx.purchasePriceList.updateMany({
                        where: { supplierId: current.supplierId, isCurrent: true },
                        data: { isCurrent: false }
                    });
                }
            }

            // Обновить шапку
            await tx.purchasePriceList.update({
                where: { id },
                data: {
                    title,
                    status: 'saved',
                    isCurrent: makeCurrent || false,
                    updatedBy: user
                }
            });

            // Пересоздать строки
            if (items && Array.isArray(items)) {
                await tx.purchasePriceItem.deleteMany({ where: { priceListId: id } });

                for (const item of items) {
                    await tx.purchasePriceItem.create({
                        data: {
                            priceListId: id,
                            productId: item.productId,
                            purchasePrice: item.purchasePrice,
                            rowDate: item.rowDate ? new Date(item.rowDate) : new Date(),
                            updatedBy: user
                        }
                    });
                }
            }
        });

        const updated = await prisma.purchasePriceList.findUnique({
            where: { id },
            include: {
                supplier: true,
                items: { include: { product: true } }
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('Save purchase price error:', error);
        res.status(500).json({ error: 'Failed to save purchase price' });
    }
};

// ============================================
// ПРОДАЖНЫЙ ПРАЙС
// ============================================

// Получить список продажных прайсов (журнал)
export const getSalesPriceLists = async (req: Request, res: Response) => {
    try {
        const { dateFrom, dateTo, listType, customerId } = req.query;

        const where: any = {};
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
            if (dateTo) where.createdAt.lte = new Date(dateTo as string);
        }
        if (listType) where.listType = listType as string;
        if (customerId) where.customerId = Number(customerId);

        const lists = await prisma.salesPriceList.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                customer: true,
                _count: { select: { items: true } }
            }
        });

        res.json(lists);
    } catch (error) {
        console.error('Get sales price lists error:', error);
        res.status(500).json({ error: 'Failed to get sales price lists' });
    }
};

// Получить текущий общий прайс
export const getCurrentGeneralPrice = async (req: Request, res: Response) => {
    try {
        const priceList = await prisma.salesPriceList.findFirst({
            where: { listType: 'GENERAL', isCurrent: true },
            include: {
                items: {
                    include: { product: true },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        res.json(priceList);
    } catch (error) {
        console.error('Get current general price error:', error);
        res.status(500).json({ error: 'Failed to get current general price' });
    }
};

// Получить текущий прайс заказчика
export const getCurrentCustomerPrice = async (req: Request, res: Response) => {
    try {
        const customerId = Number(req.params.customerId);

        const priceList = await prisma.salesPriceList.findFirst({
            where: { listType: 'CUSTOMER', customerId, isCurrent: true },
            include: {
                customer: true,
                items: {
                    include: { product: true },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        res.json(priceList);
    } catch (error) {
        console.error('Get current customer price error:', error);
        res.status(500).json({ error: 'Failed to get current customer price' });
    }
};

// Получить прайс по ID
export const getSalesPriceById = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        const priceList = await prisma.salesPriceList.findUnique({
            where: { id },
            include: {
                customer: true,
                items: {
                    include: { product: true },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        res.json(priceList);
    } catch (error) {
        console.error('Get sales price by id error:', error);
        res.status(500).json({ error: 'Failed to get sales price' });
    }
};

// Создать новый продажный прайс
export const createSalesPrice = async (req: Request, res: Response) => {
    try {
        const { listType, customerId, title } = req.body;
        const user = (req as any).user?.username || 'system';

        // Валидация
        if (listType === 'CUSTOMER' && !customerId) {
            return res.status(400).json({ error: 'Customer ID required for CUSTOMER price list' });
        }

        const priceList = await prisma.salesPriceList.create({
            data: {
                listType,
                customerId: listType === 'CUSTOMER' ? customerId : null,
                title,
                status: 'draft',
                createdBy: user,
                updatedBy: user
            },
            include: {
                customer: true,
                items: { include: { product: true } }
            }
        });

        res.json(priceList);
    } catch (error) {
        console.error('Create sales price error:', error);
        res.status(500).json({ error: 'Failed to create sales price' });
    }
};

// Сохранить продажный прайс
export const saveSalesPrice = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const { title, items, makeCurrent } = req.body;
        const user = (req as any).user?.username || 'system';

        await prisma.$transaction(async (tx) => {
            const current = await tx.salesPriceList.findUnique({ where: { id } });
            if (!current) throw new Error('Price list not found');

            // Если делаем текущим - снять флаг с других того же типа
            if (makeCurrent) {
                if (current.listType === 'GENERAL') {
                    await tx.salesPriceList.updateMany({
                        where: { listType: 'GENERAL', isCurrent: true },
                        data: { isCurrent: false }
                    });
                } else {
                    await tx.salesPriceList.updateMany({
                        where: { listType: 'CUSTOMER', customerId: current.customerId, isCurrent: true },
                        data: { isCurrent: false }
                    });
                }
            }

            // Обновить шапку
            await tx.salesPriceList.update({
                where: { id },
                data: {
                    title,
                    status: 'saved',
                    isCurrent: makeCurrent || false,
                    updatedBy: user
                }
            });

            // Пересоздать строки
            if (items && Array.isArray(items)) {
                await tx.salesPriceItem.deleteMany({ where: { priceListId: id } });

                for (const item of items) {
                    await tx.salesPriceItem.create({
                        data: {
                            priceListId: id,
                            productId: item.productId,
                            salePrice: item.salePrice,
                            rowDate: item.rowDate ? new Date(item.rowDate) : new Date(),
                            updatedBy: user
                        }
                    });
                }
            }
        });

        const updated = await prisma.salesPriceList.findUnique({
            where: { id },
            include: {
                customer: true,
                items: { include: { product: true } }
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('Save sales price error:', error);
        res.status(500).json({ error: 'Failed to save sales price' });
    }
};

// ============================================
// МЕХАНИЗМ ПОЛУЧЕНИЯ ЦЕНЫ (бизнес-логика)
// ============================================

// Получить цену продажи для заказчика и товара
export const resolveSalePrice = async (req: Request, res: Response) => {
    try {
        const { customerId, productId } = req.params;

        // 1. Проверить прайс заказчика
        const customerPrice = await prisma.salesPriceItem.findFirst({
            where: {
                product: { id: Number(productId) },
                priceList: {
                    listType: 'CUSTOMER',
                    customerId: Number(customerId),
                    isCurrent: true
                }
            }
        });

        if (customerPrice) {
            return res.json({
                source: 'CUSTOMER',
                price: customerPrice.salePrice,
                productId: Number(productId)
            });
        }

        // 2. Проверить общий прайс
        const generalPrice = await prisma.salesPriceItem.findFirst({
            where: {
                product: { id: Number(productId) },
                priceList: {
                    listType: 'GENERAL',
                    isCurrent: true
                }
            }
        });

        if (generalPrice) {
            return res.json({
                source: 'GENERAL',
                price: generalPrice.salePrice,
                productId: Number(productId)
            });
        }

        // 3. Цена не найдена
        res.json({
            source: null,
            price: null,
            productId: Number(productId),
            message: 'Price not found'
        });
    } catch (error) {
        console.error('Resolve sale price error:', error);
        res.status(500).json({ error: 'Failed to resolve sale price' });
    }
};

// Получить все цены для заказчика (для формы заказа)
export const resolveAllPricesForCustomer = async (req: Request, res: Response) => {
    try {
        const customerId = Number(req.params.customerId);

        // Получить все цены из текущего прайса заказчика
        const customerPrices = await prisma.salesPriceItem.findMany({
            where: {
                priceList: {
                    listType: 'CUSTOMER',
                    customerId,
                    isCurrent: true
                }
            },
            include: { product: true }
        });

        // Получить все цены из общего прайса
        const generalPrices = await prisma.salesPriceItem.findMany({
            where: {
                priceList: {
                    listType: 'GENERAL',
                    isCurrent: true
                }
            },
            include: { product: true }
        });

        // Объединить с приоритетом заказчика
        const customerProductIds = new Set(customerPrices.map(p => p.productId));
        const mergedPrices = [
            ...customerPrices.map(p => ({ ...p, source: 'CUSTOMER' })),
            ...generalPrices
                .filter(p => !customerProductIds.has(p.productId))
                .map(p => ({ ...p, source: 'GENERAL' }))
        ];

        res.json(mergedPrices);
    } catch (error) {
        console.error('Resolve all prices error:', error);
        res.status(500).json({ error: 'Failed to resolve prices' });
    }
};
