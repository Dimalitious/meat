import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';

// ============================================
// ВОЗВРАТЫ ИЗ ТОЧЕК (ТЗ-compliant)
// ============================================

/**
 * GET /api/orders/:orderId/returns
 * Получить все возвраты по заказу (история)
 */
export const getOrderReturns = async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;

        const returns = await prisma.orderReturn.findMany({
            where: { orderId: Number(orderId) },
            include: {
                items: {
                    include: {
                        product: { select: { id: true, name: true, code: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(returns);
    } catch (error) {
        console.error('getOrderReturns error:', error);
        res.status(500).json({ error: 'Failed to fetch returns' });
    }
};

/**
 * GET /api/orders/:orderId/returns/:expeditionId
 * Получить возврат для конкретной экспедиции
 */
export const getReturnByExpedition = async (req: Request, res: Response) => {
    try {
        const { orderId, expeditionId } = req.params;

        const orderReturn = await prisma.orderReturn.findUnique({
            where: {
                orderId_expeditionId: {
                    orderId: Number(orderId),
                    expeditionId: Number(expeditionId)
                }
            },
            include: {
                items: {
                    include: {
                        product: { select: { id: true, name: true, code: true } }
                    }
                }
            }
        });

        res.json(orderReturn);
    } catch (error) {
        console.error('getReturnByExpedition error:', error);
        res.status(500).json({ error: 'Failed to fetch return' });
    }
};

/**
 * POST /api/orders/:orderId/returns
 * Создать или обновить возврат (ТЗ §6)
 * 
 * Body:
 * {
 *   expeditionId: number,          // Обязательно
 *   items: [
 *     { orderItemId: 1, qtyReturn: 2.5 },
 *     { orderItemId: 2, qtyReturn: 0 }
 *   ]
 * }
 */
export const createOrUpdateReturn = async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;
        const { expeditionId, items } = req.body;
        const username = (req as any).user?.username || 'system';

        // Валидация входных данных
        if (!expeditionId) {
            return res.status(400).json({ error: 'expeditionId обязателен' });
        }
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'items is required and must be an array' });
        }

        // Атомарная транзакция (паттерн "Антиграв") с увеличенным timeout
        const result = await prisma.$transaction(async (tx) => {
            // 0. RBAC: проверка роли (водитель, диспетчер, админ, экспедитор)
            const userRole = (req as any).user?.role?.toLowerCase();
            const allowedRoles = ['driver', 'dispatcher', 'admin', 'expeditor', 'user', 'manager'];
            if (userRole && !allowedRoles.includes(userRole)) {
                throw new Error('ACCESS_DENIED');
            }

            // 1. Получаем заказ с позициями
            const order = await tx.order.findUnique({
                where: { id: Number(orderId) },
                include: {
                    items: {
                        include: { product: true }
                    }
                }
            });

            if (!order) {
                throw new Error('ORDER_NOT_FOUND');
            }

            // 2. Проверка что экспедиция не закрыта (ТЗ §6.1)
            const expedition = await tx.expeditionJournal.findUnique({
                where: { id: Number(expeditionId) }
            });
            if (!expedition) {
                throw new Error('EXPEDITION_NOT_FOUND');
            }
            if (expedition.status === 'closed') {
                throw new Error('EXPEDITION_CLOSED');
            }

            // 3. Валидация: проверяем что все orderItemId существуют и qtyReturn валиден
            const orderItemMap = new Map(order.items.map(item => [item.id, item]));

            for (const returnItem of items) {
                const orderItem = orderItemMap.get(returnItem.orderItemId);
                if (!orderItem) {
                    throw new Error(`INVALID_ORDER_ITEM:${returnItem.orderItemId}`);
                }

                const qtyReturn = Number(returnItem.qtyReturn) || 0;
                const shippedQty = Number(orderItem.quantity) || 0; // Decimal -> number

                if (qtyReturn < 0) {
                    throw new Error(`NEGATIVE_QTY:${returnItem.orderItemId}`);
                }
                if (qtyReturn > shippedQty) {
                    throw new Error(`EXCEEDS_QUANTITY:${returnItem.orderItemId}:${shippedQty}`);
                }
            }

            // 4. Проверяем существует ли возврат для этой пары (orderId, expeditionId)
            const existingReturn = await tx.orderReturn.findUnique({
                where: {
                    orderId_expeditionId: {
                        orderId: Number(orderId),
                        expeditionId: Number(expeditionId)
                    }
                }
            });

            const isUpdate = !!existingReturn;

            // 5. Если возврат существует — удаляем ТОЛЬКО его items (не все возвраты!)
            if (existingReturn) {
                await tx.orderReturnItem.deleteMany({
                    where: { returnId: existingReturn.id }
                });
            }

            // 6. Подготавливаем позиции возврата
            let currentReturnQty = 0;
            let currentReturnSum = new Prisma.Decimal(0);

            const returnItemsData: any[] = [];

            for (const returnItem of items) {
                const orderItem = orderItemMap.get(returnItem.orderItemId)!;
                const qtyReturn = Number(returnItem.qtyReturn) || 0;

                const qtyShip = Number(orderItem.quantity) || 0; // Decimal -> number
                const priceDec = new Prisma.Decimal(orderItem.price); // number/Decimal -> Decimal

                const sumShip = new Prisma.Decimal(qtyShip).mul(priceDec);
                const sumNet = new Prisma.Decimal(qtyShip - qtyReturn).mul(priceDec);
                const returnSum = new Prisma.Decimal(qtyReturn).mul(priceDec);

                currentReturnQty += qtyReturn;
                currentReturnSum = currentReturnSum.add(returnSum);

                returnItemsData.push({
                    orderItemId: returnItem.orderItemId,
                    productId: orderItem.productId,
                    qtyShip,
                    qtyReturn,
                    price: priceDec, // Prisma точно принимает Decimal
                    sumShip,
                    sumNet
                });
            }

            // 7. Upsert возврата по уникальному ключу (orderId, expeditionId)
            const orderReturn = await tx.orderReturn.upsert({
                where: {
                    orderId_expeditionId: {
                        orderId: Number(orderId),
                        expeditionId: Number(expeditionId)
                    }
                },
                create: {
                    orderId: Number(orderId),
                    expeditionId: Number(expeditionId),
                    createdBy: username,
                    status: 'saved',
                    totalQty: currentReturnQty,
                    totalSum: currentReturnSum,
                    items: {
                        create: returnItemsData
                    }
                },
                update: {
                    createdBy: username,
                    status: 'saved',
                    totalQty: currentReturnQty,
                    totalSum: currentReturnSum,
                    items: {
                        create: returnItemsData
                    }
                },
                include: {
                    items: {
                        include: {
                            product: { select: { id: true, name: true, code: true } }
                        }
                    }
                }
            });

            // 8. Пересчитываем агрегаты Order по ВСЕМ возвратам (не только текущему!)
            const allReturns = await tx.orderReturn.findMany({
                where: { orderId: Number(orderId) },
                include: { items: true }
            });

            let orderTotalQty = 0;
            let orderTotalSum = new Prisma.Decimal(0);

            // Собираем qtyReturn по orderItemId из ВСЕХ возвратов
            const itemReturnMap = new Map<number, number>();

            for (const ret of allReturns) {
                orderTotalQty += ret.totalQty;
                orderTotalSum = orderTotalSum.add(ret.totalSum);

                // Накапливаем qtyReturn по позициям
                for (const item of ret.items) {
                    const current = itemReturnMap.get(item.orderItemId) || 0;
                    itemReturnMap.set(item.orderItemId, current + item.qtyReturn);
                }
            }

            const netTotalSum = new Prisma.Decimal(order.totalAmount).sub(orderTotalSum);

            await tx.order.update({
                where: { id: Number(orderId) },
                data: {
                    returnTotalQty: orderTotalQty,
                    returnTotalSum: orderTotalSum,
                    netTotalSum: netTotalSum
                }
            });

            // 8.1. Обновляем OrderItem.qtyReturn (ТЗ HARD §3.1.3 MUST)
            for (const orderItem of order.items) {
                const qtyReturn = itemReturnMap.get(orderItem.id) || 0;
                await tx.orderItem.update({
                    where: { id: orderItem.id },
                    data: { qtyReturn }
                });
            }

            // 9. Журналирование (ТЗ §9)
            await tx.returnAuditLog.create({
                data: {
                    orderId: Number(orderId),
                    returnId: orderReturn.id,
                    expeditionId: Number(expeditionId),
                    action: isUpdate ? 'UPDATED' : 'CREATED',
                    performedBy: username,
                    totalQty: currentReturnQty,
                    totalSum: currentReturnSum,
                    details: {
                        itemsCount: returnItemsData.length,
                        items: returnItemsData.map(i => ({
                            productId: i.productId,
                            qtyReturn: i.qtyReturn,
                            qtyShip: i.qtyShip
                        }))
                    }
                }
            });

            console.log(`[RETURN] Order #${orderId} Exp #${expeditionId}: ${isUpdate ? 'updated' : 'created'} by ${username}, returnQty=${currentReturnQty}, orderTotalQty=${orderTotalQty}`);

            return { orderReturn, isUpdate };
        }, { timeout: 30000 }); // Увеличенный timeout для длинных транзакций

        res.json(result.orderReturn);
    } catch (error: any) {
        console.error('createOrUpdateReturn error:', error);

        if (error.message === 'ORDER_NOT_FOUND') {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        if (error.message === 'EXPEDITION_NOT_FOUND') {
            return res.status(404).json({ error: 'Экспедиция не найдена' });
        }
        if (error.message === 'EXPEDITION_CLOSED') {
            return res.status(400).json({ error: 'Экспедиция закрыта, редактирование запрещено' });
        }
        if (error.message === 'ACCESS_DENIED') {
            return res.status(403).json({ error: 'Недостаточно прав для этой операции' });
        }
        if (error.message?.startsWith('INVALID_ORDER_ITEM:')) {
            return res.status(400).json({ error: 'Некорректная позиция заказа' });
        }
        if (error.message?.startsWith('NEGATIVE_QTY:')) {
            return res.status(400).json({ error: 'Количество возврата не может быть отрицательным' });
        }
        if (error.message?.startsWith('EXCEEDS_QUANTITY:')) {
            const parts = error.message.split(':');
            return res.status(400).json({
                error: `Количество возврата превышает отгрузку (макс: ${parts[2]})`
            });
        }

        res.status(500).json({
            error: 'Failed to create return',
            details: process.env.NODE_ENV === 'production' ? undefined : String(error?.message || error)
        });
    }
};

/**
 * DELETE /api/orders/:orderId/returns/:expeditionId
 * Удалить возврат для конкретной экспедиции (только для админа)
 */
export const deleteReturn = async (req: Request, res: Response) => {
    try {
        const { orderId, expeditionId } = req.params;
        const username = (req as any).user?.username || 'system';
        const userRole = (req as any).user?.role;

        // RBAC: только ADMIN может удалять возвраты (ТЗ §5.3)
        if (userRole !== 'ADMIN' && userRole !== 'admin') {
            return res.status(403).json({ error: 'Только администратор может удалять возвраты' });
        }

        await prisma.$transaction(async (tx) => {
            // Находим конкретный возврат
            const orderReturn = await tx.orderReturn.findUnique({
                where: {
                    orderId_expeditionId: {
                        orderId: Number(orderId),
                        expeditionId: Number(expeditionId)
                    }
                }
            });

            if (!orderReturn) {
                throw new Error('RETURN_NOT_FOUND');
            }

            // Удаляем возврат (items удалятся каскадно)
            await tx.orderReturn.delete({
                where: { id: orderReturn.id }
            });

            // Пересчитываем агрегаты заказа из оставшихся возвратов
            const remainingReturns = await tx.orderReturn.findMany({
                where: { orderId: Number(orderId) },
                include: { items: true }
            });

            let totalQty = 0;
            let totalSum = new Prisma.Decimal(0);
            const itemReturnMap = new Map<number, number>();

            for (const ret of remainingReturns) {
                totalQty += ret.totalQty;
                totalSum = totalSum.add(ret.totalSum);

                for (const item of ret.items) {
                    const current = itemReturnMap.get(item.orderItemId) || 0;
                    itemReturnMap.set(item.orderItemId, current + item.qtyReturn);
                }
            }

            // Получаем заказ для расчёта netTotalSum и обновления OrderItem
            const order = await tx.order.findUnique({
                where: { id: Number(orderId) },
                include: { items: true }
            });

            if (order) {
                const netTotalSum = new Prisma.Decimal(order.totalAmount).sub(totalSum);

                await tx.order.update({
                    where: { id: Number(orderId) },
                    data: {
                        returnTotalQty: totalQty,
                        returnTotalSum: totalSum,
                        netTotalSum: netTotalSum
                    }
                });

                // ТЗ HARD §3.1.4: обновляем/сбрасываем OrderItem.qtyReturn
                for (const orderItem of order.items) {
                    const qtyReturn = itemReturnMap.get(orderItem.id) || 0;
                    await tx.orderItem.update({
                        where: { id: orderItem.id },
                        data: { qtyReturn }
                    });
                }
            }

            // Журналирование RETURN_DELETED (ТЗ §9)
            await tx.returnAuditLog.create({
                data: {
                    orderId: Number(orderId),
                    returnId: null,  // Возврат уже удалён
                    expeditionId: Number(expeditionId),
                    action: 'DELETED',
                    performedBy: username,
                    totalQty: orderReturn.totalQty,
                    totalSum: orderReturn.totalSum,
                    details: {
                        deletedReturnId: orderReturn.id
                    }
                }
            });

            console.log(`[RETURN] Order #${orderId} Exp #${expeditionId}: deleted by ${username}`);
        });

        res.json({ success: true });
    } catch (error: any) {
        console.error('deleteReturn error:', error);

        if (error.message === 'RETURN_NOT_FOUND') {
            return res.status(404).json({ error: 'Возврат не найден' });
        }

        res.status(500).json({ error: 'Failed to delete return' });
    }
};
