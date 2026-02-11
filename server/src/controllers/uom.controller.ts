import { Request, Response } from 'express';
import { prisma } from '../db';

// Get all UoMs
export const getUnits = async (req: Request, res: Response) => {
    try {
        const units = await prisma.unitOfMeasure.findMany({
            orderBy: { name: 'asc' }
        });
        res.json(units);
    } catch (error) {
        console.error('Get UoMs error:', error);
        res.status(500).json({ error: 'Failed to fetch units of measure' });
    }
};

// Create UoM
export const createUnit = async (req: Request, res: Response) => {
    try {
        const { name, isDefault } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const result = await prisma.$transaction(async (tx) => {
            // If setting as default, unset others
            if (isDefault) {
                await tx.unitOfMeasure.updateMany({
                    where: { isDefault: true },
                    data: { isDefault: false }
                });
            }

            return await tx.unitOfMeasure.create({
                data: {
                    name,
                    isDefault: isDefault || false
                }
            });
        });

        res.status(201).json(result);
    } catch (error: any) {
        console.error('Create UoM error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Unit with this name already exists' });
        }
        res.status(400).json({ error: 'Failed to create unit' });
    }
};

// Update UoM
export const updateUnit = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, isDefault } = req.body;

        const result = await prisma.$transaction(async (tx) => {
            // If setting as default, unset others
            if (isDefault) {
                await tx.unitOfMeasure.updateMany({
                    where: { id: { not: Number(id) }, isDefault: true },
                    data: { isDefault: false }
                });
            }

            return await tx.unitOfMeasure.update({
                where: { id: Number(id) },
                data: {
                    name,
                    isDefault
                }
            });
        });

        res.json(result);
    } catch (error: any) {
        console.error('Update UoM error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Unit with this name already exists' });
        }
        res.status(400).json({ error: 'Failed to update unit' });
    }
};

// Delete UoM
export const deleteUnit = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Check if used in products
        const used = await prisma.product.findFirst({
            where: { uomId: Number(id) }
        });

        if (used) {
            return res.status(400).json({ error: 'Cannot delete unit usage by products' });
        }

        await prisma.unitOfMeasure.delete({
            where: { id: Number(id) }
        });

        res.json({ message: 'Unit deleted' });
    } catch (error) {
        console.error('Delete UoM error:', error);
        res.status(400).json({ error: 'Failed to delete unit' });
    }
};
