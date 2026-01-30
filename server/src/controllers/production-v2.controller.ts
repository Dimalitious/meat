import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// MML - Управление техкартами
// ============================================

/**
 * Получить список всех MML (для левой панели)
 */
export const getMmlList = async (req: Request, res: Response) => {
    try {
        const { search, isLocked, showDeleted } = req.query;

        const where: any = {};

        // По умолчанию не показываем удалённые
        if (showDeleted !== 'true') {
            where.isDeleted = false;
        }

        if (search) {
            where.product = {
                OR: [
                    { name: { contains: String(search), mode: 'insensitive' } },
                    { code: { contains: String(search), mode: 'insensitive' } }
                ]
            };
        }

        if (isLocked !== undefined) {
            where.isLocked = isLocked === 'true';
        }

        const mmls = await prisma.productionMml.findMany({
            where,
            include: {
                product: {
                    select: { id: true, code: true, name: true, priceListName: true }
                },
                creator: {
                    select: { id: true, name: true }
                },
                _count: {
                    select: { nodes: true, runs: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(mmls);
    } catch (error) {
        console.error('getMmlList error:', error);
        res.status(500).json({ error: 'Failed to fetch MML list' });
    }
};

/**
 * Получить MML по ID с деревом узлов
 */
export const getMmlById = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        const mml = await prisma.productionMml.findUnique({
            where: { id },
            include: {
                product: {
                    select: { id: true, code: true, name: true, priceListName: true }
                },
                creator: {
                    select: { id: true, name: true }
                },
                nodes: {
                    include: {
                        product: {
                            select: { id: true, code: true, name: true, priceListName: true }
                        }
                    },
                    orderBy: [{ parentNodeId: 'asc' }, { sortOrder: 'asc' }]
                }
            }
        });

        if (!mml) {
            return res.status(404).json({ error: 'MML not found' });
        }

        // Построение дерева на стороне сервера
        const rootNodes = mml.nodes.filter(n => n.parentNodeId === null);
        const childNodes = mml.nodes.filter(n => n.parentNodeId !== null);

        const tree = rootNodes.map(root => ({
            ...root,
            children: childNodes.filter(c => c.parentNodeId === root.id)
        }));

        res.json({
            ...mml,
            rootNodes: tree
        });
    } catch (error) {
        console.error('getMmlById error:', error);
        res.status(500).json({ error: 'Failed to fetch MML' });
    }
};

/**
 * Получить MML по productId
 */
export const getMmlByProductId = async (req: Request, res: Response) => {
    try {
        const productId = Number(req.params.productId);

        const mml = await prisma.productionMml.findUnique({
            where: { productId },
            include: {
                product: {
                    select: { id: true, code: true, name: true, priceListName: true }
                },
                nodes: {
                    include: {
                        product: {
                            select: { id: true, code: true, name: true, priceListName: true }
                        }
                    },
                    orderBy: [{ parentNodeId: 'asc' }, { sortOrder: 'asc' }]
                }
            }
        });

        if (!mml) {
            return res.json(null); // MML не существует для этого товара
        }

        // Построение дерева
        const rootNodes = mml.nodes.filter(n => n.parentNodeId === null);
        const childNodes = mml.nodes.filter(n => n.parentNodeId !== null);

        const tree = rootNodes.map(root => ({
            ...root,
            children: childNodes.filter(c => c.parentNodeId === root.id)
        }));

        res.json({
            ...mml,
            rootNodes: tree
        });
    } catch (error) {
        console.error('getMmlByProductId error:', error);
        res.status(500).json({ error: 'Failed to fetch MML' });
    }
};

/**
 * Создать новый MML
 */
export const createMml = async (req: Request, res: Response) => {
    try {
        const { productId } = req.body;
        const userId = (req as any).user?.userId;

        if (!productId) {
            return res.status(400).json({ error: 'productId is required' });
        }

        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Проверка, что MML для этого товара не существует
        const existing = await prisma.productionMml.findUnique({
            where: { productId: Number(productId) }
        });

        if (existing) {
            return res.status(400).json({ error: 'MML already exists for this product' });
        }

        const mml = await prisma.productionMml.create({
            data: {
                productId: Number(productId),
                createdBy: userId
            },
            include: {
                product: {
                    select: { id: true, code: true, name: true, priceListName: true }
                },
                creator: {
                    select: { id: true, name: true, username: true }
                }
            }
        });

        // Возвращаем с пустым деревом для нового MML
        res.status(201).json({
            ...mml,
            rootNodes: []
        });
    } catch (error) {
        console.error('createMml error:', error);
        res.status(500).json({ error: 'Failed to create MML' });
    }
};

/**
 * Добавить корневой узел в MML
 */
export const addRootNode = async (req: Request, res: Response) => {
    try {
        const mmlId = Number(req.params.id);
        const { productId } = req.body;

        // Проверка что MML не заблокирован
        const mml = await prisma.productionMml.findUnique({ where: { id: mmlId } });
        if (!mml) {
            return res.status(404).json({ error: 'MML not found' });
        }
        if (mml.isLocked) {
            return res.status(400).json({ error: 'MML is locked, cannot edit' });
        }

        // Получить максимальный sortOrder
        const lastNode = await prisma.productionMmlNode.findFirst({
            where: { mmlId, parentNodeId: null },
            orderBy: { sortOrder: 'desc' }
        });
        const sortOrder = (lastNode?.sortOrder ?? -1) + 1;

        const node = await prisma.productionMmlNode.create({
            data: {
                mmlId,
                parentNodeId: null,
                productId: Number(productId),
                sortOrder
            },
            include: {
                product: {
                    select: { id: true, code: true, name: true, priceListName: true }
                }
            }
        });

        res.status(201).json(node);
    } catch (error) {
        console.error('addRootNode error:', error);
        res.status(500).json({ error: 'Failed to add root node' });
    }
};

/**
 * Добавить подпозицию (дочерний узел)
 */
export const addChildNode = async (req: Request, res: Response) => {
    try {
        const mmlId = Number(req.params.id);
        const parentNodeId = Number(req.params.parentNodeId);
        const { productId } = req.body;

        // Проверка что MML не заблокирован
        const mml = await prisma.productionMml.findUnique({ where: { id: mmlId } });
        if (!mml) {
            return res.status(404).json({ error: 'MML not found' });
        }
        if (mml.isLocked) {
            return res.status(400).json({ error: 'MML is locked, cannot edit' });
        }

        // Проверка что родительский узел существует
        const parentNode = await prisma.productionMmlNode.findUnique({ where: { id: parentNodeId } });
        if (!parentNode || parentNode.mmlId !== mmlId) {
            return res.status(400).json({ error: 'Parent node not found' });
        }

        // Получить максимальный sortOrder среди детей
        const lastChild = await prisma.productionMmlNode.findFirst({
            where: { mmlId, parentNodeId },
            orderBy: { sortOrder: 'desc' }
        });
        const sortOrder = (lastChild?.sortOrder ?? -1) + 1;

        const node = await prisma.productionMmlNode.create({
            data: {
                mmlId,
                parentNodeId,
                productId: Number(productId),
                sortOrder
            },
            include: {
                product: {
                    select: { id: true, code: true, name: true, priceListName: true }
                }
            }
        });

        res.status(201).json(node);
    } catch (error) {
        console.error('addChildNode error:', error);
        res.status(500).json({ error: 'Failed to add child node' });
    }
};

/**
 * Удалить узел MML
 */
export const deleteNode = async (req: Request, res: Response) => {
    try {
        const nodeId = Number(req.params.nodeId);

        const node = await prisma.productionMmlNode.findUnique({
            where: { id: nodeId },
            include: { mml: true }
        });

        if (!node) {
            return res.status(404).json({ error: 'Node not found' });
        }
        if (node.mml.isLocked) {
            return res.status(400).json({ error: 'MML is locked, cannot delete node' });
        }

        // Cascade delete удалит и дочерние узлы
        await prisma.productionMmlNode.delete({ where: { id: nodeId } });

        res.json({ success: true });
    } catch (error) {
        console.error('deleteNode error:', error);
        res.status(500).json({ error: 'Failed to delete node' });
    }
};

/**
 * Зафиксировать/разблокировать MML (переключение)
 */
export const toggleMmlLock = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        // Получаем текущее состояние
        const current = await prisma.productionMml.findUnique({ where: { id } });
        if (!current) {
            return res.status(404).json({ error: 'MML not found' });
        }

        // Переключаем состояние
        const mml = await prisma.productionMml.update({
            where: { id },
            data: { isLocked: !current.isLocked },
            include: {
                product: {
                    select: { id: true, code: true, name: true, priceListName: true }
                },
                creator: {
                    select: { id: true, name: true }
                },
                nodes: {
                    include: {
                        product: {
                            select: { id: true, code: true, name: true, priceListName: true }
                        }
                    },
                    orderBy: [{ parentNodeId: 'asc' }, { sortOrder: 'asc' }]
                }
            }
        });

        // Строим дерево для ответа
        const rootNodesT = mml.nodes.filter(n => n.parentNodeId === null);
        const childNodes = mml.nodes.filter(n => n.parentNodeId !== null);
        const tree = rootNodesT.map(root => ({
            ...root,
            children: childNodes.filter(c => c.parentNodeId === root.id)
        }));

        res.json({
            ...mml,
            rootNodes: tree
        });
    } catch (error) {
        console.error('toggleMmlLock error:', error);
        res.status(500).json({ error: 'Failed to toggle MML lock' });
    }
};

/**
 * Удалить MML
 */
export const deleteMml = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        const mml = await prisma.productionMml.findUnique({
            where: { id },
            include: {
                _count: { select: { runs: true } }
            }
        });

        if (!mml) {
            return res.status(404).json({ error: 'MML not found' });
        }

        if (mml.isLocked) {
            return res.status(400).json({ error: 'Cannot delete locked MML. Unlock it first.' });
        }

        if (mml._count.runs > 0) {
            return res.status(400).json({ error: 'Cannot delete MML with production runs. Delete runs first.' });
        }

        // Удаляем MML (cascade удалит узлы)
        await prisma.productionMml.delete({ where: { id } });

        res.json({ success: true });
    } catch (error) {
        console.error('deleteMml error:', error);
        res.status(500).json({ error: 'Failed to delete MML' });
    }
};

/**
 * Мягкое удаление MML (пометить как удалённый)
 */
export const softDeleteMml = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        const mml = await prisma.productionMml.findUnique({ where: { id } });
        if (!mml) {
            return res.status(404).json({ error: 'MML not found' });
        }

        const updated = await prisma.productionMml.update({
            where: { id },
            data: { isDeleted: true },
            include: {
                product: { select: { id: true, code: true, name: true } },
                creator: { select: { id: true, name: true, username: true } }
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('softDeleteMml error:', error);
        res.status(500).json({ error: 'Failed to soft delete MML' });
    }
};

/**
 * Восстановить MML (снять пометку удаления)
 */
export const restoreMml = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        const mml = await prisma.productionMml.findUnique({ where: { id } });
        if (!mml) {
            return res.status(404).json({ error: 'MML not found' });
        }

        const updated = await prisma.productionMml.update({
            where: { id },
            data: { isDeleted: false },
            include: {
                product: { select: { id: true, code: true, name: true } },
                creator: { select: { id: true, name: true, username: true } }
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('restoreMml error:', error);
        res.status(500).json({ error: 'Failed to restore MML' });
    }
};

// ============================================
// PRODUCTION RUN - Выработка (журнал)
// ============================================

/**
 * Получить список выработок (журнал производства)
 */
export const getProductionRuns = async (req: Request, res: Response) => {
    try {
        const { dateFrom, dateTo, isLocked, productId, showHidden } = req.query;

        const where: any = {
            // По умолчанию не показываем скрытые
            isHidden: showHidden === 'true' ? undefined : false
        };

        // Фильтрация по дате выработки (productionDate)
        if (dateFrom || dateTo) {
            where.productionDate = {};
            if (dateFrom) {
                where.productionDate.gte = new Date(String(dateFrom));
            }
            if (dateTo) {
                const to = new Date(String(dateTo));
                to.setHours(23, 59, 59, 999);
                where.productionDate.lte = to;
            }
        }

        if (isLocked !== undefined) {
            where.isLocked = isLocked === 'true';
        }

        if (productId) {
            where.productId = Number(productId);
        }

        const runs = await prisma.productionRun.findMany({
            where,
            include: {
                product: {
                    select: { id: true, code: true, name: true, priceListName: true }
                },
                user: {
                    select: { id: true, name: true }
                },
                mml: {
                    select: { id: true }
                },
                _count: {
                    select: { values: true }
                }
            },
            orderBy: { productionDate: 'desc' }
        });

        console.log('[DEBUG getProductionRuns] Filter:', { dateFrom, dateTo }, 'where:', JSON.stringify(where));
        console.log('[DEBUG getProductionRuns] Returned', runs.length, 'runs:',
            runs.map(r => ({ id: r.id, productId: r.productId, productName: r.product?.name?.substring(0, 30), productionDate: r.productionDate })));

        // Если запрошено — найти productIds что имеют runs ВНЕ диапазона дат
        const { includeProductsWithRunsOutside } = req.query;
        let productIdsWithRunsOutsideRange: number[] = [];

        if (includeProductsWithRunsOutside === 'true' && dateFrom && dateTo) {
            // Нормализуем даты для сравнения (без времени)
            const fromDateStr = String(dateFrom).slice(0, 10); // "2026-01-26"
            const toDateStr = String(dateTo).slice(0, 10);     // "2026-01-26"

            console.log('[DEBUG productIdsOutside] Checking range:', fromDateStr, '-', toDateStr);

            // Найти productIds, у которых ВСЕ runs вне диапазона
            const productRunCounts: Map<number, { inRange: number; outOfRange: number }> = new Map();

            const allRuns = await prisma.productionRun.findMany({
                where: { isHidden: false },
                select: { productId: true, productionDate: true }
            });

            for (const run of allRuns) {
                const pid = run.productId;
                // Нормализуем дату run к строке YYYY-MM-DD
                const runDateStr = new Date(run.productionDate).toISOString().slice(0, 10);
                const inRange = runDateStr >= fromDateStr && runDateStr <= toDateStr;

                if (!productRunCounts.has(pid)) {
                    productRunCounts.set(pid, { inRange: 0, outOfRange: 0 });
                }
                const counts = productRunCounts.get(pid)!;
                if (inRange) counts.inRange++;
                else counts.outOfRange++;
            }

            // ProductIds, у которых есть runs ВНЕ диапазона И НЕТ runs ВНУТРИ диапазона
            productIdsWithRunsOutsideRange = Array.from(productRunCounts.entries())
                .filter(([_, counts]) => counts.outOfRange > 0 && counts.inRange === 0)
                .map(([pid, _]) => pid);

            console.log('[DEBUG productIdsOutside] Products with runs outside range:', productIdsWithRunsOutsideRange);
            console.log('[DEBUG productIdsOutside] Product run counts:', Object.fromEntries(productRunCounts));
        }

        res.json({
            runs,
            productIdsWithRunsOutsideRange
        });
    } catch (error) {
        console.error('getProductionRuns error:', error);
        res.status(500).json({ error: 'Failed to fetch production runs' });
    }
};

/**
 * Получить выработку по ID с деревом значений
 */
export const getProductionRunById = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        const run = await prisma.productionRun.findUnique({
            where: { id },
            include: {
                product: {
                    select: { id: true, code: true, name: true, priceListName: true }
                },
                user: {
                    select: { id: true, name: true }
                },
                mml: {
                    include: {
                        nodes: {
                            include: {
                                product: {
                                    select: { id: true, code: true, name: true, priceListName: true }
                                }
                            },
                            orderBy: [{ parentNodeId: 'asc' }, { sortOrder: 'asc' }]
                        }
                    }
                },
                values: true
            }
        });

        if (!run) {
            return res.status(404).json({ error: 'Production run not found' });
        }

        // Построение дерева с значениями
        const valuesMap = new Map(run.values.map(v => [v.mmlNodeId, v.value]));
        const nodes = run.mml.nodes;
        const rootNodes = nodes.filter(n => n.parentNodeId === null);
        const childNodes = nodes.filter(n => n.parentNodeId !== null);

        const tree = rootNodes.map(root => ({
            ...root,
            value: valuesMap.get(root.id) ?? null,
            children: childNodes
                .filter(c => c.parentNodeId === root.id)
                .map(child => ({
                    ...child,
                    value: valuesMap.get(child.id) ?? null
                }))
        }));

        res.json({
            ...run,
            mml: {
                ...run.mml,
                rootNodes: tree
            },
            values: run.values
        });
    } catch (error) {
        console.error('getProductionRunById error:', error);
        res.status(500).json({ error: 'Failed to fetch production run' });
    }
};

/**
 * Создать новую выработку
 */
export const createProductionRun = async (req: Request, res: Response) => {
    try {
        const { productId, productionDate, plannedWeight } = req.body;
        const userId = (req as any).user?.userId;

        if (!productId) {
            return res.status(400).json({ error: 'productId is required' });
        }

        // Проверка что MML существует и получаем его структуру
        const mml = await prisma.productionMml.findUnique({
            where: { productId: Number(productId) },
            include: {
                nodes: {
                    include: {
                        product: {
                            select: { id: true, code: true, name: true, priceListName: true }
                        }
                    },
                    orderBy: [{ parentNodeId: 'asc' }, { sortOrder: 'asc' }]
                }
            }
        });

        if (!mml) {
            return res.status(400).json({ error: 'MML not found for this product. Create MML first.' });
        }

        const run = await prisma.productionRun.create({
            data: {
                productId: Number(productId),
                mmlId: mml.id,
                userId,
                productionDate: productionDate ? new Date(productionDate) : new Date(),
                plannedWeight: plannedWeight ? Number(plannedWeight) : null,
                actualWeight: 0,
                isHidden: false
            },
            include: {
                product: {
                    select: { id: true, code: true, name: true, priceListName: true }
                },
                user: {
                    select: { id: true, name: true }
                }
            }
        });

        // Построение дерева MML для ответа
        const rootNodes = mml.nodes.filter(n => n.parentNodeId === null);
        const childNodes = mml.nodes.filter(n => n.parentNodeId !== null);
        const tree = rootNodes.map(root => ({
            ...root,
            value: null,
            children: childNodes
                .filter(c => c.parentNodeId === root.id)
                .map(child => ({
                    ...child,
                    value: null
                }))
        }));

        res.status(201).json({
            ...run,
            mml: {
                ...mml,
                rootNodes: tree
            },
            values: []
        });
    } catch (error) {
        console.error('createProductionRun error:', error);
        res.status(500).json({ error: 'Failed to create production run' });
    }
};

/**
 * Сохранить значения выработки
 */
export const saveProductionRunValues = async (req: Request, res: Response) => {
    try {
        const runId = Number(req.params.id);
        const { values, productionDate, plannedWeight } = req.body; // values: [{ mmlNodeId, value }]
        console.log('saveProductionRunValues: runId=', runId, 'productionDate=', productionDate, 'typeof=', typeof productionDate);

        // Проверка что выработка не заблокирована
        const existingRun = await prisma.productionRun.findUnique({
            where: { id: runId },
            include: {
                mml: {
                    include: {
                        nodes: {
                            include: {
                                product: { select: { id: true } }
                            }
                        }
                    }
                }
            }
        });
        if (!existingRun) {
            return res.status(404).json({ error: 'Production run not found' });
        }
        if (existingRun.isLocked) {
            return res.status(400).json({ error: 'Production run is locked, cannot edit' });
        }

        // Карта узлов для получения productId и parentNodeId
        const nodesMap = new Map(existingRun.mml.nodes.map(n => [n.id, n]));

        // Проверяем, есть ли иерархия (узлы с parentNodeId !== null)
        const hasHierarchy = existingRun.mml.nodes.some(n => n.parentNodeId !== null);

        // Если есть иерархия - считаем только не-корневые узлы
        // Если структура плоская (все parentNodeId = null) - считаем все
        const nodesToSum = hasHierarchy
            ? new Set(existingRun.mml.nodes.filter(n => n.parentNodeId !== null).map(n => n.id))
            : new Set(existingRun.mml.nodes.map(n => n.id));

        // Подготовка данных для batch-операции (оптимизация производительности)
        let calculatedActualWeight = 0;
        const valuesToCreate: { productionRunId: number; mmlNodeId: number; value: number | null; snapshotProductId: number | null }[] = [];

        for (const { mmlNodeId, value } of values) {
            const node = nodesMap.get(Number(mmlNodeId));
            const numericValue = value !== null && value !== '' ? Number(value) : null;

            // Суммируем узлы согласно логике
            if (nodesToSum.has(Number(mmlNodeId)) && numericValue !== null && !isNaN(numericValue)) {
                calculatedActualWeight += numericValue;
            }

            valuesToCreate.push({
                productionRunId: runId,
                mmlNodeId: Number(mmlNodeId),
                value: numericValue,
                snapshotProductId: node?.productId || null
            });
        }

        // Атомарная транзакция: удаляем старые значения и создаём новые одним batch
        await prisma.$transaction([
            prisma.productionRunValue.deleteMany({
                where: { productionRunId: runId }
            }),
            prisma.productionRunValue.createMany({
                data: valuesToCreate
            })
        ]);

        // Обновить actualWeight и другие поля выработки
        const updateData: any = {
            actualWeight: calculatedActualWeight
        };

        console.log('[DEBUG saveRunValues] productionDate from request:', productionDate, 'typeof:', typeof productionDate);

        if (productionDate !== undefined) {
            updateData.productionDate = new Date(productionDate);
            console.log('[DEBUG saveRunValues] Setting productionDate to:', updateData.productionDate);
        }
        if (plannedWeight !== undefined) {
            updateData.plannedWeight = plannedWeight !== null ? Number(plannedWeight) : null;
        }

        console.log('[DEBUG saveRunValues] Final updateData:', updateData);

        await prisma.productionRun.update({
            where: { id: runId },
            data: updateData
        });

        // Вернуть обновлённые данные
        const run = await prisma.productionRun.findUnique({
            where: { id: runId },
            include: {
                product: {
                    select: { id: true, code: true, name: true, priceListName: true }
                },
                user: {
                    select: { id: true, name: true }
                },
                mml: {
                    include: {
                        nodes: {
                            include: {
                                product: {
                                    select: { id: true, code: true, name: true, priceListName: true }
                                }
                            },
                            orderBy: [{ parentNodeId: 'asc' }, { sortOrder: 'asc' }]
                        }
                    }
                },
                values: true
            }
        });

        if (!run) {
            return res.status(404).json({ error: 'Production run not found' });
        }

        console.log('[DEBUG saveRunValues] VERIFICATION - DB returned productionDate:', run.productionDate);

        // Построение дерева с значениями
        const valuesMap = new Map(run.values.map(v => [v.mmlNodeId, v.value]));
        const nodes = run.mml.nodes;
        const rootNodesT = nodes.filter(n => n.parentNodeId === null);
        const childNodes = nodes.filter(n => n.parentNodeId !== null);
        const tree = rootNodesT.map(root => ({
            ...root,
            value: valuesMap.get(root.id) ?? null,
            children: childNodes
                .filter(c => c.parentNodeId === root.id)
                .map(child => ({
                    ...child,
                    value: valuesMap.get(child.id) ?? null
                }))
        }));

        res.json({
            ...run,
            mml: {
                ...run.mml,
                rootNodes: tree
            },
            values: run.values
        });
    } catch (error) {
        console.error('saveProductionRunValues error:', error);
        res.status(500).json({ error: 'Failed to save production run values' });
    }
};

/**
 * Зафиксировать/разблокировать выработку (переключение)
 */
export const toggleProductionRunLock = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        // Получаем текущее состояние
        const current = await prisma.productionRun.findUnique({ where: { id } });
        if (!current) {
            return res.status(404).json({ error: 'Production run not found' });
        }

        const run = await prisma.productionRun.update({
            where: { id },
            data: { isLocked: !current.isLocked },
            include: {
                product: {
                    select: { id: true, code: true, name: true, priceListName: true }
                },
                user: {
                    select: { id: true, name: true }
                },
                mml: {
                    include: {
                        nodes: {
                            include: {
                                product: {
                                    select: { id: true, code: true, name: true, priceListName: true }
                                }
                            },
                            orderBy: [{ parentNodeId: 'asc' }, { sortOrder: 'asc' }]
                        }
                    }
                },
                values: true
            }
        });

        // Построение дерева с значениями
        const valuesMap = new Map(run.values.map(v => [v.mmlNodeId, v.value]));
        const nodes = run.mml.nodes;
        const rootNodesT = nodes.filter(n => n.parentNodeId === null);
        const childNodes = nodes.filter(n => n.parentNodeId !== null);
        const tree = rootNodesT.map(root => ({
            ...root,
            value: valuesMap.get(root.id) ?? null,
            children: childNodes
                .filter(c => c.parentNodeId === root.id)
                .map(child => ({
                    ...child,
                    value: valuesMap.get(child.id) ?? null
                }))
        }));

        res.json({
            ...run,
            mml: {
                ...run.mml,
                rootNodes: tree
            },
            values: run.values
        });
    } catch (error) {
        console.error('toggleProductionRunLock error:', error);
        res.status(500).json({ error: 'Failed to toggle production run lock' });
    }
};

/**
 * Клонировать выработку
 */
export const cloneProductionRun = async (req: Request, res: Response) => {
    try {
        const sourceId = Number(req.params.id);
        const userId = (req as any).user?.userId;

        const source = await prisma.productionRun.findUnique({
            where: { id: sourceId },
            include: { values: true }
        });

        if (!source) {
            return res.status(404).json({ error: 'Source production run not found' });
        }

        // Создать новую выработку с копированием полей
        const newRun = await prisma.productionRun.create({
            data: {
                productId: source.productId,
                mmlId: source.mmlId,
                userId,
                isLocked: false,
                productionDate: new Date(),
                plannedWeight: source.plannedWeight,
                actualWeight: source.actualWeight,
                isHidden: false
            }
        });

        // Скопировать значения с snapshotProductId
        if (source.values.length > 0) {
            await prisma.productionRunValue.createMany({
                data: source.values.map(v => ({
                    productionRunId: newRun.id,
                    mmlNodeId: v.mmlNodeId,
                    value: v.value,
                    snapshotProductId: v.snapshotProductId
                }))
            });
        }

        res.status(201).json(newRun);
    } catch (error) {
        console.error('cloneProductionRun error:', error);
        res.status(500).json({ error: 'Failed to clone production run' });
    }
};

/**
 * Удалить выработку
 */
export const deleteProductionRun = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        const run = await prisma.productionRun.findUnique({ where: { id } });
        if (!run) {
            return res.status(404).json({ error: 'Production run not found' });
        }
        if (run.isLocked) {
            return res.status(400).json({ error: 'Cannot delete locked production run' });
        }

        await prisma.productionRun.delete({ where: { id } });

        res.json({ success: true });
    } catch (error) {
        console.error('deleteProductionRun error:', error);
        res.status(500).json({ error: 'Failed to delete production run' });
    }
};

/**
 * Массовое скрытие выработок
 */
export const hideProductionRuns = async (req: Request, res: Response) => {
    try {
        const { ids } = req.body; // массив ID выработок

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'ids array is required' });
        }

        await prisma.productionRun.updateMany({
            where: {
                id: { in: ids.map(Number) }
            },
            data: {
                isHidden: true
            }
        });

        res.json({ success: true, hiddenCount: ids.length });
    } catch (error) {
        console.error('hideProductionRuns error:', error);
        res.status(500).json({ error: 'Failed to hide production runs' });
    }
};

/**
 * Показать скрытые выработки (отменить скрытие)
 */
export const unhideProductionRuns = async (req: Request, res: Response) => {
    try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'ids array is required' });
        }

        await prisma.productionRun.updateMany({
            where: {
                id: { in: ids.map(Number) }
            },
            data: {
                isHidden: false
            }
        });

        res.json({ success: true, unhiddenCount: ids.length });
    } catch (error) {
        console.error('unhideProductionRuns error:', error);
        res.status(500).json({ error: 'Failed to unhide production runs' });
    }
};

// ============================================
// РАСШИРЕННЫЙ ФУНКЦИОНАЛ ПРОИЗВОДСТВА
// ============================================

/**
 * Загрузить позиции закупок в производство за период
 * Создаёт записи ProductionRun с sourceType = 'PURCHASE'
 */
export const loadPurchasesToProduction = async (req: Request, res: Response) => {
    try {
        const { dateFrom, dateTo } = req.query;
        const userId = (req as any).user?.userId;

        if (!dateFrom || !dateTo) {
            return res.status(400).json({ error: 'dateFrom and dateTo are required' });
        }

        const fromDate = new Date(String(dateFrom));
        fromDate.setUTCHours(0, 0, 0, 0);
        const toDate = new Date(String(dateTo));
        toDate.setUTCHours(23, 59, 59, 999);

        // Получаем закупки за период с товарами
        const purchases = await prisma.purchase.findMany({
            where: {
                purchaseDate: {
                    gte: fromDate,
                    lte: toDate
                },
                isDisabled: false
            },
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, code: true, name: true, category: true }
                        },
                        supplier: {
                            select: { id: true, name: true }
                        }
                    }
                }
            }
        });

        // Собираем все позиции товаров из закупок
        const purchaseItems: Array<{
            purchaseId: number;
            purchaseItemId: number;
            purchaseDate: Date;
            productId: number;
            productCode: string;
            productName: string;
            category: string | null;
            qty: number;
            supplierName: string;
        }> = [];

        for (const purchase of purchases) {
            for (const item of purchase.items) {
                purchaseItems.push({
                    purchaseId: purchase.id,
                    purchaseItemId: item.id,
                    purchaseDate: purchase.purchaseDate,
                    productId: item.productId,
                    productCode: item.product.code,
                    productName: item.product.name,
                    category: item.product.category,
                    qty: Number(item.qty),
                    supplierName: item.supplier.name
                });
            }
        }

        res.json({
            items: purchaseItems,
            count: purchaseItems.length,
            dateRange: { from: fromDate, to: toDate }
        });
    } catch (error) {
        console.error('loadPurchasesToProduction error:', error);
        res.status(500).json({ error: 'Failed to load purchases' });
    }
};

/**
 * Загрузить остатки на начало из материального отчёта
 */
export const loadOpeningBalances = async (req: Request, res: Response) => {
    try {
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({ error: 'date is required' });
        }

        const reportDate = new Date(String(date));
        reportDate.setUTCHours(0, 0, 0, 0);

        // Получаем материальный отчёт за эту дату
        const materialReport = await prisma.materialReport.findFirst({
            where: {
                reportDate: reportDate
            },
            include: {
                lines: {
                    where: {
                        openingBalance: { gt: 0 }
                    },
                    include: {
                        product: {
                            select: { id: true, code: true, name: true, category: true }
                        }
                    }
                }
            }
        });

        if (!materialReport) {
            // Если нет сохранённого отчёта, пытаемся получить из черновика/превью
            // Остаток на начало = закрытие предыдущего дня
            const previousDate = new Date(reportDate);
            previousDate.setDate(previousDate.getDate() - 1);

            const prevReport = await prisma.materialReport.findFirst({
                where: {
                    reportDate: previousDate
                },
                include: {
                    lines: {
                        where: {
                            OR: [
                                { closingBalanceFact: { gt: 0 } },
                                { closingBalanceCalc: { gt: 0 } }
                            ]
                        },
                        include: {
                            product: {
                                select: { id: true, code: true, name: true, category: true }
                            }
                        }
                    }
                }
            });

            if (!prevReport) {
                return res.json({ items: [], count: 0, message: 'No material report found for this date' });
            }

            // Используем фактический или расчётный остаток
            const items = prevReport.lines.map(line => ({
                productId: line.productId,
                productCode: line.product.code,
                productName: line.product.name,
                category: line.product.category,
                openingBalance: Number(line.closingBalanceFact ?? line.closingBalanceCalc),
                sourceDate: previousDate
            }));

            return res.json({
                items,
                count: items.length,
                date: reportDate,
                sourceDate: previousDate
            });
        }

        const items = materialReport.lines.map(line => ({
            productId: line.productId,
            productCode: line.productCode,
            productName: line.productName,
            category: line.product?.category,
            openingBalance: Number(line.openingBalance),
            sourceDate: reportDate
        }));

        res.json({
            items,
            count: items.length,
            date: reportDate
        });
    } catch (error) {
        console.error('loadOpeningBalances error:', error);
        res.status(500).json({ error: 'Failed to load opening balances' });
    }
};

/**
 * Получить производственного сотрудника для текущего пользователя
 */
export const getCurrentProductionStaff = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const staff = await prisma.productionStaff.findUnique({
            where: { userId },
            include: {
                user: {
                    select: { id: true, name: true, username: true }
                }
            }
        });

        if (!staff) {
            // Если нет привязки к производственному персоналу, возвращаем данные пользователя
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, name: true, username: true }
            });
            return res.json({
                id: null,
                fullName: user?.name || 'Неизвестный пользователь',
                userId: userId,
                isActive: true,
                user
            });
        }

        res.json(staff);
    } catch (error) {
        console.error('getCurrentProductionStaff error:', error);
        res.status(500).json({ error: 'Failed to get production staff' });
    }
};

/**
 * Получить значения выработки по узлам с информацией о сотрудниках
 * Группирует по mmlNodeId и возвращает все записи с датой/временем и ФИО сотрудника
 */
export const getRunValuesWithStaff = async (req: Request, res: Response) => {
    try {
        const runId = Number(req.params.id);

        const values = await prisma.productionRunValue.findMany({
            where: { productionRunId: runId },
            include: {
                staff: {
                    select: { id: true, fullName: true }
                },
                node: {
                    include: {
                        product: {
                            select: { id: true, code: true, name: true, category: true }
                        }
                    }
                }
            },
            orderBy: [
                { mmlNodeId: 'asc' },
                { recordedAt: 'desc' }
            ]
        });

        // Группируем по mmlNodeId
        const grouped = new Map<number, typeof values>();
        for (const val of values) {
            if (!grouped.has(val.mmlNodeId)) {
                grouped.set(val.mmlNodeId, []);
            }
            grouped.get(val.mmlNodeId)!.push(val);
        }

        res.json({
            values,
            grouped: Object.fromEntries(grouped)
        });
    } catch (error) {
        console.error('getRunValuesWithStaff error:', error);
        res.status(500).json({ error: 'Failed to get run values with staff' });
    }
};

/**
 * Добавить новую запись значения в MML-узел с трекингом сотрудника
 */
export const addRunValueEntry = async (req: Request, res: Response) => {
    try {
        const runId = Number(req.params.id);
        const { mmlNodeId, value } = req.body;
        const userId = (req as any).user?.userId;

        if (!mmlNodeId || value === undefined) {
            return res.status(400).json({ error: 'mmlNodeId and value are required' });
        }

        // Проверяем что run существует и не заблокирован
        const run = await prisma.productionRun.findUnique({ where: { id: runId } });
        if (!run) {
            return res.status(404).json({ error: 'Production run not found' });
        }
        if (run.isLocked) {
            return res.status(400).json({ error: 'Production run is locked' });
        }

        // Получаем staff по userId (или создаём если нет)
        let staff = await prisma.productionStaff.findUnique({
            where: { userId }
        });

        // Баг 3 fix: автосоздаём ProductionStaff если не существует
        if (!staff && userId) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, name: true, username: true }
            });
            if (user) {
                staff = await prisma.productionStaff.create({
                    data: {
                        fullName: user.name || user.username || 'Пользователь',
                        userId: userId,
                        isActive: true
                    }
                });
            }
        }

        // Получаем узел для snapshotProductId
        const node = await prisma.productionMmlNode.findUnique({
            where: { id: Number(mmlNodeId) }
        });

        // Создаём новую запись
        const newValue = await prisma.productionRunValue.create({
            data: {
                productionRunId: runId,
                mmlNodeId: Number(mmlNodeId),
                value: value !== null && value !== '' ? Number(value) : null,
                snapshotProductId: node?.productId || null,
                staffId: staff?.id || null,
                recordedAt: new Date()
            },
            include: {
                staff: {
                    select: { id: true, fullName: true }
                },
                node: {
                    include: {
                        product: {
                            select: { id: true, code: true, name: true }
                        }
                    }
                }
            }
        });

        // Пересчитываем actualWeight
        const allValues = await prisma.productionRunValue.findMany({
            where: { productionRunId: runId },
            include: { node: true }
        });

        // Проверяем есть ли иерархия
        const nodeIds = new Set(allValues.map(v => v.mmlNodeId));
        const nodes = await prisma.productionMmlNode.findMany({
            where: { id: { in: Array.from(nodeIds) } }
        });
        const hasHierarchy = nodes.some(n => n.parentNodeId !== null);

        let actualWeight = 0;
        for (const val of allValues) {
            const n = nodes.find(x => x.id === val.mmlNodeId);
            const shouldSum = hasHierarchy ? (n?.parentNodeId !== null) : true;
            if (shouldSum && val.value !== null) {
                actualWeight += Number(val.value);
            }
        }

        await prisma.productionRun.update({
            where: { id: runId },
            data: { actualWeight }
        });

        res.status(201).json(newValue);
    } catch (error) {
        console.error('addRunValueEntry error:', error);
        res.status(500).json({ error: 'Failed to add run value entry' });
    }
};

/**
 * Обновить запись значения выработки
 */
export const updateRunValueEntry = async (req: Request, res: Response) => {
    try {
        const valueId = Number(req.params.valueId);
        const { value } = req.body;

        const existing = await prisma.productionRunValue.findUnique({
            where: { id: valueId },
            include: { run: true }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Value entry not found' });
        }
        if (existing.run.isLocked) {
            return res.status(400).json({ error: 'Production run is locked' });
        }

        const updated = await prisma.productionRunValue.update({
            where: { id: valueId },
            data: {
                value: value !== null && value !== '' ? Number(value) : null
            },
            include: {
                staff: {
                    select: { id: true, fullName: true }
                },
                node: {
                    include: {
                        product: {
                            select: { id: true, code: true, name: true }
                        }
                    }
                }
            }
        });

        // Пересчитываем actualWeight
        const allValues = await prisma.productionRunValue.findMany({
            where: { productionRunId: existing.productionRunId },
            include: { node: true }
        });

        const nodeIds = new Set(allValues.map(v => v.mmlNodeId));
        const nodes = await prisma.productionMmlNode.findMany({
            where: { id: { in: Array.from(nodeIds) } }
        });
        const hasHierarchy = nodes.some(n => n.parentNodeId !== null);

        let actualWeight = 0;
        for (const val of allValues) {
            const n = nodes.find(x => x.id === val.mmlNodeId);
            const shouldSum = hasHierarchy ? (n?.parentNodeId !== null) : true;
            if (shouldSum && val.value !== null) {
                actualWeight += Number(val.value);
            }
        }

        await prisma.productionRun.update({
            where: { id: existing.productionRunId },
            data: { actualWeight }
        });

        res.json(updated);
    } catch (error) {
        console.error('updateRunValueEntry error:', error);
        res.status(500).json({ error: 'Failed to update run value entry' });
    }
};

/**
 * Удалить запись значения выработки
 */
export const deleteRunValueEntry = async (req: Request, res: Response) => {
    try {
        const valueId = Number(req.params.valueId);

        const existing = await prisma.productionRunValue.findUnique({
            where: { id: valueId },
            include: { run: true }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Value entry not found' });
        }
        if (existing.run.isLocked) {
            return res.status(400).json({ error: 'Production run is locked' });
        }

        await prisma.productionRunValue.delete({
            where: { id: valueId }
        });

        // Пересчитываем actualWeight
        const allValues = await prisma.productionRunValue.findMany({
            where: { productionRunId: existing.productionRunId },
            include: { node: true }
        });

        const nodeIds = new Set(allValues.map(v => v.mmlNodeId));
        const nodes = await prisma.productionMmlNode.findMany({
            where: { id: { in: Array.from(nodeIds) } }
        });
        const hasHierarchy = nodes.some(n => n.parentNodeId !== null);

        let actualWeight = 0;
        for (const val of allValues) {
            const n = nodes.find(x => x.id === val.mmlNodeId);
            const shouldSum = hasHierarchy ? (n?.parentNodeId !== null) : true;
            if (shouldSum && val.value !== null) {
                actualWeight += Number(val.value);
            }
        }

        await prisma.productionRun.update({
            where: { id: existing.productionRunId },
            data: { actualWeight }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('deleteRunValueEntry error:', error);
        res.status(500).json({ error: 'Failed to delete run value entry' });
    }
};

/**
 * Получить категории MML узлов для группировки по вкладкам
 * Каждый узел MML = отдельный таб
 */
export const getMmlCategories = async (req: Request, res: Response) => {
    try {
        const mmlId = Number(req.params.mmlId);

        const nodes = await prisma.productionMmlNode.findMany({
            where: { mmlId },
            include: {
                product: {
                    select: { id: true, code: true, name: true, category: true }
                }
            },
            orderBy: [{ sortOrder: 'asc' }]
        });

        // Каждый узел = отдельный таб
        const result = nodes.map(node => ({
            category: node.product.name, // Имя товара как название таба
            nodes: [node], // Один узел в табе
            count: 1,
            rootNode: node
        }));

        res.json(result);
    } catch (error) {
        console.error('getMmlCategories error:', error);
        res.status(500).json({ error: 'Failed to get MML categories' });
    }
};
