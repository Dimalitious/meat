"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmDraft = confirmDraft;
exports.cancelDraft = cancelDraft;
const db_1 = require("../db");
const library_1 = require("@prisma/client/runtime/library");
// ============================================
// confirmDraft
// ============================================
async function confirmDraft(draftId, actor) {
    const draft = await db_1.prisma.orderDraft.findUnique({
        where: { id: draftId },
        include: {
            items: true,
            customer: true,
        },
    });
    if (!draft)
        return { error: 'Черновик не найден' };
    if (['CONFIRMED', 'CANCELED'].includes(draft.status)) {
        return { error: `Черновик уже ${draft.status === 'CONFIRMED' ? 'подтверждён' : 'отменён'}` };
    }
    // Валидация: хотя бы 1 item с productId + quantity
    const validItems = draft.items.filter((i) => i.productId != null && i.quantity != null);
    if (validItems.length === 0) {
        return { error: 'Нет распознанных товаров. Отредактируйте черновик.' };
    }
    // Получить текущие цены для клиента
    const prices = await getCustomerPrices(draft.customerId, validItems.map((i) => i.productId));
    // Создать Order + OrderItems
    const result = await db_1.prisma.$transaction(async (tx) => {
        // Формируем items для Order
        const orderItemsData = validItems.map((item) => {
            const price = prices.get(item.productId) ?? new library_1.Decimal(0);
            const qty = item.quantity;
            const amount = price.mul(qty);
            return {
                productId: item.productId,
                quantity: qty,
                price,
                amount,
            };
        });
        const totalAmount = orderItemsData.reduce((sum, i) => sum.add(i.amount), new library_1.Decimal(0));
        const totalWeight = orderItemsData.reduce((sum, i) => sum + i.quantity, 0);
        const order = await tx.order.create({
            data: {
                customerId: draft.customerId,
                date: new Date(),
                status: 'NEW',
                totalAmount,
                totalWeight,
                draftId: draft.id,
                items: {
                    create: orderItemsData,
                },
            },
        });
        // Обновить draft
        await tx.orderDraft.update({
            where: { id: draftId },
            data: {
                status: 'CONFIRMED',
                confirmedByUserId: actor.type === 'CRM' ? actor.userId : null,
                confirmedByChatId: actor.type === 'TELEGRAM' ? actor.chatId : null,
            },
        });
        return { orderId: order.id, totalAmount: totalAmount.toFixed(2) };
    });
    // Отправить уведомление в чат (через outbox)
    if (draft.sourceChatId) {
        await db_1.prisma.telegramOutbox.create({
            data: {
                customerId: draft.customerId,
                chatId: draft.sourceChatId,
                text: `✅ Заказ #${result.orderId} подтверждён!\nСумма: ${result.totalAmount}\nКлиент: ${draft.customer.name}`,
            },
        });
    }
    return result;
}
// ============================================
// cancelDraft
// ============================================
async function cancelDraft(draftId, actor) {
    const draft = await db_1.prisma.orderDraft.findUnique({
        where: { id: draftId },
    });
    if (!draft)
        return { error: 'Черновик не найден' };
    if (['CONFIRMED', 'CANCELED'].includes(draft.status)) {
        return { error: `Черновик уже ${draft.status === 'CONFIRMED' ? 'подтверждён' : 'отменён'}` };
    }
    await db_1.prisma.orderDraft.update({
        where: { id: draftId },
        data: {
            status: 'CANCELED',
            confirmedByUserId: actor.type === 'CRM' ? actor.userId : null,
            confirmedByChatId: actor.type === 'TELEGRAM' ? actor.chatId : null,
        },
    });
    return {};
}
// ============================================
// Получение цен
// ============================================
async function getCustomerPrices(customerId, productIds) {
    const priceMap = new Map();
    // 1) Пробуем персональный прайс-лист клиента (isCurrent=true)
    const customerPriceList = await db_1.prisma.salesPriceList.findFirst({
        where: {
            customerId,
            isCurrent: true,
        },
        orderBy: { effectiveDate: 'desc' },
        include: {
            items: {
                where: { productId: { in: productIds } },
            },
        },
    });
    if (customerPriceList) {
        for (const item of customerPriceList.items) {
            priceMap.set(item.productId, item.salePrice);
        }
    }
    // 2) Для товаров без персональной цены — общий прайс
    const missingIds = productIds.filter(id => !priceMap.has(id));
    if (missingIds.length > 0) {
        const generalPriceList = await db_1.prisma.salesPriceList.findFirst({
            where: {
                customerId: null,
                listType: 'GENERAL',
                isCurrent: true,
            },
            orderBy: { effectiveDate: 'desc' },
            include: {
                items: {
                    where: { productId: { in: missingIds } },
                },
            },
        });
        if (generalPriceList) {
            for (const item of generalPriceList.items) {
                if (!priceMap.has(item.productId)) {
                    priceMap.set(item.productId, item.salePrice);
                }
            }
        }
    }
    return priceMap;
}
