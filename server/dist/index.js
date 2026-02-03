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
// Force restart: 2026-01-22 00:36 - Socket.IO Integration
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
const production_routes_1 = __importDefault(require("./routes/production.routes"));
const prices_routes_1 = __importDefault(require("./routes/prices.routes"));
const purchasePriceLists_routes_1 = __importDefault(require("./routes/purchasePriceLists.routes"));
const mmlBatch_routes_1 = __importDefault(require("./routes/mmlBatch.routes"));
const paymentTypes_routes_1 = __importDefault(require("./routes/paymentTypes.routes"));
const purchases_routes_1 = __importDefault(require("./routes/purchases.routes"));
const telegram_controller_1 = __importDefault(require("./controllers/telegram.controller"));
const warehouses_routes_1 = __importDefault(require("./routes/warehouses.routes"));
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' })); // Increased limit for batch imports
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
app.use('/api/production', production_routes_1.default);
app.use('/api/prices', prices_routes_1.default);
app.use('/api/purchase-price-lists', purchasePriceLists_routes_1.default);
app.use('/api/production-module', mmlBatch_routes_1.default);
// Production Module v2 (Tree Structure)
const production_v2_routes_1 = __importDefault(require("./routes/production-v2.routes"));
app.use('/api/production-v2', production_v2_routes_1.default);
// Purchase Module
app.use('/api/payment-types', paymentTypes_routes_1.default);
app.use('/api/purchases', purchases_routes_1.default);
// Telegram Agent Module
app.use('/api/telegram', telegram_controller_1.default);
// Warehouses Module (Справочник складов)
app.use('/api/warehouses', warehouses_routes_1.default);
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
app.use('/api', master_routes_1.default); // /api/customers etc.
// Health check (also for telegram agent)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Socket.IO server ready`);
});
