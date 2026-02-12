import { Request, Response } from 'express';
import { prisma } from '../db';

/**
 * POST /api/orders/:orderId/send-telegram
 * Send order details to supplier's Telegram group.
 * Requires: supplier has telegramChatId set and telegramEnabled = true.
 * 
 * Body: { supplierId: number, text?: string }
 */
export const sendOrderToSupplier = async (req: Request, res: Response) => {
    try {
        const orderId = Number(req.params.orderId);
        const { supplierId, text } = req.body;
        const userId = (req as any).userId;

        if (!supplierId) {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'supplierId обязателен.' });
        }

        // Validate order exists
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Заказ не найден.' });
        }

        // Validate supplier exists and has Telegram configured
        const supplier = await prisma.supplier.findUnique({ where: { id: Number(supplierId) } });
        if (!supplier) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Поставщик не найден.' });
        }

        if (!supplier.telegramChatId) {
            return res.status(400).json({
                error: 'TELEGRAM_NOT_CONFIGURED',
                message: `У поставщика "${supplier.name}" не указан Telegram Chat ID. Настройте его в карточке поставщика.`,
            });
        }

        if (!supplier.telegramEnabled) {
            return res.status(400).json({
                error: 'TELEGRAM_DISABLED',
                message: `Отправка в Telegram отключена для поставщика "${supplier.name}". Включите в карточке поставщика.`,
            });
        }

        // Build message text if not provided
        const messageText = text || `Заказ #${orderId} для поставщика ${supplier.name}`;

        // Create TelegramOutbox entry (will be picked up by outboxWorker)
        const outboxEntry = await prisma.telegramOutbox.create({
            data: {
                chatId: supplier.telegramChatId,
                text: messageText,
                status: 'QUEUED',
                createdBy: userId ? String(userId) : 'system',
            },
        });

        // Create OrderTelegramLog entry
        const log = await prisma.orderTelegramLog.create({
            data: {
                orderId,
                supplierId: supplier.id,
                chatId: supplier.telegramChatId,
                threadId: supplier.telegramThreadId,
                status: 'QUEUED',
                text: messageText,
                sentByUserId: userId || null,
            },
        });

        res.json({
            message: 'Заказ поставлен в очередь на отправку в Telegram.',
            logId: log.id,
            outboxId: outboxEntry.id,
        });
    } catch (error) {
        console.error('sendOrderToSupplier error:', error);
        res.status(500).json({ error: 'Failed to send order to Telegram' });
    }
};

/**
 * GET /api/orders/:orderId/telegram-logs
 * Get Telegram send history for an order.
 */
export const getOrderTelegramLogs = async (req: Request, res: Response) => {
    try {
        const orderId = Number(req.params.orderId);

        const logs = await prisma.orderTelegramLog.findMany({
            where: { orderId },
            include: { supplier: { select: { id: true, name: true, code: true } } },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ logs });
    } catch (error) {
        console.error('getOrderTelegramLogs error:', error);
        res.status(500).json({ error: 'Failed to fetch telegram logs' });
    }
};
