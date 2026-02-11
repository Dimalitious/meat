"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDraftFromInbox = createDraftFromInbox;
exports.startInboxProcessor = startInboxProcessor;
exports.stopInboxProcessor = stopInboxProcessor;
const db_1 = require("../db");
const grammy_1 = require("grammy");
const bot_1 = require("./bot");
// ============================================
// Inbox Processor — обрабатывает NEW сообщения
// ============================================
const PROCESS_BATCH = 10;
const PROCESS_INTERVAL_MS = 5000; // 5 сек
const PROMPTED_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 часа
/**
 * Детектор «похоже на заказ».
 * Простой rule-based: сообщение содержит строку с числом + текстом.
 */
function looksLikeOrder(text) {
    if (!text || text.length < 5)
        return false;
    const lines = text.split(/\n/).filter(l => l.trim().length > 0);
    // Ищем хотя бы 1 строку с числом
    const hasNumberLine = lines.some(line => /\d+/.test(line) && /[а-яА-ЯёЁa-zA-Z]{2,}/.test(line));
    // Или ключевые слова
    const hasKeyword = /заказ|отправ|нужно|надо|закажи|пришлите|давайте/i.test(text);
    return hasNumberLine || (hasKeyword && lines.length >= 1);
}
/**
 * Парсинг строк сообщения в позиции черновика.
 * Формат: "<название> <число> [кг|шт|кор]"
 */
function parseOrderLines(text) {
    const lines = text.split(/[\n;]/).map(l => l.trim()).filter(l => l.length > 0);
    const items = [];
    for (const line of lines) {
        // Пробуем извлечь: текст + число + единица
        const match = line.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(кг|kg|шт|шток|штук|pcs|кор|box|коробк\w*)?\.?\s*$/i);
        if (match) {
            const rawName = match[1].trim();
            const qty = parseFloat(match[2].replace(',', '.'));
            let unit = null;
            const unitRaw = (match[3] || '').toLowerCase();
            if (['кг', 'kg'].includes(unitRaw))
                unit = 'KG';
            else if (['шт', 'шток', 'штук', 'pcs'].includes(unitRaw))
                unit = 'PCS';
            else if (['кор', 'box'].some(u => unitRaw.startsWith(u)))
                unit = 'BOX';
            else
                unit = 'KG'; // default
            items.push({ rawText: line, title: rawName, quantity: qty, unit });
        }
        else if (/\d/.test(line) && line.length > 3) {
            // Строка с числом, но не удалось спарсить
            items.push({ rawText: line, title: null, quantity: null, unit: null });
        }
        // Строки без чисел (приветствия, комментарии) — пропускаем
    }
    return items;
}
/**
 * Сопоставление товаров по имени.
 * Простой exact+contains match по Product.name / altName.
 */
async function matchProducts(items, customerId) {
    if (items.length === 0)
        return [];
    // Получаем все товары клиента из CustomerProduct (если есть)
    const customerProducts = await db_1.prisma.customerProduct.findMany({
        where: { customerId },
        include: { product: { select: { id: true, name: true, altName: true } } },
    });
    // Также все активные товары
    const allProducts = await db_1.prisma.product.findMany({
        where: { status: 'active' },
        select: { id: true, name: true, altName: true },
    });
    return items.map(item => {
        if (!item.title) {
            return { ...item, productId: null, productName: null };
        }
        const searchTerm = item.title.toLowerCase().trim();
        // 1) Точное совпадение по CustomerProduct
        const cpMatch = customerProducts.find(cp => cp.product.name.toLowerCase() === searchTerm ||
            (cp.product.altName && cp.product.altName.toLowerCase() === searchTerm));
        if (cpMatch) {
            return { ...item, productId: cpMatch.product.id, productName: cpMatch.product.name };
        }
        // 2) Contains по CustomerProduct
        const cpContains = customerProducts.find(cp => cp.product.name.toLowerCase().includes(searchTerm) ||
            searchTerm.includes(cp.product.name.toLowerCase()) ||
            (cp.product.altName && (cp.product.altName.toLowerCase().includes(searchTerm) ||
                searchTerm.includes(cp.product.altName.toLowerCase()))));
        if (cpContains) {
            return { ...item, productId: cpContains.product.id, productName: cpContains.product.name };
        }
        // 3) Поиск по всем товарам (exact → contains)
        const exactMatch = allProducts.find(p => p.name.toLowerCase() === searchTerm ||
            (p.altName && p.altName.toLowerCase() === searchTerm));
        if (exactMatch) {
            return { ...item, productId: exactMatch.id, productName: exactMatch.name };
        }
        const containsMatch = allProducts.find(p => p.name.toLowerCase().includes(searchTerm) ||
            searchTerm.includes(p.name.toLowerCase()) ||
            (p.altName && (p.altName.toLowerCase().includes(searchTerm) ||
                searchTerm.includes(p.altName.toLowerCase()))));
        if (containsMatch) {
            return { ...item, productId: containsMatch.id, productName: containsMatch.name };
        }
        return { ...item, productId: null, productName: null };
    });
}
/**
 * Создать draft из подтверждённого inbox сообщения.
 */
async function createDraftFromInbox(inboxId, chatId) {
    const inbox = await db_1.prisma.telegramInbox.findUnique({ where: { id: inboxId } });
    if (!inbox)
        return { error: 'Сообщение не найдено' };
    if (inbox.status !== 'PROMPTED')
        return { error: 'Уже обработано' };
    // Найти customer по chatId
    const customer = await db_1.prisma.customer.findUnique({
        where: { telegramChatId: chatId },
    });
    if (!customer || !customer.telegramIsEnabled) {
        return { error: 'Группа не привязана' };
    }
    // Парсинг
    const rawItems = parseOrderLines(inbox.text || '');
    const matchedItems = await matchProducts(rawItems, customer.id);
    // Проверяем: есть ли хотя бы что-то полезное?
    if (matchedItems.length === 0) {
        await db_1.prisma.telegramInbox.update({
            where: { id: inboxId },
            data: { status: 'IGNORED', processedAt: new Date(), error: 'Не удалось распарсить строки' },
        });
        return { error: 'Не удалось распарсить заказ.' };
    }
    // Определяем статус draft
    const hasUnresolved = matchedItems.some(i => !i.productId || !i.quantity);
    const draftStatus = hasUnresolved ? 'CLARIFY' : 'WAIT_CONFIRM';
    // Создаём draft + items + link в транзакции
    const draft = await db_1.prisma.$transaction(async (tx) => {
        const d = await tx.orderDraft.create({
            data: {
                customerId: customer.id,
                sourceChatId: chatId,
                status: draftStatus,
                items: {
                    create: matchedItems.map(item => ({
                        rawText: item.rawText,
                        title: item.productName || item.title,
                        productId: item.productId,
                        quantity: item.quantity,
                        unit: item.unit,
                    })),
                },
                messages: {
                    create: {
                        inboxId: inboxId,
                        kind: 'ORIGINAL',
                    },
                },
            },
            include: { items: true },
        });
        await tx.telegramInbox.update({
            where: { id: inboxId },
            data: { status: 'DRAFT_CREATED', processedAt: new Date() },
        });
        return d;
    });
    // Формируем summary
    const summaryLines = draft.items.map((item, i) => {
        const status = item.productId ? '✅' : '❓';
        const name = item.title || item.rawText;
        const qty = item.quantity != null ? `${item.quantity} ${item.unit || ''}` : '?';
        return `${i + 1}. ${status} ${name} — ${qty}`;
    });
    const summary = summaryLines.join('\n');
    return { draftId: draft.id, summary };
}
// ============================================
// Основной цикл процессора
// ============================================
let processorRunning = false;
async function processNewMessages() {
    if (!bot_1.bot)
        return;
    try {
        // 1. Timeout PROMPTED > 2 часов
        await db_1.prisma.telegramInbox.updateMany({
            where: {
                status: 'PROMPTED',
                createdAt: { lt: new Date(Date.now() - PROMPTED_TIMEOUT_MS) },
            },
            data: { status: 'IGNORED', processedAt: new Date() },
        });
        // 2. Обработать NEW записи
        const newMessages = await db_1.prisma.telegramInbox.findMany({
            where: { status: 'NEW' },
            orderBy: { createdAt: 'asc' },
            take: PROCESS_BATCH,
        });
        for (const msg of newMessages) {
            try {
                // Найти customer
                const customer = await db_1.prisma.customer.findUnique({
                    where: { telegramChatId: msg.chatId },
                });
                if (!customer || !customer.telegramIsEnabled) {
                    await db_1.prisma.telegramInbox.update({
                        where: { id: msg.id },
                        data: { status: 'IGNORED', processedAt: new Date(), error: 'Группа не привязана' },
                    });
                    continue;
                }
                // Детектор заказа
                if (!looksLikeOrder(msg.text || '')) {
                    await db_1.prisma.telegramInbox.update({
                        where: { id: msg.id },
                        data: { status: 'IGNORED', processedAt: new Date() },
                    });
                    continue;
                }
                // Стратегия (C): спросить
                await db_1.prisma.telegramInbox.update({
                    where: { id: msg.id },
                    data: { status: 'PROMPTED' },
                });
                await bot_1.bot.api.sendMessage(Number(msg.chatId), `📋 Похоже на заказ. Создать черновик?`, {
                    reply_parameters: { message_id: msg.messageId },
                    reply_markup: new grammy_1.InlineKeyboard()
                        .text('✅ Да, создать', `create_draft:${msg.id}`)
                        .text('❌ Нет', `not_order:${msg.id}`),
                });
            }
            catch (err) {
                console.error(`[InboxProcessor] Error processing msg ${msg.id}:`, err);
                await db_1.prisma.telegramInbox.update({
                    where: { id: msg.id },
                    data: { status: 'ERROR', error: String(err), processedAt: new Date() },
                }).catch(() => { });
            }
        }
    }
    catch (err) {
        console.error('[InboxProcessor] Cycle error:', err);
    }
}
function startInboxProcessor() {
    if (processorRunning || !bot_1.bot)
        return;
    processorRunning = true;
    console.log('[InboxProcessor] Started (interval:', PROCESS_INTERVAL_MS, 'ms)');
    const tick = async () => {
        await processNewMessages();
        if (processorRunning) {
            setTimeout(tick, PROCESS_INTERVAL_MS);
        }
    };
    tick();
}
function stopInboxProcessor() {
    processorRunning = false;
    console.log('[InboxProcessor] Stopped');
}
