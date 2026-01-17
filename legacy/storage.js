/**
 * StorageService — ERP v14
 */
const StorageService = {
    KEYS: {
        PRODUCTS: 'erp_products_v7',
        SUPPLIERS: 'erp_suppliers_v7',
        CUSTOMERS: 'erp_customers_v7',
        DISTRICTS: 'erp_districts_v7',
        EXPEDITORS: 'erp_expeditors_v7',
        MANAGERS: 'erp_managers_v7',
        ORDERS: 'erp_orders_v7',
        PURCHASE_DATA: 'erp_purchase_data',
        PURCHASES: 'erp_purchases_v7',
        SVOD: 'erp_svod_v7',
        JOURNAL_ORDERS: 'erp_journal_orders_v7',
        JOURNAL_SHIPMENTS: 'erp_journal_shipments_v7',
        JOURNAL_PURCHASES: 'erp_journal_purchases_v7',
        JOURNAL_SVOD: 'erp_journal_svod_v7',
        JOURNAL_PRICELISTS: 'erp_journal_pricelists_v7',
        JOURNAL_SHIPMENT_PRICELISTS: 'erp_journal_shipment_pricelists_v7',
        USERS: 'erp_users_v7',
        CALCULATIONS: 'erp_meat_calc_v7',
        CURRENT_USER: 'erp_current_user'
    },

    // ===== PRODUCTS =====
    getProducts() { return JSON.parse(localStorage.getItem(this.KEYS.PRODUCTS) || '[]'); },
    saveProducts(d) { localStorage.setItem(this.KEYS.PRODUCTS, JSON.stringify(d)); window.dispatchEvent(new CustomEvent('productsUpdated')); },
    upsertProducts(items) {
        const ex = this.getProducts(); let a = 0, u = 0, e = 0;
        items.forEach(i => { if (!i.product_code) { e++; return; } const idx = ex.findIndex(p => p.product_code === i.product_code); if (idx >= 0) { ex[idx] = { ...ex[idx], ...i }; u++; } else { ex.push(i); a++; } });
        this.saveProducts(ex); return { added: a, updated: u, errors: e };
    },
    deleteProducts(codes) { this.saveProducts(this.getProducts().filter(p => !codes.includes(p.product_code))); },
    getProductByCode(c) { return this.getProducts().find(p => p.product_code === c) || null; },
    getUniqueMorningNames() { const s = new Set(); this.getProducts().forEach(p => { if (p.short_name_morning?.trim()) s.add(p.short_name_morning.trim()) }); return Array.from(s).sort(); },
    getUniqueCategories() { const s = new Set(); this.getProducts().forEach(p => { if (p.category?.trim()) s.add(p.category.trim()) }); return Array.from(s); },
    getCategoryByMorningName(n) { const p = this.getProducts().find(x => x.short_name_morning === n); return p ? (p.category || '') : ''; },

    // ===== SUPPLIERS =====
    getSuppliers() { return JSON.parse(localStorage.getItem(this.KEYS.SUPPLIERS) || '[]'); },
    saveSuppliers(d) { localStorage.setItem(this.KEYS.SUPPLIERS, JSON.stringify(d)); },
    upsertSuppliers(items) { const ex = this.getSuppliers(); let a = 0, u = 0, e = 0; items.forEach(i => { if (!i.supplier_id) { e++; return; } const idx = ex.findIndex(s => String(s.supplier_id) === String(i.supplier_id)); if (idx >= 0) { ex[idx] = { ...ex[idx], ...i }; u++; } else { ex.push(i); a++; } }); this.saveSuppliers(ex); return { added: a, updated: u, errors: e }; },
    deleteSuppliers(ids) { this.saveSuppliers(this.getSuppliers().filter(s => !ids.includes(String(s.supplier_id)))); },

    // ===== SUPPLIER MML (Minimum Must List) =====
    _getMMLData() { return JSON.parse(localStorage.getItem('erp_supplier_mml_v7') || '{}'); },
    _saveMMLData(d) { localStorage.setItem('erp_supplier_mml_v7', JSON.stringify(d)); },
    getSupplierMML(supplierId) { return this._getMMLData()[String(supplierId)] || []; },
    saveSupplierMML(supplierId, productCodes) { const d = this._getMMLData(); d[String(supplierId)] = productCodes; this._saveMMLData(d); },
    addProductToMML(supplierId, productCode) { const mml = this.getSupplierMML(supplierId); if (!mml.includes(productCode)) { mml.push(productCode); this.saveSupplierMML(supplierId, mml); } },
    removeProductFromMML(supplierId, productCode) { const mml = this.getSupplierMML(supplierId).filter(c => c !== productCode); this.saveSupplierMML(supplierId, mml); },

    // ===== CUSTOMERS =====
    getCustomers() { return JSON.parse(localStorage.getItem(this.KEYS.CUSTOMERS) || '[]'); },
    saveCustomers(d) { localStorage.setItem(this.KEYS.CUSTOMERS, JSON.stringify(d)); },
    upsertCustomers(items) { const ex = this.getCustomers(); let a = 0, u = 0, e = 0; items.forEach(i => { if (!i.customer_id) { e++; return; } const idx = ex.findIndex(c => String(c.customer_id) === String(i.customer_id)); if (idx >= 0) { ex[idx] = { ...ex[idx], ...i }; u++; } else { ex.push(i); a++; } }); this.saveCustomers(ex); return { added: a, updated: u, errors: e }; },
    deleteCustomers(ids) { this.saveCustomers(this.getCustomers().filter(c => !ids.includes(String(c.customer_id)))); },

    // ===== DISTRICTS =====
    getDistricts() { return JSON.parse(localStorage.getItem(this.KEYS.DISTRICTS) || '[]'); },
    saveDistricts(d) { localStorage.setItem(this.KEYS.DISTRICTS, JSON.stringify(d)); },
    upsertDistricts(items) { const ex = this.getDistricts(); let a = 0, u = 0, e = 0; items.forEach(i => { if (!i.district_id) { e++; return; } const idx = ex.findIndex(x => String(x.district_id) === String(i.district_id)); if (idx >= 0) { ex[idx] = { ...ex[idx], ...i }; u++; } else { ex.push(i); a++; } }); this.saveDistricts(ex); return { added: a, updated: u, errors: e }; },
    deleteDistricts(ids) { this.saveDistricts(this.getDistricts().filter(x => !ids.includes(String(x.district_id)))); },

    // ===== EXPEDITORS =====
    getExpeditors() { return JSON.parse(localStorage.getItem(this.KEYS.EXPEDITORS) || '[]'); },
    saveExpeditors(d) { localStorage.setItem(this.KEYS.EXPEDITORS, JSON.stringify(d)); },
    upsertExpeditors(items) { const ex = this.getExpeditors(); let a = 0, u = 0, e = 0; items.forEach(i => { if (!i.expeditor_number) { e++; return; } const idx = ex.findIndex(x => String(x.expeditor_number) === String(i.expeditor_number)); if (idx >= 0) { ex[idx] = { ...ex[idx], ...i }; u++; } else { ex.push(i); a++; } }); this.saveExpeditors(ex); return { added: a, updated: u, errors: e }; },
    deleteExpeditors(ids) { this.saveExpeditors(this.getExpeditors().filter(x => !ids.includes(String(x.expeditor_number)))); },

    // ===== MANAGERS (Sales) =====
    getManagers() { return JSON.parse(localStorage.getItem(this.KEYS.MANAGERS) || '[]'); },
    saveManagers(d) { localStorage.setItem(this.KEYS.MANAGERS, JSON.stringify(d)); },
    upsertManagers(items) { const ex = this.getManagers(); let a = 0, u = 0, e = 0; items.forEach(i => { if (!i.manager_id) { e++; return; } const idx = ex.findIndex(x => String(x.manager_id) === String(i.manager_id)); if (idx >= 0) { ex[idx] = { ...ex[idx], ...i }; u++; } else { ex.push(i); a++; } }); this.saveManagers(ex); return { added: a, updated: u, errors: e }; },
    deleteManagers(ids) { this.saveManagers(this.getManagers().filter(x => !ids.includes(String(x.manager_id)))); },

    // ===== CALCULATIONS =====
    getCalculations() { return JSON.parse(localStorage.getItem(this.KEYS.CALCULATIONS) || '[]'); },
    saveCalculations(d) { localStorage.setItem(this.KEYS.CALCULATIONS, JSON.stringify(d)); },
    addCalculation(c) { const cs = this.getCalculations(); c.id = cs.length > 0 ? Math.max(...cs.map(x => x.id)) + 1 : 1; cs.push(c); this.saveCalculations(cs); return c; },
    updateCalculation(id, u) { const cs = this.getCalculations(); const idx = cs.findIndex(x => x.id === id); if (idx >= 0) { cs[idx] = { ...cs[idx], ...u }; this.saveCalculations(cs); } },
    deleteCalculations(ids) { this.saveCalculations(this.getCalculations().filter(x => !ids.includes(x.id))); },

    // ===== ORDERS =====
    getOrders() { return JSON.parse(localStorage.getItem(this.KEYS.ORDERS) || '[]'); },
    saveOrders(d) { localStorage.setItem(this.KEYS.ORDERS, JSON.stringify(d)); window.dispatchEvent(new CustomEvent('ordersUpdated')); },
    addOrder(o) { const os = this.getOrders(); o.id = os.length > 0 ? Math.max(...os.map(x => x.id)) + 1 : 1; o.processed = false; os.push(o); this.saveOrders(os); return o; },
    updateOrder(id, u) { const os = this.getOrders(); const idx = os.findIndex(x => x.id === id); if (idx >= 0) { os[idx] = { ...os[idx], ...u }; this.saveOrders(os); } },
    deleteOrders(ids) { this.saveOrders(this.getOrders().filter(o => !ids.includes(o.id))); },
    getProcessedOrders() { return this.getOrders().filter(o => o.processed === true); },
    getOrdersByCategory() { const os = this.getOrders(), ps = this.getProducts(), r = { beef: 0, lamb: 0, chicken: 0, other: 0 }; os.forEach(o => { const p = ps.find(x => x.product_code === o.product_code); const c = (p?.category || '').toLowerCase(); const v = parseFloat(o.order_value) || 0; if (c.includes('говядин')) r.beef += v; else if (c.includes('баранин')) r.lamb += v; else if (c.includes('курица') || c.includes('куриц')) r.chicken += v; else r.other += v; }); return r; },

    // ===== PURCHASES =====
    getPurchases() { return JSON.parse(localStorage.getItem(this.KEYS.PURCHASES) || '[]'); },
    savePurchases(d) { localStorage.setItem(this.KEYS.PURCHASES, JSON.stringify(d)); },
    addPurchase(p) { const ps = this.getPurchases(); p.id = ps.length > 0 ? Math.max(...ps.map(x => x.id)) + 1 : 1; ps.push(p); this.savePurchases(ps); return p; },
    updatePurchase(id, u) { const ps = this.getPurchases(); const idx = ps.findIndex(x => x.id === id); if (idx >= 0) { ps[idx] = { ...ps[idx], ...u }; this.savePurchases(ps); } },
    deletePurchases(ids) { this.savePurchases(this.getPurchases().filter(p => !ids.includes(p.id))); },

    // Get live purchase form data for a specific date (aggregating across suppliers)
    getPurchaseFormSnapshot(date) {
        const rawData = JSON.parse(localStorage.getItem(this.KEYS.PURCHASE_DATA) || '{}');
        const allSuppliers = this.getSuppliers();
        const result = []; // Array of objects { supplier_id, supplier_name, rows: [{product_code, qty...}] }

        // rawData keys are like "sup_123_2023-10-27"
        Object.keys(rawData).forEach(key => {
            if (key.endsWith('_' + date)) {
                const supplierId = key.replace('_' + date, '');
                const supplier = allSuppliers.find(s => String(s.supplier_id) === String(supplierId));
                const supplierName = supplier ? supplier.supplier_name : 'Unknown';

                const products = rawData[key]; // Object { code: { qty, price... } }
                const rows = Object.entries(products).map(([code, data]) => ({
                    product_code: code,
                    qty: parseFloat(data.qty) || 0
                })).filter(r => r.qty > 0);

                if (rows.length > 0) {
                    result.push({
                        supplier_id: supplierId,
                        supplier_name: supplierName,
                        rows: rows
                    });
                }
            }
        });
        return result;
    },

    // ===== JOURNAL ORDERS (ARCHIVE with OrderJournalRows) =====
    getJournalOrders() { return JSON.parse(localStorage.getItem(this.KEYS.JOURNAL_ORDERS) || '[]'); },
    saveJournalOrders(d) { localStorage.setItem(this.KEYS.JOURNAL_ORDERS, JSON.stringify(d)); },
    snapshotOrdersToJournal(date, orders) {
        // Save entire displayed table as snapshot
        const ordersToSave = orders || this.getOrders().filter(o => o.shipment_date === date);
        const snapshot = {
            date,
            created_at: new Date().toISOString(),
            orders: JSON.parse(JSON.stringify(ordersToSave)),
            total_weight: ordersToSave.reduce((s, o) => s + (parseFloat(o.shipped_fact) || 0), 0),
            total_sum: ordersToSave.reduce((s, o) => s + (parseFloat(o.order_sum) || 0), 0)
        };
        const journal = this.getJournalOrders().filter(j => j.date !== date);
        journal.push(snapshot);
        this.saveJournalOrders(journal);
        return snapshot;
    },
    updateJournalOrdersRows(date, rows) {
        const journal = this.getJournalOrders();
        const idx = journal.findIndex(j => j.date === date);
        if (idx >= 0) {
            journal[idx].orders = rows;
            journal[idx].total_weight = rows.reduce((s, o) => s + (parseFloat(o.shipped_fact) || 0), 0);
            journal[idx].total_sum = rows.reduce((s, o) => s + (parseFloat(o.order_sum) || 0), 0);
            this.saveJournalOrders(journal);
        }
    },
    deleteJournalOrdersByDates(dates) { this.saveJournalOrders(this.getJournalOrders().filter(j => !dates.includes(j.date))); },

    // ===== JOURNAL SHIPMENTS (ARCHIVE with ShipmentJournalRows) =====
    getJournalShipments() { return JSON.parse(localStorage.getItem(this.KEYS.JOURNAL_SHIPMENTS) || '[]'); },
    saveJournalShipments(d) { localStorage.setItem(this.KEYS.JOURNAL_SHIPMENTS, JSON.stringify(d)); },
    snapshotShipmentsToJournal(date) {
        const processed = this.getProcessedOrders().filter(o => o.shipment_date === date);
        const uniqueCustomers = new Set(processed.map(o => o.customer_id)).size;
        const snapshot = {
            date,
            created_at: new Date().toISOString(),
            shipments: JSON.parse(JSON.stringify(processed)),
            total_customers: uniqueCustomers,
            total_sum: processed.reduce((s, o) => s + (parseFloat(o.order_sum) || 0), 0),
            total_count: processed.length
        };
        const journal = this.getJournalShipments().filter(j => j.date !== date);
        journal.push(snapshot);
        this.saveJournalShipments(journal);
        return snapshot;
    },
    updateJournalShipmentsRows(date, rows) {
        const journal = this.getJournalShipments();
        const idx = journal.findIndex(j => j.date === date);
        if (idx >= 0) {
            journal[idx].shipments = rows;
            journal[idx].total_customers = new Set(rows.map(o => o.customer_id)).size;
            journal[idx].total_sum = rows.reduce((s, o) => s + (parseFloat(o.order_sum) || 0), 0);
            journal[idx].total_count = rows.length;
            this.saveJournalShipments(journal);
        }
    },
    deleteJournalShipmentsByDates(dates) { this.saveJournalShipments(this.getJournalShipments().filter(j => !dates.includes(j.date))); },

    // ===== SVOD =====
    getSvodData() { return JSON.parse(localStorage.getItem(this.KEYS.SVOD) || '{}'); },
    saveSvodData(d) { localStorage.setItem(this.KEYS.SVOD, JSON.stringify(d)); },
    getSvodRowData(n) { return this.getSvodData()[n] || this.getDefaultSvodRow(); },
    saveSvodRowData(n, d) { const s = this.getSvodData(); s[n] = d; this.saveSvodData(s); },
    getDefaultSvodRow() { const r = { opening_stock_fact: 0, stock_after_purchase: 0, stock_for_shipment: 0, production_incoming: 0, weight_to_ship: 0 }; for (let i = 1; i <= 5; i++) { r[`supplier_${i}_id`] = ''; r[`supplier_${i}_qty`] = 0; } return r; },
    getPlanFactDiff(n) { const rd = this.getSvodRowData(n), ov = this.getOrderSumByMorningName(n), sw = parseFloat(rd.weight_to_ship) || 0; return ov > 0 ? (sw / ov) : 0; },
    getOrderSumByMorningName(n) { const os = this.getOrders(), ps = this.getProducts(); let t = 0; os.forEach(o => { const p = ps.find(x => x.product_code === o.product_code); if (p && p.short_name_morning === n) t += parseFloat(o.order_value) || 0; }); return t; },
    getSvodByCategory() { const names = this.getUniqueMorningNames(), r = { beef: 0, lamb: 0, chicken: 0, other: 0 }; names.forEach(n => { const c = this.getCategoryByMorningName(n).toLowerCase(); const rd = this.getSvodRowData(n); let sum = 0; for (let i = 1; i <= 5; i++) sum += parseFloat(rd[`supplier_${i}_qty`]) || 0; const total = (parseFloat(rd.opening_stock_fact) || 0) + (parseFloat(rd.stock_for_shipment) || 0) + sum; if (c.includes('говядин')) r.beef += total; else if (c.includes('баранин')) r.lamb += total; else if (c.includes('курица') || c.includes('куриц')) r.chicken += total; else r.other += total; }); return r; },

    // ===== JOURNAL PRICELISTS =====
    getJournalPricelists() { return JSON.parse(localStorage.getItem(this.KEYS.JOURNAL_PRICELISTS) || '[]'); },
    saveJournalPricelists(d) { localStorage.setItem(this.KEYS.JOURNAL_PRICELISTS, JSON.stringify(d)); },
    snapshotPricelistToJournal(date, supplierId, supplierName, prices) {
        const snapshot = {
            id: Date.now(),
            date,
            supplier_id: supplierId,
            supplier_name: supplierName,
            created_at: new Date().toISOString(),
            prices: JSON.parse(JSON.stringify(prices)),
            total_items: prices.length
        };
        const journal = this.getJournalPricelists();
        journal.push(snapshot);
        this.saveJournalPricelists(journal);
        return snapshot;
    },
    deleteJournalPricelistsByIds(ids) { this.saveJournalPricelists(this.getJournalPricelists().filter(j => !ids.includes(j.id))); },
    // Get price from pricelist: finds latest pricelist where date <= purchaseDate
    getPriceFromPricelist(supplierId, productCode, purchaseDate) {
        const journal = this.getJournalPricelists()
            .filter(p => String(p.supplier_id) === String(supplierId) && p.date <= purchaseDate)
            .sort((a, b) => b.date.localeCompare(a.date));
        if (journal.length === 0) return null;
        const latestPricelist = journal[0];
        const priceEntry = latestPricelist.prices.find(p => p.product_code === productCode);
        return priceEntry ? parseFloat(priceEntry.price) || 0 : null;
    },

    // ===== JOURNAL SVOD =====
    getJournalSvod() { return JSON.parse(localStorage.getItem(this.KEYS.JOURNAL_SVOD) || '[]'); },
    saveJournalSvod(d) { localStorage.setItem(this.KEYS.JOURNAL_SVOD, JSON.stringify(d)); },
    snapshotSvodToJournal(date, svodData) {
        const snapshot = {
            id: Date.now(),
            date,
            created_at: new Date().toISOString(),
            data: JSON.parse(JSON.stringify(svodData))
        };
        const journal = this.getJournalSvod().filter(j => j.date !== date);
        journal.push(snapshot);
        this.saveJournalSvod(journal);
        return snapshot;
    },
    deleteJournalSvodByDates(dates) { this.saveJournalSvod(this.getJournalSvod().filter(j => !dates.includes(j.date))); },
    getSvodSnapshotByDate(date) { return this.getJournalSvod().find(j => j.date === date) || null; },

    // ===== JOURNAL PURCHASES =====
    getJournalPurchases() { return JSON.parse(localStorage.getItem(this.KEYS.JOURNAL_PURCHASES) || '[]'); },
    saveJournalPurchases(d) { localStorage.setItem(this.KEYS.JOURNAL_PURCHASES, JSON.stringify(d)); },
    snapshotPurchasesToJournal(date, supplierId, supplierName, rows) {
        const snapshot = {
            id: Date.now(),
            date,
            supplier_id: supplierId,
            supplier_name: supplierName,
            created_at: new Date().toISOString(),
            rows: JSON.parse(JSON.stringify(rows)),
            total_weight: rows.reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0),
            total_sum: rows.reduce((s, r) => s + (parseFloat(r.sum) || 0), 0)
        };
        const journal = this.getJournalPurchases();
        journal.push(snapshot);
        this.saveJournalPurchases(journal);
        return snapshot;
    },
    deleteJournalPurchasesByIds(ids) { this.saveJournalPurchases(this.getJournalPurchases().filter(j => !ids.includes(j.id))); },

    // ===== JOURNAL SHIPMENT PRICELISTS =====
    getJournalShipmentPricelists() { return JSON.parse(localStorage.getItem(this.KEYS.JOURNAL_SHIPMENT_PRICELISTS) || '[]'); },
    saveJournalShipmentPricelists(d) { localStorage.setItem(this.KEYS.JOURNAL_SHIPMENT_PRICELISTS, JSON.stringify(d)); },
    snapshotShipmentPricelistToJournal(date, columns, rows) {
        const snapshot = {
            id: Date.now(),
            date,
            created_at: new Date().toISOString(),
            columns: JSON.parse(JSON.stringify(columns)), // Array of 10 supplier UUIDs (or empty strings)
            rows: JSON.parse(JSON.stringify(rows)) // Data object { product_code: { col1: price, col2: price... } }
        };
        const journal = this.getJournalShipmentPricelists();
        journal.push(snapshot);
        this.saveJournalShipmentPricelists(journal);
        return snapshot;
    },
    deleteJournalShipmentPricelistsByIds(ids) { this.saveJournalShipmentPricelists(this.getJournalShipmentPricelists().filter(j => !ids.includes(j.id))); },

    // ===== PRODUCTION =====
    _getProductionData() { return JSON.parse(localStorage.getItem('erp_production_v7') || '{}'); },
    _saveProductionData(d) { localStorage.setItem('erp_production_v7', JSON.stringify(d)); },
    saveProduction(date, data) { const pd = this._getProductionData(); pd[date] = data; this._saveProductionData(pd); },
    getProduction(date) { return this._getProductionData()[date] || null; },

    // Get Svod data for a specific date from journal or calculate from orders
    getSvod(date) {
        // First check journal
        const journalEntry = this.getSvodSnapshotByDate(date);
        if (journalEntry && journalEntry.data) {
            // Convert svod data object to array of products with orders
            const products = this.getProducts();
            const morningNames = Object.keys(journalEntry.data);
            return morningNames.map(name => {
                const product = products.find(p => p.short_name_morning === name);
                const svodRow = journalEntry.data[name] || {};
                return {
                    product_code: product ? product.product_code : name,
                    short_name_morning: name,
                    orders: svodRow.orders || 0
                };
            }).filter(row => row.orders > 0);
        }

        // Fallback: calculate from orders for this date
        const orders = this.getOrders().filter(o => o.shipment_date === date);
        const products = this.getProducts();

        // Aggregate orders by product_code
        const aggregated = {};
        orders.forEach(o => {
            const code = o.product_code;
            if (!aggregated[code]) {
                aggregated[code] = { product_code: code, orders: 0 };
            }
            aggregated[code].orders += parseFloat(o.order_value) || 0;
        });

        return Object.values(aggregated);
    },

    // ===== USERS =====
    getUsers() { const d = localStorage.getItem(this.KEYS.USERS); if (!d) { const def = [{ id: 1, username: 'admin', password: this.hashPassword('admin'), role: 'admin', active: true }]; this.saveUsers(def); return def; } return JSON.parse(d); },
    saveUsers(d) { localStorage.setItem(this.KEYS.USERS, JSON.stringify(d)); },
    hashPassword(p) { let h = 0; for (let i = 0; i < p.length; i++) { h = ((h << 5) - h) + p.charCodeAt(i); h = h & h; } return h.toString(16); },
    addUser(u) { const us = this.getUsers(); u.id = us.length > 0 ? Math.max(...us.map(x => x.id)) + 1 : 1; u.password = this.hashPassword(u.password); us.push(u); this.saveUsers(us); return u; },
    updateUser(id, u) { const us = this.getUsers(); const idx = us.findIndex(x => x.id === id); if (idx >= 0) { if (u.password) u.password = this.hashPassword(u.password); us[idx] = { ...us[idx], ...u }; this.saveUsers(us); } },
    deleteUsers(ids) { this.saveUsers(this.getUsers().filter(x => !ids.includes(x.id))); },
    login(un, pw) { const us = this.getUsers(), h = this.hashPassword(pw), u = us.find(x => x.username === un && x.password === h && x.active); if (u) { localStorage.setItem(this.KEYS.CURRENT_USER, JSON.stringify({ id: u.id, username: u.username, role: u.role })); return u; } return null; },
    logout() { localStorage.removeItem(this.KEYS.CURRENT_USER); },
    getCurrentUser() { return JSON.parse(localStorage.getItem(this.KEYS.CURRENT_USER) || 'null'); },
    isAdmin() { const u = this.getCurrentUser(); return u && u.role === 'admin'; }
};
