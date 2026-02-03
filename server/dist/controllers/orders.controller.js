"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOrderToRework = exports.getOrderAttachments = exports.getOrdersPendingDispatch = exports.completeOrder = exports.getExpeditorOrders = exports.assignExpeditor = exports.getSummaryByIdn = exports.disableOrders = exports.deleteOrder = exports.updateOrder = exports.createOrder = exports.getOrder = exports.getOrders = void 0;
const db_1 = require("../db");
const constants_1 = require("../constants");
const date_utils_1 = require("../utils/date.utils");
// Get all orders (with optional filters) - Journal style
const getOrders = async (req, res) => {
    try {
        const { dateFrom, dateTo, customerId, status, showDisabled } = req.query;
        let where = {};
        // Фильтрация по периоду дат (в таймзоне Asia/Tashkent)
        if (dateFrom || dateTo) {
            where.date = {};
            if (dateFrom) {
                const { start } = (0, date_utils_1.getDateRangeForTashkent)(String(dateFrom));
                where.date.gte = start;
            }
            if (dateTo) {
                const { end } = (0, date_utils_1.getDateRangeForTashkent)(String(dateTo));
                where.date.lt = end;
            }
        }
        if (customerId)
            where.customerId = Number(customerId);
        if (status)
            where.status = String(status);
        // По умолчанию отключенные заказы не показываются
        // isDisabled: { not: true } покажет записи где isDisabled = false или null
        if (showDisabled !== 'true') {
            where.isDisabled = { not: true };
        }
        const orders = await db_1.prisma.order.findMany({
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
    }
    catch (error) {
        console.error('getOrders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
};
exports.getOrders = getOrders;
// Get single order
const getOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await db_1.prisma.order.findUnique({
            where: { id: Number(id) },
            include: {
                customer: true,
                items: { include: { product: true } }
            }
        });
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        res.json(order);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch order' });
    }
};
exports.getOrder = getOrder;
// Create new order
const createOrder = async (req, res) => {
    try {
        const { customerId, date, paymentType, items } = req.body;
        // items: [{ productId, quantity, price }]
        // Transaction to create order and items
        const result = await db_1.prisma.$transaction(async (tx) => {
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
    }
    catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Failed to create order' });
    }
};
exports.createOrder = createOrder;
// Update Order (Full update with items + обратная синхронизация в SummaryOrderJournal)
const updateOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { customerId, date, paymentType, status, expeditorId, items } = req.body;
        // If items are provided, do a full update with transaction
        if (items && Array.isArray(items)) {
            const result = await db_1.prisma.$transaction(async (tx) => {
                // 1. Получаем старые OrderItem с их связями на SummaryOrderJournal
                const oldItems = await tx.orderItem.findMany({
                    where: { orderId: Number(id) },
                    include: { summaryEntry: true }
                });
                // Маппинг: productId -> SummaryOrderJournal id (для восстановления связи)
                const productToSummaryMap = new Map();
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
        }
        else {
            // Simple update (just status or expeditor)
            let data = {};
            if (status)
                data.status = status;
            if (expeditorId !== undefined)
                data.expeditorId = expeditorId;
            if (paymentType)
                data.paymentType = paymentType;
            const order = await db_1.prisma.order.update({
                where: { id: Number(id) },
                data
            });
            res.json(order);
        }
    }
    catch (error) {
        console.error('Update order error:', error);
        res.status(400).json({ error: 'Failed to update order' });
    }
};
exports.updateOrder = updateOrder;
// Delete Order
const deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;
        await db_1.prisma.order.delete({
            where: { id: Number(id) }
        });
        res.json({ message: 'Order deleted' });
    }
    catch (error) {
        res.status(400).json({ error: 'Failed to delete order' });
    }
};
exports.deleteOrder = deleteOrder;
// Disable Orders (массовое отключение заказов - soft disable)
const disableOrders = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No order IDs provided' });
        }
        const result = await db_1.prisma.order.updateMany({
            where: { id: { in: ids.map((id) => Number(id)) } },
            data: { isDisabled: true }
        });
        res.json({
            success: true,
            disabledCount: result.count,
            message: `${result.count} заказ(ов) отключено`
        });
    }
    catch (error) {
        console.error('disableOrders error:', error);
        res.status(500).json({ error: 'Failed to disable orders' });
    }
};
exports.disableOrders = disableOrders;
// Get Summary data by IDN (for auto-populating Quantity in Order form)
const getSummaryByIdn = async (req, res) => {
    try {
        const { idn } = req.params;
        // Find all summary entries with this IDN
        const summaryEntries = await db_1.prisma.summaryOrderJournal.findMany({
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
        const aggregated = {};
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
    }
    catch (error) {
        console.error('getSummaryByIdn error:', error);
        res.status(500).json({ error: 'Failed to fetch summary by IDN' });
    }
};
exports.getSummaryByIdn = getSummaryByIdn;
// Assign Expeditor to Order
const assignExpeditor = async (req, res) => {
    try {
        const { id } = req.params;
        const { expeditorId, deliveryAddress } = req.body;
        const order = await db_1.prisma.order.update({
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
    }
    catch (error) {
        console.error('assignExpeditor error:', error);
        res.status(400).json({ error: 'Failed to assign expeditor' });
    }
};
exports.assignExpeditor = assignExpeditor;
// Get Orders assigned to specific expeditor (for Expedition view)
const getExpeditorOrders = async (req, res) => {
    try {
        const { expeditorId } = req.params;
        const { status, dateFrom, dateTo } = req.query;
        let where = {
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
                const { start } = (0, date_utils_1.getDateRangeForTashkent)(String(dateFrom));
                where.date.gte = start;
            }
            if (dateTo) {
                const { end } = (0, date_utils_1.getDateRangeForTashkent)(String(dateTo));
                where.date.lt = end;
            }
        }
        const orders = await db_1.prisma.order.findMany({
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
    }
    catch (error) {
        console.error('getExpeditorOrders error:', error);
        res.status(500).json({ error: 'Failed to fetch expeditor orders' });
    }
};
exports.getExpeditorOrders = getExpeditorOrders;
// Complete Order with signature
const completeOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { signatureUrl, signedInvoiceUrl } = req.body;
        const order = await db_1.prisma.order.update({
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
            await db_1.prisma.orderAttachment.create({
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
            await db_1.prisma.orderAttachment.create({
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
    }
    catch (error) {
        console.error('completeOrder error:', error);
        res.status(400).json({ error: 'Failed to complete order' });
    }
};
exports.completeOrder = completeOrder;
// Get orders pending dispatch (ready for expeditor assignment)
const getOrdersPendingDispatch = async (req, res) => {
    try {
        const { date, includeAssigned } = req.query;
        const where = {
            isDisabled: false,
            status: { in: [constants_1.ORDER_STATUS.NEW, constants_1.ORDER_STATUS.PROCESSING, constants_1.ORDER_STATUS.ASSIGNED] }
        };
        // Если includeAssigned=true, возвращаем все заказы (включая назначенные)
        // Иначе - только без экспедитора
        if (includeAssigned !== 'true') {
            where.expeditorId = null;
        }
        let startUtc = null;
        let endUtc = null;
        if (date) {
            const raw = String(date);
            const day = raw.slice(0, 10); // YYYY-MM-DD (handles both plain date and ISO)
            const [y, m, d] = day.split('-').map(Number);
            if (!y || !m || !d) {
                return res.status(400).json({ error: `Invalid date format: ${raw}` });
            }
            // Asia/Tashkent = UTC+5 (без DST)
            const offsetHours = 5;
            startUtc = new Date(Date.UTC(y, m - 1, d, -offsetHours, 0, 0, 0));
            endUtc = new Date(Date.UTC(y, m - 1, d + 1, -offsetHours, 0, 0, 0));
            where.date = { gte: startUtc, lt: endUtc };
        }
        // ============ DIAGNOSTIC LOGGING ============
        console.log('\n========== [pending-dispatch] DEBUG ==========');
        console.log('Query params:', { date: req.query.date, includeAssigned: req.query.includeAssigned });
        console.log('Date range (UTC):', {
            start: startUtc?.toISOString(),
            end: endUtc?.toISOString()
        });
        console.log('WHERE clause:', JSON.stringify(where, null, 2));
        // Debug: Check ALL orders in this date range (ignoring other filters)
        if (startUtc && endUtc) {
            const allOrdersInRange = await db_1.prisma.order.findMany({
                where: { date: { gte: startUtc, lt: endUtc } },
                select: {
                    id: true,
                    date: true,
                    status: true,
                    isDisabled: true,
                    expeditorId: true
                }
            });
            console.log(`All orders in date range (no filters): ${allOrdersInRange.length}`);
            if (allOrdersInRange.length > 0) {
                console.log('Sample orders:', allOrdersInRange.slice(0, 5).map(o => ({
                    id: o.id,
                    date: o.date.toISOString(),
                    status: o.status,
                    isDisabled: o.isDisabled,
                    expeditorId: o.expeditorId
                })));
            }
        }
        // ============ END DEBUG ============
        const orders = await db_1.prisma.order.findMany({
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
    }
    catch (error) {
        console.error('getOrdersPendingDispatch error:', error);
        res.status(500).json({ error: 'Failed to fetch pending dispatch orders' });
    }
};
exports.getOrdersPendingDispatch = getOrdersPendingDispatch;
// Get order attachments
const getOrderAttachments = async (req, res) => {
    try {
        const { id } = req.params;
        const attachments = await db_1.prisma.orderAttachment.findMany({
            where: { orderId: Number(id) },
            orderBy: { createdAt: 'desc' }
        });
        res.json(attachments);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch attachments' });
    }
};
exports.getOrderAttachments = getOrderAttachments;
// Отправить заказ на доработку (вернуть в сводку)
const sendOrderToRework = async (req, res) => {
    try {
        const { id } = req.params;
        const username = req.user?.username || 'system';
        const result = await db_1.prisma.$transaction(async (tx) => {
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
            const idn = (0, date_utils_1.formatIdnFromDate)(order.date);
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
            }
            catch (e) {
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
    }
    catch (error) {
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
exports.sendOrderToRework = sendOrderToRework;
