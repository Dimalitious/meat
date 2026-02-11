"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const socket_1 = require("./socket");
const db_1 = require("./db");
const ensureRbacSeeded_1 = require("./prisma/ensureRbacSeeded");
const auth_middleware_1 = require("./middleware/auth.middleware");
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const PORT = process.env.PORT || 3000;
// Initialize Socket.IO
const io = (0, socket_1.initializeSocketServer)(httpServer);
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const products_routes_1 = __importDefault(require("./routes/products.routes"));
const master_routes_1 = __importDefault(require("./routes/master.routes"));
const orders_routes_1 = __importDefault(require("./routes/orders.routes"));
const reports_routes_1 = __importDefault(require("./routes/reports.routes"));
const expeditors_routes_1 = __importDefault(require("./routes/expeditors.routes"));
const import_routes_1 = __importDefault(require("./routes/import.routes"));
const assembly_routes_1 = __importDefault(require("./routes/assembly.routes"));
const warehouse_routes_1 = __importDefault(require("./routes/warehouse.routes"));
const summaryOrders_routes_1 = __importDefault(require("./routes/summaryOrders.routes"));
const journals_routes_1 = __importDefault(require("./routes/journals.routes"));
const prices_routes_1 = __importDefault(require("./routes/prices.routes"));
const purchasePriceLists_routes_1 = __importDefault(require("./routes/purchasePriceLists.routes"));
const mmlBatch_routes_1 = __importDefault(require("./routes/mmlBatch.routes"));
const paymentTypes_routes_1 = __importDefault(require("./routes/paymentTypes.routes"));
const purchases_routes_1 = __importDefault(require("./routes/purchases.routes"));
const telegram_routes_1 = __importDefault(require("./routes/telegram.routes"));
const warehouses_routes_1 = __importDefault(require("./routes/warehouses.routes"));
app.use((0, cors_1.default)());
app.set('trust proxy', 1); // Railway/Nginx proxy support
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
// Middleware to attach Socket.IO to requests
app.use((req, res, next) => {
    req.io = io;
    next();
});
app.use('/api/auth', auth_routes_1.default);
app.use('/api/products', products_routes_1.default);
app.use('/api/orders', orders_routes_1.default);
app.use('/api/reports', reports_routes_1.default);
app.use('/api/expeditors', expeditors_routes_1.default);
app.use('/api/import', import_routes_1.default);
app.use('/api/assembly', assembly_routes_1.default);
app.use('/api/warehouse', warehouse_routes_1.default);
app.use('/api/summary-orders', summaryOrders_routes_1.default);
app.use('/api/journals', journals_routes_1.default);
app.use('/api/prices', prices_routes_1.default);
app.use('/api/purchase-price-lists', purchasePriceLists_routes_1.default);
app.use('/api/production-module', mmlBatch_routes_1.default);
// Production Module v2 (Tree Structure)
const production_v2_routes_1 = __importDefault(require("./routes/production-v2.routes"));
app.use('/api/production-v2', production_v2_routes_1.default);
// Purchase Module
app.use('/api/payment-types', paymentTypes_routes_1.default);
app.use('/api/purchases', purchases_routes_1.default);
// Telegram Bot Module (webhook + CRM API)
app.use('/api/telegram', telegram_routes_1.default);
// Warehouses Module (Справочник складов)
app.use('/api/warehouses', warehouses_routes_1.default);
// Admin Module (User & Role Management)
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
app.use('/api/admin', admin_routes_1.default);
// Customer Products (Персональный каталог товаров клиента)
const customerProducts_routes_1 = __importDefault(require("./routes/customerProducts.routes"));
app.use('/api/customer-products', customerProducts_routes_1.default);
// SVOD Module (Сводная таблица)
const svod_routes_1 = __importDefault(require("./routes/svod.routes"));
app.use('/api/svod', svod_routes_1.default);
// Production-Purchase Integration (Производство из закупок)
const productionDoc_routes_1 = __importDefault(require("./routes/productionDoc.routes"));
app.use('/api/production-docs', productionDoc_routes_1.default);
// Material Report Module (Материальный отчёт)
const materialReport_routes_1 = __importDefault(require("./routes/materialReport.routes"));
app.use('/api/material-report', materialReport_routes_1.default);
// Customer Cards Module (Карточки клиентов с MML и фото)
const customerCards_routes_1 = __importDefault(require("./routes/customerCards.routes"));
app.use('/api/customer-cards', customerCards_routes_1.default);
// Returns Module (Возвраты из точек)
const returns_routes_1 = __importDefault(require("./routes/returns.routes"));
app.use('/api', returns_routes_1.default); // /api/orders/:orderId/returns
// Supplier Account Module (Расчёты с поставщиками)
const supplier_routes_1 = __importDefault(require("./routes/supplier.routes"));
app.use('/api/suppliers', supplier_routes_1.default);
// Sales Manager Module (Менеджер по продажам + Аксверк + Возврат денег)
const salesManager_routes_1 = __importDefault(require("./routes/salesManager.routes"));
app.use('/api/sales-manager', salesManager_routes_1.default);
// UoM Module
const uom_routes_1 = __importDefault(require("./routes/uom.routes"));
app.use('/api/uom', uom_routes_1.default);
// Product Catalog: Countries, Subcategories, ParamValues, ProductParams, Variants
const countries_routes_1 = __importDefault(require("./routes/countries.routes"));
app.use('/api/countries', countries_routes_1.default);
const subcategories_routes_1 = __importDefault(require("./routes/subcategories.routes"));
app.use('/api/subcategories', subcategories_routes_1.default);
const paramValues_routes_1 = __importDefault(require("./routes/paramValues.routes"));
app.use('/api/param-values', paramValues_routes_1.default);
const productParams_routes_1 = __importDefault(require("./routes/productParams.routes"));
app.use('/api/product-params', productParams_routes_1.default);
const customerProductVariants_routes_1 = __importDefault(require("./routes/customerProductVariants.routes"));
app.use('/api/customer-product-variants', customerProductVariants_routes_1.default);
app.use('/api', master_routes_1.default); // /api/customers etc.
// ============================================
// Health endpoints
// ============================================
// Liveness: always 200 (for k8s / Railway / load balancers)
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// RBAC observability: returns degraded status if fallback is active
let rbacSeeded = false;
app.get('/api/health/rbac', (_req, res) => {
    const snapshot = (0, auth_middleware_1.getRbacHealthSnapshot)();
    const status = !rbacSeeded ? 'seed_failed' :
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
        await (0, ensureRbacSeeded_1.ensureRbacSeededRuntime)(db_1.prisma);
        rbacSeeded = true;
        console.log('RBAC: seeded successfully');
    }
    catch (err) {
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
        }
        catch (err) {
            console.warn('[Telegram] Workers failed to start:', err);
        }
    });
}
bootstrap().catch(err => {
    console.error('Fatal bootstrap error:', err);
    process.exit(1);
});
