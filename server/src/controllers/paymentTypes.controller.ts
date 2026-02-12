import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Базовые типы оплат с зарезервированными paymentId */
const BASE_PAYMENT_TYPES = [
    { code: 'BANK_TRANSFER', name: 'Перечисление', paymentId: 'ID1', isDefault: true },
    { code: 'CARD', name: 'Карта', paymentId: 'ID2', isDefault: false },
    { code: 'CASH', name: 'Нал', paymentId: 'ID3', isDefault: false },
];

/** Зарезервированные paymentId (только для базовых) */
const RESERVED_PAYMENT_IDS = new Set(BASE_PAYMENT_TYPES.map(b => b.paymentId));

/**
 * Получить список типов оплат
 */
export const getPaymentTypes = async (req: Request, res: Response) => {
    try {
        const { includeDisabled } = req.query;

        const where = includeDisabled === 'true' ? {} : { isDisabled: false };

        const paymentTypes = await prisma.paymentType.findMany({
            where,
            orderBy: [
                { isDefault: 'desc' },  // Сначала дефолтный
                { name: 'asc' }
            ]
        });

        res.json(paymentTypes);
    } catch (error) {
        console.error('getPaymentTypes error:', error);
        res.status(500).json({ error: 'Failed to fetch payment types' });
    }
};

/**
 * Получить тип оплаты по умолчанию
 */
export const getDefaultPaymentType = async (req: Request, res: Response) => {
    try {
        // 1. Ищем по isDefault = true
        let defaultType = await prisma.paymentType.findFirst({
            where: { isDefault: true, isDisabled: false }
        });

        // 2. Если нет - ищем по code базовой оплаты (BANK_TRANSFER)
        if (!defaultType) {
            defaultType = await prisma.paymentType.findFirst({
                where: { code: 'BANK_TRANSFER', isDisabled: false }
            });
        }

        // 3. Если нет - ищем по имени "Перечисление" (обратная совместимость)
        if (!defaultType) {
            defaultType = await prisma.paymentType.findFirst({
                where: { name: 'Перечисление', isDisabled: false }
            });
        }

        // 4. Если всё ещё нет - берём первый активный
        if (!defaultType) {
            defaultType = await prisma.paymentType.findFirst({
                where: { isDisabled: false },
                orderBy: { name: 'asc' }
            });
        }

        if (!defaultType) {
            return res.status(404).json({
                error: 'No active payment types found. Please add payment types first.',
                warning: true
            });
        }

        res.json(defaultType);
    } catch (error) {
        console.error('getDefaultPaymentType error:', error);
        res.status(500).json({ error: 'Failed to fetch default payment type' });
    }
};

/**
 * Получить тип оплаты по ID
 */
export const getPaymentTypeById = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        const paymentType = await prisma.paymentType.findUnique({
            where: { id }
        });

        if (!paymentType) {
            return res.status(404).json({ error: 'Payment type not found' });
        }

        res.json(paymentType);
    } catch (error) {
        console.error('getPaymentTypeById error:', error);
        res.status(500).json({ error: 'Failed to fetch payment type' });
    }
};

/**
 * Создать тип оплаты
 */
export const createPaymentType = async (req: Request, res: Response) => {
    try {
        const { name, isDefault, paymentId } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name is required' });
        }

        // Валидация paymentId
        const trimmedPaymentId = paymentId?.trim() || null;
        if (trimmedPaymentId) {
            if (trimmedPaymentId.length > 32) {
                return res.status(400).json({ error: 'ID оплаты не может быть длиннее 32 символов' });
            }
            // Запрет reserved ID для пользовательских типов
            if (RESERVED_PAYMENT_IDS.has(trimmedPaymentId)) {
                return res.status(400).json({
                    error: `ID оплаты "${trimmedPaymentId}" зарезервирован для базовых типов оплат. Используйте другой ID.`
                });
            }
            // Проверка уникальности paymentId
            const existingPid = await prisma.paymentType.findUnique({
                where: { paymentId: trimmedPaymentId }
            });
            if (existingPid) {
                return res.status(400).json({
                    error: `ID оплаты "${trimmedPaymentId}" уже используется типом оплаты "${existingPid.name}"`
                });
            }
        }

        // Проверка уникальности имени
        const existing = await prisma.paymentType.findUnique({
            where: { name: name.trim() }
        });

        if (existing) {
            return res.status(400).json({ error: 'Payment type with this name already exists' });
        }

        // Если устанавливаем как дефолтный - сбросить у других
        if (isDefault) {
            await prisma.paymentType.updateMany({
                where: { isDefault: true },
                data: { isDefault: false }
            });
        }

        const paymentType = await prisma.paymentType.create({
            data: {
                name: name.trim(),
                isDefault: isDefault || false,
                paymentId: trimmedPaymentId,
            }
        });

        res.status(201).json(paymentType);
    } catch (error) {
        console.error('createPaymentType error:', error);
        res.status(500).json({ error: 'Failed to create payment type' });
    }
};

/**
 * Обновить тип оплаты
 */
export const updatePaymentType = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const { name, isDisabled, isDefault, paymentId } = req.body;

        const existing = await prisma.paymentType.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Payment type not found' });
        }

        // Проверка уникальности имени при изменении
        if (name && name.trim() !== existing.name) {
            const duplicate = await prisma.paymentType.findUnique({
                where: { name: name.trim() }
            });
            if (duplicate) {
                return res.status(400).json({ error: 'Payment type with this name already exists' });
            }
        }

        // Валидация paymentId при изменении
        if (paymentId !== undefined) {
            const trimmedPaymentId = paymentId?.trim() || null;
            if (trimmedPaymentId) {
                if (trimmedPaymentId.length > 32) {
                    return res.status(400).json({ error: 'ID оплаты не может быть длиннее 32 символов' });
                }
                // Запрет reserved ID для не-базовых типов
                if (RESERVED_PAYMENT_IDS.has(trimmedPaymentId) && !existing.isBase) {
                    return res.status(400).json({
                        error: `ID оплаты "${trimmedPaymentId}" зарезервирован для базовых типов оплат. Используйте другой ID.`
                    });
                }
                // Проверка уникальности paymentId (исключая текущую запись)
                const existingPid = await prisma.paymentType.findUnique({
                    where: { paymentId: trimmedPaymentId }
                });
                if (existingPid && existingPid.id !== id) {
                    return res.status(400).json({
                        error: `ID оплаты "${trimmedPaymentId}" уже используется типом оплаты "${existingPid.name}"`
                    });
                }
            }
        }

        // Если устанавливаем как дефолтный - сбросить у других
        if (isDefault === true && !existing.isDefault) {
            await prisma.paymentType.updateMany({
                where: { isDefault: true, id: { not: id } },
                data: { isDefault: false }
            });
        }

        const data: any = {};
        if (name !== undefined) data.name = name.trim();
        if (isDisabled !== undefined) data.isDisabled = isDisabled;
        if (isDefault !== undefined) data.isDefault = isDefault;
        if (paymentId !== undefined) data.paymentId = paymentId?.trim() || null;

        const paymentType = await prisma.paymentType.update({
            where: { id },
            data,
        });

        res.json(paymentType);
    } catch (error) {
        console.error('updatePaymentType error:', error);
        res.status(500).json({ error: 'Failed to update payment type' });
    }
};

/**
 * Отключить/включить тип оплаты
 */
export const togglePaymentType = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        const existing = await prisma.paymentType.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Payment type not found' });
        }

        const paymentType = await prisma.paymentType.update({
            where: { id },
            data: { isDisabled: !existing.isDisabled }
        });

        res.json(paymentType);
    } catch (error) {
        console.error('togglePaymentType error:', error);
        res.status(500).json({ error: 'Failed to toggle payment type' });
    }
};

/**
 * Удалить тип оплаты (только если не используется)
 */
export const deletePaymentType = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        // Проверка использования
        const usageCount = await prisma.purchaseItem.count({
            where: { paymentTypeId: id }
        });

        if (usageCount > 0) {
            return res.status(400).json({
                error: `Cannot delete: payment type is used in ${usageCount} purchase items. Use disable instead.`
            });
        }

        await prisma.paymentType.delete({ where: { id } });

        res.json({ success: true });
    } catch (error) {
        console.error('deletePaymentType error:', error);
        res.status(500).json({ error: 'Failed to delete payment type' });
    }
};

/**
 * Засеять базовые типы оплат (идемпотентный upsert по code)
 * Резервирует paymentId: ID1, ID2, ID3
 * "Перечисление" устанавливается как дефолтный
 */
export const seedDefaultPaymentTypes = async (req: Request, res: Response) => {
    try {
        const errors: string[] = [];
        let created = 0;
        let updated = 0;
        let skipped = 0;

        await prisma.$transaction(async (tx) => {
            // Маппинг старых имён → code (для миграции записей без code)
            const OLD_NAME_TO_CODE: Record<string, string> = {
                'перечисление': 'BANK_TRANSFER',
                'карта': 'CARD',
                'нал': 'CASH',
            };

            // Шаг 1: Миграция — присвоить code существующим записям без code
            const allTypes = await tx.paymentType.findMany();
            for (const pt of allTypes) {
                if (pt.code) continue;
                const matchedCode = OLD_NAME_TO_CODE[pt.name.toLowerCase()];
                if (matchedCode) {
                    const existingWithCode = await tx.paymentType.findFirst({ where: { code: matchedCode } });
                    if (!existingWithCode) {
                        await tx.paymentType.update({
                            where: { id: pt.id },
                            data: { code: matchedCode },
                        });
                    }
                }
            }

            // Шаг 2: Проверить, не заняты ли reserved paymentId другими (не-базовыми) записями
            for (const base of BASE_PAYMENT_TYPES) {
                const conflict = await tx.paymentType.findUnique({ where: { paymentId: base.paymentId } });
                if (conflict) {
                    // Это конфликт, только если запись не является этой же базовой (по code)
                    const isOwnBase = conflict.code === base.code;
                    if (!isOwnBase) {
                        errors.push(
                            `Ошибка: ID оплаты "${base.paymentId}" уже используется типом оплаты "${conflict.name}" (id=${conflict.id}). Освободите ID или удалите конфликтующую запись.`
                        );
                    }
                }
            }

            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }

            // Шаг 3: Upsert по code
            for (const base of BASE_PAYMENT_TYPES) {
                const existing = await tx.paymentType.findFirst({ where: { code: base.code } });
                if (existing) {
                    const needsUpdate =
                        existing.name !== base.name ||
                        existing.paymentId !== base.paymentId ||
                        !existing.isBase ||
                        existing.isDisabled ||
                        existing.isDefault !== base.isDefault;

                    if (needsUpdate) {
                        await tx.paymentType.update({
                            where: { id: existing.id },
                            data: {
                                name: base.name,
                                paymentId: base.paymentId,
                                isBase: true,
                                isDefault: base.isDefault,
                                isDisabled: false,
                            },
                        });
                        updated++;
                    } else {
                        skipped++;
                    }
                } else {
                    // Проверка конфликта имени
                    const nameConflict = await tx.paymentType.findUnique({ where: { name: base.name } });
                    if (nameConflict) {
                        // Занято другой записью без code — присваиваем code
                        await tx.paymentType.update({
                            where: { id: nameConflict.id },
                            data: {
                                code: base.code,
                                paymentId: base.paymentId,
                                isBase: true,
                                isDefault: base.isDefault,
                                isDisabled: false,
                            },
                        });
                        updated++;
                    } else {
                        await tx.paymentType.create({
                            data: {
                                name: base.name,
                                code: base.code,
                                paymentId: base.paymentId,
                                isBase: true,
                                isDefault: base.isDefault,
                            },
                        });
                        created++;
                    }
                }
            }

            // Убедимся, что только один дефолтный
            const defaultCount = await tx.paymentType.count({ where: { isDefault: true } });
            if (defaultCount > 1) {
                await tx.paymentType.updateMany({
                    where: { isDefault: true, code: { not: 'BANK_TRANSFER' } },
                    data: { isDefault: false },
                });
            }
        });

        res.json({
            message: `Готово: создано ${created}, обновлено ${updated}, без изменений ${skipped}`,
            created,
            updated,
            skipped,
        });
    } catch (error: any) {
        console.error('seedDefaultPaymentTypes error:', error);
        // Если это наша ошибка конфликта — вернуть 409
        if (error.message?.includes('ID оплаты')) {
            return res.status(409).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to seed payment types' });
    }
};

