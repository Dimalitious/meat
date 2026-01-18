import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

app.use(cors());
app.use(express.json());

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
app.use('/api', masterRoutes); // /api/customers etc.

app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
