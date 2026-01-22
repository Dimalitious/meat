import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// CUSTOMER PRODUCTS - Персональный каталог товаров клиента
// ============================================

/**
 * Получить список товаров клиента
 * GET /api/customers/:customerId/products
 */
export const getCustomerProducts = async (req: Request, res: Response) => {
    try {
        const customerId = parseInt(req.params.customerId);

        if (isNaN(customerId)) {
            return res.status(400).json({ error: 'Invalid customer ID' });
        }

        const customerProducts = await prisma.customerProduct.findMany({
            where: { customerId },
            include: {
                product: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        priceListName: true,
                        category: true,
                        status: true
                    }
                }
            },
            orderBy: { sortOrder: 'asc' }
        });

        res.json(customerProducts);
    } catch (error) {
        console.error('getCustomerProducts error:', error);
        res.status(500).json({ error: 'Failed to get customer products' });
    }
};

/**
 * Добавить товар в каталог клиента
 * POST /api/customers/:customerId/products
 * Body: { productId: number, sortOrder?: number }
 */
export const addCustomerProduct = async (req: Request, res: Response) => {
    try {
        const customerId = parseInt(req.params.customerId);
        const { productId, sortOrder = 0 } = req.body;

        if (isNaN(customerId)) {
            return res.status(400).json({ error: 'Invalid customer ID' });
        }

        if (!productId) {
            return res.status(400).json({ error: 'productId is required' });
        }

        // Проверяем существование клиента
        const customer = await prisma.customer.findUnique({
            where: { id: customerId }
        });
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Проверяем существование товара
        const product = await prisma.product.findUnique({
            where: { id: productId }
        });
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Создаём связь (upsert для избежания дубликатов)
        const customerProduct = await prisma.customerProduct.upsert({
            where: {
                customerId_productId: { customerId, productId }
            },
            update: { sortOrder },
            create: {
                customerId,
                productId,
                sortOrder
            },
            include: {
                product: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        priceListName: true,
                        category: true,
                        status: true
                    }
                }
            }
        });

        res.status(201).json(customerProduct);
    } catch (error) {
        console.error('addCustomerProduct error:', error);
        res.status(500).json({ error: 'Failed to add customer product' });
    }
};

/**
 * Добавить несколько товаров в каталог клиента
 * POST /api/customers/:customerId/products/bulk
 * Body: { productIds: number[] }
 */
export const addCustomerProductsBulk = async (req: Request, res: Response) => {
    try {
        const customerId = parseInt(req.params.customerId);
        const { productIds } = req.body;

        if (isNaN(customerId)) {
            return res.status(400).json({ error: 'Invalid customer ID' });
        }

        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({ error: 'productIds array is required' });
        }

        // Проверяем существование клиента
        const customer = await prisma.customer.findUnique({
            where: { id: customerId }
        });
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Получаем текущий максимальный sortOrder
        const maxSortOrder = await prisma.customerProduct.aggregate({
            where: { customerId },
            _max: { sortOrder: true }
        });
        let nextSortOrder = (maxSortOrder._max.sortOrder ?? 0) + 1;

        // Создаём связи (skipDuplicates игнорирует уже существующие)
        const createData = productIds.map((productId: number) => ({
            customerId,
            productId,
            sortOrder: nextSortOrder++
        }));

        await prisma.customerProduct.createMany({
            data: createData,
            skipDuplicates: true
        });

        // Возвращаем обновлённый список
        const customerProducts = await prisma.customerProduct.findMany({
            where: { customerId },
            include: {
                product: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        priceListName: true,
                        category: true,
                        status: true
                    }
                }
            },
            orderBy: { sortOrder: 'asc' }
        });

        res.json(customerProducts);
    } catch (error) {
        console.error('addCustomerProductsBulk error:', error);
        res.status(500).json({ error: 'Failed to add customer products' });
    }
};

/**
 * Удалить товар из каталога клиента
 * DELETE /api/customers/:customerId/products/:productId
 */
export const removeCustomerProduct = async (req: Request, res: Response) => {
    try {
        const customerId = parseInt(req.params.customerId);
        const productId = parseInt(req.params.productId);

        if (isNaN(customerId) || isNaN(productId)) {
            return res.status(400).json({ error: 'Invalid customer or product ID' });
        }

        // Удаляем связь
        await prisma.customerProduct.deleteMany({
            where: { customerId, productId }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('removeCustomerProduct error:', error);
        res.status(500).json({ error: 'Failed to remove customer product' });
    }
};

/**
 * Обновить порядок товаров клиента
 * PUT /api/customers/:customerId/products/reorder
 * Body: { productIds: number[] } - массив productId в нужном порядке
 */
export const reorderCustomerProducts = async (req: Request, res: Response) => {
    try {
        const customerId = parseInt(req.params.customerId);
        const { productIds } = req.body;

        if (isNaN(customerId)) {
            return res.status(400).json({ error: 'Invalid customer ID' });
        }

        if (!productIds || !Array.isArray(productIds)) {
            return res.status(400).json({ error: 'productIds array is required' });
        }

        // Обновляем sortOrder для каждого товара
        const updatePromises = productIds.map((productId: number, index: number) =>
            prisma.customerProduct.updateMany({
                where: { customerId, productId },
                data: { sortOrder: index }
            })
        );

        await Promise.all(updatePromises);

        res.json({ success: true });
    } catch (error) {
        console.error('reorderCustomerProducts error:', error);
        res.status(500).json({ error: 'Failed to reorder customer products' });
    }
};

/**
 * Получить клиентов с количеством товаров
 * GET /api/customers/with-product-counts
 */
export const getCustomersWithProductCounts = async (req: Request, res: Response) => {
    try {
        const customers = await prisma.customer.findMany({
            include: {
                district: true,
                manager: true,
                _count: {
                    select: { customerProducts: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        res.json(customers);
    } catch (error) {
        console.error('getCustomersWithProductCounts error:', error);
        res.status(500).json({ error: 'Failed to get customers' });
    }
};
