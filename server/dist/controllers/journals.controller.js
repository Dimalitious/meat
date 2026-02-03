"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDistributionJournalById = exports.updateDistributionJournal = exports.createDistributionJournal = exports.getDistributionJournals = exports.getExpeditionJournalById = exports.updateExpeditionJournal = exports.createExpeditionJournal = exports.getExpeditionJournals = exports.getAssemblyJournalById = exports.updateAssemblyJournal = exports.createAssemblyJournal = exports.getAssemblyJournals = exports.sendAssemblyJournalToRework = exports.sendSummaryJournalToRework = exports.getSummaryJournalById = exports.updateSummaryJournal = exports.createSummaryJournal = exports.getSummaryJournals = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// ============ SUMMARY ORDERS JOURNAL ============
const getSummaryJournals = async (req, res) => {
    try {
        const { dateFrom, dateTo, showHidden } = req.query;
        const where = {};
        if (dateFrom && dateTo) {
            where.summaryDate = {
                gte: new Date(dateFrom),
                lte: new Date(dateTo)
            };
        }
        if (showHidden !== 'true') {
            where.isHidden = false;
        }
        const journals = await prisma.summaryOrdersJournal.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
        res.json(journals);
    }
    catch (error) {
        console.error('Get summary journals error:', error);
        res.status(500).json({ error: 'Failed to get summary journals' });
    }
};
exports.getSummaryJournals = getSummaryJournals;
const createSummaryJournal = async (req, res) => {
    try {
        const { summaryDate, createdBy, data } = req.body;
        const journal = await prisma.summaryOrdersJournal.create({
            data: {
                summaryDate: new Date(summaryDate),
                createdBy,
                data
            }
        });
        res.json(journal);
    }
    catch (error) {
        console.error('Create summary journal error:', error);
        res.status(400).json({ error: 'Failed to create summary journal' });
    }
};
exports.createSummaryJournal = createSummaryJournal;
const updateSummaryJournal = async (req, res) => {
    try {
        const { id } = req.params;
        const { isHidden, data } = req.body;
        const journal = await prisma.summaryOrdersJournal.update({
            where: { id: Number(id) },
            data: {
                ...(isHidden !== undefined && { isHidden }),
                ...(data !== undefined && { data })
            }
        });
        res.json(journal);
    }
    catch (error) {
        console.error('Update summary journal error:', error);
        res.status(400).json({ error: 'Failed to update summary journal' });
    }
};
exports.updateSummaryJournal = updateSummaryJournal;
const getSummaryJournalById = async (req, res) => {
    try {
        const { id } = req.params;
        const journal = await prisma.summaryOrdersJournal.findUnique({
            where: { id: Number(id) }
        });
        if (!journal) {
            return res.status(404).json({ error: 'Journal not found' });
        }
        res.json(journal);
    }
    catch (error) {
        console.error('Get summary journal error:', error);
        res.status(500).json({ error: 'Failed to get journal' });
    }
};
exports.getSummaryJournalById = getSummaryJournalById;
// Отправить журнал сводки на доработку
const sendSummaryJournalToRework = async (req, res) => {
    try {
        const { id } = req.params;
        const username = req.user?.username || 'system';
        // Начинаем транзакцию для атомарности
        const result = await prisma.$transaction(async (tx) => {
            // 1. Находим журнал
            const journal = await tx.summaryOrdersJournal.findUnique({
                where: { id: Number(id) }
            });
            if (!journal) {
                throw new Error('JOURNAL_NOT_FOUND');
            }
            // 2. Проверяем, не в процессе ли уже возврат (идемпотентность)
            if (journal.isHidden) {
                throw new Error('ALREADY_IN_REWORK');
            }
            // 3. Получаем данные журнала (массив записей сводки)
            const journalData = journal.data;
            if (!Array.isArray(journalData) || journalData.length === 0) {
                throw new Error('EMPTY_JOURNAL_DATA');
            }
            // 4. Возвращаем все записи в SummaryOrderJournal со статусом 'draft'
            const createdEntries = [];
            for (const item of journalData) {
                // Проверяем, не существует ли уже запись с таким ID и статусом draft
                const existingEntry = await tx.summaryOrderJournal.findFirst({
                    where: {
                        id: item.id,
                        status: 'draft'
                    }
                });
                if (!existingEntry) {
                    // Если запись существует, обновляем её статус
                    const existingById = await tx.summaryOrderJournal.findUnique({
                        where: { id: item.id }
                    });
                    if (existingById) {
                        // Обновляем существующую запись
                        const updated = await tx.summaryOrderJournal.update({
                            where: { id: item.id },
                            data: {
                                status: 'draft',
                                preAssemblyStatus: existingById.status
                            }
                        });
                        createdEntries.push(updated);
                    }
                    else {
                        // Создаём новую запись из данных журнала
                        const created = await tx.summaryOrderJournal.create({
                            data: {
                                idn: item.idn || null,
                                shipDate: new Date(item.shipDate || journal.summaryDate),
                                paymentType: item.paymentType || 'bank',
                                customerId: item.customerId ? Number(item.customerId) : null,
                                customerName: item.customerName || '',
                                productId: item.productId ? Number(item.productId) : null,
                                productFullName: item.productFullName || '',
                                category: item.category || null,
                                shortNameMorning: item.shortNameMorning || null,
                                priceType: item.priceType || null,
                                price: Number(item.price) || 0,
                                shippedQty: Number(item.shippedQty) || 0,
                                orderQty: Number(item.orderQty) || 0,
                                sumWithRevaluation: Number(item.sumWithRevaluation) || 0,
                                distributionCoef: Number(item.distributionCoef) || 0,
                                weightToDistribute: Number(item.weightToDistribute) || 0,
                                managerId: item.managerId || null,
                                managerName: item.managerName || '',
                                status: 'draft' // Готово к "Начать сборку"
                            }
                        });
                        createdEntries.push(created);
                    }
                }
            }
            // 5. Помечаем журнал как скрытый/неактивный
            await tx.summaryOrdersJournal.update({
                where: { id: Number(id) },
                data: {
                    isHidden: true
                }
            });
            // 6. Создаём событие аудита (если есть модель)
            try {
                await tx.summaryOrderEvent.create({
                    data: {
                        summaryOrderId: createdEntries[0]?.id || 0,
                        eventType: 'JOURNAL_REWORK',
                        fromStatus: 'journal',
                        toStatus: 'draft',
                        createdBy: username,
                        comment: `Возвращено на доработку из журнала #${id}`,
                        payload: {
                            journalId: Number(id),
                            entriesCount: createdEntries.length,
                            summaryDate: journal.summaryDate
                        }
                    }
                });
            }
            catch (e) {
                // Если модели событий нет - пропускаем
                console.log('Audit event not created (optional)');
            }
            return {
                journalId: Number(id),
                entriesReturned: createdEntries.length,
                summaryDate: journal.summaryDate
            };
        });
        res.json({
            message: 'Журнал отправлен на доработку',
            ...result
        });
    }
    catch (error) {
        console.error('Send to rework error:', error);
        if (error.message === 'JOURNAL_NOT_FOUND') {
            return res.status(404).json({ error: 'Журнал не найден' });
        }
        if (error.message === 'ALREADY_IN_REWORK') {
            return res.status(400).json({ error: 'Журнал уже отправлен на доработку' });
        }
        if (error.message === 'EMPTY_JOURNAL_DATA') {
            return res.status(400).json({ error: 'Журнал не содержит данных' });
        }
        res.status(500).json({ error: 'Ошибка отправки на доработку' });
    }
};
exports.sendSummaryJournalToRework = sendSummaryJournalToRework;
// Отправить журнал сборки на доработку
const sendAssemblyJournalToRework = async (req, res) => {
    try {
        const { id } = req.params;
        const username = req.user?.username || 'system';
        const result = await prisma.$transaction(async (tx) => {
            const journal = await tx.assemblyOrdersJournal.findUnique({
                where: { id: Number(id) }
            });
            if (!journal) {
                throw new Error('JOURNAL_NOT_FOUND');
            }
            if (journal.isHidden) {
                throw new Error('ALREADY_IN_REWORK');
            }
            const journalData = journal.data;
            if (!Array.isArray(journalData) || journalData.length === 0) {
                throw new Error('EMPTY_JOURNAL_DATA');
            }
            // Возвращаем записи в SummaryOrderJournal
            const createdEntries = [];
            for (const item of journalData) {
                const existingById = await tx.summaryOrderJournal.findUnique({
                    where: { id: item.id }
                });
                if (existingById) {
                    const updated = await tx.summaryOrderJournal.update({
                        where: { id: item.id },
                        data: {
                            status: 'draft',
                            preAssemblyStatus: existingById.status
                        }
                    });
                    createdEntries.push(updated);
                }
                else {
                    const created = await tx.summaryOrderJournal.create({
                        data: {
                            idn: item.idn || null,
                            shipDate: new Date(item.shipDate || journal.assemblyDate),
                            paymentType: item.paymentType || 'bank',
                            customerId: item.customerId ? Number(item.customerId) : null,
                            customerName: item.customerName || '',
                            productId: item.productId ? Number(item.productId) : null,
                            productFullName: item.productFullName || '',
                            category: item.category || null,
                            price: Number(item.price) || 0,
                            shippedQty: Number(item.shippedQty) || 0,
                            orderQty: Number(item.orderQty) || 0,
                            sumWithRevaluation: Number(item.sumWithRevaluation) || 0,
                            managerId: item.managerId || null,
                            managerName: item.managerName || '',
                            status: 'draft'
                        }
                    });
                    createdEntries.push(created);
                }
            }
            await tx.assemblyOrdersJournal.update({
                where: { id: Number(id) },
                data: { isHidden: true }
            });
            return {
                journalId: Number(id),
                entriesReturned: createdEntries.length,
                assemblyDate: journal.assemblyDate
            };
        });
        res.json({
            message: 'Журнал сборки отправлен на доработку',
            ...result
        });
    }
    catch (error) {
        console.error('Send assembly to rework error:', error);
        if (error.message === 'JOURNAL_NOT_FOUND') {
            return res.status(404).json({ error: 'Журнал не найден' });
        }
        if (error.message === 'ALREADY_IN_REWORK') {
            return res.status(400).json({ error: 'Журнал уже отправлен на доработку' });
        }
        if (error.message === 'EMPTY_JOURNAL_DATA') {
            return res.status(400).json({ error: 'Журнал не содержит данных' });
        }
        res.status(500).json({ error: 'Ошибка отправки на доработку' });
    }
};
exports.sendAssemblyJournalToRework = sendAssemblyJournalToRework;
// ============ ASSEMBLY ORDERS JOURNAL ============
const getAssemblyJournals = async (req, res) => {
    try {
        const { dateFrom, dateTo, showHidden } = req.query;
        const where = {};
        if (dateFrom && dateTo) {
            where.assemblyDate = {
                gte: new Date(dateFrom),
                lte: new Date(dateTo)
            };
        }
        if (showHidden !== 'true') {
            where.isHidden = false;
        }
        const journals = await prisma.assemblyOrdersJournal.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
        res.json(journals);
    }
    catch (error) {
        console.error('Get assembly journals error:', error);
        res.status(500).json({ error: 'Failed to get assembly journals' });
    }
};
exports.getAssemblyJournals = getAssemblyJournals;
const createAssemblyJournal = async (req, res) => {
    try {
        const { assemblyDate, createdBy, sourceSummaryId, data } = req.body;
        const journal = await prisma.assemblyOrdersJournal.create({
            data: {
                assemblyDate: new Date(assemblyDate),
                createdBy,
                sourceSummaryId: sourceSummaryId ? Number(sourceSummaryId) : null,
                data
            }
        });
        res.json(journal);
    }
    catch (error) {
        console.error('Create assembly journal error:', error);
        res.status(400).json({ error: 'Failed to create assembly journal' });
    }
};
exports.createAssemblyJournal = createAssemblyJournal;
const updateAssemblyJournal = async (req, res) => {
    try {
        const { id } = req.params;
        const { isHidden, data } = req.body;
        const journal = await prisma.assemblyOrdersJournal.update({
            where: { id: Number(id) },
            data: {
                ...(isHidden !== undefined && { isHidden }),
                ...(data !== undefined && { data })
            }
        });
        res.json(journal);
    }
    catch (error) {
        console.error('Update assembly journal error:', error);
        res.status(400).json({ error: 'Failed to update assembly journal' });
    }
};
exports.updateAssemblyJournal = updateAssemblyJournal;
const getAssemblyJournalById = async (req, res) => {
    try {
        const { id } = req.params;
        const journal = await prisma.assemblyOrdersJournal.findUnique({
            where: { id: Number(id) }
        });
        if (!journal) {
            return res.status(404).json({ error: 'Journal not found' });
        }
        res.json(journal);
    }
    catch (error) {
        console.error('Get assembly journal error:', error);
        res.status(500).json({ error: 'Failed to get journal' });
    }
};
exports.getAssemblyJournalById = getAssemblyJournalById;
// ============ EXPEDITION JOURNAL ============
const getExpeditionJournals = async (req, res) => {
    try {
        const { dateFrom, dateTo, showHidden, expeditorId } = req.query;
        const where = {};
        if (dateFrom && dateTo) {
            where.dateFrom = { gte: new Date(dateFrom) };
            where.dateTo = { lte: new Date(dateTo) };
        }
        if (expeditorId) {
            where.expeditorId = Number(expeditorId);
        }
        if (showHidden !== 'true') {
            where.isHidden = false;
        }
        const journals = await prisma.expeditionJournal.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
        res.json(journals);
    }
    catch (error) {
        console.error('Get expedition journals error:', error);
        res.status(500).json({ error: 'Failed to get expedition journals' });
    }
};
exports.getExpeditionJournals = getExpeditionJournals;
const createExpeditionJournal = async (req, res) => {
    try {
        const { expeditorId, expeditorName, dateFrom, dateTo, savedAt, orders } = req.body;
        const journal = await prisma.expeditionJournal.create({
            data: {
                expeditorId: Number(expeditorId),
                expeditorName: expeditorName || '',
                dateFrom: new Date(dateFrom),
                dateTo: new Date(dateTo),
                ordersCount: orders?.length || 0,
                totalWeight: orders?.reduce((sum, o) => sum + (o.totalWeight || 0), 0) || 0,
                totalAmount: orders?.reduce((sum, o) => sum + (o.totalAmount || 0), 0) || 0,
                data: orders || []
            }
        });
        res.json(journal);
    }
    catch (error) {
        console.error('Create expedition journal error:', error);
        res.status(400).json({ error: 'Failed to create expedition journal' });
    }
};
exports.createExpeditionJournal = createExpeditionJournal;
const updateExpeditionJournal = async (req, res) => {
    try {
        const { id } = req.params;
        const { isHidden, data } = req.body;
        const journal = await prisma.expeditionJournal.update({
            where: { id: Number(id) },
            data: {
                ...(isHidden !== undefined && { isHidden }),
                ...(data !== undefined && { data })
            }
        });
        res.json(journal);
    }
    catch (error) {
        console.error('Update expedition journal error:', error);
        res.status(400).json({ error: 'Failed to update expedition journal' });
    }
};
exports.updateExpeditionJournal = updateExpeditionJournal;
const getExpeditionJournalById = async (req, res) => {
    try {
        const { id } = req.params;
        const journal = await prisma.expeditionJournal.findUnique({
            where: { id: Number(id) }
        });
        if (!journal) {
            return res.status(404).json({ error: 'Journal not found' });
        }
        res.json(journal);
    }
    catch (error) {
        console.error('Get expedition journal error:', error);
        res.status(500).json({ error: 'Failed to get journal' });
    }
};
exports.getExpeditionJournalById = getExpeditionJournalById;
// ============ DISTRIBUTION JOURNAL ============
const getDistributionJournals = async (req, res) => {
    try {
        const { dateFrom, dateTo, showHidden } = req.query;
        const where = {};
        if (dateFrom && dateTo) {
            where.date = {
                gte: new Date(dateFrom),
                lte: new Date(dateTo)
            };
        }
        if (showHidden !== 'true') {
            where.isHidden = false;
        }
        const journals = await prisma.distributionJournal.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
        res.json(journals);
    }
    catch (error) {
        console.error('Get distribution journals error:', error);
        res.status(500).json({ error: 'Failed to get distribution journals' });
    }
};
exports.getDistributionJournals = getDistributionJournals;
const createDistributionJournal = async (req, res) => {
    try {
        const { date, savedAt, ordersCount, orders } = req.body;
        const journal = await prisma.distributionJournal.create({
            data: {
                date: new Date(date),
                ordersCount: orders?.length || ordersCount || 0,
                totalWeight: orders?.reduce((sum, o) => sum + (o.totalWeight || 0), 0) || 0,
                totalAmount: orders?.reduce((sum, o) => sum + (o.totalAmount || 0), 0) || 0,
                data: orders || []
            }
        });
        res.json(journal);
    }
    catch (error) {
        console.error('Create distribution journal error:', error);
        res.status(400).json({ error: 'Failed to create distribution journal' });
    }
};
exports.createDistributionJournal = createDistributionJournal;
const updateDistributionJournal = async (req, res) => {
    try {
        const { id } = req.params;
        const { isHidden, data } = req.body;
        const journal = await prisma.distributionJournal.update({
            where: { id: Number(id) },
            data: {
                ...(isHidden !== undefined && { isHidden }),
                ...(data !== undefined && { data })
            }
        });
        res.json(journal);
    }
    catch (error) {
        console.error('Update distribution journal error:', error);
        res.status(400).json({ error: 'Failed to update distribution journal' });
    }
};
exports.updateDistributionJournal = updateDistributionJournal;
const getDistributionJournalById = async (req, res) => {
    try {
        const { id } = req.params;
        const journal = await prisma.distributionJournal.findUnique({
            where: { id: Number(id) }
        });
        if (!journal) {
            return res.status(404).json({ error: 'Journal not found' });
        }
        res.json(journal);
    }
    catch (error) {
        console.error('Get distribution journal error:', error);
        res.status(500).json({ error: 'Failed to get journal' });
    }
};
exports.getDistributionJournalById = getDistributionJournalById;
