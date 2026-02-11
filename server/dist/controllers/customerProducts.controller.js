"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCustomersWithProductCounts = exports.reorderCustomerProducts = exports.removeCustomerProduct = exports.addCustomerProductsBulk = exports.addCustomerProduct = exports.getCustomerProducts = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// ============================================
// CUSTOMER PRODUCTS - Персональный каталог товаров клиента
// ============================================
/**
 * Получить список товаров клиента
 * GET /api/customers/:customerId/products
 */
const getCustomerProducts = async (req, res) => {
    try {
        const customerId = parseInt(String(req.params.customerId));
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
                        status: true,
                        subcategoryId: true,
                        subcategory: { select: { id: true, name: true, isActive: true } },
                    }
                },
                _count: {
                    select: {
                        variants: { where: { isActive: true } },
                    },
                },
            },
            orderBy: { sortOrder: 'asc' }
        });
        res.json(customerProducts);
    }
    catch (error) {
        console.error('getCustomerProducts error:', error);
        res.status(500).json({ error: 'Failed to get customer products' });
    }
};
exports.getCustomerProducts = getCustomerProducts;
/**
 * Добавить товар в каталог клиента
 * POST /api/customers/:customerId/products
 * Body: { productId: number, sortOrder?: number }
 */
const addCustomerProduct = async (req, res) => {
    try {
        const customerId = parseInt(String(req.params.customerId));
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
    }
    catch (error) {
        console.error('addCustomerProduct error:', error);
        res.status(500).json({ error: 'Failed to add customer product' });
    }
};
exports.addCustomerProduct = addCustomerProduct;
/**
 * Добавить несколько товаров в каталог клиента
 * POST /api/customers/:customerId/products/bulk
 * Body: { productIds: number[] }
 */
const addCustomerProductsBulk = async (req, res) => {
    try {
        const customerId = parseInt(String(req.params.customerId));
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
        const createData = productIds.map((productId) => ({
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
    }
    catch (error) {
        console.error('addCustomerProductsBulk error:', error);
        res.status(500).json({ error: 'Failed to add customer products' });
    }
};
exports.addCustomerProductsBulk = addCustomerProductsBulk;
/**
 * Удалить товар из каталога клиента
 * DELETE /api/customers/:customerId/products/:productId
 */
const removeCustomerProduct = async (req, res) => {
    try {
        const customerId = parseInt(String(req.params.customerId));
        const productId = parseInt(String(req.params.productId));
        if (isNaN(customerId) || isNaN(productId)) {
            return res.status(400).json({ error: 'Invalid customer or product ID' });
        }
        // Удаляем связь
        await prisma.customerProduct.deleteMany({
            where: { customerId, productId }
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('removeCustomerProduct error:', error);
        res.status(500).json({ error: 'Failed to remove customer product' });
    }
};
exports.removeCustomerProduct = removeCustomerProduct;
/**
 * Обновить порядок товаров клиента
 * PUT /api/customers/:customerId/products/reorder
 * Body: { productIds: number[] } - массив productId в нужном порядке
 */
const reorderCustomerProducts = async (req, res) => {
    try {
        const customerId = parseInt(String(req.params.customerId));
        const { productIds } = req.body;
        if (isNaN(customerId)) {
            return res.status(400).json({ error: 'Invalid customer ID' });
        }
        if (!productIds || !Array.isArray(productIds)) {
            return res.status(400).json({ error: 'productIds array is required' });
        }
        // Обновляем sortOrder для каждого товара
        const updatePromises = productIds.map((productId, index) => prisma.customerProduct.updateMany({
            where: { customerId, productId },
            data: { sortOrder: index }
        }));
        await Promise.all(updatePromises);
        res.json({ success: true });
    }
    catch (error) {
        console.error('reorderCustomerProducts error:', error);
        res.status(500).json({ error: 'Failed to reorder customer products' });
    }
};
exports.reorderCustomerProducts = reorderCustomerProducts;
/**
 * Получить клиентов с количеством товаров
 * GET /api/customers/with-product-counts
 */
const getCustomersWithProductCounts = async (req, res) => {
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
    }
    catch (error) {
        console.error('getCustomersWithProductCounts error:', error);
        res.status(500).json({ error: 'Failed to get customers' });
    }
};
exports.getCustomersWithProductCounts = getCustomersWithProductCounts;
