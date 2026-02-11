// @ts-nocheck
// NOTE: This controller uses legacy models (ProductionBatch, ProductionBatchItem, ProductionMmlItem)
// that have been replaced by ProductionRun, ProductionRunValue, ProductionMmlNode in the current schema.
// It is kept for reference but should be rewritten or removed.
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ========== MML CONTROLLER ==========

// Get all MMLs
export const getAllMmls = async (req: Request, res: Response) => {
    try {
        const mmls = await prisma.productionMml.findMany({
            include: {
                product: { select: { id: true, code: true, name: true } },
                creator: { select: { id: true, name: true } },
                items: {
                    orderBy: { lineNo: 'asc' },
                    include: {
                        componentProduct: { select: { id: true, code: true, name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(mmls);
    } catch (error) {
        console.error('Get all MMLs error:', error);
        res.status(500).json({ error: 'Failed to fetch MMLs' });
    }
};

// Get MML by ID
export const getMmlById = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const mml = await prisma.productionMml.findUnique({
            where: { id },
            include: {
                product: { select: { id: true, code: true, name: true } },
                creator: { select: { id: true, name: true } },
                items: {
                    orderBy: { lineNo: 'asc' },
                    include: {
                        componentProduct: { select: { id: true, code: true, name: true } }
                    }
                }
            }
        });
        if (!mml) {
            return res.status(404).json({ error: 'MML not found' });
        }
        res.json(mml);
    } catch (error) {
        console.error('Get MML error:', error);
        res.status(500).json({ error: 'Failed to fetch MML' });
    }
};

// Create MML
export const createMml = async (req: Request, res: Response) => {
    try {
        const { productId } = req.body;
        const userId = (req as any).user.userId;

        // Check if MML already exists for this product
        const existing = await prisma.productionMml.findUnique({ where: { productId } });
        if (existing) {
            return res.status(400).json({ error: 'MML already exists for this product' });
        }

        const mml = await prisma.productionMml.create({
            data: {
                productId,
                createdBy: userId,
                items: {
                    create: [
                        { lineNo: 1 },
                        { lineNo: 2 },
                        { lineNo: 3 },
                        { lineNo: 4 },
                        { lineNo: 5 }
                    ]
                }
            },
            include: {
                product: { select: { id: true, code: true, name: true } },
                creator: { select: { id: true, name: true } },
                items: {
                    orderBy: { lineNo: 'asc' },
                    include: {
                        componentProduct: { select: { id: true, code: true, name: true } }
                    }
                }
            }
        });

        res.status(201).json(mml);
    } catch (error) {
        console.error('Create MML error:', error);
        res.status(500).json({ error: 'Failed to create MML' });
    }
};

// Update MML item (set component product)
export const updateMmlItem = async (req: Request, res: Response) => {
    try {
        const mmlId = Number(req.params.mmlId);
        const lineNo = Number(req.params.lineNo);
        const { componentProductId } = req.body;

        // Check if MML is locked
        const mml = await prisma.productionMml.findUnique({ where: { id: mmlId } });
        if (!mml) {
            return res.status(404).json({ error: 'MML not found' });
        }
        if (mml.isLocked) {
            return res.status(400).json({ error: 'MML is locked and cannot be edited' });
        }

        const item = await prisma.productionMmlItem.update({
            where: { mmlId_lineNo: { mmlId, lineNo } },
            data: { componentProductId },
            include: {
                componentProduct: { select: { id: true, code: true, name: true } }
            }
        });

        res.json(item);
    } catch (error) {
        console.error('Update MML item error:', error);
        res.status(500).json({ error: 'Failed to update MML item' });
    }
};

// Lock MML
export const lockMml = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        const mml = await prisma.productionMml.update({
            where: { id },
            data: { isLocked: true },
            include: {
                product: { select: { id: true, code: true, name: true } },
                creator: { select: { id: true, name: true } },
                items: {
                    orderBy: { lineNo: 'asc' },
                    include: {
                        componentProduct: { select: { id: true, code: true, name: true } }
                    }
                }
            }
        });

        res.json(mml);
    } catch (error) {
        console.error('Lock MML error:', error);
        res.status(500).json({ error: 'Failed to lock MML' });
    }
};

// Delete MML (only if not locked)
export const deleteMml = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        const mml = await prisma.productionMml.findUnique({ where: { id } });
        if (!mml) {
            return res.status(404).json({ error: 'MML not found' });
        }
        if (mml.isLocked) {
            return res.status(400).json({ error: 'Cannot delete locked MML' });
        }

        await prisma.productionMml.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete MML error:', error);
        res.status(500).json({ error: 'Failed to delete MML' });
    }
};

// ========== BATCH (Выработка) CONTROLLER ==========

// Get all batches
export const getAllBatches = async (req: Request, res: Response) => {
    try {
        const batches = await prisma.productionBatch.findMany({
            include: {
                product: { select: { id: true, code: true, name: true } },
                user: { select: { id: true, name: true } },
                mml: { select: { id: true } },
                items: {
                    orderBy: { lineNo: 'asc' },
                    include: {
                        componentProduct: { select: { id: true, code: true, name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(batches);
    } catch (error) {
        console.error('Get all batches error:', error);
        res.status(500).json({ error: 'Failed to fetch batches' });
    }
};

// Get batch by ID
export const getBatchById = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const batch = await prisma.productionBatch.findUnique({
            where: { id },
            include: {
                product: { select: { id: true, code: true, name: true } },
                user: { select: { id: true, name: true } },
                mml: { select: { id: true } },
                items: {
                    orderBy: { lineNo: 'asc' },
                    include: {
                        componentProduct: { select: { id: true, code: true, name: true } }
                    }
                }
            }
        });
        if (!batch) {
            return res.status(404).json({ error: 'Batch not found' });
        }
        res.json(batch);
    } catch (error) {
        console.error('Get batch error:', error);
        res.status(500).json({ error: 'Failed to fetch batch' });
    }
};

// Create batch (with auto-populate from MML if exists)
export const createBatch = async (req: Request, res: Response) => {
    try {
        const { productId } = req.body;
        const userId = (req as any).user.userId;

        // Find MML for this product (if exists and locked)
        const mml = await prisma.productionMml.findFirst({
            where: { productId, isLocked: true },
            include: {
                items: { orderBy: { lineNo: 'asc' } }
            }
        });

        // Create batch with 5 lines
        const itemsData = [];
        for (let i = 1; i <= 5; i++) {
            const mmlItem = mml?.items.find(item => item.lineNo === i);
            itemsData.push({
                lineNo: i,
                componentProductId: mmlItem?.componentProductId || null
            });
        }

        const batch = await prisma.productionBatch.create({
            data: {
                productId,
                userId,
                mmlId: mml?.id || null,
                items: { create: itemsData }
            },
            include: {
                product: { select: { id: true, code: true, name: true } },
                user: { select: { id: true, name: true } },
                mml: { select: { id: true } },
                items: {
                    orderBy: { lineNo: 'asc' },
                    include: {
                        componentProduct: { select: { id: true, code: true, name: true } }
                    }
                }
            }
        });

        // Return with warning if no MML
        const response: any = batch;
        if (!mml) {
            response.warning = 'Для позиции не создан MML';
        }

        res.status(201).json(response);
    } catch (error) {
        console.error('Create batch error:', error);
        res.status(500).json({ error: 'Failed to create batch' });
    }
};

// Update batch (quantity)
export const updateBatch = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const { quantity } = req.body;

        const existing = await prisma.productionBatch.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Batch not found' });
        }
        if (existing.isLocked) {
            return res.status(400).json({ error: 'Batch is locked and cannot be edited' });
        }

        const batch = await prisma.productionBatch.update({
            where: { id },
            data: { quantity },
            include: {
                product: { select: { id: true, code: true, name: true } },
                user: { select: { id: true, name: true } },
                mml: { select: { id: true } },
                items: {
                    orderBy: { lineNo: 'asc' },
                    include: {
                        componentProduct: { select: { id: true, code: true, name: true } }
                    }
                }
            }
        });

        res.json(batch);
    } catch (error) {
        console.error('Update batch error:', error);
        res.status(500).json({ error: 'Failed to update batch' });
    }
};

// Update batch item
export const updateBatchItem = async (req: Request, res: Response) => {
    try {
        const batchId = Number(req.params.batchId);
        const lineNo = Number(req.params.lineNo);
        const { componentProductId, value } = req.body;

        const batch = await prisma.productionBatch.findUnique({ where: { id: batchId } });
        if (!batch) {
            return res.status(404).json({ error: 'Batch not found' });
        }
        if (batch.isLocked) {
            return res.status(400).json({ error: 'Batch is locked and cannot be edited' });
        }

        const updateData: any = {};
        if (componentProductId !== undefined) {
            updateData.componentProductId = componentProductId;
        }
        if (value !== undefined) {
            updateData.value = value;
        }

        const item = await prisma.productionBatchItem.update({
            where: { batchId_lineNo: { batchId, lineNo } },
            data: updateData,
            include: {
                componentProduct: { select: { id: true, code: true, name: true } }
            }
        });

        res.json(item);
    } catch (error) {
        console.error('Update batch item error:', error);
        res.status(500).json({ error: 'Failed to update batch item' });
    }
};

// Lock batch
export const lockBatch = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        const batch = await prisma.productionBatch.update({
            where: { id },
            data: { isLocked: true },
            include: {
                product: { select: { id: true, code: true, name: true } },
                user: { select: { id: true, name: true } },
                mml: { select: { id: true } },
                items: {
                    orderBy: { lineNo: 'asc' },
                    include: {
                        componentProduct: { select: { id: true, code: true, name: true } }
                    }
                }
            }
        });

        res.json(batch);
    } catch (error) {
        console.error('Lock batch error:', error);
        res.status(500).json({ error: 'Failed to lock batch' });
    }
};

// Clone batch
export const cloneBatch = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const userId = (req as any).user.userId;

        const original = await prisma.productionBatch.findUnique({
            where: { id },
            include: { items: { orderBy: { lineNo: 'asc' } } }
        });

        if (!original) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        // Clone with same components but empty values
        const clone = await prisma.productionBatch.create({
            data: {
                productId: original.productId,
                userId,
                mmlId: original.mmlId,
                quantity: null,
                items: {
                    create: original.items.map(item => ({
                        lineNo: item.lineNo,
                        componentProductId: item.componentProductId,
                        value: null
                    }))
                }
            },
            include: {
                product: { select: { id: true, code: true, name: true } },
                user: { select: { id: true, name: true } },
                mml: { select: { id: true } },
                items: {
                    orderBy: { lineNo: 'asc' },
                    include: {
                        componentProduct: { select: { id: true, code: true, name: true } }
                    }
                }
            }
        });

        res.status(201).json(clone);
    } catch (error) {
        console.error('Clone batch error:', error);
        res.status(500).json({ error: 'Failed to clone batch' });
    }
};

// Delete batch (only if not locked)
export const deleteBatch = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        const batch = await prisma.productionBatch.findUnique({ where: { id } });
        if (!batch) {
            return res.status(404).json({ error: 'Batch not found' });
        }
        if (batch.isLocked) {
            return res.status(400).json({ error: 'Cannot delete locked batch' });
        }

        await prisma.productionBatch.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete batch error:', error);
        res.status(500).json({ error: 'Failed to delete batch' });
    }
};
