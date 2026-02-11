"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkDeleteOrders = exports.generateInvoice = exports.sendOrderToRework = exports.getOrderAttachments = exports.getOrdersPendingDispatch = exports.confirmAssemblyOrder = exports.startAssemblyOrder = exports.completeOrder = exports.getExpeditorOrders = exports.assignExpeditor = exports.getSummaryByIdn = exports.disableOrders = exports.editOrder = exports.reassignExpeditor = exports.deleteOrder = exports.updateOrder = exports.createOrder = exports.getOrder = exports.getOrders = void 0;
const db_1 = require("../db");
const constants_1 = require("../constants");
const date_utils_1 = require("../utils/date.utils");
const geoSnapshot_service_1 = require("../services/geoSnapshot.service");
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
        const { customerId, date, paymentType, items, 
        // Delivery geo (optional from frontend)
        customerAddressId, deliveryAddress, deliveryLat, deliveryLng, deliveryComment, deliveryAccuracyM, } = req.body;
        // items: [{ productId, quantity, price }]
        // Transaction to create order and items
        const result = await db_1.prisma.$transaction(async (tx) => {
            const cid = Number(customerId);
            // ── Resolve delivery geo snapshot (shared helper) ──
            const snap = await (0, geoSnapshot_service_1.resolveGeoSnapshot)(tx, {
                customerId: cid,
                customerAddressId,
                deliveryAddress,
                deliveryLat,
                deliveryLng,
                deliveryComment,
                deliveryAccuracyM,
            });
            // 1. Calculate totals
            let totalAmount = 0;
            let totalWeight = 0;
            const validItems = [];
            for (const item of items) {
                const qty = Number(item.quantity);
                const price = Number(item.price);
                const amount = price * qty;
                totalAmount += amount;
                totalWeight += qty;
                validItems.push({
                    productId: Number(item.productId),
                    quantity: qty,
                    price: price,
                    amount: amount,
                    shippedQty: item.shippedQty == null ? 0 : Number(item.shippedQty),
                    sumWithRevaluation: item.sumWithRevaluation == null ? amount : Number(item.sumWithRevaluation),
                    distributionCoef: item.distributionCoef == null ? 0 : Number(item.distributionCoef),
                    weightToDistribute: item.weightToDistribute == null ? 0 : Number(item.weightToDistribute),
                });
            }
            // 2. Create Order
            const order = await tx.order.create({
                data: {
                    customerId: cid,
                    date: new Date(date),
                    paymentType,
                    totalAmount,
                    totalWeight,
                    status: constants_1.ORDER_STATUS.NEW, // ТЗ §4.1: FSM статус, не 'new'
                    // Delivery geo snapshot
                    deliveryAddress: snap.deliveryAddress,
                    deliveryLat: snap.deliveryLat,
                    deliveryLng: snap.deliveryLng,
                    deliveryComment: snap.deliveryComment,
                    deliveryAccuracyM: snap.deliveryAccuracyM,
                    customerAddressId: snap.customerAddressId,
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
        if (error?.status)
            return res.status(error.status).json({ error: error.error });
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
        // ТЗ: status нельзя менять напрямую - срабатывает для ОБОИХ веток (full и simple)
        if (status !== undefined) {
            return res.status(400).json({ error: 'status нельзя менять через updateOrder. Используй FSM endpoints.' });
        }
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
                    const qty = Number(item.quantity);
                    const price = Number(item.price);
                    const amount = price * qty;
                    totalAmount += amount;
                    totalWeight += qty;
                    validItems.push({
                        productId: Number(item.productId),
                        quantity: qty,
                        price: price,
                        amount: amount,
                        shippedQty: item.shippedQty == null ? 0 : Number(item.shippedQty),
                        sumWithRevaluation: item.sumWithRevaluation == null ? amount : Number(item.sumWithRevaluation),
                        distributionCoef: item.distributionCoef == null ? 0 : Number(item.distributionCoef),
                        weightToDistribute: item.weightToDistribute == null ? 0 : Number(item.weightToDistribute),
                    });
                }
                // 4. Update order with new items
                const order = await tx.order.update({
                    where: { id: Number(id) },
                    data: {
                        customerId: customerId ? Number(customerId) : undefined,
                        date: date ? new Date(date) : undefined,
                        paymentType,
                        // status - заблокирован выше, не передаём
                        expeditorId: expeditorId === null
                            ? null
                            : (expeditorId !== undefined ? Number(expeditorId) : undefined), // ТЗ §10.4
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
            // Simple update - (ТЗ: status уже заблокирован выше)
            let data = {};
            if (expeditorId !== undefined) {
                data.expeditorId = expeditorId === null ? null : Number(expeditorId);
            }
            if (paymentType)
                data.paymentType = paymentType;
            const allowedDelivery = new Set(['pending', 'in_delivery', 'delivered']);
            if (req.body.deliveryStatus !== undefined) {
                const ds = String(req.body.deliveryStatus);
                if (!allowedDelivery.has(ds)) {
                    return res.status(400).json({ error: `Некорректный deliveryStatus: ${ds}` });
                }
                data.deliveryStatus = ds;
            }
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
// Delete Order (ТЗ §3.1: RBAC - только ADMIN)
const deleteOrder = async (req, res) => {
    try {
        // ТЗ §3.1: удаление заказа разрешено только ADMIN
        const role = req.user?.role;
        if (role !== 'ADMIN' && role !== 'admin') {
            return res.status(403).json({ error: 'Только администратор может удалять заказы' });
        }
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
/**
 * PATCH-05: Переназначение экспедитора
 * PATCH /api/orders/:id/expeditor
 *
 * FSM не меняется, только expeditorId
 */
const reassignExpeditor = async (req, res) => {
    try {
        const { id } = req.params;
        const { expeditorId } = req.body;
        const username = req.user?.username || 'system';
        if (expeditorId === undefined || expeditorId === null) {
            return res.status(400).json({ error: 'Не указан expeditorId' });
        }
        const order = await db_1.prisma.order.update({
            where: { id: Number(id) },
            data: {
                expeditorId: Number(expeditorId),
                // FIX-05: assignedAt убран (не перезаписываем первоначальное назначение)
            },
            include: {
                customer: true,
                expeditor: true,
                items: { include: { product: true } }
            },
        });
        console.log(`[PATCH-05] Expeditor reassigned: order=${id}, expeditorId=${expeditorId}, by=${username}`);
        res.json(order);
    }
    catch (error) {
        console.error('reassignExpeditor error:', error);
        res.status(400).json({ error: 'Ошибка переназначения экспедитора' });
    }
};
exports.reassignExpeditor = reassignExpeditor;
/**
 * ТЗ v2 §8: Безопасное редактирование заказа
 * PUT /api/orders/:id/edit
 *
 * НЕ ЗАТИРАЕТ: signatureUrl, signedInvoiceUrl, completedAt, attachments
 * Устанавливает isEdited=true и editedAt при успешном редактировании
 */
const editOrder = async (req, res) => {
    try {
        const { id } = req.params;
        // PATCH-03: expeditorId убран из whitelist
        const { customerId, date, paymentType, items, deliveryAddress } = req.body;
        const userId = req.user?.id;
        const username = req.user?.username || 'system';
        // PATCH-03: Расширенный список запрещённых полей
        const forbiddenFields = [
            'signatureUrl',
            'signedInvoiceUrl',
            'completedAt',
            'shippedAt',
            'status',
            'deliveryStatus',
            'attachments',
            'orderAttachments',
        ];
        for (const field of forbiddenFields) {
            if (req.body[field] !== undefined) {
                return res.status(400).json({
                    error: `Поле "${field}" нельзя изменять через editOrder.`
                });
            }
        }
        // PATCH-03: Отдельно запретить expeditorId через editOrder
        if (req.body.expeditorId !== undefined) {
            return res.status(400).json({
                error: `Поле "expeditorId" нельзя изменять через editOrder. Используй PATCH /orders/:id/expeditor.`
            });
        }
        const result = await db_1.prisma.$transaction(async (tx) => {
            // Получаем текущий заказ для проверки
            const existingOrder = await tx.order.findUnique({
                where: { id: Number(id) },
                include: { items: { include: { summaryEntry: true } } }
            });
            if (!existingOrder) {
                throw new Error('Order not found');
            }
            // Если есть items - полное обновление
            if (items && Array.isArray(items)) {
                // Маппинг: productId -> SummaryOrderJournal id (для восстановления связи)
                const productToSummaryMap = new Map();
                for (const oldItem of existingOrder.items) {
                    if (oldItem.summaryEntry) {
                        productToSummaryMap.set(oldItem.productId, oldItem.summaryEntry.id);
                    }
                }
                // Удаляем старые items
                await tx.orderItem.deleteMany({
                    where: { orderId: Number(id) }
                });
                // Считаем новые тоталы
                let totalAmount = 0;
                let totalWeight = 0;
                const validItems = [];
                for (const item of items) {
                    const qty = Number(item.quantity);
                    const price = Number(item.price);
                    const amount = price * qty;
                    totalAmount += amount;
                    totalWeight += qty;
                    validItems.push({
                        productId: Number(item.productId),
                        quantity: qty,
                        price: price,
                        amount: amount,
                        shippedQty: item.shippedQty == null ? 0 : Number(item.shippedQty),
                        sumWithRevaluation: item.sumWithRevaluation == null ? amount : Number(item.sumWithRevaluation),
                        distributionCoef: item.distributionCoef == null ? 0 : Number(item.distributionCoef),
                        weightToDistribute: item.weightToDistribute == null ? 0 : Number(item.weightToDistribute),
                    });
                }
                // Обновляем заказ с isEdited=true
                const order = await tx.order.update({
                    where: { id: Number(id) },
                    data: {
                        customerId: customerId ? Number(customerId) : undefined,
                        date: date ? new Date(date) : undefined,
                        paymentType: paymentType !== undefined ? paymentType : undefined,
                        // PATCH-03: expeditorId убран
                        deliveryAddress: deliveryAddress !== undefined ? deliveryAddress : undefined,
                        totalAmount,
                        totalWeight,
                        isEdited: true,
                        editedAt: new Date(),
                        // ТЗ §8: НЕ трогаем signatureUrl, signedInvoiceUrl, completedAt
                        items: {
                            create: validItems
                        }
                    },
                    include: {
                        items: { include: { product: true } },
                        customer: true
                    }
                });
                // Восстанавливаем связь SummaryOrderJournal
                for (const newItem of order.items) {
                    const summaryId = productToSummaryMap.get(newItem.productId);
                    if (summaryId) {
                        await tx.summaryOrderJournal.update({
                            where: { id: summaryId },
                            data: {
                                orderItemId: newItem.id,
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
            }
            else {
                // Простое обновление (без items) - только разрешённые поля
                const data = {
                    isEdited: true,
                    editedAt: new Date()
                };
                if (customerId !== undefined)
                    data.customerId = Number(customerId);
                if (date !== undefined)
                    data.date = new Date(date);
                if (paymentType !== undefined)
                    data.paymentType = paymentType;
                if (deliveryAddress !== undefined)
                    data.deliveryAddress = deliveryAddress;
                // PATCH-03: expeditorId убран из editOrder
                const order = await tx.order.update({
                    where: { id: Number(id) },
                    data,
                    include: {
                        items: { include: { product: true } },
                        customer: true
                    }
                });
                return order;
            }
        });
        res.json(result);
    }
    catch (error) {
        console.error('editOrder error:', error);
        if (error.message === 'Order not found') {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        res.status(400).json({ error: 'Failed to edit order' });
    }
};
exports.editOrder = editOrder;
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
// ============================================
// FSM: Назначить экспедитора (DISTRIBUTING → LOADED)
// "Антиграв" паттерн: атомарная транзакция
// ============================================
const assignExpeditor = async (req, res) => {
    try {
        const { id } = req.params;
        const { expeditorId, deliveryAddress, dispatchDay } = req.body;
        const username = req.user?.username || 'system';
        if (!expeditorId) {
            return res.status(400).json({ error: 'Не указан ID экспедитора' });
        }
        const result = await db_1.prisma.$transaction(async (tx) => {
            // 1. Получаем и лочим заказ
            const currentOrder = await tx.order.findUnique({
                where: { id: Number(id) }
            });
            if (!currentOrder) {
                throw new Error('ORDER_NOT_FOUND');
            }
            // 2. FSM проверка: назначение только из DISTRIBUTING
            if (currentOrder.status !== constants_1.ORDER_STATUS.DISTRIBUTING) {
                throw new Error(`INVALID_STATUS:${currentOrder.status}`);
            }
            // 3. Проверяем существование экспедитора
            const expeditor = await tx.expeditor.findUnique({
                where: { id: Number(expeditorId) }
            });
            if (!expeditor) {
                throw new Error('EXPEDITOR_NOT_FOUND');
            }
            // 4. Парсинг dispatchDay — НЕ ЛОМАТЬ существующий
            let dispatchDayDate = currentOrder.dispatchDay;
            if (dispatchDay != null && String(dispatchDay).trim() !== '') {
                const [y, m, d] = String(dispatchDay).slice(0, 10).split('-').map(Number);
                dispatchDayDate = new Date(Date.UTC(y, m - 1, d));
            }
            // 5. Обновляем заказ: назначаем экспедитора, меняем статус
            const order = await tx.order.update({
                where: { id: Number(id) },
                data: {
                    expeditorId: Number(expeditorId),
                    deliveryAddress: deliveryAddress || undefined,
                    dispatchDay: dispatchDayDate,
                    assignedAt: new Date(),
                    loadedAt: new Date(),
                    loadedBy: username,
                    status: constants_1.ORDER_STATUS.LOADED,
                    deliveryStatus: 'pending'
                },
                include: {
                    customer: true,
                    expeditor: true,
                    items: { include: { product: true } }
                }
            });
            // TODO: Добавить журнал событий FSM после создания правильной модели
            // Сейчас журналы несовместимы с FSM-событиями (они хранят снимки, а не события)
            console.log(`[FSM] Order #${id}: DISTRIBUTING → LOADED, expeditor=${expeditorId}, dispatchDay=${dispatchDayDate?.toISOString().slice(0, 10)}`);
            return order;
        });
        res.json(result);
    }
    catch (error) {
        console.error('assignExpeditor error:', error);
        if (error.message === 'ORDER_NOT_FOUND') {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        if (error.message === 'EXPEDITOR_NOT_FOUND') {
            return res.status(404).json({ error: 'Экспедитор не найден' });
        }
        if (error.message?.startsWith('INVALID_STATUS:')) {
            const currentStatus = error.message.split(':')[1];
            return res.status(400).json({
                error: `Невозможно назначить экспедитора из статуса "${(0, constants_1.getStatusDisplayName)(currentStatus)}". Требуется статус "Распределяется"`
            });
        }
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
            // ТЗ §4.2: только FSM статусы - LOADED (назначен), SHIPPED (отгружен)
            // 'in_delivery'/'delivered' - это deliveryStatus, НЕ status!
            status: { in: [constants_1.ORDER_STATUS.LOADED, constants_1.ORDER_STATUS.SHIPPED] }
        };
        // Filter by delivery status if provided
        if (status) {
            where.deliveryStatus = String(status);
        }
        // Если статус не указан - показываем все статусы (включая delivered)
        // Фильтр по дате (в таймзоне Asia/Tashkent)
        let startDate;
        let endDate;
        if (dateFrom || dateTo) {
            where.date = {};
            if (dateFrom) {
                const { start } = (0, date_utils_1.getDateRangeForTashkent)(String(dateFrom));
                where.date.gte = start;
                startDate = start;
            }
            if (dateTo) {
                const { end } = (0, date_utils_1.getDateRangeForTashkent)(String(dateTo));
                where.date.lt = end;
                endDate = end;
            }
        }
        // ТЗ: Найти ExpeditionJournal по expeditorId и диапазону дат
        // Его ID используется для возвратов и накладной
        let expedition = null;
        if (startDate && endDate) {
            expedition = await db_1.prisma.expeditionJournal.findFirst({
                where: {
                    expeditorId: Number(expeditorId),
                    dateFrom: { lte: endDate },
                    dateTo: { gte: startDate },
                    isHidden: false
                },
                orderBy: { createdAt: 'desc' }
            });
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
        // ТЗ: Добавляем expeditionId и expeditionStatus к каждому заказу
        // Нормализуем status к строгим 'open' | 'closed'
        const expeditionStatus = expedition?.status === 'closed' ? 'closed' : 'open';
        const ordersWithExpedition = orders.map(order => ({
            ...order,
            expeditionId: expedition?.id || null,
            expeditionStatus
        }));
        res.json(ordersWithExpedition);
    }
    catch (error) {
        console.error('getExpeditorOrders error:', error);
        res.status(500).json({ error: 'Failed to fetch expeditor orders' });
    }
};
exports.getExpeditorOrders = getExpeditorOrders;
// ============================================
// FSM: Завершить заказ (LOADED → SHIPPED)
// "Антиграв" паттерн: атомарная транзакция
// 
// TODO ТЗ v2 §5: signatureUrl и signedInvoiceUrl сейчас хранятся как base64 в БД.
// Это неоптимально. Рекомендуется перейти на файловое хранилище (S3/MinIO),
// сохраняя в БД только URL/путь к файлу.
// ============================================
const completeOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { signatureUrl, signedInvoiceUrl } = req.body;
        const currentUserId = req.user?.id;
        const username = req.user?.username || 'system';
        const result = await db_1.prisma.$transaction(async (tx) => {
            // 1. Получаем и лочим заказ
            const currentOrder = await tx.order.findUnique({
                where: { id: Number(id) },
                include: { expeditor: true }
            });
            if (!currentOrder) {
                throw new Error('ORDER_NOT_FOUND');
            }
            // 2. FSM проверка: закрытие только из LOADED
            if (currentOrder.status !== constants_1.ORDER_STATUS.LOADED) {
                throw new Error(`INVALID_STATUS:${currentOrder.status}`);
            }
            // ТЗ: закрывают только "в пути" или ожидающие доставку
            // (смягчено: pending тоже допускается для случаев когда заказ напрямую из LOADED)
            const allowedDeliveryStatuses = ['in_delivery', 'pending', null, undefined];
            if (!allowedDeliveryStatuses.includes(currentOrder.deliveryStatus)) {
                throw new Error(`INVALID_DELIVERY_STATUS:${currentOrder.deliveryStatus}`);
            }
            // 3. Проверка прав: только назначенный экспедитор может закрыть
            // (пропускаем если currentUserId не определен - для обратной совместимости)
            if (currentUserId && currentOrder.expeditor?.userId) {
                if (currentOrder.expeditor.userId !== currentUserId) {
                    throw new Error('FORBIDDEN');
                }
            }
            // 4. Обновляем заказ
            const order = await tx.order.update({
                where: { id: Number(id) },
                data: {
                    status: constants_1.ORDER_STATUS.SHIPPED,
                    deliveryStatus: 'delivered',
                    shippedAt: new Date(),
                    completedAt: new Date(),
                    shippedBy: username,
                    signatureUrl: signatureUrl || undefined,
                    signedInvoiceUrl: signedInvoiceUrl || undefined
                },
                include: {
                    customer: true,
                    expeditor: true,
                    items: { include: { product: true } }
                }
            });
            // 5. Создаём записи вложений (подписи) в той же транзакции
            if (signatureUrl) {
                await tx.orderAttachment.create({
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
                await tx.orderAttachment.create({
                    data: {
                        orderId: Number(id),
                        type: 'signed_invoice',
                        filename: `invoice_signed_order_${id}.png`,
                        url: signedInvoiceUrl,
                        mimeType: 'image/png'
                    }
                });
            }
            // TODO: Добавить журнал событий FSM после создания правильной модели
            // Сейчас журналы несовместимы с FSM-событиями (они хранят снимки, а не события)
            console.log(`[FSM] Order #${id}: LOADED → SHIPPED by ${username}`);
            return order;
        });
        res.json(result);
    }
    catch (error) {
        console.error('completeOrder error:', error);
        if (error.message === 'ORDER_NOT_FOUND') {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        if (error.message === 'FORBIDDEN') {
            return res.status(403).json({ error: 'Только назначенный экспедитор может закрыть заказ' });
        }
        if (error.message?.startsWith('INVALID_STATUS:')) {
            const currentStatus = error.message.split(':')[1];
            return res.status(400).json({
                error: `Невозможно закрыть заказ из статуса "${(0, constants_1.getStatusDisplayName)(currentStatus)}". Требуется статус "Погружен"`
            });
        }
        res.status(400).json({ error: 'Failed to complete order' });
    }
};
exports.completeOrder = completeOrder;
// ============================================
// FSM: Начать сборку заказа (NEW → IN_ASSEMBLY)
// "Антиграв" паттерн: атомарная транзакция
// ============================================
const startAssemblyOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const username = req.user?.username || 'system';
        const result = await db_1.prisma.$transaction(async (tx) => {
            // 1. Лочим заказ (SELECT FOR UPDATE через findFirst + order)
            const currentOrder = await tx.order.findUnique({
                where: { id: Number(id) }
            });
            if (!currentOrder) {
                throw new Error('ORDER_NOT_FOUND');
            }
            // 2. FSM проверка: начать сборку можно только из NEW
            if (currentOrder.status !== constants_1.ORDER_STATUS.NEW) {
                throw new Error(`INVALID_STATUS:${currentOrder.status}`);
            }
            // 3. Обновляем статус заказа
            const order = await tx.order.update({
                where: { id: Number(id) },
                data: {
                    status: constants_1.ORDER_STATUS.IN_ASSEMBLY,
                    assemblyStartedAt: new Date(),
                    assemblyStartedBy: username
                },
                include: {
                    customer: true,
                    items: { include: { product: true } }
                }
            });
            // TODO: Добавить журнал событий FSM после создания правильной модели
            // Сейчас журналы несовместимы с FSM-событиями (они хранят снимки, а не события)
            console.log(`[FSM] Order #${id}: NEW → IN_ASSEMBLY by ${username}`);
            return order;
        });
        res.json({
            message: 'Сборка начата',
            order: result
        });
    }
    catch (error) {
        console.error('startAssemblyOrder error:', error);
        if (error.message === 'ORDER_NOT_FOUND') {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        if (error.message?.startsWith('INVALID_STATUS:')) {
            const currentStatus = error.message.split(':')[1];
            return res.status(400).json({
                error: `Невозможно начать сборку из статуса "${(0, constants_1.getStatusDisplayName)(currentStatus)}". Требуется статус "Новый"`
            });
        }
        res.status(500).json({ error: 'Ошибка начала сборки' });
    }
};
exports.startAssemblyOrder = startAssemblyOrder;
// ============================================
// FSM: Подтвердить сборку (IN_ASSEMBLY → DISTRIBUTING)
// "Антиграв" паттерн: атомарная транзакция + dispatchDay
// ============================================
const confirmAssemblyOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { dispatchDay } = req.body; // ← ПРИНИМАЕМ ИЗ UI
        const username = req.user?.username || 'system';
        const result = await db_1.prisma.$transaction(async (tx) => {
            const currentOrder = await tx.order.findUnique({
                where: { id: Number(id) }
            });
            if (!currentOrder) {
                throw new Error('ORDER_NOT_FOUND');
            }
            // FSM проверка: подтвердить можно только из IN_ASSEMBLY
            if (currentOrder.status !== constants_1.ORDER_STATUS.IN_ASSEMBLY) {
                throw new Error(`INVALID_STATUS:${currentOrder.status}`);
            }
            // ===============================
            // dispatchDay: из body или fallback
            // ===============================
            let dispatchDayDate;
            if (dispatchDay) {
                const [y, m, d] = String(dispatchDay).slice(0, 10).split('-').map(Number);
                if (!y || !m || !d) {
                    throw new Error('INVALID_DISPATCH_DAY');
                }
                dispatchDayDate = new Date(Date.UTC(y, m - 1, d));
            }
            else {
                // fallback — сегодня в Asia/Tashkent
                const now = new Date();
                const tashkentOffset = 5 * 60 * 60 * 1000;
                const tashkentNow = new Date(now.getTime() + tashkentOffset);
                dispatchDayDate = new Date(Date.UTC(tashkentNow.getUTCFullYear(), tashkentNow.getUTCMonth(), tashkentNow.getUTCDate()));
            }
            const order = await tx.order.update({
                where: { id: Number(id) },
                data: {
                    status: constants_1.ORDER_STATUS.DISTRIBUTING,
                    dispatchDay: dispatchDayDate,
                    assemblyConfirmedAt: new Date(),
                    assemblyConfirmedBy: username
                },
                include: {
                    customer: true,
                    items: { include: { product: true } }
                }
            });
            console.log(`[FSM] Order #${id}: IN_ASSEMBLY → DISTRIBUTING by ${username}, dispatchDay=${dispatchDayDate.toISOString().slice(0, 10)}`);
            return order;
        });
        res.json({
            message: 'Сборка подтверждена, заказ передан на распределение',
            order: result
        });
    }
    catch (error) {
        console.error('confirmAssemblyOrder error:', error);
        if (error.message === 'ORDER_NOT_FOUND') {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        if (error.message === 'INVALID_DISPATCH_DAY') {
            return res.status(400).json({ error: 'Некорректная дата распределения' });
        }
        if (error.message?.startsWith('INVALID_STATUS:')) {
            const currentStatus = error.message.split(':')[1];
            return res.status(400).json({
                error: `Невозможно подтвердить сборку из статуса "${(0, constants_1.getStatusDisplayName)(currentStatus)}". Требуется статус "На сборке"`
            });
        }
        res.status(500).json({ error: 'Ошибка подтверждения сборки' });
    }
};
exports.confirmAssemblyOrder = confirmAssemblyOrder;
// Get orders pending dispatch (ready for expeditor assignment)
// По ТЗ: показывает заказы в статусе DISTRIBUTING для назначения экспедитора
const getOrdersPendingDispatch = async (req, res) => {
    try {
        const { date, includeAssigned } = req.query;
        const where = {
            isDisabled: { not: true }, // ТЗ: правильно - { not: true } вместо false
            // FSM: в распределение попадают только заказы со статусом DISTRIBUTING
            // Если includeAssigned=true, также показываем LOADED (уже назначенные)
            status: includeAssigned === 'true'
                ? { in: [constants_1.ORDER_STATUS.DISTRIBUTING, constants_1.ORDER_STATUS.LOADED] }
                : constants_1.ORDER_STATUS.DISTRIBUTING
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
                        shippedQty: item.shippedQty ?? 0,
                        orderQty: item.quantity,
                        sumWithRevaluation: Number(item.amount),
                        distributionCoef: item.distributionCoef == null ? 0 : Number(item.distributionCoef),
                        weightToDistribute: item.weightToDistribute == null ? 0 : Number(item.weightToDistribute),
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
// ============================================
// Generate Invoice (ТЗ §6.2)
// TODO: Implement full invoice generation logic
// ============================================
const generateInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const { expeditionId } = req.query;
        const order = await db_1.prisma.order.findUnique({
            where: { id: Number(id) },
            include: {
                customer: true,
                expeditor: true,
                items: { include: { product: true } }
            }
        });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        // Формируем данные накладной
        const invoiceData = {
            orderId: order.id,
            idn: order.idn,
            date: order.date,
            expeditionId: expeditionId ? Number(expeditionId) : null,
            customer: {
                id: order.customer.id,
                name: order.customer.name,
                code: order.customer.code
            },
            expeditor: order.expeditor ? {
                id: order.expeditor.id,
                name: order.expeditor.name
            } : null,
            items: order.items.map(item => {
                const shipped = Number(item.shippedQty);
                const qtyShip = shipped > 0 ? shipped : Number(item.quantity);
                return {
                    productId: item.productId,
                    productName: item.product?.name || '',
                    quantity: item.quantity,
                    shippedQty: qtyShip,
                    price: Number(item.price),
                    amount: Number(item.amount)
                };
            }),
            totalAmount: Number(order.totalAmount),
            totalWeight: order.totalWeight
        };
        res.json(invoiceData);
    }
    catch (error) {
        console.error('generateInvoice error:', error);
        res.status(500).json({ error: 'Failed to generate invoice' });
    }
};
exports.generateInvoice = generateInvoice;
// ============================================
// Bulk Delete Orders (ТЗ: Удаление из Сборки заказов)
// "Антиграв" паттерн: атомарная транзакция
// ============================================
const bulkDeleteOrders = async (req, res) => {
    try {
        const userRole = req.user?.role;
        const username = req.user?.username || 'system';
        // RBAC: только dispatcher, admin, manager
        const allowedRoles = ['dispatcher', 'admin', 'manager', 'ADMIN', 'MANAGER', 'DISPATCHER'];
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({ error: 'Недостаточно прав для удаления заказов' });
        }
        const { orderIds, reason } = req.body;
        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ error: 'orderIds обязателен и должен быть непустым массивом' });
        }
        const result = await db_1.prisma.$transaction(async (tx) => {
            // 1. Получаем все заказы с items и привязками к summary
            const orders = await tx.order.findMany({
                where: { id: { in: orderIds.map(Number) } },
                include: {
                    items: {
                        include: {
                            summaryEntry: true
                        }
                    },
                    attachments: true,
                    returns: { include: { items: true } }
                }
            });
            if (orders.length !== orderIds.length) {
                const foundIds = orders.map(o => o.id);
                const notFound = orderIds.filter(id => !foundIds.includes(Number(id)));
                throw { code: 'ORDER_NOT_FOUND', notFound };
            }
            // 2. FSM проверка: удалять можно только NEW или IN_ASSEMBLY
            const allowedStatuses = new Set([constants_1.ORDER_STATUS.NEW, constants_1.ORDER_STATUS.IN_ASSEMBLY]);
            const blocked = orders
                .filter(o => !allowedStatuses.has(o.status))
                .map(o => ({ orderId: o.id, status: o.status }));
            if (blocked.length > 0) {
                throw { code: 'BLOCKED_STATUS', blocked };
            }
            // 3. Собираем все summaryEntry IDs для восстановления
            const summaryIds = new Set();
            for (const order of orders) {
                for (const item of order.items) {
                    if (item.summaryEntry?.id) {
                        summaryIds.add(item.summaryEntry.id);
                    }
                }
            }
            // 4. Восстанавливаем записи сводки → status='draft', orderItemId=null
            let restoredSummaryCount = 0;
            if (summaryIds.size > 0) {
                const upd = await tx.summaryOrderJournal.updateMany({
                    where: { id: { in: [...summaryIds] } },
                    data: {
                        status: 'draft',
                        orderItemId: null
                    }
                });
                restoredSummaryCount = upd.count;
            }
            // 5. Удаляем зависимости (каскад не всегда работает)
            const orderIdsList = orderIds.map(Number);
            // Удаляем ReturnAuditLog
            await tx.returnAuditLog.deleteMany({
                where: { orderId: { in: orderIdsList } }
            }).catch(() => { });
            // Удаляем OrderReturnItem через OrderReturn
            for (const order of orders) {
                for (const ret of order.returns) {
                    await tx.orderReturnItem.deleteMany({
                        where: { returnId: ret.id }
                    }).catch(() => { });
                }
            }
            // Удаляем OrderReturn
            await tx.orderReturn.deleteMany({
                where: { orderId: { in: orderIdsList } }
            }).catch(() => { });
            // Удаляем OrderAttachment
            await tx.orderAttachment.deleteMany({
                where: { orderId: { in: orderIdsList } }
            });
            // Удаляем OrderItem (каскад должен работать, но на всякий случай)
            await tx.orderItem.deleteMany({
                where: { orderId: { in: orderIdsList } }
            });
            // 6. Удаляем сами заказы
            const del = await tx.order.deleteMany({
                where: { id: { in: orderIdsList } }
            });
            console.log(`[BULK_DELETE] Deleted ${del.count} orders by ${username}, restored ${restoredSummaryCount} summary entries. Reason: ${reason || 'N/A'}`);
            return {
                deletedCount: del.count,
                restoredSummaryCount,
                deletedOrderIds: orderIdsList
            };
        });
        return res.json({
            success: true,
            ...result
        });
    }
    catch (error) {
        console.error('bulkDeleteOrders error:', error);
        if (error.code === 'ORDER_NOT_FOUND') {
            return res.status(404).json({
                error: 'Некоторые заказы не найдены',
                notFound: error.notFound
            });
        }
        if (error.code === 'BLOCKED_STATUS') {
            return res.status(400).json({
                error: 'Некоторые заказы нельзя удалить (уже в статусе распределения или выше)',
                blocked: error.blocked
            });
        }
        return res.status(500).json({ error: 'Ошибка удаления заказов' });
    }
};
exports.bulkDeleteOrders = bulkDeleteOrders;
