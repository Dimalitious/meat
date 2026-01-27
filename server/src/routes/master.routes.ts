import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.middleware';
import * as customers from '../controllers/customers.controller';
import * as suppliers from '../controllers/suppliers.controller';
import * as districts from '../controllers/districts.controller';
import * as managers from '../controllers/managers.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticateToken);

// Customers
router.get('/customers', customers.getCustomers);
router.post('/customers', customers.createCustomer);
router.put('/customers/:code', customers.updateCustomer);
router.delete('/customers/:code', customers.deleteCustomer);
// Customer import/export
router.get('/customers/template', customers.downloadImportTemplate);
router.get('/customers/export', customers.exportCustomersWithPhotos);
router.post('/customers/import', upload.single('file'), customers.importCustomers);
router.post('/customers/import-zip', upload.single('file'), customers.importCustomersFromZip);

// Suppliers
router.get('/suppliers', suppliers.getSuppliers);
router.post('/suppliers', suppliers.createSupplier);
router.post('/suppliers/deactivate', suppliers.deactivateSuppliers);
router.put('/suppliers/toggle/:code', suppliers.toggleSupplier);
router.put('/suppliers/:code', suppliers.updateSupplier);
router.delete('/suppliers/:code', suppliers.deleteSupplier);

// Districts
router.get('/districts', districts.getDistricts);
router.post('/districts', districts.createDistrict);
router.put('/districts/:code', districts.updateDistrict);
router.delete('/districts/:code', districts.deleteDistrict);

// Managers
router.get('/managers', managers.getManagers);
router.post('/managers', managers.createManager);
router.put('/managers/:code', managers.updateManager);
router.delete('/managers/:code', managers.deleteManager);

export default router;
