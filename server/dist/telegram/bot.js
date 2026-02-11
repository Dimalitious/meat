"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
exports.createWebhookHandler = createWebhookHandler;
const grammy_1 = require("grammy");
const db_1 = require("../db");
// ============================================
// Bot instance
// ============================================
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.warn('[TelegramBot] TELEGRAM_BOT_TOKEN not set — bot disabled');
}
exports.bot = token ? new grammy_1.Bot(token) : null;
// ============================================
// /bind CODE — привязка группы к Customer
// ============================================
exports.bot?.command('bind', async (ctx) => {
    try {
        const chat = ctx.chat;
        if (!chat || (chat.type !== 'group' && chat.type !== 'supergroup')) {
            return ctx.reply('❌ /bind работает только в группах.');
        }
        // Проверяем что отправитель — админ группы
        const member = await ctx.api.getChatMember(chat.id, ctx.from.id);
        if (!['creator', 'administrator'].includes(member.status)) {
            return ctx.reply('❌ Только администраторы группы могут привязать её.');
        }
        const code = ctx.match?.trim();
        if (!code) {
            return ctx.reply('❌ Укажите код: /bind ABCDEF');
        }
        // Ищем валидный bind request
        const bindReq = await db_1.prisma.telegramBindRequest.findFirst({
            where: {
                code,
                usedAt: null,
                expiresAt: { gt: new Date() },
            },
            include: { customer: true },
        });
        if (!bindReq) {
            return ctx.reply('❌ Код невалиден или истёк. Запросите новый в CRM.');
        }
        // Проверяем что chatId не привязан к другому customer
        const existingCustomer = await db_1.prisma.customer.findUnique({
            where: { telegramChatId: BigInt(chat.id) },
        });
        if (existingCustomer && existingCustomer.id !== bindReq.customerId) {
            return ctx.reply(`❌ Эта группа уже привязана к клиенту "${existingCustomer.name}". Сначала /unbind.`);
        }
        // Транзакция: привязать
        await db_1.prisma.$transaction([
            db_1.prisma.customer.update({
                where: { id: bindReq.customerId },
                data: {
                    telegramChatId: BigInt(chat.id),
                    telegramChatType: chat.type,
                    telegramIsEnabled: true,
                    telegramBoundAt: new Date(),
                    telegramBoundByUserId: bindReq.createdByUserId,
                    telegramGroupName: chat.title || null,
                    telegramGroupUsername: ('username' in chat ? chat.username : null) || null,
                },
            }),
            db_1.prisma.telegramBindRequest.update({
                where: { id: bindReq.id },
                data: {
                    usedAt: new Date(),
                    usedByChatId: BigInt(chat.id),
                },
            }),
        ]);
        return ctx.reply(`✅ Группа привязана к клиенту «${bindReq.customer.name}».\nТеперь бот будет принимать заказы из этого чата.`);
    }
    catch (err) {
        console.error('[TelegramBot] /bind error:', err);
        return ctx.reply('❌ Ошибка при привязке. Попробуйте позже.');
    }
});
// ============================================
// /unbind — отвязка группы
// ============================================
exports.bot?.command('unbind', async (ctx) => {
    try {
        const chat = ctx.chat;
        if (!chat || (chat.type !== 'group' && chat.type !== 'supergroup')) {
            return ctx.reply('❌ /unbind работает только в группах.');
        }
        const member = await ctx.api.getChatMember(chat.id, ctx.from.id);
        if (!['creator', 'administrator'].includes(member.status)) {
            return ctx.reply('❌ Только администраторы группы могут отвязать её.');
        }
        const customer = await db_1.prisma.customer.findUnique({
            where: { telegramChatId: BigInt(chat.id) },
        });
        if (!customer) {
            return ctx.reply('ℹ️ Эта группа не привязана ни к одному клиенту.');
        }
        const chatIdBigInt = BigInt(chat.id);
        // Транзакция: отвязать + Cleanup
        await db_1.prisma.$transaction(async (tx) => {
            await tx.customer.update({
                where: { id: customer.id },
                data: {
                    telegramChatId: null,
                    telegramIsEnabled: false,
                },
            });
            // Cancel pending drafts
            await tx.orderDraft.updateMany({
                where: {
                    customerId: customer.id,
                    status: { in: ['NEW', 'CLARIFY', 'WAIT_CONFIRM'] },
                },
                data: {
                    status: 'CANCELED',
                    note: db_1.prisma.$queryRaw `COALESCE(note, '') || ' [unbound]'`,
                },
            });
            // Cancel queued outbox
            await tx.telegramOutbox.updateMany({
                where: {
                    chatId: chatIdBigInt,
                    status: { in: ['QUEUED', 'SENDING'] },
                },
                data: { status: 'CANCELED' },
            });
        });
        return ctx.reply(`✅ Группа отвязана от клиента «${customer.name}». Незавершённые черновики отменены.`);
    }
    catch (err) {
        console.error('[TelegramBot] /unbind error:', err);
        return ctx.reply('❌ Ошибка при отвязке. Попробуйте позже.');
    }
});
// ============================================
// /status — текущий статус привязки
// ============================================
exports.bot?.command('status', async (ctx) => {
    try {
        const chat = ctx.chat;
        if (!chat || (chat.type !== 'group' && chat.type !== 'supergroup')) {
            return ctx.reply('❌ Работает только в группах.');
        }
        const customer = await db_1.prisma.customer.findUnique({
            where: { telegramChatId: BigInt(chat.id) },
        });
        if (!customer) {
            return ctx.reply('ℹ️ Группа не привязана. Используйте /bind CODE.');
        }
        const pendingDrafts = await db_1.prisma.orderDraft.count({
            where: {
                customerId: customer.id,
                status: { in: ['NEW', 'CLARIFY', 'WAIT_CONFIRM'] },
            },
        });
        return ctx.reply(`📊 Статус:\n• Клиент: ${customer.name}\n• Приём заказов: ${customer.telegramIsEnabled ? '✅' : '❌'}\n• Активных черновиков: ${pendingDrafts}`);
    }
    catch (err) {
        console.error('[TelegramBot] /status error:', err);
        return ctx.reply('❌ Ошибка.');
    }
});
// ============================================
// Callback query handler (кнопки)
// ============================================
exports.bot?.on('callback_query:data', async (ctx) => {
    try {
        const data = ctx.callbackQuery.data;
        const chatId = ctx.callbackQuery.message?.chat.id;
        if (!data || !chatId) {
            return ctx.answerCallbackQuery({ text: 'Ошибка данных' });
        }
        // create_draft:<inboxId>
        if (data.startsWith('create_draft:')) {
            const inboxId = parseInt(data.split(':')[1]);
            if (isNaN(inboxId))
                return ctx.answerCallbackQuery({ text: 'Неверный ID' });
            const { createDraftFromInbox } = await Promise.resolve().then(() => __importStar(require('./inboxProcessor')));
            const result = await createDraftFromInbox(inboxId, BigInt(chatId));
            if (result.error) {
                return ctx.answerCallbackQuery({ text: result.error });
            }
            await ctx.editMessageText(`✅ Черновик #${result.draftId} создан.\n${result.summary}\n\nПодтвердить?`, {
                reply_markup: new grammy_1.InlineKeyboard()
                    .text('✅ Подтвердить', `confirm_draft:${result.draftId}`)
                    .text('❌ Отменить', `cancel_draft:${result.draftId}`),
            });
            return ctx.answerCallbackQuery();
        }
        // not_order:<inboxId>
        if (data.startsWith('not_order:')) {
            const inboxId = parseInt(data.split(':')[1]);
            if (!isNaN(inboxId)) {
                await db_1.prisma.telegramInbox.update({
                    where: { id: inboxId },
                    data: { status: 'IGNORED', processedAt: new Date() },
                });
            }
            await ctx.editMessageText('👌 Пропущено.');
            return ctx.answerCallbackQuery();
        }
        // confirm_draft:<draftId>
        if (data.startsWith('confirm_draft:')) {
            const draftId = parseInt(data.split(':')[1]);
            if (isNaN(draftId))
                return ctx.answerCallbackQuery({ text: 'Неверный ID' });
            const { confirmDraft } = await Promise.resolve().then(() => __importStar(require('../services/draftService')));
            const result = await confirmDraft(draftId, {
                type: 'TELEGRAM',
                chatId: BigInt(chatId),
            });
            if (result.error) {
                return ctx.answerCallbackQuery({ text: result.error });
            }
            await ctx.editMessageText(`✅ Заказ #${result.orderId} создан! Сумма: ${result.totalAmount}`);
            return ctx.answerCallbackQuery({ text: 'Заказ подтверждён!' });
        }
        // cancel_draft:<draftId>
        if (data.startsWith('cancel_draft:')) {
            const draftId = parseInt(data.split(':')[1]);
            if (isNaN(draftId))
                return ctx.answerCallbackQuery({ text: 'Неверный ID' });
            const { cancelDraft } = await Promise.resolve().then(() => __importStar(require('../services/draftService')));
            await cancelDraft(draftId, {
                type: 'TELEGRAM',
                chatId: BigInt(chatId),
            });
            await ctx.editMessageText('❌ Черновик отменён.');
            return ctx.answerCallbackQuery();
        }
        return ctx.answerCallbackQuery({ text: 'Неизвестное действие' });
    }
    catch (err) {
        console.error('[TelegramBot] callback_query error:', err);
        return ctx.answerCallbackQuery({ text: 'Ошибка обработки' });
    }
});
// ============================================
// Webhook message handler — запись в Inbox
// ============================================
exports.bot?.on('message:text', async (ctx) => {
    try {
        const chat = ctx.chat;
        if (!chat || (chat.type !== 'group' && chat.type !== 'supergroup'))
            return;
        const msg = ctx.message;
        if (!msg.text || msg.text.startsWith('/'))
            return; // Команды обрабатываются выше
        // Идемпотентная запись в TelegramInbox
        await db_1.prisma.telegramInbox.upsert({
            where: {
                chatId_messageId: {
                    chatId: BigInt(chat.id),
                    messageId: msg.message_id,
                },
            },
            update: {}, // уже есть — не трогаем
            create: {
                chatId: BigInt(chat.id),
                messageId: msg.message_id,
                messageDate: new Date(msg.date * 1000),
                fromUserId: msg.from?.id ? BigInt(msg.from.id) : null,
                text: msg.text,
                raw: ctx.update,
                status: 'NEW',
            },
        });
    }
    catch (err) {
        // Подавляем ошибки — webhook НЕ должен падать
        console.error('[TelegramBot] message handler error:', err);
    }
});
// ============================================
// Express webhook handler
// ============================================
function createWebhookHandler() {
    if (!exports.bot)
        return null;
    return (0, grammy_1.webhookCallback)(exports.bot, 'express');
}
