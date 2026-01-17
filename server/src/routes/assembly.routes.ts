import { Router } from 'express';
import * as assemblyController from '../controllers/assembly.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticateToken, assemblyController.getOrdersForAssembly);
router.get('/:id', authenticateToken, assemblyController.getAssemblyOrder);
router.put('/:id', authenticateToken, assemblyController.completeAssembly);

export default router;
