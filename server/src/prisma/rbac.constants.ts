// ============================================
// RBAC Constants — single source of truth
// ============================================

export const ROLE_CODES = {
    ADMIN: 'ADMIN',
    OPERATOR: 'OPERATOR',
    PRODUCTION: 'PRODUCTION',
    EXPEDITOR: 'EXPEDITOR',
    BUYER: 'BUYER',
    ACCOUNTANT: 'ACCOUNTANT',
} as const;

export const PERM = {
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
} as const;

type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

/**
 * Legacy role string (User.role) -> new Role code mapping for fallback mode.
 * Keep this conservative: unknown values map to OPERATOR.
 */
export function mapLegacyRoleToRoleCode(legacyRoleRaw: string | null | undefined): RoleCode {
    const legacy = (legacyRoleRaw ?? '').trim().toUpperCase();

    if (legacy === 'ADMIN' || legacy === 'ADMINISTRATOR' || legacy === 'SUPERADMIN') return ROLE_CODES.ADMIN;
    if (legacy === 'PRODUCTION' || legacy === 'PROD' || legacy === 'PRODUCTION_STAFF') return ROLE_CODES.PRODUCTION;
    if (legacy === 'EXPEDITOR' || legacy === 'DRIVER' || legacy === 'COURIER') return ROLE_CODES.EXPEDITOR;
    if (legacy === 'BUYER' || legacy === 'PURCHASER' || legacy === 'PROCUREMENT') return ROLE_CODES.BUYER;
    if (legacy === 'ACCOUNTANT' || legacy === 'FINANCE') return ROLE_CODES.ACCOUNTANT;

    // Legacy codebase had lower-case adhoc roles in requireRole:
    // 'manager', 'dispatcher' — treat as OPERATOR for fallback.
    if (legacy === 'MANAGER' || legacy === 'DISPATCHER' || legacy === 'USER' || legacy === 'OPERATOR') return ROLE_CODES.OPERATOR;

    return ROLE_CODES.OPERATOR;
}

/**
 * Fallback permission sets used only when RBAC_FALLBACK=true and user has no UserRole records,
 * or when RBAC join fails and we must preserve current level of access.
 *
 * IMPORTANT: include prices.sales.read for OPERATOR so order creation can resolve prices.
 */
export const DEFAULT_ROLE_PERMS_FALLBACK: Record<RoleCode, string[]> = {
    [ROLE_CODES.ADMIN]: ['*'], // Not used (ADMIN bypass), but kept for completeness.
    [ROLE_CODES.OPERATOR]: [
        PERM.ORDERS_READ,
        PERM.ORDERS_CREATE,
        PERM.ORDERS_EDIT,
        PERM.ORDERS_ASSIGN_EXPEDITOR,
        PERM.ORDERS_CHANGE_STATUS,
        PERM.SUMMARY_READ,
        PERM.SUMMARY_CREATE,
        PERM.SUMMARY_SYNC,
        PERM.ASSEMBLY_READ,
        PERM.ASSEMBLY_MANAGE,
        PERM.JOURNALS_READ,
        PERM.JOURNALS_MANAGE,
        PERM.RETURNS_READ,
        PERM.RETURNS_CREATE,
        PERM.PRICES_SALES_READ,
        PERM.IMPORT_EXECUTE,
        PERM.CATALOG_PRODUCTS,
        PERM.CATALOG_CUSTOMERS,
        PERM.REPORTS_READ,
    ],
    [ROLE_CODES.PRODUCTION]: [
        PERM.PRODUCTION_READ,
        PERM.PRODUCTION_CREATE,
        PERM.PRODUCTION_EDIT,
        PERM.PRODUCTION_POST,
        PERM.PRODUCTION_VOID,
        PERM.PRODUCTION_ADJUST,
        PERM.PRODUCTION_CLOSURES,
        PERM.PRODUCTION_DELETE,
        PERM.PRODUCTION_HIDE,
        PERM.MML_READ,
        PERM.MML_MANAGE,
        PERM.MML_LOCK,
        PERM.PURCHASES_READ,
        PERM.CATALOG_PRODUCTS,
        PERM.REPORTS_READ,
    ],
    [ROLE_CODES.EXPEDITOR]: [
        PERM.ORDERS_READ,
        PERM.ORDERS_ASSIGN_EXPEDITOR,
        PERM.EXPEDITION_READ,
        PERM.EXPEDITION_MANAGE,
        PERM.RETURNS_READ,
        PERM.RETURNS_CREATE,
    ],
    [ROLE_CODES.BUYER]: [
        PERM.PURCHASES_READ,
        PERM.PURCHASES_CREATE,
        PERM.PURCHASES_MANAGE,
        PERM.PRICES_PURCHASE_READ,
        PERM.PRICES_PURCHASE_MANAGE,
        PERM.PRICES_SALES_READ,
        PERM.CATALOG_SUPPLIERS,
        PERM.CATALOG_PRODUCTS,
        PERM.SUPPLIER_RETURNS_READ,
        PERM.SUPPLIER_RETURNS_MANAGE,
        PERM.SUPPLIER_PAYMENTS_READ,
        PERM.SUPPLIER_PAYMENTS_MANAGE,
        PERM.SUPPLIER_STATEMENT_READ,
    ],
    [ROLE_CODES.ACCOUNTANT]: [
        PERM.ORDERS_READ,
        PERM.PURCHASES_READ,
        PERM.PRICES_SALES_READ,
        PERM.PRICES_SALES_MANAGE,
        PERM.RETURNS_READ,
        PERM.REPORTS_READ,
        PERM.SUPPLIER_RETURNS_READ,
        PERM.SUPPLIER_PAYMENTS_READ,
        PERM.SUPPLIER_STATEMENT_READ,
        // P2 reserved: admin.audit is not issued by default until AuditLog endpoints exist.
    ],
};

/**
 * System roles to seed in the database.
 */
export const SYSTEM_ROLES: { code: string; name: string; isSystem: boolean }[] = [
    { code: ROLE_CODES.ADMIN, name: 'Администратор', isSystem: true },
    { code: ROLE_CODES.OPERATOR, name: 'Оператор', isSystem: true },
    { code: ROLE_CODES.PRODUCTION, name: 'Производство', isSystem: true },
    { code: ROLE_CODES.EXPEDITOR, name: 'Экспедитор', isSystem: true },
    { code: ROLE_CODES.BUYER, name: 'Закупщик', isSystem: true },
    { code: ROLE_CODES.ACCOUNTANT, name: 'Бухгалтер', isSystem: true },
];

/**
 * Default role→permission matrix for seed.
 * Applied only once per role (if role has zero permissions).
 * ADMIN gets ALL permissions automatically — not listed here.
 */
export const DEFAULT_ROLE_PERMS_SEED: Record<string, string[]> = {
    [ROLE_CODES.OPERATOR]: [
        PERM.ORDERS_READ,
        PERM.ORDERS_CREATE,
        PERM.ORDERS_EDIT,
        PERM.ORDERS_ASSIGN_EXPEDITOR,
        PERM.ORDERS_CHANGE_STATUS,
        PERM.SUMMARY_READ,
        PERM.SUMMARY_CREATE,
        PERM.SUMMARY_SYNC,
        PERM.ASSEMBLY_READ,
        PERM.ASSEMBLY_MANAGE,
        PERM.JOURNALS_READ,
        PERM.JOURNALS_MANAGE,
        PERM.RETURNS_READ,
        PERM.RETURNS_CREATE,
        PERM.PRICES_SALES_READ,
        PERM.IMPORT_EXECUTE,
        PERM.CATALOG_PRODUCTS,
        PERM.CATALOG_CUSTOMERS,
        PERM.REPORTS_READ,
    ],
    [ROLE_CODES.PRODUCTION]: [
        PERM.PRODUCTION_READ,
        PERM.PRODUCTION_CREATE,
        PERM.PRODUCTION_EDIT,
        PERM.PRODUCTION_POST,
        PERM.PRODUCTION_VOID,
        PERM.PRODUCTION_ADJUST,
        PERM.PRODUCTION_CLOSURES,
        PERM.PRODUCTION_DELETE,
        PERM.PRODUCTION_HIDE,
        PERM.MML_READ,
        PERM.MML_MANAGE,
        PERM.MML_LOCK,
        PERM.PURCHASES_READ,
        PERM.CATALOG_PRODUCTS,
        PERM.REPORTS_READ,
    ],
    [ROLE_CODES.BUYER]: [
        PERM.PURCHASES_READ,
        PERM.PURCHASES_CREATE,
        PERM.PURCHASES_MANAGE,
        PERM.PRICES_PURCHASE_READ,
        PERM.PRICES_PURCHASE_MANAGE,
        PERM.PRICES_SALES_READ,
        PERM.CATALOG_SUPPLIERS,
        PERM.CATALOG_PRODUCTS,
        PERM.SUPPLIER_RETURNS_READ,
        PERM.SUPPLIER_RETURNS_MANAGE,
        PERM.SUPPLIER_PAYMENTS_READ,
        PERM.SUPPLIER_PAYMENTS_MANAGE,
        PERM.SUPPLIER_STATEMENT_READ,
    ],
    [ROLE_CODES.EXPEDITOR]: [
        PERM.ORDERS_READ,
        PERM.ORDERS_ASSIGN_EXPEDITOR,
        PERM.EXPEDITION_READ,
        PERM.EXPEDITION_MANAGE,
        PERM.RETURNS_READ,
        PERM.RETURNS_CREATE,
    ],
    [ROLE_CODES.ACCOUNTANT]: [
        PERM.ORDERS_READ,
        PERM.PURCHASES_READ,
        PERM.PRICES_SALES_READ,
        PERM.PRICES_SALES_MANAGE,
        PERM.RETURNS_READ,
        PERM.REPORTS_READ,
        PERM.SUPPLIER_RETURNS_READ,
        PERM.SUPPLIER_PAYMENTS_READ,
        PERM.SUPPLIER_STATEMENT_READ,
        // P2 reserved: admin.audit is not issued by default until AuditLog endpoints exist.
    ],
};
