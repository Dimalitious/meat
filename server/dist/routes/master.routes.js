"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const customers = __importStar(require("../controllers/customers.controller"));
const suppliers = __importStar(require("../controllers/suppliers.controller"));
const districts = __importStar(require("../controllers/districts.controller"));
const managers = __importStar(require("../controllers/managers.controller"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// Customers
router.get('/customers', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customers.getCustomers);
router.post('/customers', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customers.createCustomer);
router.put('/customers/:code', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customers.updateCustomer);
router.delete('/customers/:code', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customers.deleteCustomer);
// Customer import/export
router.get('/customers/template', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customers.downloadImportTemplate);
router.get('/customers/export', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), customers.exportCustomersWithPhotos);
router.post('/customers/import', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), upload.single('file'), customers.importCustomers);
router.post('/customers/import-zip', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), upload.single('file'), customers.importCustomersFromZip);
// Suppliers
router.get('/suppliers', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_SUPPLIERS), suppliers.getSuppliers);
router.post('/suppliers', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_SUPPLIERS), suppliers.createSupplier);
router.post('/suppliers/deactivate', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_SUPPLIERS), suppliers.deactivateSuppliers);
router.put('/suppliers/toggle/:code', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_SUPPLIERS), suppliers.toggleSupplier);
router.put('/suppliers/:code', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_SUPPLIERS), suppliers.updateSupplier);
router.delete('/suppliers/:code', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_SUPPLIERS), suppliers.deleteSupplier);
// Districts
router.get('/districts', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), districts.getDistricts);
router.post('/districts', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), districts.createDistrict);
router.put('/districts/:code', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), districts.updateDistrict);
router.delete('/districts/:code', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), districts.deleteDistrict);
// Managers
router.get('/managers', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), managers.getManagers);
router.post('/managers', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), managers.createManager);
router.put('/managers/:code', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), managers.updateManager);
router.delete('/managers/:code', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.CATALOG_CUSTOMERS), managers.deleteManager);
exports.default = router;
