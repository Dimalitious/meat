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
            ['code', 'name', 'altName', 'priceListName', 'category', 'status', 'coefficient', 'lossNorm', 'uom', 'country', 'subcategory'],
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(headers);

        // Column widths
        ws['!cols'] = [
            { wch: 12 }, { wch: 30 }, { wch: 25 }, { wch: 25 },
            { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 10 },
            { wch: 10 }, { wch: 15 }, { wch: 20 },
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
            const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

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

            // ── Process rows one by one
            const imported: string[] = [];
            const updated: string[] = [];
            const skipped: Array<{ row: number; code: string; error: string; field?: string }> = [];

            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                const rowNum = i + 2; // Excel row (1=header)
                const code = String(r.code ?? '').trim();
                const name = normalizeName(r.name);

                // Required fields
                if (!code) { skipped.push({ row: rowNum, code: '', error: 'CODE_REQUIRED' }); continue; }
                if (!name) { skipped.push({ row: rowNum, code, error: 'NAME_REQUIRED' }); continue; }

                // Dedup check (v5.6 §5.4)
                if (dupCodes.has(code)) {
                    skipped.push({ row: rowNum, code, error: 'DUPLICATE_CODE_IN_FILE' });
                    continue;
                }

                // Resolve UoM (v5.6 §7.1: code first, then name)
                let uomId: number | null = null;
                const uomStr = String(r.uom ?? '').trim();
                if (uomStr) {
                    const key = uomStr.toLowerCase();
                    const uom = uomByCode.get(key) || uomByName.get(key);
                    if (!uom) { skipped.push({ row: rowNum, code, error: 'UOM_NOT_FOUND', field: 'uom' }); continue; }
                    if (!uom.isActive) { skipped.push({ row: rowNum, code, error: 'INACTIVE_UOM', field: 'uom' }); continue; }
                    uomId = uom.id;
                }

                // Resolve Country
                let countryId: number | null = null;
                const countryStr = String(r.country ?? '').trim();
                if (countryStr) {
                    const country = countryByName.get(countryStr.toLowerCase());
                    if (!country) { skipped.push({ row: rowNum, code, error: 'COUNTRY_NOT_FOUND', field: 'country' }); continue; }
                    if (!country.isActive) { skipped.push({ row: rowNum, code, error: 'INACTIVE_COUNTRY', field: 'country' }); continue; }
                    countryId = country.id;
                }

                // Resolve Subcategory
                let subcategoryId: number | null = null;
                const subcatStr = String(r.subcategory ?? '').trim();
                if (subcatStr) {
                    const subcat = subcatByName.get(subcatStr.toLowerCase());
                    if (!subcat) { skipped.push({ row: rowNum, code, error: 'SUBCATEGORY_NOT_FOUND', field: 'subcategory' }); continue; }
                    if (subcat.deletedAt) { skipped.push({ row: rowNum, code, error: 'SUBCATEGORY_DELETED', field: 'subcategory' }); continue; }
                    if (!subcat.isActive) { skipped.push({ row: rowNum, code, error: 'INACTIVE_SUBCATEGORY', field: 'subcategory' }); continue; }
                    subcategoryId = subcat.id;
                }

                // Resolve Category (auto-create if not found, v5.6 §2.2 via batch-like logic)
                let categoryId: number | null = null;
                const catStr = String(r.category ?? '').trim();
                if (catStr) {
                    const catKey = normalizeKey(catStr);
                    const existing = catByNorm.get(catKey);
                    if (existing) {
                        if (existing.deletedAt) { skipped.push({ row: rowNum, code, error: 'CATEGORY_DELETED', field: 'category' }); continue; }
                        if (!existing.isActive) { skipped.push({ row: rowNum, code, error: 'INACTIVE_CATEGORY', field: 'category' }); continue; }
                        categoryId = existing.id;
                    } else {
                        // Auto-create
                        try {
                            const created = await prisma.productCategory.create({
                                data: { name: normalizeName(catStr), nameNormalized: catKey, isActive: true },
                            });
                            categoryId = created.id;
                            catByNorm.set(catKey, { ...created, deletedAt: null });
                        } catch (e: any) {
                            if (e.code === 'P2002') {
                                const retry = await prisma.productCategory.findUnique({ where: { nameNormalized: catKey } });
                                if (retry) {
                                    categoryId = retry.id;
                                    catByNorm.set(catKey, retry);
                                }
                            } else {
                                skipped.push({ row: rowNum, code, error: 'CATEGORY_CREATE_FAILED', field: 'category' });
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
                        skipped.push({ row: rowNum, code, error: 'CODE_ALREADY_EXISTS' });
                    } else {
                        skipped.push({ row: rowNum, code, error: 'ROW_FAILED', field: e.message?.slice(0, 100) });
                    }
                }
            }

            res.json({
                success: true,
                imported: imported.length,
                updated: updated.length,
                skipped: skipped.length,
                errors: skipped.slice(0, 50),
                totalErrors: skipped.length,
            });
        } catch (error: any) {
            console.error('importProductsFromExcel error:', error);
            res.status(500).json({ error: 'INTERNAL', message: error.message });
        }
    });
}
