import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import * as customers from '../controllers/customers.controller';
import * as suppliers from '../controllers/suppliers.controller';
import * as districts from '../controllers/districts.controller';
import * as managers from '../controllers/managers.controller';

const router = Router();
router.use(authenticateToken);

// Customers
router.get('/customers', customers.getCustomers);
router.post('/customers', customers.createCustomer);
router.put('/customers/:code', customers.updateCustomer);
router.delete('/customers/:code', customers.deleteCustomer);

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
