import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { prisma } from '../db';

export const importData = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const buffer = req.file.buffer;
        const workbook = XLSX.read(buffer, { type: 'buffer' });

        const stats = {
            products: { created: 0, updated: 0, total: 0 },
            customers: { created: 0, updated: 0, total: 0 },
            suppliers: { created: 0, updated: 0, total: 0 }
        };

        // --- 1. ENSURE DEFAULTS ---
        const defaultDistrict = await prisma.district.upsert({
            where: { code: 'GENERAL' },
            update: {},
            create: { code: 'GENERAL', name: 'Общий район' }
        });

        const defaultManager = await prisma.manager.upsert({
            where: { code: 'GENERAL' },
            update: {},
            create: { code: 'GENERAL', name: 'Общий менеджер' }
        });

        // --- 2. IMPORT PRODUCTS & SUPPLIERS ---
        const productSheetName = 'справочник';
        if (workbook.Sheets[productSheetName]) {
            const rows = XLSX.utils.sheet_to_json<any>(workbook.Sheets[productSheetName]);

            for (const row of rows) {
                const code = row['Код'] ? String(row['Код']).trim() : null;
                const name = row['Название'] ? String(row['Название']).trim() : null;
                const category = row['Категория'] ? String(row['Категория']).trim() : null;
                const supplierName = row['поставщики'] ? String(row['поставщики']).trim() : null;

                if (!code || !name) continue;

                // Upsert Product
                const product = await prisma.product.upsert({
                    where: { code },
                    update: { name, category, status: 'active' },
                    create: { code, name, category, status: 'active' }
                });
                stats.products.total++;

                // Handle Supplier
                if (supplierName) {
                    const supplierCode = 'SUP-' + supplierName.replace(/[^a-zA-Z0-9\u0400-\u04FF]/g, '').toUpperCase().slice(0, 10);

                    const supplier = await prisma.supplier.upsert({
                        where: { code: supplierCode },
                        update: { name: supplierName },
                        create: { code: supplierCode, name: supplierName }
                    });
                    stats.suppliers.total++;

                    await prisma.supplierProduct.upsert({
                        where: { supplierId_productId: { supplierId: supplier.id, productId: product.id } },
                        update: {},
                        create: { supplierId: supplier.id, productId: product.id }
                    });
                }
            }
        }

        // --- 3. IMPORT CUSTOMERS ---
        const customerNames = new Set<string>();

        // From 'sup'
        if (workbook.Sheets['sup']) {
            const rows = XLSX.utils.sheet_to_json<any>(workbook.Sheets['sup']);
            rows.forEach(row => {
                const name = row['торговые точки'];
                if (name) customerNames.add(String(name).trim());
            });
        }

        // From 'VIP клиенты'
        if (workbook.Sheets['VIP клиенты']) {
            const rows = XLSX.utils.sheet_to_json<any>(workbook.Sheets['VIP клиенты']);
            rows.forEach(row => {
                const name = row['Альтернативное название'];
                if (name) customerNames.add(String(name).trim());
            });
        }

        const slugify = (text: string) => {
            return text
                .toLowerCase()
                .replace(/['"]/g, '')
                .replace(/[а-яё]/g, (char) => {
                    const map: Record<string, string> = {
                        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
                        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
                        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
                        'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
                        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
                    };
                    return map[char] || char;
                })
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
        };

        for (const name of customerNames) {
            if (!name) continue;

            let code = slugify(name).toUpperCase();
            if (code.length < 3) code = 'CUST-' + Math.random().toString(36).substring(2, 7).toUpperCase();

            try {
                await prisma.customer.upsert({
                    where: { code },
                    update: {
                        name,
                        districtId: defaultDistrict.code,
                        managerId: defaultManager.code
                    },
                    create: {
                        code,
                        name,
                        districtId: defaultDistrict.code,
                        managerId: defaultManager.code
                    }
                });
                stats.customers.total++;
            } catch (e) {
                // Retry with unique suffix if collision (though unlikely with proper slugs)
                const newCode = code + '-' + Math.floor(Math.random() * 1000);
                try {
                    await prisma.customer.create({
                        data: {
                            code: newCode,
                            name,
                            districtId: defaultDistrict.code,
                            managerId: defaultManager.code
                        }
                    });
                    stats.customers.total++;
                } catch (e2) {
                    console.error(`Failed to import customer ${name}`, e2);
                }
            }
        }

        res.json({ success: true, stats });

    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Failed to process import' });
    }
};
