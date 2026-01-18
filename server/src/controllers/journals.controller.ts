import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============ SUMMARY ORDERS JOURNAL ============

export const getSummaryJournals = async (req: Request, res: Response) => {
    try {
        const { dateFrom, dateTo, showHidden } = req.query;

        const where: any = {};

        if (dateFrom && dateTo) {
            where.summaryDate = {
                gte: new Date(dateFrom as string),
                lte: new Date(dateTo as string)
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
    } catch (error) {
        console.error('Get summary journals error:', error);
        res.status(500).json({ error: 'Failed to get summary journals' });
    }
};

export const createSummaryJournal = async (req: Request, res: Response) => {
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
    } catch (error) {
        console.error('Create summary journal error:', error);
        res.status(400).json({ error: 'Failed to create summary journal' });
    }
};

export const updateSummaryJournal = async (req: Request, res: Response) => {
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
    } catch (error) {
        console.error('Update summary journal error:', error);
        res.status(400).json({ error: 'Failed to update summary journal' });
    }
};

export const getSummaryJournalById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const journal = await prisma.summaryOrdersJournal.findUnique({
            where: { id: Number(id) }
        });

        if (!journal) {
            return res.status(404).json({ error: 'Journal not found' });
        }

        res.json(journal);
    } catch (error) {
        console.error('Get summary journal error:', error);
        res.status(500).json({ error: 'Failed to get journal' });
    }
};

// ============ ASSEMBLY ORDERS JOURNAL ============

export const getAssemblyJournals = async (req: Request, res: Response) => {
    try {
        const { dateFrom, dateTo, showHidden } = req.query;

        const where: any = {};

        if (dateFrom && dateTo) {
            where.assemblyDate = {
                gte: new Date(dateFrom as string),
                lte: new Date(dateTo as string)
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
    } catch (error) {
        console.error('Get assembly journals error:', error);
        res.status(500).json({ error: 'Failed to get assembly journals' });
    }
};

export const createAssemblyJournal = async (req: Request, res: Response) => {
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
    } catch (error) {
        console.error('Create assembly journal error:', error);
        res.status(400).json({ error: 'Failed to create assembly journal' });
    }
};

export const updateAssemblyJournal = async (req: Request, res: Response) => {
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
    } catch (error) {
        console.error('Update assembly journal error:', error);
        res.status(400).json({ error: 'Failed to update assembly journal' });
    }
};

export const getAssemblyJournalById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const journal = await prisma.assemblyOrdersJournal.findUnique({
            where: { id: Number(id) }
        });

        if (!journal) {
            return res.status(404).json({ error: 'Journal not found' });
        }

        res.json(journal);
    } catch (error) {
        console.error('Get assembly journal error:', error);
        res.status(500).json({ error: 'Failed to get journal' });
    }
};
