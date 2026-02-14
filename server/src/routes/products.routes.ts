import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission, requireRole } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import { getProducts, getProduct, createProduct, updateProduct, archiveProduct, toggleProduct, upsertProduct, batchUpsertProducts } from '../controllers/products.controller';
import { downloadImportTemplate, importProductsFromExcel } from '../controllers/productsImport.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

// ── Static & prefixed paths FIRST ──
router.get('/', requirePermission(PERM.CATALOG_PRODUCTS), getProducts);
router.post('/', requirePermission(PERM.CATALOG_PRODUCTS), createProduct);
router.post('/upsert', requirePermission(PERM.CATALOG_PRODUCTS), requireRole(['ADMIN']), upsertProduct);
router.post('/batch-upsert', requirePermission(PERM.CATALOG_PRODUCTS), requireRole(['ADMIN']), batchUpsertProducts);
router.get('/import-template', requirePermission(PERM.CATALOG_PRODUCTS), requireRole(['ADMIN']), downloadImportTemplate);
router.post('/import', requirePermission(PERM.CATALOG_PRODUCTS), requireRole(['ADMIN']), importProductsFromExcel);
router.patch('/toggle/:code', requireRole(['ADMIN']), toggleProduct);

// ── Bare parameterized /:code LAST ──
router.get('/:code', requirePermission(PERM.CATALOG_PRODUCTS), getProduct);
router.put('/:code', requirePermission(PERM.CATALOG_PRODUCTS), updateProduct);
router.delete('/:code', requireRole(['ADMIN']), archiveProduct);

export default router;

