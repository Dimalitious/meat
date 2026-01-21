import { Request, Response } from 'express';
import { prisma } from '../db';

// Получить список поставщиков с поиском
export const getSuppliers = async (req: Request, res: Response) => {
    try {
        const { search, activeOnly } = req.query;
        let where: any = {};

        if (search) {
            where.OR = [
                { code: { contains: String(search), mode: 'insensitive' } },
                { name: { contains: String(search), mode: 'insensitive' } }
            ];
        }

        // Для выпадающих списков возвращаем только активных
        if (activeOnly === 'true') {
            where.isActive = true;
        }

        const items = await prisma.supplier.findMany({
            where,
            orderBy: { name: 'asc' },
            include: {
                primaryMml: {
                    select: {
                        id: true,
                        productId: true,
                        product: {
                            select: { id: true, name: true, code: true }
                        }
                    }
                }
            }
        });
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
};

// Создать поставщика
export const createSupplier = async (req: Request, res: Response) => {
    try {
        const { code, name, legalName, altName, phone, telegram, primaryMmlId } = req.body;

        if (!code || !name) {
            return res.status(400).json({ error: 'Код и название обязательны' });
        }

        const existing = await prisma.supplier.findUnique({ where: { code } });
        if (existing) {
            return res.status(400).json({ error: 'Поставщик с таким кодом уже существует' });
        }

        const item = await prisma.supplier.create({
            data: {
                code,
                name,
                legalName: legalName || null,
                altName: altName || null,
                phone: phone || null,
                telegram: telegram || null,
                isActive: true,
                primaryMmlId: primaryMmlId || null
            },
            include: {
                primaryMml: {
                    select: {
                        id: true,
                        productId: true,
                        product: {
                            select: { id: true, name: true, code: true }
                        }
                    }
                }
            }
        });
        res.status(201).json(item);
    } catch (error) {
        console.error('Create supplier error:', error);
        res.status(400).json({ error: 'Failed to create supplier' });
    }
};

// Обновить поставщика
export const updateSupplier = async (req: Request, res: Response) => {
    try {
        const { code } = req.params as { code: string };
        const { name, legalName, altName, phone, telegram, isActive, primaryMmlId } = req.body;

        const item = await prisma.supplier.update({
            where: { code },
            data: {
                ...(name !== undefined && { name }),
                ...(legalName !== undefined && { legalName }),
                ...(altName !== undefined && { altName }),
                ...(phone !== undefined && { phone }),
                ...(telegram !== undefined && { telegram }),
                ...(isActive !== undefined && { isActive }),
                ...(primaryMmlId !== undefined && { primaryMmlId: primaryMmlId || null })
            },
            include: {
                primaryMml: {
                    select: {
                        id: true,
                        productId: true,
                        product: {
                            select: { id: true, name: true, code: true }
                        }
                    }
                }
            }
        });
        res.json(item);
    } catch (error) {
        console.error('Update supplier error:', error);
        res.status(400).json({ error: 'Failed to update supplier' });
    }
};

// Переключить статус поставщика (отключить/включить)
export const toggleSupplier = async (req: Request, res: Response) => {
    try {
        const { code } = req.params as { code: string };

        const supplier = await prisma.supplier.findUnique({ where: { code } });
        if (!supplier) {
            return res.status(404).json({ error: 'Поставщик не найден' });
        }

        const newStatus = !supplier.isActive;
        const updated = await prisma.supplier.update({
            where: { code },
            data: { isActive: newStatus }
        });

        res.json({
            message: newStatus ? 'Поставщик активирован' : 'Поставщик отключён',
            supplier: updated
        });
    } catch (error) {
        console.error('Toggle supplier error:', error);
        res.status(400).json({ error: 'Failed to toggle supplier status' });
    }
};

// Массовое отключение поставщиков
export const deactivateSuppliers = async (req: Request, res: Response) => {
    try {
        const { codes } = req.body as { codes: string[] };

        if (!codes || !Array.isArray(codes) || codes.length === 0) {
            return res.status(400).json({ error: 'Не указаны коды поставщиков' });
        }

        const result = await prisma.supplier.updateMany({
            where: { code: { in: codes } },
            data: { isActive: false }
        });

        res.json({
            message: `Отключено поставщиков: ${result.count}`,
            count: result.count
        });
    } catch (error) {
        console.error('Deactivate suppliers error:', error);
        res.status(400).json({ error: 'Failed to deactivate suppliers' });
    }
};

// Удаление поставщика (не используется по ТЗ, но оставляем для совместимости)
export const deleteSupplier = async (req: Request, res: Response) => {
    try {
        const { code } = req.params as { code: string };
        await prisma.supplier.delete({ where: { code } });
        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(400).json({ error: 'Failed to delete supplier' });
    }
};
