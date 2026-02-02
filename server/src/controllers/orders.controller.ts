import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { ORDER_STATUS, isValidTransition, getStatusDisplayName } from '../constants';
import { getDateRangeForTashkent, formatIdnFromDate } from '../utils/date.utils';

// Get all orders (with optional filters) - Journal style
export const getOrders = async (req: Request, res: Response) => {
    try {
        const { dateFrom, dateTo, customerId, status, showDisabled } = req.query;

        let where: any = {};

        // Фильтрация по периоду дат (в таймзоне Asia/Tashkent)
        if (dateFrom || dateTo) {
            where.date = {};
            if (dateFrom) {
                const { start } = getDateRangeForTashkent(String(dateFrom));
                where.date.gte = start;
            }
            if (dateTo) {
                const { end } = getDateRangeForTashkent(String(dateTo));
                where.date.lt = end;
            }
        }

        if (customerId) where.customerId = Number(customerId);
        if (status) where.status = String(status);

        // По умолчанию отключенные заказы не показываются
        // isDisabled: { not: true } покажет записи где isDisabled = false или null
        if (showDisabled !== 'true') {
            where.isDisabled = { not: true };
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

// Update Order (Full update with items + обратная синхронизация в SummaryOrderJournal)
export const updateOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { customerId, date, paymentType, status, expeditorId, items } = req.body;

        // If items are provided, do a full update with transaction
        if (items && Array.isArray(items)) {
            const result = await prisma.$transaction(async (tx) => {
                // 1. Получаем старые OrderItem с их связями на SummaryOrderJournal
                const oldItems = await tx.orderItem.findMany({
                    where: { orderId: Number(id) },
                    include: { summaryEntry: true }
                });

                // Маппинг: productId -> SummaryOrderJournal id (для восстановления связи)
                const productToSummaryMap = new Map<number, number>();
                for (const oldItem of oldItems) {
                    if (oldItem.summaryEntry) {
                        productToSummaryMap.set(oldItem.productId, oldItem.summaryEntry.id);
                    }
                }

                // 2. Удаляем старые items (связь orderItemId станет null)
                await tx.orderItem.deleteMany({
                    where: { orderId: Number(id) }
                });

                // 3. Calculate totals и создаём новые items
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

                // 4. Update order with new items
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

                // 5. Восстанавливаем связь и обновляем SummaryOrderJournal
                for (const newItem of order.items) {
                    const summaryId = productToSummaryMap.get(newItem.productId);
                    if (summaryId) {
                        // Обновляем SummaryOrderJournal: восстанавливаем связь + синхронизируем данные
                        await tx.summaryOrderJournal.update({
                            where: { id: summaryId },
                            data: {
                                orderItemId: newItem.id,
                                // Синхронизация данных Order -> SummaryEntry
                                orderQty: newItem.quantity,
                                shippedQty: newItem.shippedQty,
                                price: newItem.price,
                                sumWithRevaluation: newItem.sumWithRevaluation,
                                productId: newItem.productId,
                                productFullName: newItem.product?.name || '',
                                productCode: newItem.product?.code || null,
                                customerId: order.customerId,
                                customerName: order.customer?.name || ''
                            }
                        });
                    }
                }

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

// ============================================
// FSM: Назначить экспедитора (DISTRIBUTING → LOADED)
// ============================================
export const assignExpeditor = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { expeditorId, deliveryAddress, dispatchDay } = req.body;

        // Получаем текущий заказ для проверки статуса
        const currentOrder = await prisma.order.findUnique({
            where: { id: Number(id) }
        });

        if (!currentOrder) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }

        // FSM: Назначение экспедитора разрешено только из статуса DISTRIBUTING
        if (currentOrder.status !== ORDER_STATUS.DISTRIBUTING) {
            return res.status(400).json({
                error: `Невозможно назначить экспедитора из статуса "${getStatusDisplayName(currentOrder.status)}". Требуется статус "Распределяется"`
            });
        }

        if (!expeditorId) {
            return res.status(400).json({ error: 'Не указан ID экспедитора' });
        }

        // Парсинг dispatchDay (бизнес-дата в Asia/Tashkent)
        let dispatchDayDate: Date | null = null;
        if (dispatchDay) {
            const [y, m, d] = String(dispatchDay).slice(0, 10).split('-').map(Number);
            dispatchDayDate = new Date(Date.UTC(y, m - 1, d));
        }

        const order = await prisma.order.update({
            where: { id: Number(id) },
            data: {
                expeditorId: Number(expeditorId),
                deliveryAddress: deliveryAddress || undefined,
                dispatchDay: dispatchDayDate,
                assignedAt: new Date(),
                loadedAt: new Date(),
                status: ORDER_STATUS.LOADED,
                deliveryStatus: 'pending'
            },
            include: {
                customer: true,
                expeditor: true,
                items: { include: { product: true } }
            }
        });

        console.log(`[FSM] Order #${id}: DISTRIBUTING → LOADED, expeditor=${expeditorId}, dispatchDay=${dispatchDay}`);
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
            expeditorId: Number(expeditorId),
            // Only show orders that have been assigned (passed through Distribution)
            status: { in: ['assigned', 'in_delivery', 'delivered'] }
        };

        // Filter by delivery status if provided
        if (status) {
            where.deliveryStatus = String(status);
        }
        // Если статус не указан - показываем все статусы (включая delivered)

        // Фильтр по дате (в таймзоне Asia/Tashkent)
        if (dateFrom || dateTo) {
            where.date = {};
            if (dateFrom) {
                const { start } = getDateRangeForTashkent(String(dateFrom));
                where.date.gte = start;
            }
            if (dateTo) {
                const { end } = getDateRangeForTashkent(String(dateTo));
                where.date.lt = end;
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

// ============================================
// FSM: Завершить заказ (LOADED → SHIPPED)
// ============================================
export const completeOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { signatureUrl, signedInvoiceUrl } = req.body;
        const currentUserId = (req as any).user?.id;

        // Получаем текущий заказ для проверки
        const currentOrder = await prisma.order.findUnique({
            where: { id: Number(id) },
            include: { expeditor: true }
        });

        if (!currentOrder) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }

        // FSM: Закрытие разрешено только из статуса LOADED
        if (currentOrder.status !== ORDER_STATUS.LOADED) {
            return res.status(400).json({
                error: `Невозможно закрыть заказ из статуса "${getStatusDisplayName(currentOrder.status)}". Требуется статус "Погружен"`
            });
        }

        // Проверка: только назначенный экспедитор может закрыть заказ
        // (пропускаем если currentUserId не определен - для обратной совместимости)
        if (currentUserId && currentOrder.expeditor?.userId) {
            if (currentOrder.expeditor.userId !== currentUserId) {
                return res.status(403).json({ error: 'Только назначенный экспедитор может закрыть заказ' });
            }
        }

        const order = await prisma.order.update({
            where: { id: Number(id) },
            data: {
                status: ORDER_STATUS.SHIPPED,
                deliveryStatus: 'delivered',
                shippedAt: new Date(),
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

        console.log(`[FSM] Order #${id}: LOADED → SHIPPED`);
        res.json(order);
    } catch (error) {
        console.error('completeOrder error:', error);
        res.status(400).json({ error: 'Failed to complete order' });
    }
};

// ============================================
// FSM: Начать сборку заказа (NEW → IN_ASSEMBLY)
// ============================================
export const startAssemblyOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const username = (req as any).user?.username || 'system';

        const currentOrder = await prisma.order.findUnique({
            where: { id: Number(id) }
        });

        if (!currentOrder) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }

        // FSM: Начать сборку можно только из статуса NEW
        if (currentOrder.status !== ORDER_STATUS.NEW) {
            return res.status(400).json({
                error: `Невозможно начать сборку из статуса "${getStatusDisplayName(currentOrder.status)}". Требуется статус "Новый"`
            });
        }

        const order = await prisma.order.update({
            where: { id: Number(id) },
            data: {
                status: ORDER_STATUS.IN_ASSEMBLY,
                assemblyStartedAt: new Date(),
                assemblyStartedBy: username
            },
            include: {
                customer: true,
                items: { include: { product: true } }
            }
        });

        console.log(`[FSM] Order #${id}: NEW → IN_ASSEMBLY by ${username}`);
        res.json({
            message: 'Сборка начата',
            order
        });
    } catch (error) {
        console.error('startAssemblyOrder error:', error);
        res.status(500).json({ error: 'Ошибка начала сборки' });
    }
};

// ============================================
// FSM: Подтвердить сборку (IN_ASSEMBLY → DISTRIBUTING)
// ============================================
export const confirmAssemblyOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const username = (req as any).user?.username || 'system';

        const currentOrder = await prisma.order.findUnique({
            where: { id: Number(id) }
        });

        if (!currentOrder) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }

        // FSM: Подтвердить сборку можно только из статуса IN_ASSEMBLY
        if (currentOrder.status !== ORDER_STATUS.IN_ASSEMBLY) {
            return res.status(400).json({
                error: `Невозможно подтвердить сборку из статуса "${getStatusDisplayName(currentOrder.status)}". Требуется статус "На сборке"`
            });
        }

        const order = await prisma.order.update({
            where: { id: Number(id) },
            data: {
                status: ORDER_STATUS.DISTRIBUTING,
                assemblyConfirmedAt: new Date(),
                assemblyConfirmedBy: username
            },
            include: {
                customer: true,
                items: { include: { product: true } }
            }
        });

        console.log(`[FSM] Order #${id}: IN_ASSEMBLY → DISTRIBUTING by ${username}`);
        res.json({
            message: 'Сборка подтверждена, заказ передан на распределение',
            order
        });
    } catch (error) {
        console.error('confirmAssemblyOrder error:', error);
        res.status(500).json({ error: 'Ошибка подтверждения сборки' });
    }
};
// Get orders pending dispatch (ready for expeditor assignment)
// По ТЗ: показывает заказы в статусе DISTRIBUTING для назначения экспедитора
export const getOrdersPendingDispatch = async (req: Request, res: Response) => {
    try {
        const { date, includeAssigned } = req.query;

        const where: Prisma.OrderWhereInput = {
            isDisabled: false,
            // FSM: в распределение попадают только заказы со статусом DISTRIBUTING
            // Если includeAssigned=true, также показываем LOADED (уже назначенные)
            status: includeAssigned === 'true'
                ? { in: [ORDER_STATUS.DISTRIBUTING, ORDER_STATUS.LOADED] }
                : ORDER_STATUS.DISTRIBUTING
        };

        // Если includeAssigned !== true, показываем только без экспедитора
        if (includeAssigned !== 'true') {
            where.expeditorId = null;
        }

        // Фильтрация по бизнес-дате распределения (dispatchDay)
        if (date) {
            const raw = String(date);
            const day = raw.slice(0, 10); // YYYY-MM-DD
            const [y, m, d] = day.split('-').map(Number);

            if (!y || !m || !d) {
                return res.status(400).json({ error: `Invalid date format: ${raw}` });
            }

            // dispatchDay хранится как DATE (без времени), поэтому просто сравниваем
            const dispatchDate = new Date(Date.UTC(y, m - 1, d));
            where.dispatchDay = dispatchDate;
        }

        // ============ DIAGNOSTIC LOGGING ============
        console.log('\n========== [pending-dispatch] DEBUG ==========');
        console.log('Query params:', { date: req.query.date, includeAssigned: req.query.includeAssigned });
        console.log('WHERE clause:', JSON.stringify(where, null, 2));
        // ============ END DEBUG ============

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

        console.log(`[pending-dispatch] RESULT: ${orders.length} orders found with all filters`);
        console.log('==============================================\n');

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

            // 4. Генерируем IDN из даты заказа (в таймзоне Asia/Tashkent)
            const idn = formatIdnFromDate(order.date);

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
