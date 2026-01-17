import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const prisma = new PrismaClient();
const FILE_PATH = 'c:\\gr\\imports\\data.xlsx';

async function main() {
    if (!fs.existsSync(FILE_PATH)) {
        console.error(`File not found: ${FILE_PATH}`);
        process.exit(1);
    }

    console.log('Reading Excel file...');
    const workbook = XLSX.readFile(FILE_PATH);

    // --- 1. PREPARE DEFAULTS ---
    console.log('Ensuring default District and Manager...');

    const defaultDistrict = await prisma.district.upsert({
        where: { code: 'GENERAL' },
        update: {},
        create: {
            code: 'GENERAL',
            name: 'Общий район'
        }
    });

    const defaultManager = await prisma.manager.upsert({
        where: { code: 'GENERAL' },
        update: {},
        create: {
            code: 'GENERAL',
            name: 'Общий менеджер'
        }
    });

    // --- 2. IMPORT PRODUCTS & SUPPLIERS ---
    const productSheetName = 'справочник';
    if (workbook.Sheets[productSheetName]) {
        console.log(`Importing Products from '${productSheetName}'...`);
        const rows = XLSX.utils.sheet_to_json<any>(workbook.Sheets[productSheetName]);

        let productCount = 0;

        for (const row of rows) {
            const code = row['Код'] ? String(row['Код']).trim() : null;
            const name = row['Название'] ? String(row['Название']).trim() : null;
            const category = row['Категория'] ? String(row['Категория']).trim() : null;
            const supplierName = row['поставщики'] ? String(row['поставщики']).trim() : null;

            if (!code || !name) continue;

            // Upsert Product
            const product = await prisma.product.upsert({
                where: { code },
                update: {
                    name,
                    category,
                    status: 'active'
                },
                create: {
                    code,
                    name,
                    category,
                    status: 'active'
                }
            });

            // Handle Supplier if present
            if (supplierName) {
                // Simple code generation for supplier: SUP-{UPPERCASE_NAME_PART}
                // or just use name as code if unique enough, but better safe.
                // Let's use a sanitized slug as code.
                const supplierCode = 'SUP-' + supplierName.replace(/[^a-zA-Z0-9\u0400-\u04FF]/g, '').toUpperCase().slice(0, 10);

                const supplier = await prisma.supplier.upsert({
                    where: { code: supplierCode },
                    update: { name: supplierName },
                    create: {
                        code: supplierCode,
                        name: supplierName
                    }
                });

                // Link SupplierProduct
                await prisma.supplierProduct.upsert({
                    where: {
                        supplierId_productId: {
                            supplierId: supplier.id,
                            productId: product.id
                        }
                    },
                    update: {},
                    create: {
                        supplierId: supplier.id,
                        productId: product.id
                    }
                });
            }

            productCount++;
        }
        console.log(`Processed ${productCount} products.`);
    } else {
        console.warn(`Sheet '${productSheetName}' not found.`);
    }

    // --- 3. IMPORT CUSTOMERS ---
    const customerNames = new Set<string>();

    // From 'sup' sheet
    if (workbook.Sheets['sup']) {
        const rows = XLSX.utils.sheet_to_json<any>(workbook.Sheets['sup']);
        rows.forEach(row => {
            const name = row['торговые точки'];
            if (name) customerNames.add(String(name).trim());
        });
    }

    // From 'VIP клиенты' sheet
    if (workbook.Sheets['VIP клиенты']) {
        const rows = XLSX.utils.sheet_to_json<any>(workbook.Sheets['VIP клиенты']);
        rows.forEach(row => {
            const name = row['Альтернативное название'];
            if (name) customerNames.add(String(name).trim());
        });
    }

    console.log(`Found ${customerNames.size} unique customers. Importing...`);

    let customerCount = 0;
    for (const name of customerNames) {
        if (!name) continue;

        // Generate a code using a hash-like strategy or simple slug
        // Since names can be anything, and we need a consistent unique code for updates
        // we will use a sanitized translit/slug style.

        // Simple translit/slugify function
        const slug = name
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

        let code = slug.toUpperCase();
        if (code.length < 3) code = 'CUST-' + Math.random().toString(36).substring(2, 7).toUpperCase();

        // Ensure code is not too long (DB limit?) - usually String is 191 chars in Prisma (default VARCHAR)
        // But uniqueness is key.

        // Check if code exists to avoid collision (unlikely with full name slug, but possible)
        // For this script, we'll trust the slug is unique enough or Prisma will throw unique constraint error.
        // To be safer, we can try-catch or append suffix if implicit collision handling is needed.
        // For now, simplicity:

        try {
            await prisma.customer.upsert({
                where: { code },
                update: {
                    name,
                    districtId: defaultDistrict.code,
                    managerId: defaultManager.code,
                },
                create: {
                    code,
                    name,
                    districtId: defaultDistrict.code,
                    managerId: defaultManager.code,
                }
            });
            customerCount++;
        } catch (e) {
            console.error(`Error importing customer '${name}' with code '${code}':`, e);
            // Fallback with random suffix
            const newCode = code + '-' + Math.floor(Math.random() * 1000);
            try {
                await prisma.customer.create({
                    data: {
                        code: newCode,
                        name,
                        districtId: defaultDistrict.code,
                        managerId: defaultManager.code,
                    }
                });
                customerCount++;
            } catch (e2) {
                console.error(`Failed fallback for '${name}':`, e2);
            }
        }
    }

    console.log(`Imported/Updated ${customerCount} customers.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
