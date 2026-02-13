import { Request, Response } from 'express';
import { prisma } from '../db';

// ============================================
// Utility: parse telegramChatId from API input
// ============================================

/**
 * Parses telegramChatId from various input formats.
 * Returns:
 *   undefined → field not provided (skip update)
 *   null      → explicitly clearing (set to null)
 *   bigint    → valid chat ID
 * Throws on invalid input.
 */
function parseTelegramChatId(input: unknown): bigint | null | undefined {
    if (input === undefined) return undefined;
    if (input === null) return null;
    if (typeof input === 'string') {
        const s = input.trim();
        if (s === '') return null; // empty input = clear
        if (!/^-?\d+$/.test(s)) throw new Error('invalid');
        return BigInt(s);
    }
    if (typeof input === 'number') {
        if (!Number.isInteger(input)) throw new Error('invalid');
        return BigInt(input);
    }
    if (typeof input === 'bigint') return input;
    throw new Error('invalid');
}

/**
 * Validates Telegram fields and builds data object for Prisma update.
 * Shared between createSupplier and updateSupplier.
 * 
 * @param supplierId - numeric ID of the supplier (for uniqueness check)
 * @param currentChatId - current telegramChatId in DB (null for new suppliers)
 * @param body - request body
 * @param data - Prisma data object to mutate
 * @returns error response object if validation fails, null if OK
 */
async function applyTelegramFields(
    supplierId: number | null,
    currentChatId: bigint | null,
    body: any,
    data: any
): Promise<{ status: number; body: any } | null> {
    // 1) Parse chatId
    let chatId: bigint | null | undefined;
    try {
        chatId = parseTelegramChatId(body.telegramChatId);
    } catch {
        return { status: 400, body: { error: 'Некорректный telegramChatId' } };
    }

    const threadIdRaw = body.telegramThreadId;
    const threadId = threadIdRaw === undefined ? undefined : (threadIdRaw ?? null);

    const enabledRaw = body.telegramEnabled;
    const enabled = enabledRaw === undefined ? undefined : Boolean(enabledRaw);

    // 2) Can't enable without chatId
    if (enabled === true) {
        const effectiveChatId = chatId !== undefined ? chatId : (currentChatId ?? null);
        if (!effectiveChatId) {
            return { status: 400, body: { error: 'Нельзя включить Telegram без chatId группы' } };
        }
    }

    // 3) Uniqueness check: chatId not taken by another supplier
    if (chatId !== undefined && chatId !== null) {
        const whereClause: any = { telegramChatId: chatId };
        if (supplierId !== null) {
            whereClause.NOT = { id: supplierId };
        }
        const other = await prisma.supplier.findFirst({
            where: whereClause,
            select: { id: true, code: true, name: true },
        });
        if (other) {
            return {
                status: 409,
                body: {
                    error: 'Эта Telegram-группа уже привязана к другому поставщику',
                    conflict: other,
                },
            };
        }
    }

    // 4) Apply fields to data
    if (chatId !== undefined) data.telegramChatId = chatId;
    if (threadId !== undefined) data.telegramThreadId = threadId;
    if (enabled !== undefined) data.telegramEnabled = enabled;

    // 5) Auto-clear on chatId=null: disable + clear threadId
    if (chatId === null) {
        data.telegramEnabled = false;
        data.telegramThreadId = null;
    }

    return null; // no error
}

// ============================================
// CRUD
// ============================================

const supplierInclude = {
    primaryMml: {
        select: {
            id: true,
            productId: true,
            product: {
                select: { id: true, name: true, code: true }
            }
        }
    }
};

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
            include: supplierInclude,
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

        const data: any = {
            code,
            name,
            legalName: legalName || null,
            altName: altName || null,
            phone: phone || null,
            telegram: telegram || null,
            isActive: true,
            primaryMmlId: primaryMmlId || null,
        };

        // Telegram fields (same validations as update)
        const tgError = await applyTelegramFields(null, null, req.body, data);
        if (tgError) {
            return res.status(tgError.status).json(tgError.body);
        }

        const item = await prisma.supplier.create({
            data,
            include: supplierInclude,
        });
        res.status(201).json(item);
    } catch (error: any) {
        console.error('Create supplier error:', error);
        if (error?.code === 'P2002') {
            return res.status(409).json({ error: 'Эта Telegram-группа уже привязана к другому поставщику' });
        }
        res.status(400).json({ error: 'Failed to create supplier' });
    }
};

// Обновить поставщика
export const updateSupplier = async (req: Request, res: Response) => {
    try {
        const { code } = req.params as { code: string };
        const { name, legalName, altName, phone, telegram, isActive, primaryMmlId } = req.body;

        // 1) Check supplier exists (needed for TG validation + proper 404)
        const supplier = await prisma.supplier.findUnique({
            where: { code },
            select: { id: true, telegramChatId: true },
        });
        if (!supplier) {
            return res.status(404).json({ error: 'Поставщик не найден' });
        }

        // 2) Build core data
        const data: any = {};
        if (name !== undefined) data.name = name;
        if (legalName !== undefined) data.legalName = legalName;
        if (altName !== undefined) data.altName = altName;
        if (phone !== undefined) data.phone = phone;
        if (telegram !== undefined) data.telegram = telegram;
        if (isActive !== undefined) data.isActive = isActive;
        if (primaryMmlId !== undefined) data.primaryMmlId = primaryMmlId || null;

        // 3) Telegram fields (validate + apply)
        const tgError = await applyTelegramFields(
            supplier.id,
            supplier.telegramChatId,
            req.body,
            data,
        );
        if (tgError) {
            return res.status(tgError.status).json(tgError.body);
        }

        // 4) Execute update
        const item = await prisma.supplier.update({
            where: { code },
            data,
            include: supplierInclude,
        });
        res.json(item);
    } catch (error: any) {
        console.error('Update supplier error:', error);
        if (error?.code === 'P2002') {
            return res.status(409).json({ error: 'Эта Telegram-группа уже привязана к другому поставщику' });
        }
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
    } catch (error: any) {
        // FK Restrict: SupplierTelegramMessage prevents deletion
        if (error?.code === 'P2003') {
            return res.status(409).json({
                error: 'Нельзя удалить поставщика: есть связанные данные (Telegram-история). Отключите поставщика вместо удаления.',
            });
        }
        res.status(400).json({ error: 'Failed to delete supplier' });
    }
};
