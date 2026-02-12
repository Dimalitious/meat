import { Request, Response } from 'express';
import { prisma } from '../db';

const DEFAULT_UNITS = [
    'килограммы', 'штуки', 'пачки', 'упаковки',
    'блоки', 'метры', 'сантиметры', 'миллиметры',
];

// GET /api/uom?active=true|all  (default: active-only)
export const getUnits = async (req: Request, res: Response) => {
    try {
        const { active } = req.query;
        const where: any = {};
        if (active !== 'all') {
            where.isActive = true;
        }

        const units = await prisma.unitOfMeasure.findMany({
            where,
            orderBy: { name: 'asc' }
        });
        res.json(units);
    } catch (error) {
        console.error('Get UoMs error:', error);
        res.status(500).json({ error: 'Failed to fetch units of measure' });
    }
};

// POST /api/uom
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

// PUT /api/uom/:id
export const updateUnit = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, isDefault, isActive } = req.body;

        const result = await prisma.$transaction(async (tx) => {
            // If setting as default, unset others
            if (isDefault) {
                await tx.unitOfMeasure.updateMany({
                    where: { id: { not: Number(id) }, isDefault: true },
                    data: { isDefault: false }
                });
            }

            const data: any = {};
            if (name !== undefined) data.name = name;
            if (isDefault !== undefined) data.isDefault = isDefault;
            if (isActive !== undefined) data.isActive = Boolean(isActive);

            return await tx.unitOfMeasure.update({
                where: { id: Number(id) },
                data,
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

// DELETE /api/uom/:id — soft delete (isActive = false)
export const deleteUnit = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const unit = await prisma.unitOfMeasure.update({
            where: { id: Number(id) },
            data: { isActive: false },
        });

        res.json({ message: 'Unit archived', unit });
    } catch (error: any) {
        console.error('Delete UoM error:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Unit not found' });
        }
        res.status(400).json({ error: 'Failed to archive unit' });
    }
};

// POST /api/uom/fill-defaults — idempotent seed of base units
export const fillDefaults = async (req: Request, res: Response) => {
    try {
        let created = 0;
        let reactivated = 0;
        let skipped = 0;

        await prisma.$transaction(async (tx) => {
            for (const name of DEFAULT_UNITS) {
                const existing = await tx.unitOfMeasure.findUnique({ where: { name } });
                if (existing) {
                    if (!existing.isActive) {
                        await tx.unitOfMeasure.update({
                            where: { id: existing.id },
                            data: { isActive: true },
                        });
                        reactivated++;
                    } else {
                        skipped++;
                    }
                } else {
                    await tx.unitOfMeasure.create({ data: { name } });
                    created++;
                }
            }
        });

        res.json({
            message: `Готово: создано ${created}, восстановлено ${reactivated}, уже было ${skipped}`,
            created,
            reactivated,
            skipped,
        });
    } catch (error) {
        console.error('fillDefaults error:', error);
        res.status(500).json({ error: 'Failed to fill defaults' });
    }
};
