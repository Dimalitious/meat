import fs from 'fs';
import path from 'path';
import { prisma } from './db';

const FILE_PATH = process.argv[2] || 'erp_export.json'; // Pass filename as arg

async function importData() {
    try {
        const fullPath = path.resolve(process.cwd(), FILE_PATH);
        if (!fs.existsSync(fullPath)) {
            console.error(`❌ File not found: ${fullPath}`);
            return;
        }

        const raw = fs.readFileSync(fullPath, 'utf8');
        const data = JSON.parse(raw); // { products: [], customers: [], ... }

        console.log('📦 Starting import...');

        // 1. Districts
        if (data.districts) {
            console.log(`Importing ${data.districts.length} districts...`);
            for (const d of data.districts) {
                if (!d.district_id) continue;
                await prisma.district.upsert({
                    where: { code: String(d.district_id) },
                    update: { name: d.district_name },
                    create: { code: String(d.district_id), name: d.district_name }
                });
            }
        }

        // 2. Managers
        if (data.managers) {
            console.log(`Importing ${data.managers.length} managers...`);
            for (const m of data.managers) {
                if (!m.manager_id) continue;
                await prisma.manager.upsert({
                    where: { code: String(m.manager_id) },
                    update: { name: m.manager_name },
                    create: { code: String(m.manager_id), name: m.manager_name }
                });
            }
        }

        // 3. Customers
        if (data.customers) {
            console.log(`Importing ${data.customers.length} customers...`);
            for (const c of data.customers) {
                if (!c.customer_id) continue;
                await prisma.customer.upsert({
                    where: { code: String(c.customer_id) },
                    update: {
                        name: c.customer_name,
                        legalName: c.legal_name,
                        districtId: c.district_id ? String(c.district_id) : null,
                        managerId: c.manager_id ? String(c.manager_id) : null,
                    },
                    create: {
                        code: String(c.customer_id),
                        name: c.customer_name,
                        legalName: c.legal_name,
                        districtId: c.district_id ? String(c.district_id) : null,
                        managerId: c.manager_id ? String(c.manager_id) : null,
                    }
                });
            }
        }

        // 4. Suppliers
        if (data.suppliers) {
            console.log(`Importing ${data.suppliers.length} suppliers...`);
            for (const s of data.suppliers) {
                if (!s.supplier_id) continue;
                await prisma.supplier.upsert({
                    where: { code: String(s.supplier_id) },
                    update: { name: s.supplier_name, legalName: s.legal_name },
                    create: { code: String(s.supplier_id), name: s.supplier_name, legalName: s.legal_name }
                });
            }
        }

        // 5. Products
        if (data.products) {
            console.log(`Importing ${data.products.length} products...`);
            for (const p of data.products) {
                if (!p.product_code) continue;
                await prisma.product.upsert({
                    where: { code: String(p.product_code) },
                    update: {
                        name: p.product_name,
                        altName: p.alt_name,
                        shortNameFsa: p.short_name_fsa,
                        shortNamePl: p.short_name_pl,
                        shortNameMorning: p.short_name_morning,
                        priceMorning: p.price_morning ? parseFloat(p.price_morning) : 0,
                        category: p.category,
                        status: p.status || 'active',
                        coefficient: p.coefficient ? parseFloat(p.coefficient) : 1,
                        lossNorm: p.loss_norm ? parseFloat(p.loss_norm) : 0
                    },
                    create: {
                        code: String(p.product_code),
                        name: p.product_name,
                        altName: p.alt_name,
                        shortNameFsa: p.short_name_fsa,
                        shortNamePl: p.short_name_pl,
                        shortNameMorning: p.short_name_morning,
                        priceMorning: p.price_morning ? parseFloat(p.price_morning) : 0,
                        category: p.category,
                        status: p.status || 'active',
                        coefficient: p.coefficient ? parseFloat(p.coefficient) : 1,
                        lossNorm: p.loss_norm ? parseFloat(p.loss_norm) : 0
                    }
                });
            }
        }

        console.log('✅ Import completed successfully!');

    } catch (error) {
        console.error('❌ Import failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

importData();
