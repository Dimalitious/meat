"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateItemValue = exports.unlockProductionItem = exports.lockProductionItem = exports.cloneProductionItem = exports.deleteMultipleItems = exports.deleteProductionItem = exports.updateProductionItem = exports.addProductionItem = exports.saveJournal = exports.getJournalList = exports.getOrCreateJournal = exports.updateProductionStaff = exports.createProductionStaff = exports.getStaffByUserId = exports.getProductionStaff = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// ============================================
// СПРАВОЧНИК ПРОИЗВОДСТВЕННОГО ПЕРСОНАЛА
// ============================================
// Получить список персонала
const getProductionStaff = async (req, res) => {
    try {
        const staff = await prisma.productionStaff.findMany({
            where: { isActive: true },
            include: { user: { select: { id: true, username: true, name: true } } },
            orderBy: { fullName: 'asc' }
        });
        res.json(staff);
    }
    catch (error) {
        console.error('Get production staff error:', error);
        res.status(500).json({ error: 'Failed to get production staff' });
    }
};
exports.getProductionStaff = getProductionStaff;
// Получить сотрудника по userId
const getStaffByUserId = async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        const staff = await prisma.productionStaff.findUnique({
            where: { userId },
            include: { user: { select: { id: true, username: true, name: true } } }
        });
        res.json(staff);
    }
    catch (error) {
        console.error('Get staff by user error:', error);
        res.status(500).json({ error: 'Failed to get staff' });
    }
};
exports.getStaffByUserId = getStaffByUserId;
// Создать сотрудника
const createProductionStaff = async (req, res) => {
    try {
        const { fullName, phone, userId } = req.body;
        const staff = await prisma.productionStaff.create({
            data: { fullName, phone, userId },
            include: { user: { select: { id: true, username: true, name: true } } }
        });
        res.json(staff);
    }
    catch (error) {
        console.error('Create production staff error:', error);
        res.status(500).json({ error: 'Failed to create production staff' });
    }
};
exports.createProductionStaff = createProductionStaff;
// Обновить сотрудника
const updateProductionStaff = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { fullName, phone, isActive } = req.body;
        const staff = await prisma.productionStaff.update({
            where: { id },
            data: { fullName, phone, isActive },
            include: { user: { select: { id: true, username: true, name: true } } }
        });
        res.json(staff);
    }
    catch (error) {
        console.error('Update production staff error:', error);
        res.status(500).json({ error: 'Failed to update production staff' });
    }
};
exports.updateProductionStaff = updateProductionStaff;
// ============================================
// ЖУРНАЛ ПРОИЗВОДСТВА
// ============================================
// Получить документ по дате и user_id (или создать новый)
const getOrCreateJournal = async (req, res) => {
    try {
        const dateStr = req.params.date;
        const date = new Date(dateStr);
        date.setUTCHours(0, 0, 0, 0);
        const user = req.user;
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
    }
    catch (error) {
        console.error('Get/create journal error:', error);
        res.status(500).json({ error: 'Failed to get/create journal' });
    }
};
exports.getOrCreateJournal = getOrCreateJournal;
// Список журналов (для таблицы)
const getJournalList = async (req, res) => {
    try {
        const { dateFrom, dateTo, staffId } = req.query;
        const where = {};
        if (dateFrom || dateTo) {
            where.productionDate = {};
            if (dateFrom)
                where.productionDate.gte = new Date(dateFrom);
            if (dateTo)
                where.productionDate.lte = new Date(dateTo);
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
    }
    catch (error) {
        console.error('Get journal list error:', error);
        res.status(500).json({ error: 'Failed to get journals' });
    }
};
exports.getJournalList = getJournalList;
// Сохранить журнал
const saveJournal = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const user = req.user?.username || 'system';
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
    }
    catch (error) {
        console.error('Save journal error:', error);
        res.status(500).json({ error: 'Failed to save journal' });
    }
};
exports.saveJournal = saveJournal;
// ============================================
// КАРТОЧКИ ПРОИЗВОДСТВА
// ============================================
// Добавить карточку
const addProductionItem = async (req, res) => {
    try {
        const journalId = Number(req.params.journalId);
        const { productId, productName } = req.body;
        const user = req.user?.username || 'system';
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
    }
    catch (error) {
        console.error('Add production item error:', error);
        res.status(500).json({ error: 'Failed to add item' });
    }
};
exports.addProductionItem = addProductionItem;
// Обновить карточку (товар, состояние)
const updateProductionItem = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { productId, productName, state } = req.body;
        const user = req.user?.username || 'system';
        const data = { updatedBy: user };
        if (productId !== undefined)
            data.productId = productId;
        if (productName !== undefined)
            data.productName = productName;
        if (state !== undefined)
            data.state = state;
        const item = await prisma.productionItem.update({
            where: { id },
            data,
            include: { product: true, values: true }
        });
        res.json(item);
    }
    catch (error) {
        console.error('Update production item error:', error);
        res.status(500).json({ error: 'Failed to update item' });
    }
};
exports.updateProductionItem = updateProductionItem;
// Удалить карточку (soft delete)
const deleteProductionItem = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const user = req.user?.username || 'system';
        await prisma.productionItem.update({
            where: { id },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
                deletedBy: user
            }
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Delete production item error:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
};
exports.deleteProductionItem = deleteProductionItem;
// Удалить несколько карточек (bulk)
const deleteMultipleItems = async (req, res) => {
    try {
        const { ids } = req.body;
        const user = req.user?.username || 'system';
        await prisma.productionItem.updateMany({
            where: { id: { in: ids } },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
                deletedBy: user
            }
        });
        res.json({ success: true, deleted: ids.length });
    }
    catch (error) {
        console.error('Delete multiple items error:', error);
        res.status(500).json({ error: 'Failed to delete items' });
    }
};
exports.deleteMultipleItems = deleteMultipleItems;
// Клонировать карточку
const cloneProductionItem = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const user = req.user?.username || 'system';
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
    }
    catch (error) {
        console.error('Clone production item error:', error);
        res.status(500).json({ error: 'Failed to clone item' });
    }
};
exports.cloneProductionItem = cloneProductionItem;
// Заблокировать карточку (зелёная галочка)
const lockProductionItem = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const user = req.user?.username || 'system';
        const item = await prisma.productionItem.update({
            where: { id },
            data: { state: 'locked', updatedBy: user },
            include: { product: true, values: true }
        });
        res.json(item);
    }
    catch (error) {
        console.error('Lock production item error:', error);
        res.status(500).json({ error: 'Failed to lock item' });
    }
};
exports.lockProductionItem = lockProductionItem;
// Разблокировать карточку (карандаш)
const unlockProductionItem = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const user = req.user?.username || 'system';
        const item = await prisma.productionItem.update({
            where: { id },
            data: { state: 'editing', updatedBy: user },
            include: { product: true, values: true }
        });
        res.json(item);
    }
    catch (error) {
        console.error('Unlock production item error:', error);
        res.status(500).json({ error: 'Failed to unlock item' });
    }
};
exports.unlockProductionItem = unlockProductionItem;
// Обновить значение поля карточки
const updateItemValue = async (req, res) => {
    try {
        const itemId = Number(req.params.itemId);
        const { fieldKey, fieldValue } = req.body;
        const user = req.user?.username || 'system';
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
    }
    catch (error) {
        console.error('Update item value error:', error);
        res.status(500).json({ error: 'Failed to update value' });
    }
};
exports.updateItemValue = updateItemValue;
