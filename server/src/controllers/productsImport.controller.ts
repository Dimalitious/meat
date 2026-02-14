import { Request, Response } from 'express';
import { prisma } from '../db';
import multer from 'multer';
import * as XLSX from 'xlsx';

// ── Multer: memory storage, 5MB limit (v5.6 §5.3) ─────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
}).single('file');

// ── Helpers ─────────────────────────────────────────────
const MAX_ROWS = 10_000;

const normalizeName = (raw: any): string =>
    String(raw ?? '').trim().replace(/\s+/g, ' ');

const normalizeKey = (raw: any): string =>
    normalizeName(raw).toLowerCase();

// ── GET /import-template ────────────────────────────────
export async function downloadImportTemplate(_req: Request, res: Response) {
    try {
        const headers = [
            ['Код', 'Наименование', 'Альт. наименование', 'Категория', 'Подкатегория', 'Ед. измерения', 'Страна', 'Наименование прайс-листа', 'Коэффициент', 'Норма потерь', 'Участвует в производстве'],
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(headers);

        // Column widths
        ws['!cols'] = [
            { wch: 12 }, { wch: 30 }, { wch: 25 }, { wch: 18 },
            { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 25 },
            { wch: 12 }, { wch: 10 }, { wch: 22 },
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Products');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename=products_import_template.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (error: any) {
        console.error('downloadImportTemplate error:', error);
        res.status(500).json({ error: 'INTERNAL' });
    }
}

// ── POST /import  ───────────────────────────────────────
export async function importProductsFromExcel(req: Request, res: Response) {
    upload(req, res, async (multerErr) => {
        try {
            if (multerErr) {
                if (multerErr.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'FILE_TOO_LARGE', message: 'Максимальный размер файла 5MB.' });
                }
                return res.status(400).json({ error: 'UPLOAD_ERROR', message: multerErr.message });
            }
            if (!req.file) {
                return res.status(400).json({ error: 'FILE_REQUIRED', message: 'Пожалуйста загрузите .xlsx файл.' });
            }

            // Parse Excel
            const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

            // Map Russian headers → internal English keys (supports both languages)
            const headerMap: Record<string, string> = {
                'Код': 'code', 'Наименование': 'name', 'Альт. наименование': 'altName',
                'Категория': 'category', 'Подкатегория': 'subcategory', 'Ед. измерения': 'uom',
                'Страна': 'country', 'Наименование прайс-листа': 'priceListName',
                'Коэффициент': 'coefficient', 'Норма потерь': 'lossNorm',
                'Участвует в производстве': 'participatesInProduction',
            };
            const rows = rawRows.map((r) => {
                const mapped: any = {};
                for (const [key, val] of Object.entries(r)) {
                    mapped[headerMap[key] || key] = val;
                }
                return mapped;
            });

            if (rows.length === 0) {
                return res.status(400).json({ error: 'EMPTY_FILE', message: 'Файл пуст.' });
            }
            if (rows.length > MAX_ROWS) {
                return res.status(400).json({ error: 'FILE_TOO_LARGE', message: `Максимум ${MAX_ROWS} строк.` });
            }

            // ── Dedup: check for duplicate codes within the file (v5.6 §5.4)
            const codeCount = new Map<string, number>();
            for (const r of rows) {
                const c = String(r.code ?? '').trim();
                if (c) codeCount.set(c, (codeCount.get(c) || 0) + 1);
            }
            const dupCodes = new Set<string>();
            for (const [c, cnt] of codeCount) {
                if (cnt > 1) dupCodes.add(c);
            }

            // ── Pre-load lookup tables ONE time
            const [allCountries, allSubcats, allUoms, allCategories] = await Promise.all([
                prisma.country.findMany({ select: { id: true, name: true, isActive: true } }),
                prisma.productSubcategory.findMany({ select: { id: true, name: true, isActive: true, deletedAt: true } }),
                prisma.unitOfMeasure.findMany({ select: { id: true, name: true, code: true, isActive: true } }),
                prisma.productCategory.findMany({ select: { id: true, name: true, nameNormalized: true, isActive: true, deletedAt: true } }),
            ]);

            // Build lookup maps
            type CountryRow = typeof allCountries[0];
            type SubcatRow = typeof allSubcats[0];
            type UomRow = typeof allUoms[0];
            type CatRow = typeof allCategories[0];

            const countryByName = new Map<string, CountryRow>(allCountries.map((c) => [c.name.toLowerCase(), c]));
            const subcatByName = new Map<string, SubcatRow>(allSubcats.map((s) => [s.name.toLowerCase(), s]));
            // UoM: code first, then name (v5.6 §7.1)
            const uomByCode = new Map<string, UomRow>(allUoms.filter((u) => u.code).map((u) => [(u.code!).toLowerCase(), u]));
            const uomByName = new Map<string, UomRow>(allUoms.map((u) => [u.name.toLowerCase(), u]));
            const catByNorm = new Map<string, CatRow>(allCategories.map((c) => [c.nameNormalized, c]));

            // ── Batch pre-create/restore categories only from rows likely to succeed
            // (rows with valid code + name + not duplicate — avoids creating orphan categories)
            let createdCategories = 0;
            let restoredCategories = 0;
            const uniqueCatKeys = new Set<string>();
            const catNameByKey = new Map<string, string>(); // normalized → display name
            for (const r of rows) {
                const rowCode = String(r.code ?? '').trim();
                const rowName = normalizeName(r.name);
                // Skip rows that will fail basic validation anyway
                if (!rowCode || !rowName || dupCodes.has(rowCode)) continue;

                const catStr = String(r.category ?? '').trim();
                if (catStr) {
                    const key = normalizeKey(catStr);
                    uniqueCatKeys.add(key);
                    if (!catNameByKey.has(key)) catNameByKey.set(key, normalizeName(catStr));
                }
            }
            // Create or restore categories in batch
            for (const key of uniqueCatKeys) {
                const existing = catByNorm.get(key);
                if (existing && existing.deletedAt) {
                    // Restore soft-deleted category
                    try {
                        const restored = await prisma.productCategory.update({
                            where: { id: existing.id },
                            data: { deletedAt: null, isActive: true },
                        });
                        catByNorm.set(key, { ...restored, nameNormalized: key, deletedAt: null });
                        restoredCategories++;
                    } catch (_) { /* keep existing in map, per-row will catch */ }
                } else if (!existing) {
                    // Create new category
                    try {
                        const created = await prisma.productCategory.create({
                            data: { name: catNameByKey.get(key)!, nameNormalized: key, isActive: true },
                        });
                        catByNorm.set(key, { ...created, deletedAt: null });
                    } catch (e: any) {
                        if (e.code === 'P2002') {
                            const retry = await prisma.productCategory.findUnique({ where: { nameNormalized: key } });
                            if (retry) catByNorm.set(key, retry);
                        }
                    }
                }
                // else: existing && !deletedAt — already usable, skip
            }

            // ── Process rows one by one
            const imported: string[] = [];
            const updated: string[] = [];
            const errors: Array<{ row: number; code?: string; error: string; message?: string; field?: string }> = [];

            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                const rowNum = i + 2; // Excel row (1=header)
                const code = String(r.code ?? '').trim();
                const name = normalizeName(r.name);

                // Required fields
                if (!code) { errors.push({ row: rowNum, error: 'CODE_REQUIRED', message: 'Код товара обязателен.' }); continue; }
                if (!name) { errors.push({ row: rowNum, code, error: 'NAME_REQUIRED', message: 'Наименование обязательно.' }); continue; }

                // Dedup check (v5.6 §5.4)
                if (dupCodes.has(code)) {
                    errors.push({ row: rowNum, code, error: 'DUPLICATE_CODE_IN_FILE', message: `Код "${code}" встречается в файле несколько раз.` });
                    continue;
                }

                // Resolve UoM (v5.6 §7.1: code first, then name)
                let uomId: number | null = null;
                const uomStr = String(r.uom ?? '').trim();
                if (uomStr) {
                    const key = uomStr.toLowerCase();
                    const uom = uomByCode.get(key) || uomByName.get(key);
                    if (!uom) { errors.push({ row: rowNum, code, error: 'UOM_NOT_FOUND', field: 'uom', message: `ЕИ "${uomStr}" не найдена.` }); continue; }
                    if (!uom.isActive) { errors.push({ row: rowNum, code, error: 'INACTIVE_UOM', field: 'uom', message: `ЕИ "${uomStr}" неактивна.` }); continue; }
                    uomId = uom.id;
                }

                // Resolve Country
                let countryId: number | null = null;
                const countryStr = String(r.country ?? '').trim();
                if (countryStr) {
                    const country = countryByName.get(countryStr.toLowerCase());
                    if (!country) { errors.push({ row: rowNum, code, error: 'COUNTRY_NOT_FOUND', field: 'country', message: `Страна "${countryStr}" не найдена.` }); continue; }
                    if (!country.isActive) { errors.push({ row: rowNum, code, error: 'INACTIVE_COUNTRY', field: 'country', message: `Страна "${countryStr}" неактивна.` }); continue; }
                    countryId = country.id;
                }

                // Resolve Subcategory
                let subcategoryId: number | null = null;
                const subcatStr = String(r.subcategory ?? '').trim();
                if (subcatStr) {
                    const subcat = subcatByName.get(subcatStr.toLowerCase());
                    if (!subcat) { errors.push({ row: rowNum, code, error: 'SUBCATEGORY_NOT_FOUND', field: 'subcategory', message: `Подкатегория "${subcatStr}" не найдена.` }); continue; }
                    if (subcat.deletedAt) { errors.push({ row: rowNum, code, error: 'SUBCATEGORY_DELETED', field: 'subcategory', message: `Подкатегория "${subcatStr}" удалена.` }); continue; }
                    if (!subcat.isActive) { errors.push({ row: rowNum, code, error: 'INACTIVE_SUBCATEGORY', field: 'subcategory', message: `Подкатегория "${subcatStr}" неактивна.` }); continue; }
                    subcategoryId = subcat.id;
                }

                // Resolve Category (auto-create if not found, v5.6 §2.2 via batch-like logic)
                let categoryId: number | null = null;
                const catStr = String(r.category ?? '').trim();
                if (catStr) {
                    const catKey = normalizeKey(catStr);
                    const existing = catByNorm.get(catKey);
                    if (existing) {
                        if (existing.deletedAt) { errors.push({ row: rowNum, code, error: 'CATEGORY_DELETED', field: 'category', message: `Категория "${catStr}" удалена.` }); continue; }
                        if (!existing.isActive) { errors.push({ row: rowNum, code, error: 'INACTIVE_CATEGORY', field: 'category', message: `Категория "${catStr}" неактивна.` }); continue; }
                        categoryId = existing.id;
                    } else {
                        // Auto-create
                        try {
                            const created = await prisma.productCategory.create({
                                data: { name: normalizeName(catStr), nameNormalized: catKey, isActive: true },
                            });
                            categoryId = created.id;
                            catByNorm.set(catKey, { ...created, deletedAt: null });
                            createdCategories++;
                        } catch (e: any) {
                            if (e.code === 'P2002') {
                                const retry = await prisma.productCategory.findUnique({ where: { nameNormalized: catKey } });
                                if (retry) {
                                    categoryId = retry.id;
                                    catByNorm.set(catKey, retry);
                                }
                            } else {
                                errors.push({ row: rowNum, code, error: 'CATEGORY_CREATE_FAILED', field: 'category', message: `Не удалось создать категорию "${catStr}".` });
                                continue;
                            }
                        }
                    }
                }

                // Status whitelist
                const statusRaw = String(r.status ?? '').trim().toLowerCase();
                const status = ['active', 'inactive'].includes(statusRaw) ? statusRaw : 'active';

                // Build data
                const data: any = {
                    name,
                    altName: String(r.altName ?? '').trim() || null,
                    priceListName: String(r.priceListName ?? '').trim() || null,
                    category: catStr || null,
                    status,
                    coefficient: r.coefficient != null && r.coefficient !== '' ? Number(r.coefficient) || 1.0 : 1.0,
                    lossNorm: r.lossNorm != null && r.lossNorm !== '' ? Number(r.lossNorm) || 0.0 : 0.0,
                    uomId,
                    countryId,
                    subcategoryId,
                    categoryId,
                };

                // Upsert per row (partial import, v5.6 §5.2)
                try {
                    const exists = await prisma.product.findUnique({ where: { code }, select: { id: true } });
                    if (exists) {
                        await prisma.product.update({ where: { code }, data });
                        updated.push(code);
                    } else {
                        await prisma.product.create({ data: { code, ...data } });
                        imported.push(code);
                    }
                } catch (e: any) {
                    if (e.code === 'P2002') {
                        errors.push({ row: rowNum, code, error: 'CODE_ALREADY_EXISTS', message: `Код "${code}" уже существует.` });
                    } else {
                        errors.push({ row: rowNum, code, error: 'ROW_FAILED', message: e.message?.slice(0, 200) });
                    }
                }
            }

            res.json({
                success: errors.length === 0,
                stats: {
                    totalRows: rows.length,
                    importedCount: imported.length,
                    updatedCount: updated.length,
                    errorCount: errors.length,
                    createdCategories,
                    restoredCategories,
                },
                imported,
                updated,
                errors: errors.slice(0, 100), // cap detail list
            });
        } catch (error: any) {
            console.error('importProductsFromExcel error:', error);
            res.status(500).json({ error: 'INTERNAL', message: error.message });
        }
    });
}

