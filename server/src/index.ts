import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeSocketServer } from './socket';
import { prisma } from './db';
import { ensureRbacSeededRuntime } from './prisma/ensureRbacSeeded';
import { getRbacHealthSnapshot } from './middleware/auth.middleware';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.IO
const io = initializeSocketServer(httpServer);

import authRoutes from './routes/auth.routes';
import productsRoutes from './routes/products.routes';
import masterRoutes from './routes/master.routes';
import ordersRoutes from './routes/orders.routes';
import reportsRoutes from './routes/reports.routes';
import expeditorsRoutes from './routes/expeditors.routes';
import importRoutes from './routes/import.routes';
import assemblyRoutes from './routes/assembly.routes';
import warehouseRoutes from './routes/warehouse.routes';
import summaryOrdersRoutes from './routes/summaryOrders.routes';
import journalsRoutes from './routes/journals.routes';

import pricesRoutes from './routes/prices.routes';
import purchasePriceListsRoutes from './routes/purchasePriceLists.routes';
import mmlBatchRoutes from './routes/mmlBatch.routes';
import paymentTypesRoutes from './routes/paymentTypes.routes';
import purchasesRoutes from './routes/purchases.routes';
import telegramRoutes from './routes/telegram.routes';
import warehousesRoutes from './routes/warehouses.routes';

app.use(cors());
app.set('trust proxy', 1); // Railway/Nginx proxy support
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middleware to attach Socket.IO to requests
app.use((req: Request, res: Response, next: NextFunction) => {
    (req as any).io = io;
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/expeditors', expeditorsRoutes);
app.use('/api/import', importRoutes);
app.use('/api/assembly', assemblyRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/summary-orders', summaryOrdersRoutes);
app.use('/api/journals', journalsRoutes);

app.use('/api/prices', pricesRoutes);
app.use('/api/purchase-price-lists', purchasePriceListsRoutes);
app.use('/api/production-module', mmlBatchRoutes);

// Production Module v2 (Tree Structure)
import productionV2Routes from './routes/production-v2.routes';
app.use('/api/production-v2', productionV2Routes);

// Purchase Module
app.use('/api/payment-types', paymentTypesRoutes);
app.use('/api/purchases', purchasesRoutes);

// Telegram Bot Module (webhook + CRM API)
app.use('/api/telegram', telegramRoutes);

// Warehouses Module (Справочник складов)
app.use('/api/warehouses', warehousesRoutes);

// Admin Module (User & Role Management)
import adminRoutes from './routes/admin.routes';
app.use('/api/admin', adminRoutes);

// Customer Products (Персональный каталог товаров клиента)
import customerProductsRoutes from './routes/customerProducts.routes';
app.use('/api/customer-products', customerProductsRoutes);

// SVOD Module (Сводная таблица)
import svodRoutes from './routes/svod.routes';
app.use('/api/svod', svodRoutes);

// Production-Purchase Integration (Производство из закупок)
import productionDocRoutes from './routes/productionDoc.routes';
app.use('/api/production-docs', productionDocRoutes);

// Material Report Module (Материальный отчёт)
import materialReportRoutes from './routes/materialReport.routes';
app.use('/api/material-report', materialReportRoutes);

// Customer Cards Module (Карточки клиентов с MML и фото)
import customerCardsRoutes from './routes/customerCards.routes';
app.use('/api/customer-cards', customerCardsRoutes);

// Returns Module (Возвраты из точек)
import returnsRoutes from './routes/returns.routes';
app.use('/api', returnsRoutes);  // /api/orders/:orderId/returns

// Supplier Account Module (Расчёты с поставщиками)
import supplierRoutes from './routes/supplier.routes';
app.use('/api/suppliers', supplierRoutes);

// Sales Manager Module (Менеджер по продажам + Аксверк + Возврат денег)
import salesManagerRoutes from './routes/salesManager.routes';
app.use('/api/sales-manager', salesManagerRoutes);

// UoM Module
import uomRoutes from './routes/uom.routes';
app.use('/api/uom', uomRoutes);

// Product Catalog: Countries, Subcategories, ParamValues, ProductParams, Variants
import countriesRoutes from './routes/countries.routes';
app.use('/api/countries', countriesRoutes);

import subcategoriesRoutes from './routes/subcategories.routes';
app.use('/api/subcategories', subcategoriesRoutes);

import paramValuesRoutes from './routes/paramValues.routes';
app.use('/api/param-values', paramValuesRoutes);

import productParamsRoutes from './routes/productParams.routes';
app.use('/api/product-params', productParamsRoutes);

import customerProductVariantsRoutes from './routes/customerProductVariants.routes';
app.use('/api/customer-product-variants', customerProductVariantsRoutes);

app.use('/api', masterRoutes); // /api/customers etc.

// ============================================
// Health endpoints
// ============================================

// Liveness: always 200 (for k8s / Railway / load balancers)
app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// RBAC observability: returns degraded status if fallback is active
let rbacSeeded = false;

app.get('/api/health/rbac', (_req: Request, res: Response) => {
    const snapshot = getRbacHealthSnapshot();
    const status =
        !rbacSeeded ? 'seed_failed' :
            snapshot.fallbackCount > 0 ? 'degraded' :
                'ok';

    res.json({
        status,
        rbacSeeded,
        ...snapshot,
        timestamp: new Date().toISOString(),
    });
});

// ============================================
// Async bootstrap: RBAC seed + server start
// ============================================

async function bootstrap() {
    // Ensure RBAC tables have permissions, roles, ADMIN→ALL linkage
    try {
        await ensureRbacSeededRuntime(prisma);
        rbacSeeded = true;
        console.log('RBAC: seeded successfully');
    } catch (err) {
        rbacSeeded = false;
        console.error('RBAC: seed FAILED — running in fallback mode', err);
    }

    httpServer.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log(`Socket.IO server ready`);
        if (!rbacSeeded) {
            console.error('⚠ RBAC SEED FAILED — check database connectivity / migration state');
        }

        // Start Telegram workers
        try {
            const { startInboxProcessor } = require('./telegram/inboxProcessor');
            const { startOutboxWorker } = require('./telegram/outboxWorker');
            startInboxProcessor();
            startOutboxWorker();
        } catch (err) {
            console.warn('[Telegram] Workers failed to start:', err);
        }
    });
}

bootstrap().catch(err => {
    console.error('Fatal bootstrap error:', err);
    process.exit(1);
});
