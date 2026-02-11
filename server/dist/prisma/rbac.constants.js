"use strict";
// ============================================
// RBAC Constants — single source of truth
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ROLE_PERMS_SEED = exports.SYSTEM_ROLES = exports.DEFAULT_ROLE_PERMS_FALLBACK = exports.PERM = exports.ROLE_CODES = void 0;
exports.mapLegacyRoleToRoleCode = mapLegacyRoleToRoleCode;
exports.ROLE_CODES = {
    ADMIN: 'ADMIN',
    OPERATOR: 'OPERATOR',
    PRODUCTION: 'PRODUCTION',
    EXPEDITOR: 'EXPEDITOR',
    BUYER: 'BUYER',
    ACCOUNTANT: 'ACCOUNTANT',
    SALES_MANAGER: 'SALES_MANAGER',
};
exports.PERM = {
    // Orders
    ORDERS_READ: 'orders.read',
    ORDERS_CREATE: 'orders.create',
    ORDERS_EDIT: 'orders.edit',
    ORDERS_DELETE: 'orders.delete',
    ORDERS_ASSIGN_EXPEDITOR: 'orders.assign_expeditor',
    ORDERS_CHANGE_STATUS: 'orders.change_status',
    // Summary Orders (Сводка)
    SUMMARY_READ: 'summary.read',
    SUMMARY_CREATE: 'summary.create',
    SUMMARY_SYNC: 'summary.sync',
    // Assembly (Сборка)
    ASSEMBLY_READ: 'assembly.read',
    ASSEMBLY_MANAGE: 'assembly.manage',
    // Expedition (Экспедиция / Доставка)
    EXPEDITION_READ: 'expedition.read',
    EXPEDITION_MANAGE: 'expedition.manage',
    // Journals (Журналы)
    JOURNALS_READ: 'journals.read',
    JOURNALS_MANAGE: 'journals.manage',
    // Returns
    RETURNS_READ: 'returns.read',
    RETURNS_CREATE: 'returns.create',
    // Prices
    PRICES_PURCHASE_READ: 'prices.purchase.read',
    PRICES_PURCHASE_MANAGE: 'prices.purchase.manage',
    PRICES_SALES_READ: 'prices.sales.read',
    PRICES_SALES_MANAGE: 'prices.sales.manage',
    // Purchases
    PURCHASES_READ: 'purchases.read',
    PURCHASES_CREATE: 'purchases.create',
    PURCHASES_MANAGE: 'purchases.manage',
    // Supplier Account
    SUPPLIER_RETURNS_READ: 'supplier.returns.read',
    SUPPLIER_RETURNS_MANAGE: 'supplier.returns.manage',
    SUPPLIER_PAYMENTS_READ: 'supplier.payments.read',
    SUPPLIER_PAYMENTS_MANAGE: 'supplier.payments.manage',
    SUPPLIER_STATEMENT_READ: 'supplier.statement.read',
    // Import
    IMPORT_EXECUTE: 'import.execute',
    // Production
    PRODUCTION_READ: 'production.read',
    PRODUCTION_CREATE: 'production.create',
    PRODUCTION_EDIT: 'production.edit',
    PRODUCTION_POST: 'production.post',
    PRODUCTION_VOID: 'production.void',
    PRODUCTION_ADJUST: 'production.adjust',
    PRODUCTION_CLOSURES: 'production.closures',
    PRODUCTION_DELETE: 'production.delete',
    PRODUCTION_HIDE: 'production.hide',
    // MML
    MML_READ: 'mml.read',
    MML_MANAGE: 'mml.manage',
    MML_LOCK: 'mml.lock',
    // Catalog / Справочники
    CATALOG_PRODUCTS: 'catalog.products',
    CATALOG_CUSTOMERS: 'catalog.customers',
    CATALOG_SUPPLIERS: 'catalog.suppliers',
    // Warehouses (Склады)
    WAREHOUSES_READ: 'warehouses.read',
    WAREHOUSES_MANAGE: 'warehouses.manage',
    // Reports (Отчёты — свод, мат. отчёт)
    REPORTS_READ: 'reports.read',
    REPORTS_MANAGE: 'reports.manage',
    // Admin
    ADMIN_USERS: 'admin.users',
    ADMIN_ROLES: 'admin.roles',
    // P2: reserved for future AuditLog endpoint (view audit entries).
    // Keep code here to avoid breaking changes later, but do not rely on it in P0/P1.
    ADMIN_AUDIT: 'admin.audit',
    // Telegram Bot
    TELEGRAM_BIND: 'telegram.bind',
    TELEGRAM_DRAFTS_READ: 'telegram.drafts.read',
    TELEGRAM_DRAFTS_MANAGE: 'telegram.drafts.manage',
    TELEGRAM_OUTBOX: 'telegram.outbox',
    // Sales Manager Module
    SALES_MANAGER_CUSTOMERS_READ: 'salesManager.customers.read',
    SALES_MANAGER_CUSTOMERS_ASSIGN: 'salesManager.customers.assign',
    SALES_MANAGER_DRAFTS_READ: 'salesManager.drafts.read',
    SALES_MANAGER_DRAFTS_ACCEPT: 'salesManager.drafts.accept',
    SALES_MANAGER_DRAFTS_REJECT: 'salesManager.drafts.reject',
    SALES_MANAGER_DRAFTS_EDIT: 'salesManager.drafts.edit',
    SALES_MANAGER_STATEMENT_READ: 'salesManager.statement.read',
    SALES_MANAGER_STATEMENT_SEND: 'salesManager.statement.send',
    SALES_MANAGER_REFUNDS_READ: 'salesManager.refunds.read',
    SALES_MANAGER_REFUNDS_MANAGE: 'salesManager.refunds.manage',
    SALES_MANAGER_ADDRESSES_MANAGE: 'salesManager.addresses.manage',
};
/**
 * Legacy role string (User.role) -> new Role code mapping for fallback mode.
 * Keep this conservative: unknown values map to OPERATOR.
 */
function mapLegacyRoleToRoleCode(legacyRoleRaw) {
    const legacy = (legacyRoleRaw ?? '').trim().toUpperCase();
    if (legacy === 'ADMIN' || legacy === 'ADMINISTRATOR' || legacy === 'SUPERADMIN')
        return exports.ROLE_CODES.ADMIN;
    if (legacy === 'PRODUCTION' || legacy === 'PROD' || legacy === 'PRODUCTION_STAFF')
        return exports.ROLE_CODES.PRODUCTION;
    if (legacy === 'EXPEDITOR' || legacy === 'DRIVER' || legacy === 'COURIER')
        return exports.ROLE_CODES.EXPEDITOR;
    if (legacy === 'BUYER' || legacy === 'PURCHASER' || legacy === 'PROCUREMENT')
        return exports.ROLE_CODES.BUYER;
    if (legacy === 'ACCOUNTANT' || legacy === 'FINANCE')
        return exports.ROLE_CODES.ACCOUNTANT;
    // Legacy codebase had lower-case adhoc roles in requireRole:
    // 'manager', 'dispatcher' — treat as OPERATOR for fallback.
    if (legacy === 'MANAGER' || legacy === 'DISPATCHER' || legacy === 'USER' || legacy === 'OPERATOR')
        return exports.ROLE_CODES.OPERATOR;
    if (legacy === 'SALES_MANAGER' || legacy === 'SALES')
        return exports.ROLE_CODES.SALES_MANAGER;
    return exports.ROLE_CODES.OPERATOR;
}
/**
 * Fallback permission sets used only when RBAC_FALLBACK=true and user has no UserRole records,
 * or when RBAC join fails and we must preserve current level of access.
 *
 * IMPORTANT: include prices.sales.read for OPERATOR so order creation can resolve prices.
 */
exports.DEFAULT_ROLE_PERMS_FALLBACK = {
    [exports.ROLE_CODES.ADMIN]: ['*'], // Not used (ADMIN bypass), but kept for completeness.
    [exports.ROLE_CODES.OPERATOR]: [
        exports.PERM.ORDERS_READ,
        exports.PERM.ORDERS_CREATE,
        exports.PERM.ORDERS_EDIT,
        exports.PERM.ORDERS_ASSIGN_EXPEDITOR,
        exports.PERM.ORDERS_CHANGE_STATUS,
        exports.PERM.SUMMARY_READ,
        exports.PERM.SUMMARY_CREATE,
        exports.PERM.SUMMARY_SYNC,
        exports.PERM.ASSEMBLY_READ,
        exports.PERM.ASSEMBLY_MANAGE,
        exports.PERM.JOURNALS_READ,
        exports.PERM.JOURNALS_MANAGE,
        exports.PERM.RETURNS_READ,
        exports.PERM.RETURNS_CREATE,
        exports.PERM.PRICES_SALES_READ,
        exports.PERM.IMPORT_EXECUTE,
        exports.PERM.CATALOG_PRODUCTS,
        exports.PERM.CATALOG_CUSTOMERS,
        exports.PERM.REPORTS_READ,
        exports.PERM.TELEGRAM_DRAFTS_READ,
        exports.PERM.TELEGRAM_DRAFTS_MANAGE,
    ],
    [exports.ROLE_CODES.PRODUCTION]: [
        exports.PERM.PRODUCTION_READ,
        exports.PERM.PRODUCTION_CREATE,
        exports.PERM.PRODUCTION_EDIT,
        exports.PERM.PRODUCTION_POST,
        exports.PERM.PRODUCTION_VOID,
        exports.PERM.PRODUCTION_ADJUST,
        exports.PERM.PRODUCTION_CLOSURES,
        exports.PERM.PRODUCTION_DELETE,
        exports.PERM.PRODUCTION_HIDE,
        exports.PERM.MML_READ,
        exports.PERM.MML_MANAGE,
        exports.PERM.MML_LOCK,
        exports.PERM.PURCHASES_READ,
        exports.PERM.CATALOG_PRODUCTS,
        exports.PERM.REPORTS_READ,
    ],
    [exports.ROLE_CODES.EXPEDITOR]: [
        exports.PERM.ORDERS_READ,
        exports.PERM.ORDERS_ASSIGN_EXPEDITOR,
        exports.PERM.EXPEDITION_READ,
        exports.PERM.EXPEDITION_MANAGE,
        exports.PERM.RETURNS_READ,
        exports.PERM.RETURNS_CREATE,
    ],
    [exports.ROLE_CODES.BUYER]: [
        exports.PERM.PURCHASES_READ,
        exports.PERM.PURCHASES_CREATE,
        exports.PERM.PURCHASES_MANAGE,
        exports.PERM.PRICES_PURCHASE_READ,
        exports.PERM.PRICES_PURCHASE_MANAGE,
        exports.PERM.PRICES_SALES_READ,
        exports.PERM.CATALOG_SUPPLIERS,
        exports.PERM.CATALOG_PRODUCTS,
        exports.PERM.SUPPLIER_RETURNS_READ,
        exports.PERM.SUPPLIER_RETURNS_MANAGE,
        exports.PERM.SUPPLIER_PAYMENTS_READ,
        exports.PERM.SUPPLIER_PAYMENTS_MANAGE,
        exports.PERM.SUPPLIER_STATEMENT_READ,
    ],
    [exports.ROLE_CODES.ACCOUNTANT]: [
        exports.PERM.ORDERS_READ,
        exports.PERM.PURCHASES_READ,
        exports.PERM.PRICES_SALES_READ,
        exports.PERM.PRICES_SALES_MANAGE,
        exports.PERM.RETURNS_READ,
        exports.PERM.REPORTS_READ,
        exports.PERM.SUPPLIER_RETURNS_READ,
        exports.PERM.SUPPLIER_PAYMENTS_READ,
        exports.PERM.SUPPLIER_STATEMENT_READ,
        exports.PERM.TELEGRAM_OUTBOX,
        // P2 reserved: admin.audit is not issued by default until AuditLog endpoints exist.
    ],
    [exports.ROLE_CODES.SALES_MANAGER]: [
        exports.PERM.SALES_MANAGER_CUSTOMERS_READ,
        exports.PERM.SALES_MANAGER_DRAFTS_READ,
        exports.PERM.SALES_MANAGER_DRAFTS_ACCEPT,
        exports.PERM.SALES_MANAGER_DRAFTS_REJECT,
        exports.PERM.SALES_MANAGER_DRAFTS_EDIT,
        exports.PERM.SALES_MANAGER_STATEMENT_READ,
        exports.PERM.SALES_MANAGER_STATEMENT_SEND,
        exports.PERM.SALES_MANAGER_REFUNDS_READ,
        exports.PERM.SALES_MANAGER_ADDRESSES_MANAGE,
        exports.PERM.ORDERS_READ,
        exports.PERM.CATALOG_CUSTOMERS,
        exports.PERM.TELEGRAM_DRAFTS_READ,
    ],
};
/**
 * System roles to seed in the database.
 */
exports.SYSTEM_ROLES = [
    { code: exports.ROLE_CODES.ADMIN, name: 'Администратор', isSystem: true },
    { code: exports.ROLE_CODES.OPERATOR, name: 'Оператор', isSystem: true },
    { code: exports.ROLE_CODES.PRODUCTION, name: 'Производство', isSystem: true },
    { code: exports.ROLE_CODES.EXPEDITOR, name: 'Экспедитор', isSystem: true },
    { code: exports.ROLE_CODES.BUYER, name: 'Закупщик', isSystem: true },
    { code: exports.ROLE_CODES.ACCOUNTANT, name: 'Бухгалтер', isSystem: true },
    { code: exports.ROLE_CODES.SALES_MANAGER, name: 'Менеджер по продажам', isSystem: true },
];
/**
 * Default role→permission matrix for seed.
 * Applied only once per role (if role has zero permissions).
 * ADMIN gets ALL permissions automatically — not listed here.
 */
exports.DEFAULT_ROLE_PERMS_SEED = {
    [exports.ROLE_CODES.OPERATOR]: [
        exports.PERM.ORDERS_READ,
        exports.PERM.ORDERS_CREATE,
        exports.PERM.ORDERS_EDIT,
        exports.PERM.ORDERS_ASSIGN_EXPEDITOR,
        exports.PERM.ORDERS_CHANGE_STATUS,
        exports.PERM.SUMMARY_READ,
        exports.PERM.SUMMARY_CREATE,
        exports.PERM.SUMMARY_SYNC,
        exports.PERM.ASSEMBLY_READ,
        exports.PERM.ASSEMBLY_MANAGE,
        exports.PERM.JOURNALS_READ,
        exports.PERM.JOURNALS_MANAGE,
        exports.PERM.RETURNS_READ,
        exports.PERM.RETURNS_CREATE,
        exports.PERM.PRICES_SALES_READ,
        exports.PERM.IMPORT_EXECUTE,
        exports.PERM.CATALOG_PRODUCTS,
        exports.PERM.CATALOG_CUSTOMERS,
        exports.PERM.REPORTS_READ,
        exports.PERM.TELEGRAM_DRAFTS_READ,
        exports.PERM.TELEGRAM_DRAFTS_MANAGE,
    ],
    [exports.ROLE_CODES.PRODUCTION]: [
        exports.PERM.PRODUCTION_READ,
        exports.PERM.PRODUCTION_CREATE,
        exports.PERM.PRODUCTION_EDIT,
        exports.PERM.PRODUCTION_POST,
        exports.PERM.PRODUCTION_VOID,
        exports.PERM.PRODUCTION_ADJUST,
        exports.PERM.PRODUCTION_CLOSURES,
        exports.PERM.PRODUCTION_DELETE,
        exports.PERM.PRODUCTION_HIDE,
        exports.PERM.MML_READ,
        exports.PERM.MML_MANAGE,
        exports.PERM.MML_LOCK,
        exports.PERM.PURCHASES_READ,
        exports.PERM.CATALOG_PRODUCTS,
        exports.PERM.REPORTS_READ,
    ],
    [exports.ROLE_CODES.BUYER]: [
        exports.PERM.PURCHASES_READ,
        exports.PERM.PURCHASES_CREATE,
        exports.PERM.PURCHASES_MANAGE,
        exports.PERM.PRICES_PURCHASE_READ,
        exports.PERM.PRICES_PURCHASE_MANAGE,
        exports.PERM.PRICES_SALES_READ,
        exports.PERM.CATALOG_SUPPLIERS,
        exports.PERM.CATALOG_PRODUCTS,
        exports.PERM.SUPPLIER_RETURNS_READ,
        exports.PERM.SUPPLIER_RETURNS_MANAGE,
        exports.PERM.SUPPLIER_PAYMENTS_READ,
        exports.PERM.SUPPLIER_PAYMENTS_MANAGE,
        exports.PERM.SUPPLIER_STATEMENT_READ,
    ],
    [exports.ROLE_CODES.EXPEDITOR]: [
        exports.PERM.ORDERS_READ,
        exports.PERM.ORDERS_ASSIGN_EXPEDITOR,
        exports.PERM.EXPEDITION_READ,
        exports.PERM.EXPEDITION_MANAGE,
        exports.PERM.RETURNS_READ,
        exports.PERM.RETURNS_CREATE,
    ],
    [exports.ROLE_CODES.ACCOUNTANT]: [
        exports.PERM.ORDERS_READ,
        exports.PERM.PURCHASES_READ,
        exports.PERM.PRICES_SALES_READ,
        exports.PERM.PRICES_SALES_MANAGE,
        exports.PERM.RETURNS_READ,
        exports.PERM.REPORTS_READ,
        exports.PERM.SUPPLIER_RETURNS_READ,
        exports.PERM.SUPPLIER_PAYMENTS_READ,
        exports.PERM.SUPPLIER_STATEMENT_READ,
        exports.PERM.TELEGRAM_OUTBOX,
        // P2 reserved: admin.audit is not issued by default until AuditLog endpoints exist.
    ],
    [exports.ROLE_CODES.SALES_MANAGER]: [
        exports.PERM.SALES_MANAGER_CUSTOMERS_READ,
        exports.PERM.SALES_MANAGER_DRAFTS_READ,
        exports.PERM.SALES_MANAGER_DRAFTS_ACCEPT,
        exports.PERM.SALES_MANAGER_DRAFTS_REJECT,
        exports.PERM.SALES_MANAGER_DRAFTS_EDIT,
        exports.PERM.SALES_MANAGER_STATEMENT_READ,
        exports.PERM.SALES_MANAGER_STATEMENT_SEND,
        exports.PERM.SALES_MANAGER_REFUNDS_READ,
        exports.PERM.SALES_MANAGER_ADDRESSES_MANAGE,
        exports.PERM.ORDERS_READ,
        exports.PERM.CATALOG_CUSTOMERS,
        exports.PERM.TELEGRAM_DRAFTS_READ,
    ],
};
