import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import {
    getPaymentTypes,
    getPaymentTypeById,
    getDefaultPaymentType,
    createPaymentType,
    updatePaymentType,
    togglePaymentType,
    deletePaymentType,
    seedDefaultPaymentTypes
} from '../controllers/paymentTypes.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

// Read (needed by operators creating purchases)
router.get('/', requirePermission(PERM.PURCHASES_READ), getPaymentTypes);
router.get('/default', requirePermission(PERM.PURCHASES_READ), getDefaultPaymentType);
router.get('/:id', requirePermission(PERM.PURCHASES_READ), getPaymentTypeById);

// Manage (admin only via ADMIN bypass, but explicit permission for audit)
router.post('/seed', requirePermission(PERM.ADMIN_USERS), seedDefaultPaymentTypes);
router.post('/', requirePermission(PERM.PURCHASES_MANAGE), createPaymentType);
router.put('/:id', requirePermission(PERM.PURCHASES_MANAGE), updatePaymentType);
router.patch('/:id/toggle', requirePermission(PERM.PURCHASES_MANAGE), togglePaymentType);
router.delete('/:id', requirePermission(PERM.PURCHASES_MANAGE), deletePaymentType);

export default router;
