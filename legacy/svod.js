(function () {
    const tabsContainer = document.getElementById('tabs'), tableHead = document.getElementById('table-head'), tableBody = document.getElementById('table-body'), emptyState = document.getElementById('empty-state'), btnAutoFill = document.getElementById('btn-auto-fill'), btnClearWeight = document.getElementById('btn-clear-weight'), btnSaveSvod = document.getElementById('btn-save-svod'), svodDateInput = document.getElementById('svod-date-input'), toast = document.getElementById('toast');
    let activeCategory = null;

    // Initialize date to today if not set
    svodDateInput.value = new Date().toISOString().split('T')[0];

    function esc(s) { return s ? String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : '' }
    function showToast(msg, type) { toast.textContent = msg; toast.className = 'toast ' + type; toast.style.display = 'block'; setTimeout(() => toast.style.display = 'none', 3000) }

    function getSvodDate() {
        return svodDateInput.value;
    }

    svodDateInput.addEventListener('change', renderTable);

    function buildSupplierMapping(date) {
        // Use LIVE form data instead of Journal
        const purchases = StorageService.getPurchaseFormSnapshot(date);
        const allProducts = StorageService.getProducts();
        const allProductCodes = allProducts.map(p => p.product_code);

        // Sort by supplier name for consistency
        purchases.sort((a, b) => a.supplier_name.localeCompare(b.supplier_name));

        const mapping = {};
        const missingProducts = [];

        purchases.slice(0, 10).forEach((p, i) => {
            const products = {};
            (p.rows || []).forEach(r => {
                if (r.qty > 0) {
                    // Check if product exists in catalog
                    if (!allProductCodes.includes(r.product_code)) {
                        if (!missingProducts.includes(r.product_code)) {
                            missingProducts.push(r.product_code);
                        }
                    }
                    products[r.product_code] = r.qty;
                }
            });
            mapping[i + 1] = { supplier_id: p.supplier_id, supplier_name: p.supplier_name, products };
        });

        // Show error if products are missing from catalog
        if (missingProducts.length > 0) {
            showToast(`Ошибка: товары не найдены в справочнике: ${missingProducts.join(', ')}`, 'error');
        }

        return mapping;
    }

    function getCategories() {
        const cats = StorageService.getUniqueCategories();
        const order = ['баранина', 'говядина', 'курица'];
        const sorted = [];
        order.forEach(o => { const found = cats.find(c => c.toLowerCase().includes(o)); if (found) sorted.push(found) });
        cats.filter(c => !sorted.includes(c)).sort().forEach(c => sorted.push(c));
        return sorted;
    }

    function renderTabs() {
        const cats = getCategories();
        if (cats.length === 0) { tabsContainer.innerHTML = '<span style="opacity:.5">Нет категорий</span>'; return }
        if (!activeCategory || !cats.includes(activeCategory)) activeCategory = cats[0];
        tabsContainer.innerHTML = '';
        cats.forEach(c => {
            const tab = document.createElement('div');
            tab.className = 'tab' + (c === activeCategory ? ' active' : '');
            tab.textContent = c;
            tab.addEventListener('click', () => { activeCategory = c; renderTabs(); renderTable() });
            tabsContainer.appendChild(tab);
        });
    }

    function renderHeader(supplierMapping, categoryProductCodes, filteredSupplierIndices) {
        let supplierHeaders = '';
        // Only show suppliers that have products in the current category
        filteredSupplierIndices.forEach((i, displayIdx) => {
            const sup = supplierMapping[i];
            const name = sup ? sup.supplier_name : '—';
            supplierHeaders += `<th class="supplier-selected"><div class="header-select" style="font-size:.55rem">${esc(name)}</div><div style="font-size:.5rem;opacity:.5">П${displayIdx + 1}</div></th>`;
        });

        if (filteredSupplierIndices.length === 0) {
            supplierHeaders = '<th style="opacity:.5">Нет поставщиков</th>';
        }

        tableHead.innerHTML = `<tr>
            <th>Утреннее имя</th>
            <th>Заказы</th>
            <th>Остаток начало</th>
            <th>Остаток отгр.</th>
            <th>Производ.</th>
            ${supplierHeaders}
            <th>Кол-во к отгр.</th>
            <th>Факт−отх.</th>
            <th>Вес к отгр.</th>
            <th>%план/факт</th>
            <th>Перебор/ Недобор</th>
            <th>Коэфф.</th>
        </tr>`;
    }

    function renderTable() {
        const date = getSvodDate();
        // svodDateEl.textContent = 'Дата: ' + date; // Removed as we use input now

        const supplierMapping = buildSupplierMapping(date);

        // Get all products to find category product codes
        const products = StorageService.getProducts();
        const categoryProductCodes = products
            .filter(p => p.category === activeCategory)
            .map(p => p.product_code);

        // Filter supplier indices: only those who have purchases in this category
        const filteredSupplierIndices = [];
        for (let i = 1; i <= 10; i++) {
            const sup = supplierMapping[i];
            if (sup) {
                const hasProductInCategory = categoryProductCodes.some(code => sup.products[code] && sup.products[code] > 0);
                if (hasProductInCategory) {
                    filteredSupplierIndices.push(i);
                }
            }
        }

        renderHeader(supplierMapping, categoryProductCodes, filteredSupplierIndices);

        const names = StorageService.getUniqueMorningNames().filter(n => StorageService.getCategoryByMorningName(n) === activeCategory);
        tableBody.innerHTML = ''; emptyState.style.display = names.length === 0 ? 'block' : 'none';

        // Deduplicate visually similar names (handling homoglyphs/spaces)
        const normalize = (s) => {
            if (!s) return '';
            let n = s.toLowerCase().trim();
            // Replace common Cyrillic with Latin lookalikes for grouping
            const map = { 'а': 'a', 'о': 'o', 'е': 'e', 'с': 'c', 'р': 'p', 'х': 'x', 'у': 'y', 'к': 'k', 'м': 'm', 'н': 'h', 'т': 't', 'в': 'b' };
            return n.split('').map(c => map[c] || c).join('');
        };

        const uniqueNamesMap = {}; // key -> { displayName, forms: [] }
        names.forEach(n => {
            const key = normalize(n);
            if (!uniqueNamesMap[key]) uniqueNamesMap[key] = { displayName: n, forms: [] };
            uniqueNamesMap[key].forms.push(n);
        });

        // Render aggregated rows
        Object.values(uniqueNamesMap).sort((a, b) => a.displayName.localeCompare(b.displayName)).forEach(group => {
            const n = group.displayName;
            const forms = group.forms; // All variations

            const rd = StorageService.getSvodRowData(n);
            // Sum order value for ALL forms
            let orderVal = 0;
            forms.forEach(fn => orderVal += StorageService.getOrderSumByMorningName(fn));

            // Find ALL items matching ANY of the forms
            const matchingProducts = products.filter(p => forms.includes(p.short_name_morning));
            const matchingCodes = matchingProducts.map(p => p.product_code);

            const prod = matchingProducts[0];
            const coeff = prod ? parseFloat(prod.coefficient) || 1 : 1;
            const productCode = prod?.product_code || '';

            let supplierSum = 0;
            let supplierCells = '';
            filteredSupplierIndices.forEach((i, displayIdx) => {
                const sup = supplierMapping[i];
                let qty = 0;
                if (sup) {
                    // Sum quantities across ALL matching codes
                    matchingCodes.forEach(code => {
                        if (sup.products[code]) qty += sup.products[code];
                    });
                }
                supplierSum += qty;
                supplierCells += `<td class="cell-num"><div class="cell-input readonly" data-sup="${i}">${qty > 0 ? qty.toFixed(2) : '—'}</div></td>`;
            });

            if (filteredSupplierIndices.length === 0) {
                supplierCells = '<td class="cell-num">—</td>';
            }

            const openingStock = parseFloat(rd.opening_stock) || 0;
            const stockForShip = parseFloat(rd.stock_for_shipment) || 0;
            const production = parseFloat(rd.production) || 0;
            const qtyToShip = openingStock + stockForShip + supplierSum;
            const factMinusWaste = qtyToShip * coeff;
            const weightToShip = parseFloat(rd.weight_to_ship) || 0;
            const planFactDiff = orderVal > 0 ? ((weightToShip / orderVal) * 100) : 0;
            const overUnder = weightToShip - orderVal;

            const tr = document.createElement('tr'); tr.dataset.name = n; tr.dataset.code = productCode;
            tr.innerHTML = `<td>${esc(n)}</td>
                <td class="cell-num ${orderVal > 0 ? 'order-positive' : ''}"><div class="cell-input readonly order-val">${orderVal.toFixed(2)}</div></td>
                <td class="cell-num"><input type="number" class="cell-input" data-field="opening_stock" value="${openingStock}" step="0.01"></td>
                <td class="cell-num"><input type="number" class="cell-input" data-field="stock_for_shipment" value="${stockForShip}" step="0.01"></td>
                <td class="cell-num"><input type="number" class="cell-input" data-field="production" value="${production}" step="0.01"></td>
                ${supplierCells}
                <td class="cell-num"><div class="cell-input readonly qty-to-ship">${qtyToShip.toFixed(2)}</div></td>
                <td class="cell-num"><div class="cell-input readonly fact-minus-waste">${factMinusWaste.toFixed(2)}</div></td>
                <td class="cell-num"><input type="number" class="cell-input weight-to-ship" data-field="weight_to_ship" value="${weightToShip}" step="0.01"></td>
                <td class="cell-num"><div class="cell-input readonly plan-fact-diff">${planFactDiff.toFixed(1)}%</div></td>
                <td class="cell-num"><div class="cell-input readonly over-under" style="color:${overUnder >= 0 ? 'var(--success)' : 'var(--danger)'}">${overUnder >= 0 ? '+' : ''}${overUnder.toFixed(2)}</div></td>
                <td class="cell-num"><div class="cell-input readonly">${coeff.toFixed(2)}</div></td>`;
            tableBody.appendChild(tr);
        });
        attachListeners(supplierMapping, filteredSupplierIndices);
        updateDashboard();
    }

    function attachListeners(supplierMapping, filteredSupplierIndices) {
        // Helper to normalize for matching
        const normalize = (s) => {
            if (!s) return '';
            let n = s.toLowerCase().trim();
            const map = { 'а': 'a', 'о': 'o', 'е': 'e', 'с': 'c', 'р': 'p', 'х': 'x', 'у': 'y', 'к': 'k', 'м': 'm', 'н': 'h', 'т': 't', 'в': 'b' };
            return n.split('').map(c => map[c] || c).join('');
        };

        tableBody.querySelectorAll('tr').forEach(tr => {
            const name = tr.dataset.name;
            const normalizedKEY = normalize(name);
            const allProducts = StorageService.getProducts();

            // Find ALL items matching this normalized key (rebuilding context)
            const matchingProducts = allProducts.filter(p => normalize(p.short_name_morning) === normalizedKEY);
            const matchingCodes = matchingProducts.map(p => p.product_code);
            const coeff = matchingProducts[0] ? parseFloat(matchingProducts[0].coefficient) || 1 : 1;

            const allNames = StorageService.getUniqueMorningNames();
            const forms = allNames.filter(n => normalize(n) === normalizedKEY);
            let orderVal = 0;
            forms.forEach(fn => orderVal += StorageService.getOrderSumByMorningName(fn));

            let supplierSum = 0;
            filteredSupplierIndices.forEach(i => {
                const sup = supplierMapping[i];
                if (sup) {
                    matchingCodes.forEach(c => {
                        if (sup.products[c]) supplierSum += sup.products[c];
                    });
                }
            });

            tr.querySelectorAll('.cell-input').forEach(inp => {
                if (inp.tagName === 'DIV') return;
                inp.addEventListener('change', () => saveRow(tr, name));
                inp.addEventListener('input', () => recalcRow(tr, coeff, orderVal, supplierSum));
            });
        });
    }

    function recalcRow(tr, coeff, orderVal, supplierSum) {
        const openingStock = parseFloat(tr.querySelector('[data-field="opening_stock"]')?.value) || 0;
        const stockForShip = parseFloat(tr.querySelector('[data-field="stock_for_shipment"]')?.value) || 0;
        // Production does NOT participate in formulas
        const qtyToShip = openingStock + stockForShip + supplierSum;
        const factMinusWaste = qtyToShip * coeff;
        const weightToShip = parseFloat(tr.querySelector('[data-field="weight_to_ship"]')?.value) || 0;
        const planFactDiff = orderVal > 0 ? ((weightToShip / orderVal) * 100) : 0;
        const overUnder = weightToShip - orderVal;

        tr.querySelector('.qty-to-ship').textContent = qtyToShip.toFixed(2);
        tr.querySelector('.fact-minus-waste').textContent = factMinusWaste.toFixed(2);
        tr.querySelector('.plan-fact-diff').textContent = planFactDiff.toFixed(1) + '%';
        const ouCell = tr.querySelector('.over-under');
        ouCell.textContent = (overUnder >= 0 ? '+' : '') + overUnder.toFixed(2);
        ouCell.style.color = overUnder >= 0 ? 'var(--success)' : 'var(--danger)';
    }

    function saveRow(tr, name) {
        const d = {};
        tr.querySelectorAll('[data-field]').forEach(el => {
            const f = el.dataset.field, v = el.value;
            d[f] = parseFloat(v) || 0;
        });
        StorageService.saveSvodRowData(name, d);
    }

    btnAutoFill.addEventListener('click', function () {
        tableBody.querySelectorAll('tr').forEach(tr => {
            const qtyCell = tr.querySelector('.qty-to-ship');
            const weightInput = tr.querySelector('[data-field="weight_to_ship"]');
            if (qtyCell && weightInput) {
                weightInput.value = qtyCell.textContent;
                weightInput.dispatchEvent(new Event('input'));
                weightInput.dispatchEvent(new Event('change'));
            }
        });
        showToast('Вес заполнен', 'success');
    });

    btnClearWeight.addEventListener('click', function () {
        tableBody.querySelectorAll('tr').forEach(tr => {
            const weightInput = tr.querySelector('[data-field="weight_to_ship"]');
            if (weightInput) {
                weightInput.value = 0;
                weightInput.dispatchEvent(new Event('input'));
                weightInput.dispatchEvent(new Event('change'));
            }
        });
        showToast('Вес очищен', 'success');
    });

    btnSaveSvod.addEventListener('click', function () {
        const date = getSvodDate();
        const rows = [];
        tableBody.querySelectorAll('tr').forEach(tr => {
            const name = tr.dataset.name;
            const orderVal = parseFloat(tr.querySelector('.order-val')?.textContent) || 0;
            const qtyToShip = parseFloat(tr.querySelector('.qty-to-ship')?.textContent) || 0;
            const weightToShip = parseFloat(tr.querySelector('[data-field="weight_to_ship"]')?.value) || 0;
            const production = parseFloat(tr.querySelector('[data-field="production"]')?.value) || 0;
            rows.push({ name, order_val: orderVal, qty_to_ship: qtyToShip, weight_to_ship: weightToShip, production });
        });

        const snapshot = { date, category: activeCategory, created_at: new Date().toISOString(), rows };

        let journal = JSON.parse(localStorage.getItem('erp_journal_svod') || '[]');
        journal = journal.filter(j => !(j.date === date && j.category === activeCategory));
        journal.push(snapshot);
        localStorage.setItem('erp_journal_svod', JSON.stringify(journal));

        showToast(`Свод за ${date} сохранён: ${rows.length} позиций`, 'success');
    });

    function updateDashboard() {
        let total = 0;
        tableBody.querySelectorAll('tr').forEach(tr => {
            // Sum the displayed order value from the table
            const val = parseFloat(tr.querySelector('.order-val')?.textContent) || 0;
            total += val;
        });
        const dashEl = document.getElementById('dashboard-total-orders');
        if (dashEl) dashEl.textContent = total.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    renderTabs();
    renderTable();
    updateDashboard(); // Initial update
    window.addEventListener('productsUpdated', () => { renderTabs(); renderTable(); updateDashboard(); });
    window.addEventListener('purchasesUpdated', () => { renderTable(); updateDashboard(); });

    // Also listen for storage changes from other tabs/windows
    window.addEventListener('storage', (e) => {
        if (e.key === 'erp_purchase_data') {
            renderTable();
            updateDashboard();
        }
    });
})();
