import { Request, Response } from 'express';
import { prisma } from '../db';

// ============================================
// МАТЕРИАЛЬНЫЙ ОТЧЁТ
// ============================================

/**
 * Получить или сформировать материальный отчёт на указанную дату
 * GET /api/material-report?date=YYYY-MM-DD
 */
export const getMaterialReport = async (req: Request, res: Response) => {
    try {
        const { date, refresh } = req.query;
        const forceRefresh = refresh === 'true';
        console.log('[DEBUG MaterialReport] getMaterialReport called with date:', date, 'refresh:', forceRefresh);

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

        // Если есть сохранённый и НЕ запрошено обновление — возвращаем как есть
        if (existingReport && !forceRefresh) {
            return res.json({
                report: existingReport,
                isPreview: false,
                message: 'Сохранённый отчёт'
            });
        }

        // Пересчитываем данные
        const preview = await buildMaterialReportPreview(reportDate);

        // Если был сохранённый отчёт и запрошен refresh — сохраняем введённые факты и определяем изменения
        let hasChanges = false;
        if (existingReport && forceRefresh) {
            const factsByProduct = new Map<number, number | null>();
            existingReport.lines.forEach(l => {
                if (l.closingBalanceFact !== null) {
                    factsByProduct.set(l.productId, Number(l.closingBalanceFact));
                }
            });

            // Мерджим введённые факты в новые данные
            preview.lines.forEach(line => {
                const existingFact = factsByProduct.get(line.productId);
                if (existingFact !== undefined) {
                    line.closingBalanceFact = existingFact;
                }
            });

            // Проверяем есть ли изменения (сравниваем ключевые поля)
            const savedLines = new Map(existingReport.lines.map(l => [l.productId, l]));
            for (const newLine of preview.lines) {
                const savedLine = savedLines.get(newLine.productId);
                if (!savedLine) {
                    hasChanges = true; // Новый товар
                    break;
                }
                // Сравниваем расчётные поля
                if (Number(savedLine.inProduction || 0) !== Number(newLine.inProduction || 0) ||
                    Number(savedLine.outProductionWriteoff || 0) !== Number(newLine.outProductionWriteoff || 0) ||
                    Number(savedLine.inPurchase || 0) !== Number(newLine.inPurchase || 0)) {
                    hasChanges = true;
                    break;
                }
            }
        }

        return res.json({
            report: {
                id: existingReport?.id || null,
                reportDate: reportDate.toISOString(),
                status: existingReport ? 'saved' : 'preview',
                lines: preview.lines
            },
            isPreview: !existingReport,
            hasChanges,
            message: hasChanges ? 'Данные изменились, требуется сохранение' :
                existingReport ? 'Данные актуальны' : 'Предпросмотр (не сохранён)'
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

    // DEBUG: логирование дат запроса
    console.log('[DEBUG MaterialReport] reportDate input:', reportDate);
    console.log('[DEBUG MaterialReport] dateStart:', dateStart.toISOString());
    console.log('[DEBUG MaterialReport] dateEnd:', dateEnd.toISOString());

    // Параллельно получаем все данные
    const [
        products,
        svod,
        purchases,
        production,
        productionWriteoffs,
        customerReturns,
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
        // V3: Списано в производство = Σ(всех RunValue) для каждого Run
        // Заменяет старый подход через actualWeight (который теперь = только PRODUCTION)
        prisma.productionRunValue.findMany({
            where: {
                run: {
                    productionDate: { gte: dateStart, lte: dateEnd },
                    isHidden: false
                },
                value: { not: null }
            },
            select: {
                value: true,
                run: {
                    select: { productId: true }
                }
            }
        }),
        // V3: Производство = выход (только PRODUCTION opType)
        // Это товары, которые ПОЛУЧИЛИ в результате выработки (MML узлы)
        prisma.productionRunValue.findMany({
            where: {
                run: {
                    productionDate: { gte: dateStart, lte: dateEnd },
                    isHidden: false
                },
                value: { not: null },
                opType: 'PRODUCTION'
            },
            select: {
                snapshotProductId: true,
                value: true,
                node: {
                    select: {
                        productId: true
                    }
                }
            }
        }),
        // ТЗ v2 §6: Возвраты от покупателей = агрегация OrderItem.qtyReturn за дату
        prisma.orderItem.findMany({
            where: {
                order: {
                    date: { gte: dateStart, lte: dateEnd },
                    isDisabled: false
                },
                qtyReturn: { gt: 0 }
            },
            select: {
                productId: true,
                qtyReturn: true,
                price: true
            }
        }),
        // Предыдущий отчёт (для остатка на начало)
        getPreviousDayReport(reportDate)
    ]);

    // DEBUG: логирование производственных данных
    console.log('[DEBUG MaterialReport] production (сырьё) count:', production.length);
    console.log('[DEBUG MaterialReport] productionWriteoffs (выход) count:', productionWriteoffs.length);
    if (productionWriteoffs.length > 0) {
        console.log('[DEBUG MaterialReport] productionWriteoffs sample:', JSON.stringify(productionWriteoffs[0], null, 2));
    }

    // Группируем данные по товарам
    const purchasesByProduct = new Map<number, number>();
    purchases.forEach(p => {
        const current = purchasesByProduct.get(p.productId) || 0;
        purchasesByProduct.set(p.productId, current + Number(p.qty));
    });

    // V3: Списано в производство = Σ(RunValue.value) сгруппировано по run.productId
    // Это замена старого подхода через actualWeight
    const productionWriteoffByProduct = new Map<number, number>();
    production.forEach((p: any) => {
        const productId = p.run?.productId;
        if (productId) {
            const current = productionWriteoffByProduct.get(productId) || 0;
            productionWriteoffByProduct.set(productId, current + Number(p.value || 0));
        }
    });

    // Производство = выход (правая панель, ProductionRunValue)
    // Это товары которые ПОЛУЧИЛИ в результате выработки
    const productionByProduct = new Map<number, number>();
    productionWriteoffs.forEach(p => {
        const productId = p.snapshotProductId || p.node?.productId;
        if (productId) {
            const current = productionByProduct.get(productId) || 0;
            productionByProduct.set(productId, current + Number(p.value || 0));
        }
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

    // ТЗ v2 §6: Возвраты от покупателей (агрегация qtyReturn)
    const customerReturnsByProduct = new Map<number, number>();
    customerReturns.forEach(r => {
        const current = customerReturnsByProduct.get(r.productId) || 0;
        customerReturnsByProduct.set(r.productId, current + Number(r.qtyReturn || 0));
    });

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
    productionWriteoffByProduct.forEach((_, id) => productIdsWithMovements.add(id));
    svodByProduct.forEach((_, id) => productIdsWithMovements.add(id));
    previousBalances.forEach((_, id) => productIdsWithMovements.add(id));
    customerReturnsByProduct.forEach((_, id) => productIdsWithMovements.add(id));

    // Строим строки отчёта
    const lines: any[] = [];
    let sortOrder = 0;

    productIdsWithMovements.forEach(productId => {
        const product = products.find(p => p.id === productId);
        if (!product) return; // Пропускаем неактивные товары

        const openingBalance = previousBalances.get(productId) || 0;
        const inPurchase = purchasesByProduct.get(productId) || 0;
        const inProduction = productionByProduct.get(productId) || 0;
        const inCustomerReturn = customerReturnsByProduct.get(productId) || 0; // ТЗ v2 §6
        const outProductionWriteoff = productionWriteoffByProduct.get(productId) || 0;
        const svodData = svodByProduct.get(productId);
        const outSale = svodData?.weightToShip || 0;

        // Формула расчётного остатка на конец
        // ТЗ v2 §6: добавляем inCustomerReturn
        const closingBalanceCalc = openingBalance
            + inPurchase
            + inProduction
            + inCustomerReturn
            - outSale
            - outProductionWriteoff;

        lines.push({
            productId,
            productCode: product.code,
            productName: product.name,
            category: product.category,
            openingBalance,
            inPurchase,
            inProduction,
            inCustomerReturn,  // ТЗ v2 §6: Возврат от покупателя
            outSale,
            outWaste: 0,
            outBundle: 0,
            outDefectWriteoff: 0,
            outProductionWriteoff,
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
 * Получить остатки за предыдущий день
 * Если есть сохранённый отчёт - берём из него
 * Если нет — рассчитываем динамически на основе движений за все предыдущие дни
 */
async function getPreviousDayReport(reportDate: Date) {
    const previousDate = new Date(reportDate);
    previousDate.setDate(previousDate.getDate() - 1);
    previousDate.setUTCHours(0, 0, 0, 0);

    // Сначала пробуем найти сохранённый отчёт
    const savedReport = await prisma.materialReport.findFirst({
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

    if (savedReport) {
        return savedReport;
    }

    // Нет сохранённого отчёта — рассчитываем динамически
    // Рассчитываем накопленные остатки до конца предыдущего дня
    const endOfPreviousDay = new Date(previousDate);
    endOfPreviousDay.setUTCHours(23, 59, 59, 999);

    // Параллельно получаем все движения ДО конца предыдущего дня
    const [purchases, productionRuns, productionOutput, svodShipped] = await Promise.all([
        // Все закупки до конца предыдущего дня
        prisma.purchaseItem.findMany({
            where: {
                purchase: {
                    purchaseDate: { lte: endOfPreviousDay },
                    isDisabled: false
                }
            },
            select: {
                productId: true,
                qty: true
            }
        }),
        // V3: Производственные прогоны (сырьё списано) = Σ(всех RunValue)
        prisma.productionRunValue.findMany({
            where: {
                run: {
                    productionDate: { lte: endOfPreviousDay },
                    isHidden: false
                },
                value: { not: null }
            },
            select: {
                value: true,
                run: {
                    select: { productId: true }
                }
            }
        }),
        // V3: Выход продукции (только PRODUCTION opType)
        prisma.productionRunValue.findMany({
            where: {
                run: {
                    productionDate: { lte: endOfPreviousDay },
                    isHidden: false
                },
                value: { not: null },
                opType: 'PRODUCTION'
            },
            select: {
                snapshotProductId: true,
                value: true,
                node: {
                    select: {
                        productId: true
                    }
                }
            }
        }),
        // Все отгрузки до конца предыдущего дня
        prisma.svodLine.findMany({
            where: {
                svod: {
                    svodDate: { lte: endOfPreviousDay }
                }
            },
            select: {
                productId: true,
                weightToShip: true
            }
        })
    ]);

    // Группируем данные по товарам
    const balanceByProduct = new Map<number, number>();

    // 1. Приход от закупок (+)
    purchases.forEach(p => {
        const current = balanceByProduct.get(p.productId) || 0;
        balanceByProduct.set(p.productId, current + Number(p.qty || 0));
    });

    // V3: Списание сырья в производство (-) = Σ(RunValue.value) по run.productId
    productionRuns.forEach((p: any) => {
        const productId = p.run?.productId;
        if (productId) {
            const current = balanceByProduct.get(productId) || 0;
            balanceByProduct.set(productId, current - Number(p.value || 0));
        }
    });

    // 3. Приход от производства (+) — ProductionRunValue.value
    productionOutput.forEach(p => {
        const productId = p.snapshotProductId || p.node?.productId;
        if (productId) {
            const current = balanceByProduct.get(productId) || 0;
            balanceByProduct.set(productId, current + Number(p.value || 0));
        }
    });

    // 4. Минус отгрузки (-)
    svodShipped.forEach(s => {
        const current = balanceByProduct.get(s.productId) || 0;
        balanceByProduct.set(s.productId, current - Number(s.weightToShip || 0));
    });

    // Формируем псевдо-отчёт с рассчитанными остатками
    const lines = Array.from(balanceByProduct.entries()).map(([productId, balance]) => ({
        productId,
        closingBalanceCalc: balance,
        closingBalanceFact: null
    }));

    return { lines };
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
                            outProductionWriteoff: l.outProductionWriteoff,
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
                    productId: parseInt(String(productId))
                }
            },
            update: {
                closingBalanceFact: closingBalanceFact !== null ? closingBalanceFact : null
            },
            create: {
                draftId: draft.id,
                productId: parseInt(String(productId)),
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
                            outProductionWriteoff: l.outProductionWriteoff || 0,
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
            where: { id: parseInt(String(id)) }
        });

        res.json({ success: true, message: 'Отчёт удалён' });
    } catch (error) {
        console.error('[MATERIAL_REPORT] Delete error:', error);
        res.status(500).json({ error: 'Ошибка удаления отчёта' });
    }
};
