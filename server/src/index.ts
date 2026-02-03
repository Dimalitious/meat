import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeSocketServer } from './socket';

// Force restart: 2026-01-22 00:36 - Socket.IO Integration
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
import productionRoutes from './routes/production.routes';
import pricesRoutes from './routes/prices.routes';
import purchasePriceListsRoutes from './routes/purchasePriceLists.routes';
import mmlBatchRoutes from './routes/mmlBatch.routes';
import paymentTypesRoutes from './routes/paymentTypes.routes';
import purchasesRoutes from './routes/purchases.routes';
import telegramRoutes from './controllers/telegram.controller';
import warehousesRoutes from './routes/warehouses.routes';

app.use(cors());
app.use(express.json({ limit: '50mb' }));  // Increased limit for batch imports
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
app.use('/api/production', productionRoutes);
app.use('/api/prices', pricesRoutes);
app.use('/api/purchase-price-lists', purchasePriceListsRoutes);
app.use('/api/production-module', mmlBatchRoutes);

// Production Module v2 (Tree Structure)
import productionV2Routes from './routes/production-v2.routes';
app.use('/api/production-v2', productionV2Routes);

// Purchase Module
app.use('/api/payment-types', paymentTypesRoutes);
app.use('/api/purchases', purchasesRoutes);

// Telegram Agent Module
app.use('/api/telegram', telegramRoutes);

// Warehouses Module (Справочник складов)
app.use('/api/warehouses', warehousesRoutes);

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

app.use('/api', masterRoutes); // /api/customers etc.

// Health check (also for telegram agent)
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Socket.IO server ready`);
});

