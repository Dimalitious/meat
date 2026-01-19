import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// СПРАВОЧНИК ПРОИЗВОДСТВЕННОГО ПЕРСОНАЛА
// ============================================

// Получить список персонала
export const getProductionStaff = async (req: Request, res: Response) => {
    try {
        const staff = await prisma.productionStaff.findMany({
            where: { isActive: true },
            include: { user: { select: { id: true, username: true, name: true } } },
            orderBy: { fullName: 'asc' }
        });
        res.json(staff);
    } catch (error) {
        console.error('Get production staff error:', error);
        res.status(500).json({ error: 'Failed to get production staff' });
    }
};

// Получить сотрудника по userId
export const getStaffByUserId = async (req: Request, res: Response) => {
    try {
        const userId = Number(req.params.userId);
        const staff = await prisma.productionStaff.findUnique({
            where: { userId },
            include: { user: { select: { id: true, username: true, name: true } } }
        });
        res.json(staff);
    } catch (error) {
        console.error('Get staff by user error:', error);
        res.status(500).json({ error: 'Failed to get staff' });
    }
};

// Создать сотрудника
export const createProductionStaff = async (req: Request, res: Response) => {
    try {
        const { fullName, phone, userId } = req.body;

        const staff = await prisma.productionStaff.create({
            data: { fullName, phone, userId },
            include: { user: { select: { id: true, username: true, name: true } } }
        });
        res.json(staff);
    } catch (error) {
        console.error('Create production staff error:', error);
        res.status(500).json({ error: 'Failed to create production staff' });
    }
};

// Обновить сотрудника
export const updateProductionStaff = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const { fullName, phone, isActive } = req.body;

        const staff = await prisma.productionStaff.update({
            where: { id },
            data: { fullName, phone, isActive },
            include: { user: { select: { id: true, username: true, name: true } } }
        });
        res.json(staff);
    } catch (error) {
        console.error('Update production staff error:', error);
        res.status(500).json({ error: 'Failed to update production staff' });
    }
};

// ============================================
// ЖУРНАЛ ПРОИЗВОДСТВА
// ============================================

// Получить документ по дате и user_id (или создать новый)
export const getOrCreateJournal = async (req: Request, res: Response) => {
    try {
        const dateStr = req.params.date as string;
        const date = new Date(dateStr);
        date.setUTCHours(0, 0, 0, 0);

        const user = (req as any).user;
        const userId = user?.id || user?.userId;
        const userName = user?.username || user?.name || 'system';

        // Найти сотрудника по userId
        let staff = await prisma.productionStaff.findUnique({
            where: { userId: Number(userId) }
        });

        // Если сотрудника нет - создать автоматически
        if (!staff) {
            staff = await prisma.productionStaff.create({
                data: {
                    userId: Number(userId),
                    fullName: user?.name || userName,
                    phone: null
                }
            });
        }

        // Искать журнал по дате + сотрудник
        let journal = await prisma.productionJournal.findFirst({
            where: {
                productionDate: date,
                staffId: staff.id
            },
            include: {
                staff: { include: { user: { select: { name: true, username: true } } } },
                items: {
                    where: { isDeleted: false },
                    include: { product: true, values: true },
                    orderBy: { sortOrder: 'asc' }
                }
            }
        });

        if (!journal) {
            // Создать новый журнал
            journal = await prisma.productionJournal.create({
                data: {
                    productionDate: date,
                    staffId: staff.id,
                    status: 'draft',
                    createdBy: userName
                },
                include: {
                    staff: { include: { user: { select: { name: true, username: true } } } },
                    items: {
                        where: { isDeleted: false },
                        include: { product: true, values: true },
                        orderBy: { sortOrder: 'asc' }
                    }
                }
            });
        }

        res.json(journal);
    } catch (error) {
        console.error('Get/create journal error:', error);
        res.status(500).json({ error: 'Failed to get/create journal' });
    }
};

// Список журналов (для таблицы)
export const getJournalList = async (req: Request, res: Response) => {
    try {
        const { dateFrom, dateTo, staffId } = req.query;

        const where: any = {};
        if (dateFrom || dateTo) {
            where.productionDate = {};
            if (dateFrom) where.productionDate.gte = new Date(dateFrom as string);
            if (dateTo) where.productionDate.lte = new Date(dateTo as string);
        }
        if (staffId) {
            where.staffId = Number(staffId);
        }

        const journals = await prisma.productionJournal.findMany({
            where,
            include: {
                staff: { include: { user: { select: { name: true } } } },
                _count: { select: { items: true } }
            },
            orderBy: { productionDate: 'desc' }
        });

        res.json(journals);
    } catch (error) {
        console.error('Get journal list error:', error);
        res.status(500).json({ error: 'Failed to get journals' });
    }
};

// Сохранить журнал
export const saveJournal = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const user = (req as any).user?.username || 'system';

        const journal = await prisma.productionJournal.update({
            where: { id },
            data: {
                status: 'saved',
                updatedBy: user
            },
            include: {
                staff: { include: { user: { select: { name: true, username: true } } } },
                items: {
                    where: { isDeleted: false },
                    include: { product: true, values: true },
                    orderBy: { sortOrder: 'asc' }
                }
            }
        });

        res.json(journal);
    } catch (error) {
        console.error('Save journal error:', error);
        res.status(500).json({ error: 'Failed to save journal' });
    }
};

// ============================================
// КАРТОЧКИ ПРОИЗВОДСТВА
// ============================================

// Добавить карточку
export const addProductionItem = async (req: Request, res: Response) => {
    try {
        const journalId = Number(req.params.journalId);
        const { productId, productName } = req.body;
        const user = (req as any).user?.username || 'system';

        // Получить максимальный sortOrder
        const maxSort = await prisma.productionItem.aggregate({
            where: { journalId },
            _max: { sortOrder: true }
        });

        const item = await prisma.productionItem.create({
            data: {
                journalId,
                productId: productId || null,
                productName: productName || null,
                state: 'editing',
                sortOrder: (maxSort._max.sortOrder || 0) + 1,
                createdBy: user,
                updatedBy: user
            },
            include: { product: true, values: true }
        });

        res.json(item);
    } catch (error) {
        console.error('Add production item error:', error);
        res.status(500).json({ error: 'Failed to add item' });
    }
};

// Обновить карточку (товар, состояние)
export const updateProductionItem = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const { productId, productName, state } = req.body;
        const user = (req as any).user?.username || 'system';

        const data: any = { updatedBy: user };
        if (productId !== undefined) data.productId = productId;
        if (productName !== undefined) data.productName = productName;
        if (state !== undefined) data.state = state;

        const item = await prisma.productionItem.update({
            where: { id },
            data,
            include: { product: true, values: true }
        });

        res.json(item);
    } catch (error) {
        console.error('Update production item error:', error);
        res.status(500).json({ error: 'Failed to update item' });
    }
};

// Удалить карточку (soft delete)
export const deleteProductionItem = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const user = (req as any).user?.username || 'system';

        await prisma.productionItem.update({
            where: { id },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
                deletedBy: user
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Delete production item error:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
};

// Удалить несколько карточек (bulk)
export const deleteMultipleItems = async (req: Request, res: Response) => {
    try {
        const { ids } = req.body;
        const user = (req as any).user?.username || 'system';

        await prisma.productionItem.updateMany({
            where: { id: { in: ids } },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
                deletedBy: user
            }
        });

        res.json({ success: true, deleted: ids.length });
    } catch (error) {
        console.error('Delete multiple items error:', error);
        res.status(500).json({ error: 'Failed to delete items' });
    }
};

// Клонировать карточку
export const cloneProductionItem = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const user = (req as any).user?.username || 'system';

        // Получить исходную карточку с значениями
        const source = await prisma.productionItem.findUnique({
            where: { id },
            include: { values: true }
        });

        if (!source) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Получить максимальный sortOrder
        const maxSort = await prisma.productionItem.aggregate({
            where: { journalId: source.journalId },
            _max: { sortOrder: true }
        });

        // Создать клон
        const clone = await prisma.productionItem.create({
            data: {
                journalId: source.journalId,
                productId: source.productId,
                productName: source.productName,
                state: 'editing', // Клон всегда в режиме редактирования
                sortOrder: (maxSort._max.sortOrder || 0) + 1,
                createdBy: user,
                updatedBy: user,
                values: {
                    create: source.values.map(v => ({
                        fieldKey: v.fieldKey,
                        fieldValue: v.fieldValue,
                        updatedBy: user
                    }))
                }
            },
            include: { product: true, values: true }
        });

        res.json(clone);
    } catch (error) {
        console.error('Clone production item error:', error);
        res.status(500).json({ error: 'Failed to clone item' });
    }
};

// Заблокировать карточку (зелёная галочка)
export const lockProductionItem = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const user = (req as any).user?.username || 'system';

        const item = await prisma.productionItem.update({
            where: { id },
            data: { state: 'locked', updatedBy: user },
            include: { product: true, values: true }
        });

        res.json(item);
    } catch (error) {
        console.error('Lock production item error:', error);
        res.status(500).json({ error: 'Failed to lock item' });
    }
};

// Разблокировать карточку (карандаш)
export const unlockProductionItem = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const user = (req as any).user?.username || 'system';

        const item = await prisma.productionItem.update({
            where: { id },
            data: { state: 'editing', updatedBy: user },
            include: { product: true, values: true }
        });

        res.json(item);
    } catch (error) {
        console.error('Unlock production item error:', error);
        res.status(500).json({ error: 'Failed to unlock item' });
    }
};

// Обновить значение поля карточки
export const updateItemValue = async (req: Request, res: Response) => {
    try {
        const itemId = Number(req.params.itemId);
        const { fieldKey, fieldValue } = req.body;
        const user = (req as any).user?.username || 'system';

        const value = await prisma.productionItemValue.upsert({
            where: {
                productionItemId_fieldKey: { productionItemId: itemId, fieldKey }
            },
            update: { fieldValue, updatedBy: user },
            create: {
                productionItemId: itemId,
                fieldKey,
                fieldValue,
                updatedBy: user
            }
        });

        res.json(value);
    } catch (error) {
        console.error('Update item value error:', error);
        res.status(500).json({ error: 'Failed to update value' });
    }
};
