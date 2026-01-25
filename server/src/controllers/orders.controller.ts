import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { ORDER_STATUS } from '../constants';

// Get all orders (with optional filters) - Journal style
export const getOrders = async (req: Request, res: Response) => {
    try {
        const { dateFrom, dateTo, customerId, status, showDisabled } = req.query;

        let where: any = {};

        // Фильтрация по периоду дат
        if (dateFrom || dateTo) {
            where.date = {};
            if (dateFrom) where.date.gte = new Date(String(dateFrom));
            if (dateTo) {
                // Устанавливаем конец дня для корректной фильтрации
                const endDate = new Date(String(dateTo));
                endDate.setHours(23, 59, 59, 999);
                where.date.lte = endDate;
            }
        }

        if (customerId) where.customerId = Number(customerId);
        if (status) where.status = String(status);

        // По умолчанию отключенные заказы не показываются
        if (showDisabled !== 'true') {
            where.isDisabled = false;
        }

        const orders = await prisma.order.findMany({
            where,
            include: {
                customer: true,
                expeditor: true,
                items: {
                    include: { product: true }
                }
            },
            orderBy: { date: 'desc' }
        });
        res.json(orders);
    } catch (error) {
        console.error('getOrders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
};

// Get single order
export const getOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const order = await prisma.order.findUnique({
            where: { id: Number(id) },
            include: {
                customer: true,
                items: { include: { product: true } }
            }
        });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch order' });
    }
};

// Create new order
export const createOrder = async (req: Request, res: Response) => {
    try {
        const { customerId, date, paymentType, items } = req.body;
        // items: [{ productId, quantity, price }]

        // Transaction to create order and items
        const result = await prisma.$transaction(async (tx) => {
            // 1. Calculate totals
            let totalAmount = 0;
            let totalWeight = 0;
            const validItems = [];

            for (const item of items) {
                const amount = item.price * item.quantity;
                totalAmount += amount;
                totalWeight += item.quantity;
                validItems.push({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price,
                    amount: amount,
                    shippedQty: item.shippedQty || 0,
                    sumWithRevaluation: item.sumWithRevaluation || amount,
                    distributionCoef: item.distributionCoef || 0,
                    weightToDistribute: item.weightToDistribute || 0,
                });
            }

            // 2. Create Order
            const order = await tx.order.create({
                data: {
                    customerId: Number(customerId),
                    date: new Date(date),
                    paymentType,
                    totalAmount,
                    totalWeight,
                    status: 'new',
                    items: {
                        create: validItems
                    }
                },
                include: { items: true }
            });
            return order;
        });

        res.status(201).json(result);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Failed to create order' });
    }
};

// Update Order (Full update with items)
export const updateOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { customerId, date, paymentType, status, expeditorId, items } = req.body;

        // If items are provided, do a full update with transaction
        if (items && Array.isArray(items)) {
            const result = await prisma.$transaction(async (tx) => {
                // Delete existing items
                await tx.orderItem.deleteMany({
                    where: { orderId: Number(id) }
                });

                // Calculate totals
                let totalAmount = 0;
                let totalWeight = 0;
                const validItems = [];

                for (const item of items) {
                    const amount = item.price * item.quantity;
                    totalAmount += amount;
                    totalWeight += item.quantity;
                    validItems.push({
                        productId: item.productId,
                        quantity: item.quantity,
                        price: item.price,
                        amount: amount,
                        shippedQty: item.shippedQty || 0,
                        sumWithRevaluation: item.sumWithRevaluation || amount,
                        distributionCoef: item.distributionCoef || 0,
                        weightToDistribute: item.weightToDistribute || 0,
                    });
                }

                // Update order with new items
                const order = await tx.order.update({
                    where: { id: Number(id) },
                    data: {
                        customerId: customerId ? Number(customerId) : undefined,
                        date: date ? new Date(date) : undefined,
                        paymentType,
                        status,
                        expeditorId: expeditorId !== undefined ? expeditorId : undefined,
                        totalAmount,
                        totalWeight,
                        items: {
                            create: validItems
                        }
                    },
                    include: {
                        items: { include: { product: true } },
                        customer: true
                    }
                });
                return order;
            });
            res.json(result);
        } else {
            // Simple update (just status or expeditor)
            let data: any = {};
            if (status) data.status = status;
            if (expeditorId !== undefined) data.expeditorId = expeditorId;
            if (paymentType) data.paymentType = paymentType;

            const order = await prisma.order.update({
                where: { id: Number(id) },
                data
            });
            res.json(order);
        }
    } catch (error) {
        console.error('Update order error:', error);
        res.status(400).json({ error: 'Failed to update order' });
    }
};

// Delete Order
export const deleteOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.order.delete({
            where: { id: Number(id) }
        });
        res.json({ message: 'Order deleted' });
    } catch (error) {
        res.status(400).json({ error: 'Failed to delete order' });
    }
};

// Disable Orders (массовое отключение заказов - soft disable)
export const disableOrders = async (req: Request, res: Response) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No order IDs provided' });
        }

        const result = await prisma.order.updateMany({
            where: { id: { in: ids.map((id: number) => Number(id)) } },
            data: { isDisabled: true }
        });

        res.json({
            success: true,
            disabledCount: result.count,
            message: `${result.count} заказ(ов) отключено`
        });
    } catch (error) {
        console.error('disableOrders error:', error);
        res.status(500).json({ error: 'Failed to disable orders' });
    }
};

// Get Summary data by IDN (for auto-populating Quantity in Order form)
export const getSummaryByIdn = async (req: Request, res: Response) => {
    try {
        const { idn } = req.params;

        // Find all summary entries with this IDN
        const summaryEntries = await prisma.summaryOrderJournal.findMany({
            where: { idn: String(idn) },
            include: {
                product: true,
                customer: true
            }
        });

        if (summaryEntries.length === 0) {
            return res.status(404).json({
                error: 'Не найдено значение в Сводке заказов по IDN = ' + idn,
                idn,
                found: false
            });
        }

        // Aggregate: sum of orderQty per productId
        const aggregated: Record<number, {
            productId: number;
            productName: string;
            totalOrderQty: number;
            price: number;
            category: string | null;
        }> = {};

        for (const entry of summaryEntries) {
            if (entry.productId) {
                if (!aggregated[entry.productId]) {
                    aggregated[entry.productId] = {
                        productId: entry.productId,
                        productName: entry.productFullName,
                        totalOrderQty: 0,
                        price: Number(entry.price),
                        category: entry.category
                    };
                }
                aggregated[entry.productId].totalOrderQty += entry.orderQty;
            }
        }

        const items = Object.values(aggregated);
        const totalQty = items.reduce((sum, item) => sum + item.totalOrderQty, 0);

        res.json({
            idn,
            found: true,
            entriesCount: summaryEntries.length,
            totalQuantity: totalQty,
            items,
            customer: summaryEntries[0].customer,
            customerName: summaryEntries[0].customerName,
            paymentType: summaryEntries[0].paymentType,
            shipDate: summaryEntries[0].shipDate
        });
    } catch (error) {
        console.error('getSummaryByIdn error:', error);
        res.status(500).json({ error: 'Failed to fetch summary by IDN' });
    }
};

// Assign Expeditor to Order
export const assignExpeditor = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { expeditorId, deliveryAddress } = req.body;

        const order = await prisma.order.update({
            where: { id: Number(id) },
            data: {
                expeditorId: expeditorId ? Number(expeditorId) : null,
                deliveryAddress: deliveryAddress || undefined,
                assignedAt: expeditorId ? new Date() : null,
                status: expeditorId ? 'assigned' : 'new',
                deliveryStatus: expeditorId ? 'pending' : 'pending'
            },
            include: {
                customer: true,
                expeditor: true,
                items: { include: { product: true } }
            }
        });

        res.json(order);
    } catch (error) {
        console.error('assignExpeditor error:', error);
        res.status(400).json({ error: 'Failed to assign expeditor' });
    }
};

// Get Orders assigned to specific expeditor (for Expedition view)
export const getExpeditorOrders = async (req: Request, res: Response) => {
    try {
        const { expeditorId } = req.params;
        const { status, dateFrom, dateTo } = req.query;

        let where: any = {
            expeditorId: Number(expeditorId)
        };

        // Filter by delivery status if provided
        if (status) {
            where.deliveryStatus = String(status);
        }
        // Если статус не указан - показываем все статусы (включая delivered)

        // Фильтр по дате
        if (dateFrom || dateTo) {
            where.date = {};
            if (dateFrom) {
                const start = new Date(String(dateFrom));
                start.setHours(0, 0, 0, 0);
                where.date.gte = start;
            }
            if (dateTo) {
                const end = new Date(String(dateTo));
                end.setHours(23, 59, 59, 999);
                where.date.lte = end;
            }
        }

        const orders = await prisma.order.findMany({
            where,
            include: {
                customer: true,
                expeditor: true,
                items: { include: { product: true } },
                attachments: true
            },
            orderBy: { assignedAt: 'desc' }
        });

        res.json(orders);
    } catch (error) {
        console.error('getExpeditorOrders error:', error);
        res.status(500).json({ error: 'Failed to fetch expeditor orders' });
    }
};

// Complete Order with signature
export const completeOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { signatureUrl, signedInvoiceUrl } = req.body;

        const order = await prisma.order.update({
            where: { id: Number(id) },
            data: {
                status: 'delivered',
                deliveryStatus: 'delivered',
                completedAt: new Date(),
                signatureUrl: signatureUrl || undefined,
                signedInvoiceUrl: signedInvoiceUrl || undefined
            },
            include: {
                customer: true,
                expeditor: true,
                items: { include: { product: true } }
            }
        });

        // Create attachment record if signature provided
        if (signatureUrl) {
            await prisma.orderAttachment.create({
                data: {
                    orderId: Number(id),
                    type: 'signature',
                    filename: `signature_order_${id}.png`,
                    url: signatureUrl,
                    mimeType: 'image/png'
                }
            });
        }

        if (signedInvoiceUrl) {
            await prisma.orderAttachment.create({
                data: {
                    orderId: Number(id),
                    type: 'signed_invoice',
                    filename: `invoice_signed_order_${id}.png`,
                    url: signedInvoiceUrl,
                    mimeType: 'image/png'
                }
            });
        }

        res.json(order);
    } catch (error) {
        console.error('completeOrder error:', error);
        res.status(400).json({ error: 'Failed to complete order' });
    }
};

// Get orders pending dispatch (ready for expeditor assignment)
export const getOrdersPendingDispatch = async (req: Request, res: Response) => {
    try {
        const { date, includeAssigned } = req.query;

        const where: Prisma.OrderWhereInput = {
            isDisabled: false,
            status: { in: [ORDER_STATUS.NEW, ORDER_STATUS.PROCESSING] }
        };

        // Если includeAssigned=true, возвращаем все заказы (включая назначенные)
        // Иначе - только без экспедитора
        if (includeAssigned !== 'true') {
            where.expeditorId = null;
        }

        if (date) {
            const startDate = new Date(String(date));
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(startDate);
            endDate.setHours(23, 59, 59, 999);
            where.date = { gte: startDate, lte: endDate };
        }

        const orders = await prisma.order.findMany({
            where,
            include: {
                customer: true,
                expeditor: true,
                items: {
                    include: { product: true }
                }
            },
            orderBy: [
                { customer: { name: 'asc' } },
                { id: 'asc' }
            ]
        });

        res.json(orders);
    } catch (error) {
        console.error('getOrdersPendingDispatch error:', error);
        res.status(500).json({ error: 'Failed to fetch pending dispatch orders' });
    }
};

// Get order attachments
export const getOrderAttachments = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const attachments = await prisma.orderAttachment.findMany({
            where: { orderId: Number(id) },
            orderBy: { createdAt: 'desc' }
        });

        res.json(attachments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch attachments' });
    }
};

// Отправить заказ на доработку (вернуть в сводку)
export const sendOrderToRework = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const username = (req as any).user?.username || 'system';

        const result = await prisma.$transaction(async (tx) => {
            // 1. Найти заказ с позициями
            const order = await tx.order.findUnique({
                where: { id: Number(id) },
                include: {
                    items: { include: { product: true } },
                    customer: true
                }
            });

            if (!order) {
                throw new Error('ORDER_NOT_FOUND');
            }

            // 2. Проверить что заказ не отключён
            if (order.isDisabled) {
                throw new Error('ORDER_DISABLED');
            }

            // 3. Проверить что заказ не в статусе rework уже
            if (order.status === 'rework') {
                throw new Error('ALREADY_IN_REWORK');
            }

            // 4. Генерируем IDN из даты заказа
            const dateObj = new Date(order.date);
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const year = dateObj.getFullYear();
            const idn = `${day}${month}${year}`;

            // 5. Создать записи в SummaryOrderJournal из позиций заказа
            const createdEntries = [];
            for (const item of order.items) {
                const entry = await tx.summaryOrderJournal.create({
                    data: {
                        idn,
                        shipDate: order.date,
                        paymentType: order.paymentType || 'bank',
                        customerId: order.customerId,
                        customerName: order.customer?.name || '',
                        productId: item.productId,
                        productFullName: item.product?.name || '',
                        category: item.product?.category || null,
                        price: Number(item.price),
                        shippedQty: item.shippedQty || 0,
                        orderQty: item.quantity,
                        sumWithRevaluation: Number(item.amount),
                        distributionCoef: Number(item.distributionCoef) || 0,
                        weightToDistribute: Number(item.weightToDistribute) || 0,
                        managerId: null,
                        managerName: '',
                        status: 'draft' // Готово к "Начать сборку"
                    }
                });
                createdEntries.push(entry);
            }

            // 6. Пометить заказ как на доработке
            await tx.order.update({
                where: { id: Number(id) },
                data: {
                    status: 'rework',
                    isDisabled: true // Скрыть из журнала заказов
                }
            });

            // 7. Попытка создать событие аудита
            try {
                if (createdEntries.length > 0) {
                    await tx.summaryOrderEvent.create({
                        data: {
                            summaryOrderId: createdEntries[0].id,
                            eventType: 'ORDER_REWORK',
                            fromStatus: order.status,
                            toStatus: 'draft',
                            createdBy: username,
                            comment: `Заказ #${id} отправлен на доработку`,
                            payload: {
                                orderId: Number(id),
                                itemsCount: createdEntries.length,
                                originalDate: order.date
                            }
                        }
                    });
                }
            } catch (e) {
                console.log('Audit event not created (optional)');
            }

            // DEBUG: Вывод информации о созданных записях
            console.log(`[REWORK] Order #${id} sent to rework:`);
            console.log(`  - Order date: ${order.date}`);
            console.log(`  - IDN: ${idn}`);
            console.log(`  - Entries created: ${createdEntries.length}`);
            createdEntries.forEach(e => console.log(`    Entry #${e.id}: status=${e.status}, product=${e.productFullName}`));

            return {
                orderId: Number(id),
                entriesCreated: createdEntries.length,
                orderDate: order.date
            };
        });

        res.json({
            message: 'Заказ отправлен на доработку',
            ...result
        });
    } catch (error: any) {
        console.error('Send order to rework error:', error);

        if (error.message === 'ORDER_NOT_FOUND') {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        if (error.message === 'ORDER_DISABLED') {
            return res.status(400).json({ error: 'Заказ уже отключён' });
        }
        if (error.message === 'ALREADY_IN_REWORK') {
            return res.status(400).json({ error: 'Заказ уже на доработке' });
        }

        res.status(500).json({ error: 'Ошибка отправки на доработку' });
    }
};
