import { Router } from 'express';
import multer from 'multer';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import * as customers from '../controllers/customers.controller';
import * as suppliers from '../controllers/suppliers.controller';
import * as districts from '../controllers/districts.controller';
import * as managers from '../controllers/managers.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticateToken);
router.use(loadUserContext);

// Customers
router.get('/customers', requirePermission(PERM.CATALOG_CUSTOMERS), customers.getCustomers);
router.post('/customers', requirePermission(PERM.CATALOG_CUSTOMERS), customers.createCustomer);
router.put('/customers/:code', requirePermission(PERM.CATALOG_CUSTOMERS), customers.updateCustomer);
router.delete('/customers/:code', requirePermission(PERM.CATALOG_CUSTOMERS), customers.deleteCustomer);
// Customer import/export
router.get('/customers/template', requirePermission(PERM.CATALOG_CUSTOMERS), customers.downloadImportTemplate);
router.get('/customers/export', requirePermission(PERM.CATALOG_CUSTOMERS), customers.exportCustomersWithPhotos);
router.post('/customers/import', requirePermission(PERM.CATALOG_CUSTOMERS), upload.single('file'), customers.importCustomers);
router.post('/customers/import-zip', requirePermission(PERM.CATALOG_CUSTOMERS), upload.single('file'), customers.importCustomersFromZip);

// Suppliers
router.get('/suppliers', requirePermission(PERM.CATALOG_SUPPLIERS), suppliers.getSuppliers);
router.post('/suppliers', requirePermission(PERM.CATALOG_SUPPLIERS), suppliers.createSupplier);
router.post('/suppliers/deactivate', requirePermission(PERM.CATALOG_SUPPLIERS), suppliers.deactivateSuppliers);
router.put('/suppliers/toggle/:code', requirePermission(PERM.CATALOG_SUPPLIERS), suppliers.toggleSupplier);
router.put('/suppliers/:code', requirePermission(PERM.CATALOG_SUPPLIERS), suppliers.updateSupplier);
router.delete('/suppliers/:code', requirePermission(PERM.CATALOG_SUPPLIERS), suppliers.deleteSupplier);

// Districts
router.get('/districts', requirePermission(PERM.CATALOG_CUSTOMERS), districts.getDistricts);
router.post('/districts', requirePermission(PERM.CATALOG_CUSTOMERS), districts.createDistrict);
router.put('/districts/:code', requirePermission(PERM.CATALOG_CUSTOMERS), districts.updateDistrict);
router.delete('/districts/:code', requirePermission(PERM.CATALOG_CUSTOMERS), districts.deleteDistrict);

// Managers
router.get('/managers', requirePermission(PERM.CATALOG_CUSTOMERS), managers.getManagers);
router.post('/managers', requirePermission(PERM.CATALOG_CUSTOMERS), managers.createManager);
router.put('/managers/:code', requirePermission(PERM.CATALOG_CUSTOMERS), managers.updateManager);
router.delete('/managers/:code', requirePermission(PERM.CATALOG_CUSTOMERS), managers.deleteManager);

export default router;
