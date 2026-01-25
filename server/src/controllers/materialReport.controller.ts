import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// МАТЕРИАЛЬНЫЙ ОТЧЁТ
// ============================================

/**
 * Получить или сформировать материальный отчёт на указанную дату
 * GET /api/material-report?date=YYYY-MM-DD
 */
export const getMaterialReport = async (req: Request, res: Response) => {
    try {
        const { date } = req.query;

        if (!date || typeof date !== 'string') {
            return res.status(400).json({ error: 'Параметр date обязателен' });
        }

        // Нормализуем дату к UTC
        const reportDate = new Date(date);
        reportDate.setUTCHours(0, 0, 0, 0);

        // Ищем сохранённый отчёт (используем findFirst т.к. warehouseId может быть null)
        const existingReport = await prisma.materialReport.findFirst({
            where: {
                reportDate,
                warehouseId: null // Пока без склада
            },
            include: {
                lines: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                                category: true
                            }
                        }
                    },
                    orderBy: { sortOrder: 'asc' }
                }
            }
        });

        if (existingReport) {
            return res.json({
                report: existingReport,
                isPreview: false,
                message: 'Сохранённый отчёт'
            });
        }

        // Нет сохранённого - формируем предпросмотр
        const preview = await buildMaterialReportPreview(reportDate);

        return res.json({
            report: {
                id: null,
                reportDate: reportDate.toISOString(),
                status: 'preview',
                lines: preview.lines
            },
            isPreview: true,
            message: 'Предпросмотр (не сохранён)'
        });
    } catch (error) {
        console.error('[MATERIAL_REPORT] Error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};

/**
 * Построить предпросмотр материального отчёта
 */
async function buildMaterialReportPreview(reportDate: Date) {
    // Границы дня для запросов
    const dateStart = new Date(reportDate);
    dateStart.setUTCHours(0, 0, 0, 0);
    const dateEnd = new Date(reportDate);
    dateEnd.setUTCHours(23, 59, 59, 999);

    // Параллельно получаем все данные
    const [
        products,
        svod,
        purchases,
        production,
        previousReport
    ] = await Promise.all([
        // Все активные товары
        prisma.product.findMany({
            where: { status: 'active' },
            select: { id: true, code: true, name: true, category: true }
        }),
        // Свод на дату (для данных по заказам)
        prisma.svodHeader.findUnique({
            where: { svodDate: reportDate },
            include: {
                lines: {
                    select: {
                        productId: true,
                        orderQty: true,
                        weightToShip: true
                    }
                }
            }
        }),
        // Закупки на дату
        prisma.purchaseItem.findMany({
            where: {
                purchase: {
                    purchaseDate: { gte: dateStart, lte: dateEnd },
                    isDisabled: false
                }
            },
            select: {
                productId: true,
                qty: true
            }
        }),
        // Производство на дату
        prisma.productionRun.findMany({
            where: {
                productionDate: { gte: dateStart, lte: dateEnd },
                isHidden: false
            },
            select: {
                productId: true,
                actualWeight: true
            }
        }),
        // Предыдущий отчёт (для остатка на начало)
        getPreviousDayReport(reportDate)
    ]);

    // Группируем данные по товарам
    const purchasesByProduct = new Map<number, number>();
    purchases.forEach(p => {
        const current = purchasesByProduct.get(p.productId) || 0;
        purchasesByProduct.set(p.productId, current + Number(p.qty));
    });

    const productionByProduct = new Map<number, number>();
    production.forEach(p => {
        const current = productionByProduct.get(p.productId) || 0;
        productionByProduct.set(p.productId, current + Number(p.actualWeight || 0));
    });

    const svodByProduct = new Map<number, { orderQty: number; weightToShip: number }>();
    if (svod?.lines) {
        svod.lines.forEach(l => {
            svodByProduct.set(l.productId, {
                orderQty: Number(l.orderQty),
                weightToShip: Number(l.weightToShip || 0)
            });
        });
    }

    const previousBalances = new Map<number, number>();
    if (previousReport?.lines) {
        previousReport.lines.forEach(l => {
            // Факт если есть, иначе расчётный
            const balance = l.closingBalanceFact !== null
                ? Number(l.closingBalanceFact)
                : Number(l.closingBalanceCalc);
            previousBalances.set(l.productId, balance);
        });
    }

    // Собираем все товары с движениями
    const productIdsWithMovements = new Set<number>();
    purchasesByProduct.forEach((_, id) => productIdsWithMovements.add(id));
    productionByProduct.forEach((_, id) => productIdsWithMovements.add(id));
    svodByProduct.forEach((_, id) => productIdsWithMovements.add(id));
    previousBalances.forEach((_, id) => productIdsWithMovements.add(id));

    // Строим строки отчёта
    const lines: any[] = [];
    let sortOrder = 0;

    productIdsWithMovements.forEach(productId => {
        const product = products.find(p => p.id === productId);
        if (!product) return; // Пропускаем неактивные товары

        const openingBalance = previousBalances.get(productId) || 0;
        const inPurchase = purchasesByProduct.get(productId) || 0;
        const inProduction = productionByProduct.get(productId) || 0;
        const svodData = svodByProduct.get(productId);
        const outSale = svodData?.weightToShip || 0;

        // Формула расчётного остатка на конец
        const closingBalanceCalc = openingBalance
            + inPurchase
            + inProduction
            - outSale;

        lines.push({
            productId,
            productCode: product.code,
            productName: product.name,
            category: product.category,
            openingBalance,
            inPurchase,
            inProduction,
            outSale,
            outWaste: 0,
            outBundle: 0,
            outDefectWriteoff: 0,
            outWeightLoss: 0,
            outSupplierReturn: 0,
            closingBalanceCalc,
            closingBalanceFact: null,
            sortOrder: sortOrder++,
            product
        });
    });

    // Сортируем по категории и названию
    lines.sort((a, b) => {
        if (a.category !== b.category) {
            return (a.category || '').localeCompare(b.category || '');
        }
        return (a.productName || '').localeCompare(b.productName || '');
    });

    return { lines };
}

/**
 * Получить отчёт за предыдущий день
 */
async function getPreviousDayReport(reportDate: Date) {
    const previousDate = new Date(reportDate);
    previousDate.setDate(previousDate.getDate() - 1);
    previousDate.setUTCHours(0, 0, 0, 0);

    return prisma.materialReport.findFirst({
        where: {
            reportDate: previousDate,
            warehouseId: null
        },
        include: {
            lines: {
                select: {
                    productId: true,
                    closingBalanceCalc: true,
                    closingBalanceFact: true
                }
            }
        }
    });
}

/**
 * Обновить материальный отчёт (кнопка "Обновить отчёт")
 * POST /api/material-report/refresh
 */
export const refreshMaterialReport = async (req: Request, res: Response) => {
    try {
        const { date } = req.body;
        const user = (req as any).user;

        if (!date) {
            return res.status(400).json({ error: 'Параметр date обязателен' });
        }

        const reportDate = new Date(date);
        reportDate.setUTCHours(0, 0, 0, 0);

        // Получаем свежие данные
        const preview = await buildMaterialReportPreview(reportDate);

        // Ищем существующий черновик для сохранения введённых фактов
        const existingDraft = await prisma.materialReportDraft.findFirst({
            where: {
                reportDate,
                warehouseId: null
            },
            include: {
                lines: {
                    select: {
                        productId: true,
                        closingBalanceFact: true
                    }
                }
            }
        });

        // Мерджим введённые факты
        if (existingDraft?.lines) {
            const factsByProduct = new Map<number, number | null>();
            existingDraft.lines.forEach(l => {
                if (l.closingBalanceFact !== null) {
                    factsByProduct.set(l.productId, Number(l.closingBalanceFact));
                }
            });

            preview.lines.forEach(line => {
                const existingFact = factsByProduct.get(line.productId);
                if (existingFact !== undefined) {
                    line.closingBalanceFact = existingFact;
                }
            });
        }

        // Обновляем или создаём черновик
        await prisma.$transaction(async (tx) => {
            // Удаляем старый черновик если есть
            await tx.materialReportDraft.deleteMany({
                where: {
                    reportDate,
                    warehouseId: null
                }
            });

            // Создаём новый черновик
            await tx.materialReportDraft.create({
                data: {
                    reportDate,
                    warehouseId: null,
                    updatedBy: user?.username,
                    lines: {
                        create: preview.lines.map(l => ({
                            productId: l.productId,
                            openingBalance: l.openingBalance,
                            inPurchase: l.inPurchase,
                            inProduction: l.inProduction,
                            outSale: l.outSale,
                            outWaste: l.outWaste,
                            outBundle: l.outBundle,
                            outDefectWriteoff: l.outDefectWriteoff,
                            outWeightLoss: l.outWeightLoss,
                            outSupplierReturn: l.outSupplierReturn,
                            closingBalanceCalc: l.closingBalanceCalc,
                            closingBalanceFact: l.closingBalanceFact
                        }))
                    }
                }
            });
        });

        return res.json({
            report: {
                id: null,
                reportDate: reportDate.toISOString(),
                status: 'draft',
                lines: preview.lines
            },
            message: 'Отчёт обновлён'
        });
    } catch (error) {
        console.error('[MATERIAL_REPORT] Refresh error:', error);
        res.status(500).json({ error: 'Ошибка обновления отчёта' });
    }
};

/**
 * Обновить фактический остаток для товара (ручной ввод)
 * PATCH /api/material-report/line/:productId
 */
export const updateMaterialReportLine = async (req: Request, res: Response) => {
    try {
        const { productId } = req.params;
        const { date, closingBalanceFact } = req.body;
        const user = (req as any).user;

        if (!date) {
            return res.status(400).json({ error: 'Параметр date обязателен' });
        }

        const reportDate = new Date(date);
        reportDate.setUTCHours(0, 0, 0, 0);

        // Ищем или создаём черновик
        let draft = await prisma.materialReportDraft.findFirst({
            where: {
                reportDate,
                warehouseId: null
            }
        });

        if (!draft) {
            // Создаём черновик
            draft = await prisma.materialReportDraft.create({
                data: {
                    reportDate,
                    warehouseId: null,
                    updatedBy: user?.username
                }
            });
        }

        // Обновляем или создаём строку
        await prisma.materialReportDraftLine.upsert({
            where: {
                draftId_productId: {
                    draftId: draft.id,
                    productId: parseInt(productId)
                }
            },
            update: {
                closingBalanceFact: closingBalanceFact !== null ? closingBalanceFact : null
            },
            create: {
                draftId: draft.id,
                productId: parseInt(productId),
                closingBalanceFact: closingBalanceFact !== null ? closingBalanceFact : null
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[MATERIAL_REPORT] Update line error:', error);
        res.status(500).json({ error: 'Ошибка обновления строки' });
    }
};

/**
 * Сохранить материальный отчёт (кнопка "Сохранить отчёт")
 * POST /api/material-report/save
 */
export const saveMaterialReport = async (req: Request, res: Response) => {
    try {
        const { date, lines } = req.body;
        const user = (req as any).user;

        if (!date) {
            return res.status(400).json({ error: 'Параметр date обязателен' });
        }

        if (!lines || !Array.isArray(lines)) {
            return res.status(400).json({ error: 'Параметр lines обязателен' });
        }

        const reportDate = new Date(date);
        reportDate.setUTCHours(0, 0, 0, 0);

        // Валидация
        for (const line of lines) {
            if (line.closingBalanceFact !== null && line.closingBalanceFact < 0) {
                return res.status(400).json({
                    error: `Фактический остаток не может быть отрицательным для товара ${line.productCode}`
                });
            }
        }

        // Транзакция: создаём/обновляем отчёт
        const result = await prisma.$transaction(async (tx) => {
            // Удаляем старый отчёт если есть
            await tx.materialReport.deleteMany({
                where: {
                    reportDate,
                    warehouseId: null
                }
            });

            // Создаём новый отчёт
            const report = await tx.materialReport.create({
                data: {
                    reportDate,
                    warehouseId: null,
                    sourceType: 'ORDER_SUMMARY',
                    status: 'saved',
                    createdBy: user?.username || 'system',
                    lines: {
                        create: lines.map((l: any, idx: number) => ({
                            productId: l.productId,
                            productCode: l.productCode,
                            productName: l.productName,
                            openingBalance: l.openingBalance || 0,
                            inPurchase: l.inPurchase || 0,
                            inProduction: l.inProduction || 0,
                            outSale: l.outSale || 0,
                            outWaste: l.outWaste || 0,
                            outBundle: l.outBundle || 0,
                            outDefectWriteoff: l.outDefectWriteoff || 0,
                            outWeightLoss: l.outWeightLoss || 0,
                            outSupplierReturn: l.outSupplierReturn || 0,
                            closingBalanceCalc: l.closingBalanceCalc || 0,
                            closingBalanceFact: l.closingBalanceFact,
                            sortOrder: idx
                        }))
                    }
                },
                include: {
                    lines: {
                        include: {
                            product: {
                                select: {
                                    id: true,
                                    code: true,
                                    name: true,
                                    category: true
                                }
                            }
                        }
                    }
                }
            });

            // Удаляем черновик после сохранения
            await tx.materialReportDraft.deleteMany({
                where: {
                    reportDate,
                    warehouseId: null
                }
            });

            return report;
        });

        res.json({
            report: result,
            message: 'Отчёт сохранён успешно'
        });
    } catch (error) {
        console.error('[MATERIAL_REPORT] Save error:', error);
        res.status(500).json({ error: 'Ошибка сохранения отчёта' });
    }
};

/**
 * Удалить материальный отчёт
 * DELETE /api/material-report/:id
 */
export const deleteMaterialReport = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.materialReport.delete({
            where: { id: parseInt(id) }
        });

        res.json({ success: true, message: 'Отчёт удалён' });
    } catch (error) {
        console.error('[MATERIAL_REPORT] Delete error:', error);
        res.status(500).json({ error: 'Ошибка удаления отчёта' });
    }
};
