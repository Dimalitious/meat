import { Request, Response } from 'express';
import { prisma } from '../db';

/** Базовые единицы измерения: code → сокращённое название */
const BASE_UNITS = [
    { code: 'BLOCK', name: 'Бл' },
    { code: 'KG', name: 'Кг' },
    { code: 'M', name: 'М' },
    { code: 'MM', name: 'Млм' },
    { code: 'PACK', name: 'Пач' },
    { code: 'CM', name: 'См' },
    { code: 'UP', name: 'Уп' },
    { code: 'PCS', name: 'Шт' },
];

/** Маппинг старых полных названий → code для миграции */
const OLD_NAME_TO_CODE: Record<string, string> = {
    'блоки': 'BLOCK',
    'килограммы': 'KG',
    'метры': 'M',
    'миллиметры': 'MM',
    'пачки': 'PACK',
    'сантиметры': 'CM',
    'упаковки': 'UP',
    'штуки': 'PCS',
};

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

// POST /api/uom/fill-defaults — idempotent seed/update of base units
export const fillDefaults = async (req: Request, res: Response) => {
    try {
        let created = 0;
        let updated = 0;
        let skipped = 0;

        await prisma.$transaction(async (tx) => {
            // Шаг 1: Миграция — если есть старые записи без code (со старыми полными именами),
            // присваиваем им code, чтобы дальнейший upsert их подхватил
            const allUnits = await tx.unitOfMeasure.findMany();
            for (const unit of allUnits) {
                if (unit.code) continue; // Уже имеет code — пропускаем
                const matchedCode = OLD_NAME_TO_CODE[unit.name.toLowerCase()];
                if (matchedCode) {
                    // Проверяем, нет ли уже записи с таким code
                    const existing = await tx.unitOfMeasure.findUnique({ where: { code: matchedCode } });
                    if (!existing) {
                        await tx.unitOfMeasure.update({
                            where: { id: unit.id },
                            data: { code: matchedCode },
                        });
                    }
                }
            }

            // Шаг 2: Upsert по code — создаём или обновляем
            for (const base of BASE_UNITS) {
                const existing = await tx.unitOfMeasure.findUnique({ where: { code: base.code } });
                if (existing) {
                    if (existing.name !== base.name || !existing.isBase || !existing.isActive) {
                        await tx.unitOfMeasure.update({
                            where: { id: existing.id },
                            data: { name: base.name, isBase: true, isActive: true },
                        });
                        updated++;
                    } else {
                        skipped++;
                    }
                } else {
                    // Перед созданием — проверяем, не занято ли имя (уникальный constraint)
                    const nameConflict = await tx.unitOfMeasure.findUnique({ where: { name: base.name } });
                    if (nameConflict) {
                        // Имя занято другой записью без code — присваиваем ей code и обновляем
                        await tx.unitOfMeasure.update({
                            where: { id: nameConflict.id },
                            data: { code: base.code, isBase: true, isActive: true },
                        });
                        updated++;
                    } else {
                        await tx.unitOfMeasure.create({
                            data: { name: base.name, code: base.code, isBase: true },
                        });
                        created++;
                    }
                }
            }
        }, { timeout: 30000 });

        res.json({
            message: `Готово: создано ${created}, обновлено ${updated}, уже было ${skipped}`,
            created,
            updated,
            skipped,
        });
    } catch (error) {
        console.error('fillDefaults error:', error);
        res.status(500).json({ error: 'Failed to fill defaults' });
    }
};

