import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get summary orders with filters and pagination - OPTIMIZED
export const getSummaryOrders = async (req: Request, res: Response) => {
    try {
        const {
            date,
            customerId,
            productId,
            category,
            district,
            managerId,
            status,
            page = '1',
            limit = '100'  // Увеличили лимит для меньшего количества запросов
        } = req.query;

        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {};

        // Date filter
        if (date) {
            const startDate = new Date(date as string);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1);
            where.shipDate = { gte: startDate, lt: endDate };
        }

        // Status filter
        if (status) {
            const statuses = (status as string).split(',');
            if (statuses.length === 1) {
                where.status = statuses[0];
            } else {
                where.status = { in: statuses };
            }
        }

        if (customerId) where.customerId = Number(customerId);
        if (productId) where.productId = Number(productId);
        if (category) where.category = category;
        if (district) where.district = district;
        if (managerId) where.managerId = managerId;

        // Выполняем count и findMany ПАРАЛЛЕЛЬНО
        const [total, orders] = await Promise.all([
            prisma.summaryOrderJournal.count({ where }),
            prisma.summaryOrderJournal.findMany({
                where,
                // SELECT только нужные поля — НЕ тянем связи customer/product
                select: {
                    id: true,
                    idn: true,
                    shipDate: true,
                    paymentType: true,
                    customerId: true,
                    customerName: true,  // Уже есть в записи
                    productId: true,
                    productCode: true,
                    productFullName: true,  // Уже есть в записи
                    category: true,
                    shortNameMorning: true,
                    priceType: true,
                    price: true,
                    shippedQty: true,
                    orderQty: true,
                    sumWithRevaluation: true,
                    distributionCoef: true,
                    weightToDistribute: true,
                    managerId: true,
                    managerName: true,
                    district: true,
                    pointAddress: true,
                    status: true,
                    createdAt: true
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum
            })
        ]);

        res.json({
            data: orders,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + orders.length < total
            }
        });
    } catch (error) {
        console.error('Get summary orders error:', error);
        res.status(500).json({ error: 'Failed to fetch summary orders' });
    }
};

// Get filter options (unique values for dropdowns) - OPTIMIZED
export const getFilterOptions = async (req: Request, res: Response) => {
    try {
        // Выполняем все запросы ПАРАЛЛЕЛЬНО
        const [catData, distData, mgrData] = await Promise.all([
            // Categories
            prisma.summaryOrderJournal.findMany({
                where: { category: { not: null } },
                select: { category: true },
                distinct: ['category']
            }).catch(() => []),

            // Districts - raw query быстрее
            prisma.$queryRaw<{ district: string }[]>`
                SELECT DISTINCT district 
                FROM "SummaryOrderJournal" 
                WHERE district IS NOT NULL 
                LIMIT 100
            `.catch(() => []),

            // Managers
            prisma.summaryOrderJournal.findMany({
                where: { managerId: { not: null } },
                select: { managerId: true, managerName: true },
                distinct: ['managerId']
            }).catch(() => [])
        ]);

        const categories = catData.map(c => c.category).filter(Boolean) as string[];
        const districts = (distData as any[]).map(d => d.district).filter(Boolean);
        const managers = mgrData.filter(m => m.managerId).map(m => ({
            id: m.managerId!,
            name: m.managerName
        }));

        res.json({ categories, districts, managers });
    } catch (error) {
        console.error('Get filter options error:', error);
        res.json({ categories: [], districts: [], managers: [] });
    }
};

// Create summary order entry
export const createSummaryOrder = async (req: Request, res: Response) => {
    try {
        const {
            shipDate,
            paymentType,
            customerId,
            customerName,
            productId,
            productCode,
            productFullName,
            category,
            shortNameMorning,
            priceType,
            price,
            shippedQty,
            orderQty,
            distributionCoef,
            weightToDistribute,
            managerId,
            managerName,
            district,
            pointAddress,
            status
        } = req.body;

        const priceNum = Number(price) || 0;
        const shippedNum = Number(shippedQty) || 0;
        const dateObj = new Date(shipDate);

        // Generate IDN based on date: format DDMMYYYY
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        const idn = `${day}${month}${year}`;

        // Get customer info for district if not provided
        let finalDistrict = district;
        let finalPointAddress = pointAddress;
        if (customerId && !district) {
            const customer = await prisma.customer.findUnique({
                where: { id: Number(customerId) }
            });
            if (customer) {
                // Use districtId as district fallback
                finalDistrict = district || customer.districtId || null;
            }
        }

        const entry = await prisma.summaryOrderJournal.create({
            data: {
                idn,
                shipDate: new Date(shipDate),
                paymentType: paymentType || 'bank', // "Перечисление" по умолчанию
                customerId: customerId ? Number(customerId) : null,
                customerName: customerName || '',
                productId: productId ? Number(productId) : null,
                // productCode: productCode || null, // Uncomment after prisma generate
                productFullName: productFullName || '',
                category,
                shortNameMorning,
                priceType,
                price: priceNum,
                shippedQty: shippedNum,
                orderQty: Number(orderQty) || 0,
                sumWithRevaluation: priceNum * shippedNum,
                distributionCoef: Number(distributionCoef) || 0,
                weightToDistribute: Number(weightToDistribute) || 0,
                managerId,
                managerName,
                // district: finalDistrict, // Uncomment after prisma generate
                // pointAddress: finalPointAddress, // Uncomment after prisma generate
                status: status || 'draft'
            },
            include: { customer: true, product: true }
        });
        res.json(entry);
    } catch (error: any) {
        console.error('Create summary order error:', error);
        res.status(400).json({ error: 'Failed to create summary order', details: error.message });
    }
};

// BULK CREATE - for fast Excel import
export const bulkCreateSummaryOrders = async (req: Request, res: Response) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Items array is required' });
        }

        console.log(`[BULK IMPORT] Starting import of ${items.length} items...`);
        const startTime = Date.now();

        // Prepare all data for batch insert
        const dataToCreate = items.map((item: any) => {
            const priceNum = Number(item.price) || 0;
            const shippedNum = Number(item.shippedQty) || 0;
            const dateObj = new Date(item.shipDate);

            // Generate IDN based on date: format DDMMYYYY
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const year = dateObj.getFullYear();
            const idn = `${day}${month}${year}`;

            return {
                idn,
                shipDate: dateObj,
                paymentType: item.paymentType || 'bank',
                customerId: item.customerId ? Number(item.customerId) : null,
                customerName: item.customerName || '',
                productId: item.productId ? Number(item.productId) : null,
                productFullName: item.productFullName || '',
                category: item.category || null,
                shortNameMorning: item.shortNameMorning || null,
                priceType: item.priceType || null,
                price: priceNum,
                shippedQty: shippedNum,
                orderQty: Number(item.orderQty) || 0,
                sumWithRevaluation: priceNum * shippedNum,
                distributionCoef: Number(item.distributionCoef) || 0,
                weightToDistribute: Number(item.weightToDistribute) || 0,
                managerId: item.managerId || null,
                managerName: item.managerName || '',
                status: item.status || 'draft'
            };
        });

        // Use createMany for maximum performance (single SQL INSERT)
        const result = await prisma.summaryOrderJournal.createMany({
            data: dataToCreate,
            skipDuplicates: false
        });

        const elapsed = Date.now() - startTime;
        console.log(`[BULK IMPORT] Created ${result.count} entries in ${elapsed}ms`);

        res.json({
            message: `Импортировано ${result.count} записей`,
            count: result.count,
            timeMs: elapsed
        });
    } catch (error: any) {
        console.error('Bulk create error:', error);
        res.status(400).json({ error: 'Failed to bulk create', details: error.message });
    }
};

// Update summary order entry
export const updateSummaryOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data: any = { ...req.body };

        // Convert numeric fields
        if (data.price !== undefined) data.price = Number(data.price);
        if (data.shippedQty !== undefined) data.shippedQty = Number(data.shippedQty);
        if (data.orderQty !== undefined) data.orderQty = Number(data.orderQty);
        if (data.distributionCoef !== undefined) data.distributionCoef = Number(data.distributionCoef);
        if (data.weightToDistribute !== undefined) data.weightToDistribute = Number(data.weightToDistribute);

        // Recalculate sumWithRevaluation
        if (data.price !== undefined || data.shippedQty !== undefined) {
            const existing = await prisma.summaryOrderJournal.findUnique({ where: { id: Number(id) } });
            if (existing) {
                const price = data.price !== undefined ? data.price : Number(existing.price);
                const shippedQty = data.shippedQty !== undefined ? data.shippedQty : existing.shippedQty;
                data.sumWithRevaluation = price * shippedQty;
            }
        }

        // Оптимизация: убираем include при update для ускорения
        const entry = await prisma.summaryOrderJournal.update({
            where: { id: Number(id) },
            data
        });
        res.json(entry);
    } catch (error) {
        console.error('Update summary order error:', error);
        res.status(400).json({ error: 'Failed to update summary order' });
    }
};

// Delete summary order entry
export const deleteSummaryOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.summaryOrderJournal.delete({
            where: { id: Number(id) }
        });
        res.json({ message: 'Entry deleted' });
    } catch (error) {
        console.error('Delete summary order error:', error);
        res.status(400).json({ error: 'Failed to delete summary order' });
    }
};

// Sync entries to Orders table
export const syncToOrders = async (req: Request, res: Response) => {
    try {
        const { entryIds } = req.body;
        console.log('[SYNC] Called with entryIds:', entryIds);

        const entries = await prisma.summaryOrderJournal.findMany({
            where: {
                id: { in: entryIds.map((id: number) => Number(id)) }
            },
            include: { customer: true, product: true }
        });

        console.log('[SYNC] Found entries:', entries.length);

        if (entries.length === 0) {
            return res.json({ message: 'No entries found for sync', synced: 0 });
        }

        const results = [];

        for (const entry of entries) {
            if (!entry.customerId || !entry.productId) continue;

            const idn = entry.idn || null;

            let order = await prisma.order.findFirst({
                where: {
                    customerId: entry.customerId,
                    ...(idn ? { idn } : { date: entry.shipDate })
                }
            });

            let orderItemId: number | null = null;

            if (order) {
                const existingItem = await prisma.orderItem.findFirst({
                    where: { orderId: order.id, productId: entry.productId }
                });

                if (existingItem) {
                    await prisma.orderItem.update({
                        where: { id: existingItem.id },
                        data: {
                            quantity: entry.orderQty,
                            shippedQty: entry.shippedQty,
                            price: entry.price,
                            amount: Number(entry.price) * entry.orderQty
                        }
                    });
                    orderItemId = existingItem.id;
                    results.push({ action: 'item_updated', orderId: order.id, orderItemId });
                } else {
                    const newItem = await prisma.orderItem.create({
                        data: {
                            orderId: order.id,
                            productId: entry.productId,
                            quantity: entry.orderQty,
                            price: entry.price,
                            amount: Number(entry.price) * entry.orderQty,
                            shippedQty: entry.shippedQty,
                            sumWithRevaluation: entry.sumWithRevaluation,
                            distributionCoef: entry.distributionCoef,
                            weightToDistribute: entry.weightToDistribute
                        }
                    });
                    orderItemId = newItem.id;

                    await prisma.order.update({
                        where: { id: order.id },
                        data: {
                            totalAmount: { increment: Number(entry.price) * entry.orderQty },
                            totalWeight: { increment: entry.orderQty }
                        }
                    });
                    results.push({ action: 'item_added', orderId: order.id, orderItemId });
                }
            } else {
                order = await prisma.order.create({
                    data: {
                        customerId: entry.customerId,
                        date: entry.shipDate,
                        idn: idn,
                        paymentType: entry.paymentType,
                        status: 'new',
                        totalAmount: Number(entry.price) * entry.orderQty,
                        totalWeight: entry.orderQty,
                        items: {
                            create: {
                                productId: entry.productId,
                                quantity: entry.orderQty,
                                price: entry.price,
                                amount: Number(entry.price) * entry.orderQty,
                                shippedQty: entry.shippedQty,
                                sumWithRevaluation: entry.sumWithRevaluation,
                                distributionCoef: entry.distributionCoef,
                                weightToDistribute: entry.weightToDistribute
                            }
                        }
                    }
                });
                // Получаем созданный OrderItem отдельно
                const createdItem = await prisma.orderItem.findFirst({
                    where: { orderId: order.id, productId: entry.productId }
                });
                orderItemId = createdItem?.id || null;
                results.push({ action: 'order_created', orderId: order.id, orderItemId });
            }

            // Сохраняем связь orderItemId в SummaryOrderJournal для обратной синхронизации
            if (orderItemId) {
                await prisma.summaryOrderJournal.update({
                    where: { id: entry.id },
                    data: {
                        orderItemId,
                        status: 'synced'
                    }
                });
            }
        }

        res.json({ message: 'Sync completed', results });
    } catch (error) {
        console.error('Sync to orders error:', error);
        res.status(500).json({ error: 'Failed to sync to orders' });
    }
};

// Send to rework
export const sendToRework = async (req: Request, res: Response) => {
    try {
        const { idn } = req.body;

        if (!idn) {
            return res.status(400).json({ error: 'IDN is required' });
        }

        const updated = await prisma.summaryOrderJournal.updateMany({
            where: { idn },
            data: { status: 'rework' }
        });

        res.json({ message: 'Sent to rework', count: updated.count });
    } catch (error) {
        console.error('Send to rework error:', error);
        res.status(500).json({ error: 'Failed to send to rework' });
    }
};

// ============================================
// ASSEMBLY MANAGEMENT (Управление сборкой)
// ============================================

// Статусы, запрещающие возврат со сборки
const FINAL_STATUSES = ['synced', 'packed', 'shipped', 'closed'];

// Начать сборку - POST /api/summary-orders/:id/assembly/start
export const startAssembly = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const username = (req as any).user?.username || 'system';

        const entry = await prisma.summaryOrderJournal.findUnique({
            where: { id: Number(id) }
        });

        if (!entry) {
            return res.status(404).json({ error: 'Запись не найдена' });
        }

        // Проверка: уже в сборке?
        if (entry.status === 'forming') {
            return res.status(400).json({ error: 'Запись уже находится в сборке' });
        }

        // Проверка: запрещённый статус?
        if (FINAL_STATUSES.includes(entry.status)) {
            return res.status(400).json({ error: `Невозможно отправить в сборку из статуса "${entry.status}"` });
        }

        // Транзакция: обновление записи + создание события
        const result = await prisma.$transaction(async (tx) => {
            // Обновляем запись
            const updated = await tx.summaryOrderJournal.update({
                where: { id: Number(id) },
                data: {
                    preAssemblyStatus: entry.status,  // Сохраняем предыдущий статус
                    status: 'forming',
                    assemblyStartedAt: new Date(),
                    assemblyStartedBy: username,
                    // Сбрасываем поля возврата
                    assemblyReturnedAt: null,
                    assemblyReturnedBy: null,
                    assemblyReturnReason: null,
                    assemblyReturnComment: null
                }
            });

            // Создаём событие в истории
            await tx.summaryOrderEvent.create({
                data: {
                    summaryOrderId: Number(id),
                    eventType: 'ASSEMBLY_START',
                    fromStatus: entry.status,
                    toStatus: 'forming',
                    createdBy: username
                }
            });

            return updated;
        });

        res.json({
            message: 'Отправлено в сборку',
            entry: result
        });
    } catch (error) {
        console.error('Start assembly error:', error);
        res.status(500).json({ error: 'Ошибка отправки в сборку' });
    }
};

// Вернуть со сборки - POST /api/summary-orders/:id/assembly/return
export const returnFromAssembly = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason, comment } = req.body;
        const username = (req as any).user?.username || 'system';

        const entry = await prisma.summaryOrderJournal.findUnique({
            where: { id: Number(id) }
        });

        if (!entry) {
            return res.status(404).json({ error: 'Запись не найдена' });
        }

        // Проверка: в сборке?
        if (entry.status !== 'forming') {
            return res.status(400).json({
                error: 'Запись не находится в сборке',
                currentStatus: entry.status
            });
        }

        // Определяем статус для возврата
        // Вариант A: возвращаем в preAssemblyStatus
        // Вариант B (fallback): возвращаем в 'draft'
        const returnToStatus = entry.preAssemblyStatus || 'draft';

        // Транзакция: обновление записи + создание события
        const result = await prisma.$transaction(async (tx) => {
            // Обновляем запись
            const updated = await tx.summaryOrderJournal.update({
                where: { id: Number(id) },
                data: {
                    status: returnToStatus,
                    assemblyReturnedAt: new Date(),
                    assemblyReturnedBy: username,
                    assemblyReturnReason: reason || null,
                    assemblyReturnComment: comment || null,
                    // Не сбрасываем preAssemblyStatus - может пригодиться для истории
                }
            });

            // Создаём событие в истории
            await tx.summaryOrderEvent.create({
                data: {
                    summaryOrderId: Number(id),
                    eventType: 'ASSEMBLY_RETURN',
                    fromStatus: 'forming',
                    toStatus: returnToStatus,
                    reason: reason || null,
                    comment: comment || null,
                    createdBy: username,
                    payload: {
                        assemblyStartedAt: entry.assemblyStartedAt,
                        assemblyStartedBy: entry.assemblyStartedBy,
                        returnedAt: new Date().toISOString()
                    }
                }
            });

            return updated;
        });

        res.json({
            message: 'Возвращено со сборки',
            previousStatus: 'forming',
            newStatus: returnToStatus,
            entry: result
        });
    } catch (error) {
        console.error('Return from assembly error:', error);
        res.status(500).json({ error: 'Ошибка возврата со сборки' });
    }
};

// Массовый возврат со сборки - POST /api/summary-orders/assembly/return-batch
export const returnFromAssemblyBatch = async (req: Request, res: Response) => {
    try {
        const { ids, reason, comment } = req.body;
        const username = (req as any).user?.username || 'system';

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'IDs обязательны' });
        }

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        for (const id of ids) {
            try {
                const entry = await prisma.summaryOrderJournal.findUnique({
                    where: { id: Number(id) }
                });

                if (!entry) {
                    results.failed++;
                    results.errors.push(`ID ${id}: не найден`);
                    continue;
                }

                if (entry.status !== 'forming') {
                    results.failed++;
                    results.errors.push(`ID ${id}: не в сборке (статус: ${entry.status})`);
                    continue;
                }

                const returnToStatus = entry.preAssemblyStatus || 'draft';

                await prisma.$transaction(async (tx) => {
                    await tx.summaryOrderJournal.update({
                        where: { id: Number(id) },
                        data: {
                            status: returnToStatus,
                            assemblyReturnedAt: new Date(),
                            assemblyReturnedBy: username,
                            assemblyReturnReason: reason || null,
                            assemblyReturnComment: comment || null
                        }
                    });

                    await tx.summaryOrderEvent.create({
                        data: {
                            summaryOrderId: Number(id),
                            eventType: 'ASSEMBLY_RETURN',
                            fromStatus: 'forming',
                            toStatus: returnToStatus,
                            reason: reason || null,
                            comment: comment || null,
                            createdBy: username
                        }
                    });
                });

                results.success++;
            } catch (err) {
                results.failed++;
                results.errors.push(`ID ${id}: ошибка обработки`);
            }
        }

        res.json({
            message: `Обработано: ${results.success} успешно, ${results.failed} ошибок`,
            ...results
        });
    } catch (error) {
        console.error('Batch return from assembly error:', error);
        res.status(500).json({ error: 'Ошибка массового возврата' });
    }
};

// Получить историю событий записи - GET /api/summary-orders/:id/events
export const getOrderEvents = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const events = await prisma.summaryOrderEvent.findMany({
            where: { summaryOrderId: Number(id) },
            orderBy: { createdAt: 'desc' }
        });

        res.json(events);
    } catch (error) {
        console.error('Get order events error:', error);
        res.status(500).json({ error: 'Ошибка получения истории' });
    }
};
