import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import {
    getProductionDocs,
    getProductionDoc,
    createProductionDoc,
    loadFromPurchase,
    clearInputs,
    applyCutting,
    finalizeDoc,
    cancelDoc,
    deleteProductionDoc,
    getAvailablePurchases
} from '../controllers/productionDoc.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

// Read
router.get('/', requirePermission(PERM.PRODUCTION_READ), getProductionDocs);
router.get('/available-purchases', requirePermission(PERM.PRODUCTION_READ), getAvailablePurchases);
router.get('/:id', requirePermission(PERM.PRODUCTION_READ), getProductionDoc);

// Create / Edit
router.post('/', requirePermission(PERM.PRODUCTION_CREATE), createProductionDoc);
router.post('/:id/load-from-purchase', requirePermission(PERM.PRODUCTION_EDIT), loadFromPurchase);
router.post('/:id/clear-inputs', requirePermission(PERM.PRODUCTION_EDIT), clearInputs);
router.post('/:id/apply-cutting', requirePermission(PERM.PRODUCTION_EDIT), applyCutting);

// Finalize / Cancel
router.post('/:id/finalize', requirePermission(PERM.PRODUCTION_POST), finalizeDoc);
router.post('/:id/cancel', requirePermission(PERM.PRODUCTION_VOID), cancelDoc);

// Delete
router.delete('/:id', requirePermission(PERM.PRODUCTION_DELETE), deleteProductionDoc);

export default router;
