"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startOutboxWorker = startOutboxWorker;
exports.stopOutboxWorker = stopOutboxWorker;
const db_1 = require("../db");
const bot_1 = require("./bot");
// ============================================
// Outbox Worker — отправка исходящих сообщений
// ============================================
const WORKER_INTERVAL_MS = 3000; // 3 сек
const RATE_DELAY_MS = 1100; // 1.1 сек между сообщениями в один чат
const BATCH_SIZE = 5;
const BACKOFF_MINUTES = [1, 5, 15, 60, 360]; // 1м, 5м, 15м, 1ч, 6ч
function getBackoffMs(attempt) {
    const idx = Math.min(attempt, BACKOFF_MINUTES.length - 1);
    return BACKOFF_MINUTES[idx] * 60 * 1000;
}
let workerRunning = false;
async function processBatch() {
    if (!bot_1.bot)
        return;
    try {
        const tasks = await db_1.prisma.telegramOutbox.findMany({
            where: {
                status: 'QUEUED',
                nextAttemptAt: { lte: new Date() },
            },
            orderBy: { nextAttemptAt: 'asc' },
            take: BATCH_SIZE,
        });
        for (const task of tasks) {
            try {
                // Атомарно перевести в SENDING
                const updated = await db_1.prisma.telegramOutbox.updateMany({
                    where: { id: task.id, status: 'QUEUED' },
                    data: { status: 'SENDING', updatedAt: new Date() },
                });
                if (updated.count === 0)
                    continue; // кто-то другой взял
                // Отправить
                if (task.text) {
                    await bot_1.bot.api.sendMessage(Number(task.chatId), task.text, {
                        parse_mode: undefined,
                    });
                }
                // Успех
                await db_1.prisma.telegramOutbox.update({
                    where: { id: task.id },
                    data: {
                        status: 'SENT',
                        sentAt: new Date(),
                    },
                });
            }
            catch (err) {
                const newAttempts = task.attempts + 1;
                const isFinal = newAttempts >= task.maxAttempts;
                await db_1.prisma.telegramOutbox.update({
                    where: { id: task.id },
                    data: {
                        status: isFinal ? 'FAILED' : 'QUEUED',
                        attempts: newAttempts,
                        lastError: String(err?.message || err).slice(0, 500),
                        nextAttemptAt: isFinal
                            ? undefined
                            : new Date(Date.now() + getBackoffMs(newAttempts)),
                    },
                });
                console.error(`[OutboxWorker] Failed task ${task.id} (attempt ${newAttempts}/${task.maxAttempts}):`, err?.message);
            }
            // Rate limiting — задержка между сообщениями
            await new Promise(resolve => setTimeout(resolve, RATE_DELAY_MS));
        }
    }
    catch (err) {
        console.error('[OutboxWorker] Cycle error:', err);
    }
}
function startOutboxWorker() {
    if (workerRunning || !bot_1.bot)
        return;
    workerRunning = true;
    console.log('[OutboxWorker] Started (interval:', WORKER_INTERVAL_MS, 'ms)');
    const tick = async () => {
        await processBatch();
        if (workerRunning) {
            setTimeout(tick, WORKER_INTERVAL_MS);
        }
    };
    tick();
}
function stopOutboxWorker() {
    workerRunning = false;
    console.log('[OutboxWorker] Stopped');
}
