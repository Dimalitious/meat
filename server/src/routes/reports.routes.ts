import { Router } from 'express';
import { getSvodReport } from '../controllers/reports.controller';

const router = Router();

router.get('/svod', getSvodReport);

export default router;
