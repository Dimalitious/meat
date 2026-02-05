import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

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
        const { dateFrom, dateTo, productionDate, isLocked, productId, showHidden } = req.query;

        const where: any = {
            // По умолчанию не показываем скрытые
            isHidden: showHidden === 'true' ? undefined : false
        };

        // V3: Single date filter (preferred)
        if (productionDate) {
            const dayStart = new Date(String(productionDate));
            dayStart.setUTCHours(0, 0, 0, 0);
            const dayEnd = new Date(String(productionDate));
            dayEnd.setUTCHours(23, 59, 59, 999);
            where.productionDate = { gte: dayStart, lte: dayEnd };
        }
        // Legacy: Фильтрация по дате выработки (dateFrom/dateTo)
        else if (dateFrom || dateTo) {
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
        const { productId, productionDate, plannedWeight, sourcePurchaseItemId, sourceType } = req.body;
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

        // V3: Validate sourcePurchaseItemId for PURCHASE source type
        const effectiveSourceType = sourceType || (sourcePurchaseItemId ? 'PURCHASE' : 'MANUAL');

        // PURCHASE type requires sourcePurchaseItemId
        if (effectiveSourceType === 'PURCHASE' && !sourcePurchaseItemId) {
            return res.status(400).json({
                error: 'sourcePurchaseItemId is required for PURCHASE source type. Each run must be linked to a specific lot.'
            });
        }

        if (sourcePurchaseItemId) {
            const purchaseItem = await prisma.purchaseItem.findUnique({
                where: { id: Number(sourcePurchaseItemId) }
            });
            if (!purchaseItem) {
                return res.status(400).json({ error: 'Source purchase item not found' });
            }
            if (purchaseItem.productId !== Number(productId)) {
                return res.status(400).json({ error: 'Source purchase item product does not match' });
            }
        }

        const run = await prisma.productionRun.create({
            data: {
                productId: Number(productId),
                mmlId: mml.id,
                userId,
                productionDate: productionDate ? new Date(productionDate) : new Date(),
                plannedWeight: plannedWeight ? Number(plannedWeight) : null,
                actualWeight: 0,
                isHidden: false,
                // V3: Source tracking
                sourcePurchaseItemId: sourcePurchaseItemId ? Number(sourcePurchaseItemId) : null,
                sourceType: effectiveSourceType
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

        // ============================================
        // TZ2: ВАЛИДАЦИЯ - проверка превышения доступного количества
        // Допустимая погрешность: 300г (0.3 кг)
        // ============================================
        const TOLERANCE_KG = 0.3;
        const productId = existingRun.productId;
        const runDate = productionDate ? new Date(productionDate) : existingRun.productionDate;

        // Устанавливаем диапазон дат для поиска закупок и остатков
        const dateStart = new Date(runDate);
        dateStart.setUTCHours(0, 0, 0, 0);
        const dateEnd = new Date(runDate);
        dateEnd.setUTCHours(23, 59, 59, 999);
        const previousDate = new Date(runDate);
        previousDate.setDate(previousDate.getDate() - 1);
        previousDate.setUTCHours(23, 59, 59, 999);

        // Параллельно получаем: закупки на дату + остаток из материального отчёта
        const [purchaseTotal, openingBalanceResult] = await Promise.all([
            // Сумма закупок продукта на дату
            prisma.purchaseItem.aggregate({
                where: {
                    productId,
                    purchase: {
                        purchaseDate: { gte: dateStart, lte: dateEnd },
                        isDisabled: false
                    }
                },
                _sum: { qty: true }
            }),
            // Остаток из материального отчёта за предыдущий день
            prisma.materialReportLine.findFirst({
                where: {
                    productId,
                    materialReport: {
                        reportDate: { lte: previousDate },
                        warehouseId: null
                    }
                },
                orderBy: { materialReport: { reportDate: 'desc' } },
                select: {
                    closingBalanceCalc: true,
                    closingBalanceFact: true
                }
            })
        ]);

        const purchaseQty = Number(purchaseTotal._sum.qty || 0);
        const openingBalance = openingBalanceResult
            ? (openingBalanceResult.closingBalanceFact !== null
                ? Number(openingBalanceResult.closingBalanceFact)
                : Number(openingBalanceResult.closingBalanceCalc || 0))
            : 0;

        const availableQty = purchaseQty + openingBalance;
        const producedQty = calculatedActualWeight;

        console.log('[PRODUCTION VALIDATION]', {
            productId,
            producedQty,
            availableQty,
            purchaseQty,
            openingBalance,
            tolerance: TOLERANCE_KG,
            exceeded: producedQty > availableQty + TOLERANCE_KG
        });

        // Проверка: если превышено более чем на допуск — отклоняем
        if (producedQty > availableQty + TOLERANCE_KG) {
            return res.status(400).json({
                error: 'Количество выработки превышает доступное количество (закупка + остаток). Проверьте данные.',
                details: {
                    produced: Math.round(producedQty * 1000) / 1000,
                    available: Math.round(availableQty * 1000) / 1000,
                    purchase: Math.round(purchaseQty * 1000) / 1000,
                    openingBalance: Math.round(openingBalance * 1000) / 1000,
                    tolerance: TOLERANCE_KG,
                    exceeded: Math.round((producedQty - availableQty - TOLERANCE_KG) * 1000) / 1000
                }
            });
        }
        // ============================================

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

        // V3: Trigger closure recalculation in background (fire-and-forget)
        const runDateStr = run.productionDate.toISOString().slice(0, 10);
        const username = (req as any).user?.username || 'system';
        (async () => {
            try {
                const dayStart = new Date(run.productionDate);
                dayStart.setUTCHours(0, 0, 0, 0);
                await prisma.$transaction(async (tx: any) => {
                    await recalcLotClosures(tx, dayStart, username);
                    await recalcClosuresForDate(tx, runDateStr, username);
                });
            } catch (e) {
                console.error('Background closure recalc error:', e);
            }
        })();
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

        // V3: Soft delete instead of hard delete
        await prisma.productionRun.update({
            where: { id },
            data: { isHidden: true }
        });

        // V3: Trigger recalc in background
        const username = (req as any).user?.username || 'system';
        const runDateStr = run.productionDate.toISOString().slice(0, 10);
        (async () => {
            try {
                const dayStart = new Date(run.productionDate);
                dayStart.setUTCHours(0, 0, 0, 0);
                await prisma.$transaction(async (tx: any) => {
                    await recalcLotClosures(tx, dayStart, username);
                    await recalcClosuresForDate(tx, runDateStr, username);
                });
            } catch (e) {
                console.error('Background closure recalc error:', e);
            }
        })();

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
        const { ids, productionDate } = req.body; // массив ID выработок и дата

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

        // V3: Trigger recalc if date provided
        if (productionDate) {
            const username = (req as any).user?.username || 'system';
            (async () => {
                try {
                    const dayStart = new Date(productionDate);
                    dayStart.setUTCHours(0, 0, 0, 0);
                    await prisma.$transaction(async (tx: any) => {
                        await recalcLotClosures(tx, dayStart, username);
                        await recalcClosuresForDate(tx, String(productionDate), username);
                    });
                } catch (e) {
                    console.error('Background closure recalc error:', e);
                }
            })();
        }

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
        const { ids, productionDate } = req.body; // массив ID выработок и дата

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

        // V3: Trigger recalc if date provided
        if (productionDate) {
            const username = (req as any).user?.username || 'system';
            (async () => {
                try {
                    const dayStart = new Date(productionDate);
                    dayStart.setUTCHours(0, 0, 0, 0);
                    await prisma.$transaction(async (tx: any) => {
                        await recalcLotClosures(tx, dayStart, username);
                        await recalcClosuresForDate(tx, String(productionDate), username);
                    });
                } catch (e) {
                    console.error('Background closure recalc error:', e);
                }
            })();
        }

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
                    where: {
                        product: {
                            participatesInProduction: true  // Только товары с флагом "участие в производстве"
                        }
                    },
                    include: {
                        product: {
                            select: { id: true, code: true, name: true, category: true, participatesInProduction: true }
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
 * Загрузить невыработанные позиции с предыдущих дат
 * Возвращает товары где (закупка + остаток - выработка) > 0
 */
export const loadUnfinishedItems = async (req: Request, res: Response) => {
    try {
        const { beforeDate, daysBack = 30 } = req.query;

        if (!beforeDate) {
            return res.status(400).json({ error: 'beforeDate is required' });
        }

        const toDate = new Date(String(beforeDate));
        toDate.setUTCHours(0, 0, 0, 0);

        const fromDate = new Date(toDate);
        fromDate.setDate(fromDate.getDate() - Number(daysBack));
        fromDate.setUTCHours(0, 0, 0, 0);

        // Получаем все Production Runs за период
        const runs = await prisma.productionRun.findMany({
            where: {
                productionDate: {
                    gte: fromDate,
                    lt: toDate  // До, но не включая текущую дату
                },
                isHidden: false
            },
            include: {
                product: {
                    select: { id: true, code: true, name: true, category: true }
                },
                values: true
            }
        });

        // Получаем закупки за тот же период
        const purchases = await prisma.purchase.findMany({
            where: {
                purchaseDate: {
                    gte: fromDate,
                    lt: toDate
                },
                isDisabled: false
            },
            include: {
                items: {
                    where: {
                        product: {
                            participatesInProduction: true  // Только товары с флагом "участие в производстве"
                        }
                    },
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

        // Агрегируем закупки по productId
        const purchaseByProduct = new Map<number, { qty: number; date: Date; idn: string }>();
        for (const purchase of purchases) {
            for (const item of purchase.items) {
                const existing = purchaseByProduct.get(item.productId);
                const idn = item.supplier.name.substring(0, 6) + purchase.purchaseDate.toISOString().substring(2, 10).replace(/-/g, '');
                if (!existing || purchase.purchaseDate > existing.date) {
                    purchaseByProduct.set(item.productId, {
                        qty: (existing?.qty || 0) + Number(item.qty),
                        date: purchase.purchaseDate,
                        idn
                    });
                } else {
                    purchaseByProduct.set(item.productId, {
                        ...existing,
                        qty: existing.qty + Number(item.qty)
                    });
                }
            }
        }

        // Агрегируем выработку по productId
        const producedByProduct = new Map<number, number>();
        for (const run of runs) {
            const total = run.values.reduce((sum, v) => sum + Number(v.value), 0);
            producedByProduct.set(run.productId, (producedByProduct.get(run.productId) || 0) + total);
        }

        // Получаем последний МатОтчёт для остатков
        const lastReport = await prisma.materialReport.findFirst({
            where: {
                reportDate: {
                    gte: fromDate,
                    lt: toDate
                }
            },
            orderBy: { reportDate: 'desc' },
            include: {
                lines: {
                    include: {
                        product: {
                            select: { id: true, code: true, name: true, category: true }
                        }
                    }
                }
            }
        });

        const balanceByProduct = new Map<number, number>();
        if (lastReport) {
            for (const line of lastReport.lines) {
                balanceByProduct.set(line.productId, Number(line.openingBalance));
            }
        }

        // Формируем список невыработанных позиций
        const unfinishedItems: Array<{
            productId: number;
            productCode: string;
            productName: string;
            category: string | null;
            purchaseQty: number;
            balanceQty: number;
            producedQty: number;
            remainingQty: number;
            purchaseDate: Date | null;
            idn: string | null;
        }> = [];

        // Объединяем все productId
        const allProductIds = new Set<number>([
            ...purchaseByProduct.keys(),
            ...balanceByProduct.keys()
        ]);

        for (const productId of allProductIds) {
            const purchase = purchaseByProduct.get(productId);
            const balance = balanceByProduct.get(productId) || 0;
            const produced = producedByProduct.get(productId) || 0;
            const remaining = (purchase?.qty || 0) + balance - produced;

            // Только если осталось > 0
            if (remaining > 0) {
                // Получаем данные о продукте
                const run = runs.find(r => r.productId === productId);
                const purchaseItem = purchases.flatMap(p => p.items).find(i => i.productId === productId);

                const product = run?.product || purchaseItem?.product;
                if (product) {
                    unfinishedItems.push({
                        productId,
                        productCode: product.code,
                        productName: product.name,
                        category: product.category,
                        purchaseQty: purchase?.qty || 0,
                        balanceQty: balance,
                        producedQty: produced,
                        remainingQty: remaining,
                        purchaseDate: purchase?.date || null,
                        idn: purchase?.idn || null
                    });
                }
            }
        }

        res.json({
            items: unfinishedItems,
            count: unfinishedItems.length,
            dateRange: { from: fromDate, to: toDate }
        });
    } catch (error) {
        console.error('loadUnfinishedItems error:', error);
        res.status(500).json({ error: 'Failed to load unfinished items' });
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

        // V3: Trigger closure recalculation in background
        const username = (req as any).user?.username || 'system';
        (async () => {
            try {
                const dayStart = new Date(run.productionDate);
                dayStart.setUTCHours(0, 0, 0, 0);
                const runDateStr = run.productionDate.toISOString().slice(0, 10);
                await prisma.$transaction(async (tx: any) => {
                    await recalcLotClosures(tx, dayStart, username);
                    await recalcClosuresForDate(tx, runDateStr, username);
                });
            } catch (e) {
                console.error('Background closure recalc error:', e);
            }
        })();

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

        // V3: Trigger closure recalculation in background
        const username = (req as any).user?.username || 'system';
        (async () => {
            try {
                const dayStart = new Date(existing.run.productionDate);
                dayStart.setUTCHours(0, 0, 0, 0);
                const runDateStr = existing.run.productionDate.toISOString().slice(0, 10);
                await prisma.$transaction(async (tx: any) => {
                    await recalcLotClosures(tx, dayStart, username);
                    await recalcClosuresForDate(tx, runDateStr, username);
                });
            } catch (e) {
                console.error('Background closure recalc error:', e);
            }
        })();

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

        // V3: Trigger closure recalculation in background
        const username = (req as any).user?.username || 'system';
        (async () => {
            try {
                const dayStart = new Date(existing.run.productionDate);
                dayStart.setUTCHours(0, 0, 0, 0);
                const runDateStr = existing.run.productionDate.toISOString().slice(0, 10);
                await prisma.$transaction(async (tx: any) => {
                    await recalcLotClosures(tx, dayStart, username);
                    await recalcClosuresForDate(tx, runDateStr, username);
                });
            } catch (e) {
                console.error('Background closure recalc error:', e);
            }
        })();

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

// ============================================
// PRODUCTION V3 - CLOSURE SYSTEM
// ============================================

const DAY_MS = 86_400_000;
const LOOKBACK_DAYS = 90;
const TOLERANCE = new Prisma.Decimal('0.01'); // 1%

/**
 * Конвертация строки YYYY-MM-DD в начало дня по Ташкенту (UTC+5)
 * Возвращает Date в UTC
 */
function toTashkentDayStart(dateStr: string): Date {
    const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
    // Ташкент = UTC+5, так что 00:00 Ташкент = 19:00 UTC предыдущего дня
    return new Date(Date.UTC(y, m - 1, d, -5, 0, 0, 0));
}

/**
 * Добавить дни к дате
 */
function addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Получить диапазон дня [start, end) для Ташкента
 */
function getTashkentDayRange(dateStr: string): { dayStart: Date; dayEnd: Date } {
    const dayStart = toTashkentDayStart(dateStr);
    const dayEnd = addDays(dayStart, 1);
    return { dayStart, dayEnd };
}

/**
 * Пересчёт закрытий партий (ProductionLotClosure)
 * Вызывается в транзакции при любом изменении выработки
 */
async function recalcLotClosures(
    tx: Prisma.TransactionClient,
    beforeDay: Date,
    username: string
): Promise<void> {
    // Lookback: только последние 90 дней + все открытые
    const minDate = addDays(beforeDay, -LOOKBACK_DAYS);

    // 1. Получаем все purchaseItems за период
    const purchaseItems = await tx.purchaseItem.findMany({
        where: {
            purchase: {
                purchaseDate: { gte: minDate, lt: beforeDay },
                isDisabled: false
            }
        },
        select: { id: true, qty: true, productId: true }
    });

    // Также получаем все открытые closures (независимо от даты)
    const openClosures = await tx.productionLotClosure.findMany({
        where: { status: 'open' },
        select: { purchaseItemId: true }
    });

    const openIds = new Set(openClosures.map(c => c.purchaseItemId));
    const allIds = new Set([...purchaseItems.map(p => p.id), ...openIds]);

    if (allIds.size === 0) return;

    // 2. Агрегируем выработку по purchaseItemId из ProductionAllocation
    // V3: Используем allocations вместо sourcePurchaseItemId (INV-1)
    const producedAgg = await tx.productionAllocation.groupBy({
        by: ['purchaseItemId'],
        where: {
            purchaseItemId: { in: Array.from(allIds) },
            isVoided: false  // Только активные allocations
        },
        _sum: { qtyAllocated: true }
    });

    const producedMap = new Map<number, Prisma.Decimal>();
    for (const row of producedAgg) {
        producedMap.set(row.purchaseItemId, row._sum.qtyAllocated ?? new Prisma.Decimal(0));
    }

    // 3. Получаем qty для всех purchaseItems (включая открытые)
    const allPurchaseItems = await tx.purchaseItem.findMany({
        where: { id: { in: Array.from(allIds) } },
        select: { id: true, qty: true }
    });

    const qtyMap = new Map<number, Prisma.Decimal>();
    for (const pi of allPurchaseItems) {
        qtyMap.set(pi.id, new Prisma.Decimal(pi.qty));
    }

    // 4. Сначала получаем текущие статусы closures для сравнения
    const existingClosures = await tx.productionLotClosure.findMany({
        where: { purchaseItemId: { in: Array.from(allIds) } },
        select: { purchaseItemId: true, status: true }
    });
    const currentStatusMap = new Map<number, string>();
    for (const c of existingClosures) {
        currentStatusMap.set(c.purchaseItemId, c.status);
    }

    // 5. Batch upsert и отслеживание изменений статуса
    const statusChanges: { purchaseItemId: number; fromStatus: string; toStatus: string }[] = [];

    const upsertOps = Array.from(allIds).map(async (purchaseItemId) => {
        const qtyPurchased = qtyMap.get(purchaseItemId) ?? new Prisma.Decimal(0);
        const qtyProduced = producedMap.get(purchaseItemId) ?? new Prisma.Decimal(0);
        const remainingRaw = qtyPurchased.sub(qtyProduced);
        const qtyRemaining = remainingRaw.lt(0) ? new Prisma.Decimal(0) : remainingRaw;

        let newStatus: 'open' | 'closed' = 'open';
        if (qtyPurchased.lte(0)) {
            newStatus = 'closed';
        } else if (qtyRemaining.lte(0)) {
            newStatus = 'closed';
        } else {
            const ratio = qtyRemaining.div(qtyPurchased);
            if (ratio.lte(TOLERANCE)) newStatus = 'closed';
        }

        // Проверяем изменение статуса
        const oldStatus = currentStatusMap.get(purchaseItemId) ?? 'new';
        if (oldStatus !== newStatus && oldStatus !== 'new') {
            statusChanges.push({
                purchaseItemId,
                fromStatus: oldStatus,
                toStatus: newStatus
            });
        }

        return tx.productionLotClosure.upsert({
            where: { purchaseItemId },
            create: {
                purchaseItemId,
                status: newStatus,
                qtyPurchased,
                qtyProduced,
                qtyRemaining,
                closedAt: newStatus === 'closed' ? new Date() : null,
                closedBy: newStatus === 'closed' ? username : null
            },
            update: {
                status: newStatus,
                qtyPurchased,
                qtyProduced,
                qtyRemaining,
                closedAt: newStatus === 'closed' ? new Date() : null,
                closedBy: newStatus === 'closed' ? username : null,
                reopenedAt: newStatus === 'open' && oldStatus === 'closed' ? new Date() : undefined,
                reopenedBy: newStatus === 'open' && oldStatus === 'closed' ? username : undefined
            }
        });
    });

    await Promise.all(upsertOps);

    // 6. Audit log только при смене статуса
    if (statusChanges.length > 0) {
        const auditOps = statusChanges.map(change =>
            tx.productionClosureAudit.create({
                data: {
                    scope: 'LOT',
                    action: change.toStatus === 'closed' ? 'CLOSED' : 'REOPENED',
                    purchaseItemId: change.purchaseItemId,
                    performedBy: username,
                    payload: { fromStatus: change.fromStatus, toStatus: change.toStatus }
                }
            })
        );
        await Promise.all(auditOps);
    }
}

/**
 * Пересчёт закрытий продуктов на дату (ProductionClosure)
 */
async function recalcClosuresForDate(
    tx: Prisma.TransactionClient,
    dateStr: string,
    username: string
): Promise<void> {
    const { dayStart, dayEnd } = getTashkentDayRange(dateStr);

    // 1. Закупки на дату по productId
    const purchaseAgg = await tx.purchaseItem.groupBy({
        by: ['productId'],
        where: {
            purchase: {
                purchaseDate: { gte: dayStart, lt: dayEnd },
                isDisabled: false
            }
        },
        _sum: { qty: true }
    });

    const purchaseMap = new Map<number, Prisma.Decimal>();
    for (const row of purchaseAgg) {
        purchaseMap.set(row.productId, row._sum.qty ?? new Prisma.Decimal(0));
    }

    // 2. Carryover из открытых партий до этой даты
    const openLots = await tx.productionLotClosure.findMany({
        where: { status: 'open' },
        include: {
            purchaseItem: {
                include: {
                    purchase: { select: { purchaseDate: true } }
                }
            }
        }
    });

    const carryMap = new Map<number, Prisma.Decimal>();
    for (const lot of openLots) {
        const pi = lot.purchaseItem;
        if (!pi?.purchase?.purchaseDate) continue;
        if (pi.purchase.purchaseDate >= dayStart) continue; // Только партии ДО текущего дня

        const productId = pi.productId;
        const cur = carryMap.get(productId) ?? new Prisma.Decimal(0);
        carryMap.set(productId, cur.add(new Prisma.Decimal(lot.qtyRemaining)));
    }

    // 3. Выработка на дату по productId
    const producedAgg = await tx.productionRun.groupBy({
        by: ['productId'],
        where: {
            isHidden: false,
            productionDate: { gte: dayStart, lt: dayEnd }
        },
        _sum: { actualWeight: true }
    });

    const producedMap = new Map<number, Prisma.Decimal>();
    for (const row of producedAgg) {
        producedMap.set(row.productId, row._sum.actualWeight ?? new Prisma.Decimal(0));
    }

    // 4. Собираем все productIds
    const productIds = new Set<number>([
        ...purchaseMap.keys(),
        ...carryMap.keys(),
        ...producedMap.keys()
    ]);

    // 5. Batch upsert closures
    const upsertOps = Array.from(productIds).map(async (productId) => {
        const totalIn = (purchaseMap.get(productId) ?? new Prisma.Decimal(0))
            .add(carryMap.get(productId) ?? new Prisma.Decimal(0));

        const totalProduced = producedMap.get(productId) ?? new Prisma.Decimal(0);

        if (totalIn.lte(0)) {
            return tx.productionClosure.upsert({
                where: { productionDate_productId: { productionDate: dayStart, productId } },
                create: {
                    productionDate: dayStart,
                    productId,
                    status: 'open',
                    totalIn,
                    totalProduced,
                    diffAbs: new Prisma.Decimal(0)
                },
                update: {
                    status: 'open',
                    totalIn,
                    totalProduced,
                    diffAbs: new Prisma.Decimal(0),
                    closedAt: null,
                    closedBy: null
                }
            });
        }

        const diffAbs = totalIn.sub(totalProduced).abs();
        const ratio = diffAbs.div(totalIn);
        const status: 'open' | 'closed' = ratio.lte(TOLERANCE) ? 'closed' : 'open';

        return tx.productionClosure.upsert({
            where: { productionDate_productId: { productionDate: dayStart, productId } },
            create: {
                productionDate: dayStart,
                productId,
                status,
                totalIn,
                totalProduced,
                diffAbs,
                closedAt: status === 'closed' ? new Date() : null,
                closedBy: status === 'closed' ? username : null
            },
            update: {
                status,
                totalIn,
                totalProduced,
                diffAbs,
                closedAt: status === 'closed' ? new Date() : null,
                closedBy: status === 'closed' ? username : null
            }
        });
    });

    await Promise.all(upsertOps);

    // 6. Audit log
    await tx.productionClosureAudit.create({
        data: {
            scope: 'PRODUCT',
            action: 'RECALC',
            productionDate: dayStart,
            performedBy: username,
            payload: { dateStr, count: productIds.size }
        }
    });
}

// ============================================
// PRODUCTION V3 - ENDPOINTS
// ============================================

/**
 * Получить закупки за одну дату (для кнопки "Загрузить")
 * GET /api/production-v2/purchases-by-date?date=YYYY-MM-DD
 */
export const getPurchasesByDate = async (req: Request, res: Response) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
        }

        const { dayStart, dayEnd } = getTashkentDayRange(String(date));

        const items = await prisma.purchaseItem.findMany({
            where: {
                purchase: {
                    purchaseDate: { gte: dayStart, lt: dayEnd },
                    isDisabled: false
                }
            },
            include: {
                purchase: { select: { id: true, idn: true, purchaseDate: true } },
                product: { select: { id: true, name: true, code: true, category: true } },
                supplier: { select: { id: true, name: true } }
            }
        });

        res.json({ date, items });
    } catch (error) {
        console.error('getPurchasesByDate error:', error);
        res.status(500).json({ error: 'Failed to load purchases by date' });
    }
};

/**
 * Получить carryover breakdown по партиям (для правой панели)
 * GET /api/production-v2/carryover-breakdown?date=YYYY-MM-DD&productId=123
 */
export const getCarryoverBreakdown = async (req: Request, res: Response) => {
    try {
        const { date, productId } = req.query;
        if (!date) {
            return res.status(400).json({ error: 'date is required' });
        }

        const { dayStart } = getTashkentDayRange(String(date));

        // Фильтруем на уровне БД
        const whereClause: any = {
            status: 'open',
            purchaseItem: {
                purchase: {
                    purchaseDate: { lt: dayStart },
                    isDisabled: false
                }
            }
        };

        if (productId) {
            whereClause.purchaseItem.productId = Number(productId);
        }

        const lots = await prisma.productionLotClosure.findMany({
            where: whereClause,
            include: {
                purchaseItem: {
                    include: {
                        purchase: { select: { idn: true, purchaseDate: true } },
                        product: { select: { id: true, name: true, code: true, category: true } }
                    }
                }
            }
        });

        const items = lots.map(lot => ({
            purchaseItemId: lot.purchaseItemId,
            productId: lot.purchaseItem?.productId,
            productName: lot.purchaseItem?.product?.name ?? '',
            productCode: lot.purchaseItem?.product?.code ?? null,
            category: lot.purchaseItem?.product?.category ?? null,
            idn: lot.purchaseItem?.purchase?.idn ?? null,
            purchaseDate: lot.purchaseItem?.purchase?.purchaseDate ?? null,
            qtyRemaining: lot.qtyRemaining,
            qtyPurchased: lot.qtyPurchased,
            qtyProduced: lot.qtyProduced
        }));

        // Группировка по productId для total
        const totals = new Map<number, Prisma.Decimal>();
        for (const item of items) {
            if (item.productId) {
                const cur = totals.get(item.productId) ?? new Prisma.Decimal(0);
                totals.set(item.productId, cur.add(new Prisma.Decimal(item.qtyRemaining)));
            }
        }

        res.json({
            date,
            items,
            totals: Object.fromEntries(totals)
        });
    } catch (error) {
        console.error('getCarryoverBreakdown error:', error);
        res.status(500).json({ error: 'Failed to load carryover breakdown' });
    }
};

/**
 * Получить статусы закрытий на дату (для маркеров в UI)
 * GET /api/production-v2/closures?date=YYYY-MM-DD
 */
export const getClosuresByDate = async (req: Request, res: Response) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ error: 'date is required' });
        }

        const { dayStart } = getTashkentDayRange(String(date));

        const closures = await prisma.productionClosure.findMany({
            where: { productionDate: dayStart },
            select: {
                productId: true,
                status: true,
                totalIn: true,
                totalProduced: true,
                diffAbs: true,
                closedAt: true
            }
        });

        res.json({ date, closures });
    } catch (error) {
        console.error('getClosuresByDate error:', error);
        res.status(500).json({ error: 'Failed to load closures' });
    }
};

/**
 * Ручной пересчёт закрытий (кнопка "Сформировать")
 * POST /api/production-v2/closures/recalc { date: "YYYY-MM-DD" }
 */
export const recalcClosuresManual = async (req: Request, res: Response) => {
    try {
        const { date } = req.body;
        if (!date) {
            return res.status(400).json({ error: 'date is required' });
        }

        const username = (req as any).user?.username || 'system';
        const { dayStart } = getTashkentDayRange(String(date));

        await prisma.$transaction(async (tx) => {
            await recalcLotClosures(tx, dayStart, username);
            await recalcClosuresForDate(tx, String(date), username);
        });

        res.json({ success: true, message: 'Closures recalculated' });
    } catch (error) {
        console.error('recalcClosuresManual error:', error);
        res.status(500).json({ error: 'Failed to recalc closures' });
    }
};

/**
 * Восстановить партию (reopen)
 * POST /api/production-v2/closures/lot/:purchaseItemId/reopen
 */
export const reopenLot = async (req: Request, res: Response) => {
    try {
        const purchaseItemId = Number(req.params.purchaseItemId);
        const username = (req as any).user?.username || 'system';

        const lot = await prisma.productionLotClosure.update({
            where: { purchaseItemId },
            data: {
                status: 'open',
                closedAt: null,
                closedBy: null,
                reopenedAt: new Date(),
                reopenedBy: username
            }
        });

        await prisma.productionClosureAudit.create({
            data: {
                scope: 'LOT',
                action: 'REOPENED',
                purchaseItemId,
                performedBy: username
            }
        });

        res.json(lot);
    } catch (error) {
        console.error('reopenLot error:', error);
        res.status(500).json({ error: 'Failed to reopen lot' });
    }
};

/**
 * Восстановить продукт на дату (reopen)
 * POST /api/production-v2/closures/product/:productId/reopen { date: "YYYY-MM-DD" }
 */
export const reopenProductForDate = async (req: Request, res: Response) => {
    try {
        const productId = Number(req.params.productId);
        const { date } = req.body;
        if (!date) {
            return res.status(400).json({ error: 'date is required' });
        }

        const username = (req as any).user?.username || 'system';
        const { dayStart } = getTashkentDayRange(String(date));

        const closure = await prisma.productionClosure.update({
            where: { productionDate_productId: { productionDate: dayStart, productId } },
            data: {
                status: 'open',
                closedAt: null,
                closedBy: null,
                reopenedAt: new Date(),
                reopenedBy: username
            }
        });

        await prisma.productionClosureAudit.create({
            data: {
                scope: 'PRODUCT',
                action: 'REOPENED',
                productionDate: dayStart,
                productId,
                performedBy: username
            }
        });

        res.json(closure);
    } catch (error) {
        console.error('reopenProductForDate error:', error);
        res.status(500).json({ error: 'Failed to reopen product for date' });
    }
};
// ============================================
// PRODUCTION V3: FIFO ALLOCATION SYSTEM
// ============================================

/**
 * FIFO Allocation: распределить вес документа по партиям закупок
 * Порядок: purchaseDate ASC, id ASC
 */
async function allocateRunToLots(
    tx: Prisma.TransactionClient,
    runId: number,
    productId: number,
    weight: Prisma.Decimal,
    allocatedAt: Date
): Promise<void> {
    // 1. Найти партии с остатком > 0, отсортированные FIFO
    const availableLots = await tx.purchaseItem.findMany({
        where: {
            productId,
            qtyRemaining: { gt: 0 },
            purchase: { isDisabled: false }
        },
        orderBy: [
            { purchase: { purchaseDate: 'asc' } },
            { id: 'asc' }
        ],
        include: {
            purchase: { select: { purchaseDate: true, idn: true } }
        }
    });

    let remaining = new Prisma.Decimal(weight);
    const allocations: { purchaseItemId: number; qty: Prisma.Decimal }[] = [];

    for (const lot of availableLots) {
        if (remaining.lte(0)) break;

        const lotRemaining = new Prisma.Decimal(lot.qtyRemaining);
        const toAllocate = Prisma.Decimal.min(remaining, lotRemaining);

        allocations.push({
            purchaseItemId: lot.id,
            qty: toAllocate
        });

        remaining = remaining.sub(toAllocate);
    }

    // 2. Проверка: хватает ли партий?
    if (remaining.gt(0)) {
        // Помечаем run как needsReview
        await tx.productionRun.update({
            where: { id: runId },
            data: { needsReview: true }
        });
        console.warn(`[FIFO] Run #${runId}: insufficient lots, remaining=${remaining.toString()}`);
    }

    // 3. Создать allocation записи
    for (const alloc of allocations) {
        await tx.productionAllocation.create({
            data: {
                sourceType: 'RUN',
                sourceId: runId,
                purchaseItemId: alloc.purchaseItemId,
                productId,
                qtyAllocated: alloc.qty,
                allocatedAt
            }
        });

        // 4. Обновить qtyRemaining в партии
        await tx.purchaseItem.update({
            where: { id: alloc.purchaseItemId },
            data: {
                qtyRemaining: { decrement: alloc.qty }
            }
        });
    }
}

/**
 * Отменить allocations для документа (при void)
 */
async function deallocateRun(
    tx: Prisma.TransactionClient,
    runId: number,
    voidReason: string
): Promise<void> {
    // 1. Получить все активные allocations
    const allocations = await tx.productionAllocation.findMany({
        where: {
            sourceType: 'RUN',
            sourceId: runId,
            isVoided: false
        }
    });

    // 2. Отметить как voided и вернуть qty в партии
    for (const alloc of allocations) {
        await tx.productionAllocation.update({
            where: { id: alloc.id },
            data: {
                isVoided: true,
                voidedAt: new Date(),
                voidReason
            }
        });

        // Вернуть qty в партию
        await tx.purchaseItem.update({
            where: { id: alloc.purchaseItemId },
            data: {
                qtyRemaining: { increment: alloc.qtyAllocated }
            }
        });
    }
}

/**
 * Провести документ выработки (draft → posted)
 * POST /api/production-v2/runs/:id/post
 */
export const postProductionRun = async (req: Request, res: Response) => {
    try {
        const runId = Number(req.params.id);
        const username = (req as any).user?.username || 'system';

        const run = await prisma.productionRun.findUnique({
            where: { id: runId },
            select: {
                id: true,
                productId: true,
                productionDate: true,
                actualWeight: true,
                status: true,
                isLocked: true
            }
        });

        if (!run) {
            return res.status(404).json({ error: 'Run not found' });
        }

        if (run.status !== 'draft') {
            return res.status(400).json({ error: `Cannot post run with status '${run.status}'` });
        }

        if (!run.actualWeight || new Prisma.Decimal(run.actualWeight).lte(0)) {
            return res.status(400).json({ error: 'Cannot post run with zero weight' });
        }

        await prisma.$transaction(async (tx) => {
            // 1. FIFO allocation
            await allocateRunToLots(
                tx,
                run.id,
                run.productId,
                new Prisma.Decimal(run.actualWeight!),
                run.productionDate
            );

            // 2. Update status
            await tx.productionRun.update({
                where: { id: runId },
                data: {
                    status: 'posted',
                    isLocked: true
                }
            });

            // 3. Recalc closures
            const dayStart = toTashkentDayStart(run.productionDate);
            await recalcLotClosures(tx, dayStart, username);
            await recalcClosuresForDate(tx, dayStart.toISOString().slice(0, 10), username);

            // 4. Audit
            await tx.productionClosureAudit.create({
                data: {
                    scope: 'LOT',
                    action: 'POSTED',
                    productionDate: dayStart,
                    productId: run.productId,
                    performedBy: username,
                    payload: { runId, actualWeight: run.actualWeight?.toString() }
                }
            });
        });

        res.json({ success: true, runId, status: 'posted' });
    } catch (error) {
        console.error('postProductionRun error:', error);
        res.status(500).json({ error: 'Failed to post production run' });
    }
};

/**
 * Аннулировать документ выработки (posted → voided)
 * POST /api/production-v2/runs/:id/void
 */
export const voidProductionRun = async (req: Request, res: Response) => {
    try {
        const runId = Number(req.params.id);
        const { reason } = req.body;
        const username = (req as any).user?.username || 'system';

        const run = await prisma.productionRun.findUnique({
            where: { id: runId },
            select: {
                id: true,
                productId: true,
                productionDate: true,
                status: true
            }
        });

        if (!run) {
            return res.status(404).json({ error: 'Run not found' });
        }

        if (run.status !== 'posted') {
            return res.status(400).json({ error: `Cannot void run with status '${run.status}'` });
        }

        await prisma.$transaction(async (tx) => {
            // 1. Deallocate
            await deallocateRun(tx, runId, reason || 'Voided by user');

            // 2. Update status
            await tx.productionRun.update({
                where: { id: runId },
                data: {
                    status: 'voided',
                    isHidden: true
                }
            });

            // 3. Recalc closures
            const dayStart = toTashkentDayStart(run.productionDate);
            await recalcLotClosures(tx, dayStart, username);
            await recalcClosuresForDate(tx, dayStart.toISOString().slice(0, 10), username);

            // 4. Audit
            await tx.productionClosureAudit.create({
                data: {
                    scope: 'LOT',
                    action: 'VOIDED',
                    productionDate: dayStart,
                    productId: run.productId,
                    performedBy: username,
                    payload: { runId, reason }
                }
            });
        });

        res.json({ success: true, runId, status: 'voided' });
    } catch (error) {
        console.error('voidProductionRun error:', error);
        res.status(500).json({ error: 'Failed to void production run' });
    }
};

/**
 * Получить allocations для партии
 * GET /api/production-v2/lots/:purchaseItemId/allocations
 */
export const getLotAllocations = async (req: Request, res: Response) => {
    try {
        const purchaseItemId = Number(req.params.purchaseItemId);

        const allocations = await prisma.productionAllocation.findMany({
            where: { purchaseItemId },
            orderBy: { allocatedAt: 'desc' },
            include: {
                productionRun: {
                    select: {
                        id: true,
                        productionDate: true,
                        status: true,
                        product: { select: { id: true, name: true, code: true } }
                    }
                }
            }
        });

        res.json(allocations);
    } catch (error) {
        console.error('getLotAllocations error:', error);
        res.status(500).json({ error: 'Failed to get lot allocations' });
    }
};

// ============================================
// PRODUCTION V3: ADJUSTMENTS
// ============================================

/**
 * Получить список корректировок
 * GET /api/production-v2/adjustments?date=YYYY-MM-DD
 */
export const getAdjustments = async (req: Request, res: Response) => {
    try {
        const { date, productId, status } = req.query;

        const where: any = {};

        if (date) {
            const { dayStart, dayEnd } = getTashkentDayRange(String(date));
            where.adjustmentDate = { gte: dayStart, lt: dayEnd };
        }

        if (productId) {
            where.productId = Number(productId);
        }

        if (status) {
            where.status = String(status);
        }

        const adjustments = await prisma.productionAdjustment.findMany({
            where,
            include: {
                product: { select: { id: true, code: true, name: true } },
                creator: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(adjustments);
    } catch (error) {
        console.error('getAdjustments error:', error);
        res.status(500).json({ error: 'Failed to get adjustments' });
    }
};

/**
 * Создать корректировку (draft)
 * POST /api/production-v2/adjustments
 */
export const createAdjustment = async (req: Request, res: Response) => {
    try {
        const { productId, adjustmentDate, effectiveDate, deltaWeight, reason } = req.body;
        const userId = (req as any).user?.userId;

        if (!productId || !deltaWeight) {
            return res.status(400).json({ error: 'productId and deltaWeight are required' });
        }

        const adjustment = await prisma.productionAdjustment.create({
            data: {
                productId: Number(productId),
                adjustmentDate: adjustmentDate ? new Date(adjustmentDate) : new Date(),
                effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
                deltaWeight: Number(deltaWeight),
                reason: reason || null,
                status: 'draft',
                createdBy: userId
            },
            include: {
                product: { select: { id: true, code: true, name: true } },
                creator: { select: { id: true, name: true } }
            }
        });

        res.status(201).json(adjustment);
    } catch (error) {
        console.error('createAdjustment error:', error);
        res.status(500).json({ error: 'Failed to create adjustment' });
    }
};

/**
 * Обновить корректировку (только draft)
 * PATCH /api/production-v2/adjustments/:id
 */
export const updateAdjustment = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const { deltaWeight, reason, adjustmentDate, effectiveDate } = req.body;

        const existing = await prisma.productionAdjustment.findUnique({
            where: { id },
            select: { status: true }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Adjustment not found' });
        }

        if (existing.status !== 'draft') {
            return res.status(400).json({ error: 'Cannot update non-draft adjustment' });
        }

        const data: any = {};
        if (deltaWeight !== undefined) data.deltaWeight = Number(deltaWeight);
        if (reason !== undefined) data.reason = reason;
        if (adjustmentDate) data.adjustmentDate = new Date(adjustmentDate);
        if (effectiveDate) data.effectiveDate = new Date(effectiveDate);

        const adjustment = await prisma.productionAdjustment.update({
            where: { id },
            data,
            include: {
                product: { select: { id: true, code: true, name: true } },
                creator: { select: { id: true, name: true } }
            }
        });

        res.json(adjustment);
    } catch (error) {
        console.error('updateAdjustment error:', error);
        res.status(500).json({ error: 'Failed to update adjustment' });
    }
};

/**
 * Провести корректировку (draft → posted)
 * POST /api/production-v2/adjustments/:id/post
 */
export const postAdjustment = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const username = (req as any).user?.username || 'system';

        const adjustment = await prisma.productionAdjustment.findUnique({
            where: { id },
            select: {
                id: true,
                productId: true,
                adjustmentDate: true,
                deltaWeight: true,
                status: true
            }
        });

        if (!adjustment) {
            return res.status(404).json({ error: 'Adjustment not found' });
        }

        if (adjustment.status !== 'draft') {
            return res.status(400).json({ error: `Cannot post adjustment with status '${adjustment.status}'` });
        }

        await prisma.$transaction(async (tx) => {
            // 1. FIFO allocation (аналогично run)
            await allocateAdjustmentToLots(
                tx,
                adjustment.id,
                adjustment.productId,
                new Prisma.Decimal(adjustment.deltaWeight),
                adjustment.adjustmentDate
            );

            // 2. Update status
            await tx.productionAdjustment.update({
                where: { id },
                data: {
                    status: 'posted',
                    isLocked: true
                }
            });

            // 3. Recalc closures
            const dayStart = toTashkentDayStart(adjustment.adjustmentDate);
            await recalcLotClosures(tx, dayStart, username);
            await recalcClosuresForDate(tx, dayStart.toISOString().slice(0, 10), username);

            // 4. Audit
            await tx.productionClosureAudit.create({
                data: {
                    scope: 'LOT',
                    action: 'POSTED',
                    productionDate: dayStart,
                    productId: adjustment.productId,
                    performedBy: username,
                    payload: { adjustmentId: id, deltaWeight: adjustment.deltaWeight.toString() }
                }
            });
        });

        res.json({ success: true, id, status: 'posted' });
    } catch (error) {
        console.error('postAdjustment error:', error);
        res.status(500).json({ error: 'Failed to post adjustment' });
    }
};

/**
 * Аннулировать корректировку (posted → voided)
 * POST /api/production-v2/adjustments/:id/void
 */
export const voidAdjustment = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const { reason } = req.body;
        const username = (req as any).user?.username || 'system';

        const adjustment = await prisma.productionAdjustment.findUnique({
            where: { id },
            select: {
                id: true,
                productId: true,
                adjustmentDate: true,
                status: true
            }
        });

        if (!adjustment) {
            return res.status(404).json({ error: 'Adjustment not found' });
        }

        if (adjustment.status !== 'posted') {
            return res.status(400).json({ error: `Cannot void adjustment with status '${adjustment.status}'` });
        }

        await prisma.$transaction(async (tx) => {
            // 1. Deallocate
            await deallocateAdjustment(tx, id, reason || 'Voided by user');

            // 2. Update status
            await tx.productionAdjustment.update({
                where: { id },
                data: {
                    status: 'voided',
                    voidedAt: new Date(),
                    voidedBy: (req as any).user?.userId,
                    voidReason: reason
                }
            });

            // 3. Recalc closures
            const dayStart = toTashkentDayStart(adjustment.adjustmentDate);
            await recalcLotClosures(tx, dayStart, username);
            await recalcClosuresForDate(tx, dayStart.toISOString().slice(0, 10), username);

            // 4. Audit
            await tx.productionClosureAudit.create({
                data: {
                    scope: 'LOT',
                    action: 'VOIDED',
                    productionDate: dayStart,
                    productId: adjustment.productId,
                    performedBy: username,
                    payload: { adjustmentId: id, reason }
                }
            });
        });

        res.json({ success: true, id, status: 'voided' });
    } catch (error) {
        console.error('voidAdjustment error:', error);
        res.status(500).json({ error: 'Failed to void adjustment' });
    }
};

/**
 * Удалить корректировку (только draft)
 * DELETE /api/production-v2/adjustments/:id
 */
export const deleteAdjustment = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        const existing = await prisma.productionAdjustment.findUnique({
            where: { id },
            select: { status: true }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Adjustment not found' });
        }

        if (existing.status !== 'draft') {
            return res.status(400).json({ error: 'Cannot delete non-draft adjustment. Use void instead.' });
        }

        await prisma.productionAdjustment.delete({ where: { id } });

        res.json({ success: true, id });
    } catch (error) {
        console.error('deleteAdjustment error:', error);
        res.status(500).json({ error: 'Failed to delete adjustment' });
    }
};

// Helper: FIFO allocation for adjustment
async function allocateAdjustmentToLots(
    tx: Prisma.TransactionClient,
    adjustmentId: number,
    productId: number,
    weight: Prisma.Decimal,
    allocatedAt: Date
): Promise<void> {
    const availableLots = await tx.purchaseItem.findMany({
        where: {
            productId,
            qtyRemaining: { gt: 0 },
            purchase: { isDisabled: false }
        },
        orderBy: [
            { purchase: { purchaseDate: 'asc' } },
            { id: 'asc' }
        ]
    });

    let remaining = new Prisma.Decimal(weight);

    for (const lot of availableLots) {
        if (remaining.lte(0)) break;

        const lotRemaining = new Prisma.Decimal(lot.qtyRemaining);
        const toAllocate = Prisma.Decimal.min(remaining, lotRemaining);

        await tx.productionAllocation.create({
            data: {
                sourceType: 'ADJ',
                sourceId: adjustmentId,
                purchaseItemId: lot.id,
                productId,
                qtyAllocated: toAllocate,
                allocatedAt
            }
        });

        await tx.purchaseItem.update({
            where: { id: lot.id },
            data: { qtyRemaining: { decrement: toAllocate } }
        });

        remaining = remaining.sub(toAllocate);
    }

    if (remaining.gt(0)) {
        console.warn(`[FIFO] Adjustment #${adjustmentId}: insufficient lots, remaining=${remaining.toString()}`);
    }
}

// Helper: Deallocate for adjustment
async function deallocateAdjustment(
    tx: Prisma.TransactionClient,
    adjustmentId: number,
    voidReason: string
): Promise<void> {
    const allocations = await tx.productionAllocation.findMany({
        where: {
            sourceType: 'ADJ',
            sourceId: adjustmentId,
            isVoided: false
        }
    });

    for (const alloc of allocations) {
        await tx.productionAllocation.update({
            where: { id: alloc.id },
            data: {
                isVoided: true,
                voidedAt: new Date(),
                voidReason
            }
        });

        await tx.purchaseItem.update({
            where: { id: alloc.purchaseItemId },
            data: { qtyRemaining: { increment: alloc.qtyAllocated } }
        });
    }
}

// Export recalc functions for use in other functions
export { recalcLotClosures, recalcClosuresForDate, getTashkentDayRange };
