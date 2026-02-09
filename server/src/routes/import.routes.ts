import { Router } from 'express';
import multer from 'multer';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import { importData } from '../controllers/import.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/excel', authenticateToken, loadUserContext, requirePermission(PERM.IMPORT_EXECUTE), upload.single('file'), importData);

export default router;
