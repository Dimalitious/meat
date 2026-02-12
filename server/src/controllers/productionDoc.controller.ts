import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { assertMmlUsableForNewOps, handleMmlGuardError } from '../services/mml.service';

const prisma = new PrismaClient();

// Типы для запросов
interface LoadFromPurchaseParams {
    dateFrom?: string;
    dateTo?: string;
    purchaseId?: number;
    supplierId?: number;
}

interface ApplyCuttingData {
    inputId: number;
    mmlId: number;
    outputs: Array<{
        productId: number;
        qtyOut: number;
    }>;
}

// ============================================
// GET /api/production-docs - Список документов
// ============================================
export const getProductionDocs = async (req: Request, res: Response) => {
    try {
        const { dateFrom, dateTo, warehouseId, status } = req.query;

        const where: Prisma.ProductionDocWhereInput = {};

        if (dateFrom || dateTo) {
            where.date = {};
            if (dateFrom) where.date.gte = new Date(dateFrom as string);
            if (dateTo) where.date.lte = new Date(dateTo as string);
        }

        if (warehouseId) {
            where.warehouseId = Number(warehouseId);
        }

        if (status) {
            where.status = status as string;
        }

        const docs = await prisma.productionDoc.findMany({
            where,
            include: {
                warehouse: true,
                createdBy: { select: { id: true, name: true, username: true } },
                inputs: {
                    include: {
                        product: { select: { id: true, code: true, name: true } },
                        purchase: { select: { id: true, purchaseDate: true } },
                    }
                },
                outputs: {
                    include: {
                        product: { select: { id: true, code: true, name: true } },
                    }
                },
                _count: {
                    select: { inputs: true, outputs: true, cuttingLines: true }
                }
            },
            orderBy: { date: 'desc' }
        });

        res.json(docs);
    } catch (error) {
        console.error('Error fetching production docs:', error);
        res.status(500).json({ error: 'Ошибка получения документов производства' });
    }
};

// ============================================
// GET /api/production-docs/:id - Получить документ
// ============================================
export const getProductionDoc = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const doc = await prisma.productionDoc.findUnique({
            where: { id: Number(id) },
            include: {
                warehouse: true,
                createdBy: { select: { id: true, name: true, username: true } },
                inputs: {
                    include: {
                        product: { select: { id: true, code: true, name: true, category: true } },
                        purchase: {
                            select: {
                                id: true,
                                purchaseDate: true,
                            }
                        },
                        purchaseItem: {
                            include: {
                                supplier: { select: { id: true, name: true } }
                            }
                        },
                        loadedBy: { select: { id: true, name: true } }
                    },
                    orderBy: { loadedAt: 'desc' }
                },
                outputs: {
                    include: {
                        product: { select: { id: true, code: true, name: true, category: true } },
                    },
                    orderBy: { productId: 'asc' }
                },
                cuttingLines: {
                    include: {
                        mml: { include: { product: { select: { name: true } } } },
                        outProduct: { select: { id: true, code: true, name: true } },
                        productionInput: {
                            include: { product: { select: { name: true } } }
                        }
                    }
                }
            }
        });

        if (!doc) {
            return res.status(404).json({ error: 'Документ не найден' });
        }

        res.json(doc);
    } catch (error) {
        console.error('Error fetching production doc:', error);
        res.status(500).json({ error: 'Ошибка получения документа производства' });
    }
};

// ============================================
// POST /api/production-docs - Создать документ
// ============================================
export const createProductionDoc = async (req: Request, res: Response) => {
    try {
        const { date, warehouseId } = req.body;
        const userId = (req as any).user?.id;

        if (!date || !warehouseId) {
            return res.status(400).json({ error: 'Укажите дату и склад' });
        }

        // Проверяем, что склад существует
        const warehouse = await prisma.warehouse.findUnique({
            where: { id: Number(warehouseId) }
        });

        if (!warehouse) {
            return res.status(404).json({ error: 'Склад не найден' });
        }

        // Проверяем уникальность (дата + склад)
        const existing = await prisma.productionDoc.findFirst({
            where: {
                date: new Date(date),
                warehouseId: Number(warehouseId)
            }
        });

        if (existing) {
            return res.status(400).json({
                error: 'Документ на эту дату и склад уже существует',
                existingId: existing.id
            });
        }

        const doc = await prisma.productionDoc.create({
            data: {
                date: new Date(date),
                warehouseId: Number(warehouseId),
                createdByUserId: userId,
                status: 'draft'
            },
            include: {
                warehouse: true,
                createdBy: { select: { id: true, name: true } }
            }
        });

        res.status(201).json(doc);
    } catch (error) {
        console.error('Error creating production doc:', error);
        res.status(500).json({ error: 'Ошибка создания документа производства' });
    }
};

// ============================================
// POST /api/production-docs/:id/load-from-purchase
// Загрузить сырьё из закупок
// ============================================
export const loadFromPurchase = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { dateFrom, dateTo, purchaseId, supplierId } = req.body as LoadFromPurchaseParams;
        const userId = (req as any).user?.id;

        // 1. Получить документ производства
        const doc = await prisma.productionDoc.findUnique({
            where: { id: Number(id) }
        });

        if (!doc) {
            return res.status(404).json({ error: 'Документ не найден' });
        }

        // 2. Проверить статус
        if (doc.status === 'done' || doc.status === 'canceled') {
            return res.status(400).json({ error: 'Документ закрыт, загрузка невозможна' });
        }

        // 3. Определить диапазон дат
        const searchDateFrom = dateFrom ? new Date(dateFrom) : doc.date;
        const searchDateTo = dateTo ? new Date(dateTo) : doc.date;

        // 4. Получить подходящие позиции закупок
        const purchaseItemsWhere: Prisma.PurchaseItemWhereInput = {
            purchase: {
                purchaseDate: {
                    gte: searchDateFrom,
                    lte: searchDateTo,
                },
                isDisabled: false,
                ...(purchaseId ? { id: Number(purchaseId) } : {}),
            },
            ...(supplierId ? { supplierId: Number(supplierId) } : {}),
        };

        const purchaseItems = await prisma.purchaseItem.findMany({
            where: purchaseItemsWhere,
            include: {
                purchase: true,
                product: { select: { id: true, code: true, name: true } },
                supplier: { select: { id: true, name: true } },
                // Сколько уже загружено в производства
                productionInputs: {
                    select: { qtyIn: true },
                    where: {
                        productionDoc: { status: { notIn: ['canceled'] } }
                    }
                }
            }
        });

        // 5. Фильтруем только те, у которых есть остаток
        let loadedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const item of purchaseItems) {
            // Вычисляем уже загруженное количество
            const alreadyLoaded = item.productionInputs.reduce(
                (sum, pi) => sum + Number(pi.qtyIn), 0
            );

            const availableQty = Number(item.qty) - alreadyLoaded;

            if (availableQty <= 0) {
                skippedCount++;
                continue;
            }

            // 6. Upsert в production_input
            const result = await prisma.productionInput.upsert({
                where: {
                    productionDocId_purchaseItemId: {
                        productionDocId: Number(id),
                        purchaseItemId: item.id,
                    },
                },
                create: {
                    productionDocId: Number(id),
                    purchaseId: item.purchaseId,
                    purchaseItemId: item.id,
                    productId: item.productId,
                    warehouseId: doc.warehouseId,
                    qtyIn: new Prisma.Decimal(availableQty),
                    priceIn: item.price,
                    loadedByUserId: userId,
                },
                update: {
                    qtyIn: new Prisma.Decimal(availableQty),
                    priceIn: item.price,
                },
            });

            // Проверяем, было ли это создание или обновление
            if (result.loadedAt.getTime() === result.loadedAt.getTime()) {
                loadedCount++;
            } else {
                updatedCount++;
            }
        }

        // 7. Обновить статус документа
        if (loadedCount > 0 || updatedCount > 0) {
            await prisma.productionDoc.update({
                where: { id: Number(id) },
                data: { status: 'loaded' },
            });
        }

        // 8. Получить обновлённый документ
        const updatedDoc = await prisma.productionDoc.findUnique({
            where: { id: Number(id) },
            include: {
                inputs: {
                    include: {
                        product: { select: { id: true, code: true, name: true } },
                        purchase: { select: { id: true, purchaseDate: true } },
                        purchaseItem: {
                            include: { supplier: { select: { name: true } } }
                        }
                    }
                },
                _count: { select: { inputs: true } }
            }
        });

        res.json({
            message: `Загружено: ${loadedCount}, обновлено: ${updatedCount}, пропущено: ${skippedCount}`,
            loaded: loadedCount,
            updated: updatedCount,
            skipped: skippedCount,
            doc: updatedDoc,
        });
    } catch (error) {
        console.error('Error loading from purchase:', error);
        res.status(500).json({ error: 'Ошибка загрузки сырья из закупок' });
    }
};

// ============================================
// POST /api/production-docs/:id/clear-inputs
// Очистить загруженное сырьё
// ============================================
export const clearInputs = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const doc = await prisma.productionDoc.findUnique({
            where: { id: Number(id) },
            include: { inputs: true }
        });

        if (!doc) {
            return res.status(404).json({ error: 'Документ не найден' });
        }

        if (doc.status === 'done' || doc.status === 'canceled') {
            return res.status(400).json({ error: 'Документ закрыт' });
        }

        // Проверяем, есть ли использованные inputs
        const hasUsed = doc.inputs.some(i => Number(i.qtyUsed) > 0);
        if (hasUsed) {
            return res.status(400).json({
                error: 'Нельзя очистить — есть использованное сырьё. Сначала отмените разделку.'
            });
        }

        // Удаляем все inputs
        await prisma.productionInput.deleteMany({
            where: { productionDocId: Number(id) }
        });

        // Возвращаем статус в draft
        await prisma.productionDoc.update({
            where: { id: Number(id) },
            data: { status: 'draft' }
        });

        res.json({ message: 'Загруженное сырьё очищено' });
    } catch (error) {
        console.error('Error clearing inputs:', error);
        res.status(500).json({ error: 'Ошибка очистки' });
    }
};

// ============================================
// POST /api/production-docs/:id/apply-cutting
// Применить разделку по MML
// ============================================
export const applyCutting = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { inputId, mmlId, outputs } = req.body as ApplyCuttingData;
        const userId = (req as any).user?.id;

        if (!inputId || !mmlId || !outputs || outputs.length === 0) {
            return res.status(400).json({ error: 'Укажите входное сырьё, MML и выходные позиции' });
        }

        // 1. Получить документ и input
        const doc = await prisma.productionDoc.findUnique({
            where: { id: Number(id) }
        });

        if (!doc || doc.status === 'done' || doc.status === 'canceled') {
            return res.status(400).json({ error: 'Документ недоступен для разделки' });
        }

        const input = await prisma.productionInput.findUnique({
            where: { id: inputId }
        });

        if (!input || input.productionDocId !== Number(id)) {
            return res.status(404).json({ error: 'Входное сырьё не найдено в этом документе' });
        }

        // 2. Проверить доступное количество
        const qtyAvailable = Number(input.qtyIn) - Number(input.qtyUsed);
        const totalConsumed = outputs.reduce((sum, o) => sum + o.qtyOut, 0);

        if (totalConsumed > qtyAvailable) {
            return res.status(400).json({
                error: `Недостаточно сырья. Доступно: ${qtyAvailable.toFixed(3)}, запрошено: ${totalConsumed.toFixed(3)}`
            });
        }

        // 3. Проверить MML + guards
        const mml = await prisma.productionMml.findUnique({
            where: { id: mmlId },
            include: { nodes: { where: { isActive: true }, include: { product: true } } }
        });

        if (!mml) {
            return res.status(404).json({ error: 'MML не найден' });
        }
        assertMmlUsableForNewOps(mml);

        // 4. Создать линии разделки и обновить outputs (в транзакции)
        await prisma.$transaction(async (tx) => {
            for (const output of outputs) {
                // Создать линию разделки
                await tx.productionCuttingLine.create({
                    data: {
                        productionDocId: Number(id),
                        productionInputId: inputId,
                        mmlId: mmlId,
                        outProductId: output.productId,
                        qtyOut: new Prisma.Decimal(output.qtyOut),
                        qtyInConsumed: new Prisma.Decimal(output.qtyOut), // Упрощённо 1:1
                        createdByUserId: userId,
                    },
                });

                // Upsert в ProductionOutput
                await tx.productionOutput.upsert({
                    where: {
                        productionDocId_productId: {
                            productionDocId: Number(id),
                            productId: output.productId,
                        },
                    },
                    create: {
                        productionDocId: Number(id),
                        productId: output.productId,
                        qtyOut: new Prisma.Decimal(output.qtyOut),
                    },
                    update: {
                        qtyOut: { increment: output.qtyOut },
                    },
                });
            }

            // Обновить qtyUsed в input
            await tx.productionInput.update({
                where: { id: inputId },
                data: { qtyUsed: { increment: totalConsumed } },
            });

            // Обновить статус документа
            await tx.productionDoc.update({
                where: { id: Number(id) },
                data: { status: 'cutting' },
            });
        });

        // 5. Получить обновлённый документ
        const updatedDoc = await prisma.productionDoc.findUnique({
            where: { id: Number(id) },
            include: {
                inputs: {
                    include: { product: { select: { name: true } } }
                },
                outputs: {
                    include: { product: { select: { name: true } } }
                },
            }
        });

        res.json({
            message: `Разделка применена. Израсходовано сырья: ${totalConsumed.toFixed(3)} кг`,
            doc: updatedDoc,
        });
    } catch (error) {
        if (handleMmlGuardError(res, error)) return;
        console.error('applyCutting error:', error);
        res.status(500).json({ error: 'Ошибка при применении разделки' });
    }
};

// ============================================
// POST /api/production-docs/:id/finalize
// Провести документ (status → done)
// ============================================
export const finalizeDoc = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const doc = await prisma.productionDoc.findUnique({
            where: { id: Number(id) },
            include: { inputs: true, outputs: true }
        });

        if (!doc) {
            return res.status(404).json({ error: 'Документ не найден' });
        }

        if (doc.status === 'done') {
            return res.status(400).json({ error: 'Документ уже проведён' });
        }

        if (doc.status === 'canceled') {
            return res.status(400).json({ error: 'Документ отменён' });
        }

        if (doc.outputs.length === 0) {
            return res.status(400).json({ error: 'Нет выходных позиций. Сначала выполните разделку.' });
        }

        // Проводим документ
        const updated = await prisma.productionDoc.update({
            where: { id: Number(id) },
            data: { status: 'done' },
            include: {
                outputs: { include: { product: { select: { name: true } } } }
            }
        });

        res.json({
            message: 'Документ проведён',
            doc: updated,
        });
    } catch (error) {
        console.error('Error finalizing doc:', error);
        res.status(500).json({ error: 'Ошибка проведения документа' });
    }
};

// ============================================
// POST /api/production-docs/:id/cancel
// Отменить документ
// ============================================
export const cancelDoc = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const doc = await prisma.productionDoc.findUnique({
            where: { id: Number(id) }
        });

        if (!doc) {
            return res.status(404).json({ error: 'Документ не найден' });
        }

        if (doc.status === 'canceled') {
            return res.status(400).json({ error: 'Документ уже отменён' });
        }

        // Отменяем документ (данные остаются для аудита)
        const updated = await prisma.productionDoc.update({
            where: { id: Number(id) },
            data: { status: 'canceled' }
        });

        res.json({
            message: 'Документ отменён',
            doc: updated,
        });
    } catch (error) {
        console.error('Error canceling doc:', error);
        res.status(500).json({ error: 'Ошибка отмены документа' });
    }
};

// ============================================
// DELETE /api/production-docs/:id
// Удалить документ (только draft)
// ============================================
export const deleteProductionDoc = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const doc = await prisma.productionDoc.findUnique({
            where: { id: Number(id) }
        });

        if (!doc) {
            return res.status(404).json({ error: 'Документ не найден' });
        }

        if (doc.status !== 'draft') {
            return res.status(400).json({
                error: 'Удалить можно только черновик. Для других статусов используйте отмену.'
            });
        }

        await prisma.productionDoc.delete({
            where: { id: Number(id) }
        });

        res.json({ message: 'Документ удалён' });
    } catch (error) {
        console.error('Error deleting production doc:', error);
        res.status(500).json({ error: 'Ошибка удаления документа' });
    }
};

// ============================================
// GET /api/production-docs/available-purchases
// Получить закупки, доступные для загрузки
// ============================================
export const getAvailablePurchases = async (req: Request, res: Response) => {
    try {
        const { dateFrom, dateTo, supplierId, warehouseId } = req.query;

        if (!dateFrom) {
            return res.status(400).json({ error: 'Укажите дату начала периода' });
        }

        const searchDateFrom = new Date(dateFrom as string);
        const searchDateTo = dateTo ? new Date(dateTo as string) : searchDateFrom;

        // Получаем закупки за период
        const purchases = await prisma.purchase.findMany({
            where: {
                purchaseDate: {
                    gte: searchDateFrom,
                    lte: searchDateTo
                },
                isDisabled: false,
            },
            include: {
                items: {
                    where: supplierId ? { supplierId: Number(supplierId) } : undefined,
                    include: {
                        product: { select: { id: true, code: true, name: true, category: true } },
                        supplier: { select: { id: true, name: true } },
                        productionInputs: {
                            select: { qtyIn: true },
                            where: {
                                productionDoc: { status: { notIn: ['canceled'] } }
                            }
                        }
                    }
                },
                createdByUser: { select: { name: true } }
            },
            orderBy: { purchaseDate: 'desc' }
        });

        // Форматируем и вычисляем остатки
        const result = purchases.map(p => ({
            id: p.id,
            date: p.purchaseDate,
            totalAmount: p.totalAmount,
            createdBy: p.createdByUser?.name,
            items: p.items.map(item => {
                const loaded = item.productionInputs.reduce((sum, pi) => sum + Number(pi.qtyIn), 0);
                const available = Number(item.qty) - loaded;
                return {
                    id: item.id,
                    product: item.product,
                    supplier: item.supplier,
                    qty: Number(item.qty),
                    qtyLoaded: loaded,
                    qtyAvailable: available,
                    price: Number(item.price),
                    isAvailable: available > 0
                };
            }).filter(item => item.qtyAvailable > 0)  // Только те, у которых есть остаток
        })).filter(p => p.items.length > 0);  // Только закупки с доступными позициями

        res.json(result);
    } catch (error) {
        console.error('Error fetching available purchases:', error);
        res.status(500).json({ error: 'Ошибка получения доступных закупок' });
    }
};
