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
        const { search, isLocked } = req.query;

        const where: any = {};

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
                    select: { id: true, name: true }
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

        res.json(runs);
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
        if (productionDate !== undefined) {
            updateData.productionDate = new Date(productionDate);
        }
        if (plannedWeight !== undefined) {
            updateData.plannedWeight = plannedWeight !== null ? Number(plannedWeight) : null;
        }

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

