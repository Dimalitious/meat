import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import {
    getSupplierReturns,
    getSupplierReturnById,
    createSupplierReturn,
    updateSupplierReturn,
    deleteSupplierReturn,
} from '../controllers/supplierReturns.controller';
import {
    getSupplierPayments,
    createSupplierPayment,
    updateSupplierPayment,
    deleteSupplierPayment,
} from '../controllers/supplierPayments.controller';
import {
    getSupplierStatement,
    getOpeningBalance,
    setOpeningBalance,
} from '../controllers/supplierStatement.controller';

const router = Router();

// All routes require authentication + RBAC context
router.use(authenticateToken);
router.use(loadUserContext);

// ============================================
// Возвраты поставщику
// ============================================

router.get('/returns', requirePermission(PERM.SUPPLIER_RETURNS_READ), getSupplierReturns);
router.post('/returns', requirePermission(PERM.SUPPLIER_RETURNS_MANAGE), createSupplierReturn);
router.get('/returns/:id', requirePermission(PERM.SUPPLIER_RETURNS_READ), getSupplierReturnById);
router.put('/returns/:id', requirePermission(PERM.SUPPLIER_RETURNS_MANAGE), updateSupplierReturn);
router.delete('/returns/:id', requirePermission(PERM.SUPPLIER_RETURNS_MANAGE), deleteSupplierReturn);

// ============================================
// Оплаты поставщику
// ============================================

router.get('/payments', requirePermission(PERM.SUPPLIER_PAYMENTS_READ), getSupplierPayments);
router.post('/payments', requirePermission(PERM.SUPPLIER_PAYMENTS_MANAGE), createSupplierPayment);
router.put('/payments/:id', requirePermission(PERM.SUPPLIER_PAYMENTS_MANAGE), updateSupplierPayment);
router.delete('/payments/:id', requirePermission(PERM.SUPPLIER_PAYMENTS_MANAGE), deleteSupplierPayment);

// ============================================
// Акт сверки + начальное сальдо
// ============================================

router.get('/:supplierId/statement', requirePermission(PERM.SUPPLIER_STATEMENT_READ), getSupplierStatement);
router.get('/:supplierId/opening-balance', requirePermission(PERM.SUPPLIER_STATEMENT_READ), getOpeningBalance);
router.put('/:supplierId/opening-balance', requirePermission(PERM.SUPPLIER_PAYMENTS_MANAGE), setOpeningBalance);

export default router;
