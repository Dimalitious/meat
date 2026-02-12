/**
 * MML Guard Service — централизованные проверки для техкарт
 * 
 * Guards:
 *   assertMmlUsableForNewOps(mml)   — можно ли создавать новые операции
 *   assertMmlMutable(mml)           — можно ли менять структуру (узлы)
 *   assertMmlAdminMutable(mml)      — можно ли менять isActive (административное)
 *   assertHasActiveNodes(tx, mmlId) — есть ли хотя бы 1 активный узел
 *   hasMmlConsumers(tx, mmlId)      — есть ли consumers (runs/cutting lines)
 *   getCurrentMmlByProductId(tx, productId) — текущая версия MML (MAX version, not deleted)
 */

import { PrismaClient, Prisma, ProductionMml } from '@prisma/client';

// ============================================
// CUSTOM ERROR CLASS
// ============================================

export class MmlGuardError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number = 400) {
        super(message);
        this.name = 'MmlGuardError';
        this.statusCode = statusCode;
    }
}

// ============================================
// CONSUMER CHECK
// ============================================

/**
 * Проверить, есть ли у MML потребители (ProductionRun, ProductionCuttingLine)
 */
export async function hasMmlConsumers(
    tx: Prisma.TransactionClient | PrismaClient,
    mmlId: number
): Promise<boolean> {
    const runCount = await tx.productionRun.count({ where: { mmlId } });
    if (runCount > 0) return true;

    const cuttingCount = await tx.productionCuttingLine.count({ where: { mmlId } });
    return cuttingCount > 0;
}

// ============================================
// GUARD: assertMmlUsableForNewOps
// ============================================

/**
 * Проверить, можно ли использовать MML для создания новых операций.
 * Проверки: !isDeleted, isActive
 */
export function assertMmlUsableForNewOps(mml: ProductionMml): void {
    if (mml.isDeleted) {
        throw new MmlGuardError('MML удалена, нельзя использовать для новых операций', 409);
    }
    if (!mml.isActive) {
        throw new MmlGuardError('MML выключена, нельзя использовать для новых операций', 409);
    }
}

// ============================================
// GUARD: assertMmlMutable
// ============================================

/**
 * Проверить, можно ли менять структуру MML (добавление/удаление/изменение узлов).
 * Проверки: !isDeleted, !isLocked
 * Дополнительно: если isLocked=false, но есть consumers — блокируем и ставим isLocked=true.
 */
export async function assertMmlMutable(
    tx: Prisma.TransactionClient | PrismaClient,
    mml: ProductionMml
): Promise<void> {
    if (mml.isDeleted) {
        throw new MmlGuardError('MML удалена, нельзя редактировать', 400);
    }
    if (mml.isLocked) {
        throw new MmlGuardError(
            'Версия техкарты заморожена (есть операции). Создайте новую версию для изменений.',
            409
        );
    }
    // Дополнительная проверка: если isLocked=false, но есть consumers — автоматически замораживаем
    const hasConsumers = await hasMmlConsumers(tx, mml.id);
    if (hasConsumers) {
        // Автоматически ставим isLocked=true
        await tx.productionMml.update({
            where: { id: mml.id },
            data: { isLocked: true },
        });
        throw new MmlGuardError(
            'Версия техкарты заморожена (обнаружены операции). Создайте новую версию для изменений.',
            409
        );
    }
}

// ============================================
// GUARD: assertMmlAdminMutable
// ============================================

/**
 * Проверить, можно ли менять административные поля MML (isActive).
 * Разрешено даже на frozen MML. Запрещено только на deleted.
 */
export function assertMmlAdminMutable(mml: ProductionMml): void {
    if (mml.isDeleted) {
        throw new MmlGuardError('MML удалена, нельзя менять статус', 400);
    }
}

// ============================================
// GUARD: assertHasActiveNodes
// ============================================

/**
 * Проверить, что у MML есть хотя бы один активный узел.
 */
export async function assertHasActiveNodes(
    tx: Prisma.TransactionClient | PrismaClient,
    mmlId: number
): Promise<void> {
    const activeCount = await tx.productionMmlNode.count({
        where: { mmlId, isActive: true },
    });
    if (activeCount === 0) {
        throw new MmlGuardError('В техкарте нет активных позиций', 400);
    }
}

// ============================================
// RESOLVER: getCurrentMmlByProductId
// ============================================

/**
 * Получить текущую (последнюю не удалённую) версию MML для продукта.
 * Текущая = MAX(version) WHERE isDeleted=false
 * Возвращает null если нет MML.
 */
export async function getCurrentMmlByProductId(
    tx: Prisma.TransactionClient | PrismaClient,
    productId: number
): Promise<ProductionMml | null> {
    return tx.productionMml.findFirst({
        where: { productId, isDeleted: false },
        orderBy: { version: 'desc' },
    });
}

/**
 * Получить текущую MML для продукта или бросить ошибку.
 */
export async function requireCurrentMmlByProductId(
    tx: Prisma.TransactionClient | PrismaClient,
    productId: number
): Promise<ProductionMml> {
    const mml = await getCurrentMmlByProductId(tx, productId);
    if (!mml) {
        throw new MmlGuardError('Для этого товара нет доступной техкарты', 404);
    }
    return mml;
}

// ============================================
// HELPER: handleMmlGuardError
// ============================================

/**
 * Обработчик ошибок MmlGuardError для Express.
 * Использование: catch(err) { if (handleMmlGuardError(res, err)) return; throw err; }
 */
export function handleMmlGuardError(res: any, err: unknown): boolean {
    if (err instanceof MmlGuardError) {
        res.status(err.statusCode).json({ error: err.message });
        return true;
    }
    return false;
}
