(function () {
    const purchaseDate = document.getElementById('purchase-date'),
        btnSuppliers = document.getElementById('btn-suppliers'),
        btnSave = document.getElementById('btn-save'),
        btnSavePrice = document.getElementById('btn-save-price'),
        suppliersPanel = document.getElementById('suppliers-panel'),
        tableArea = document.getElementById('table-area'),
        suppliersModal = document.getElementById('suppliers-modal'),
        allSuppliersList = document.getElementById('all-suppliers-list'),
        newSupplierName = document.getElementById('new-supplier-name'),
        toast = document.getElementById('toast'),
        categoryTabs = document.getElementById('category-tabs');

    let activeTab = 'purchases', activeCategory = '', selectedSupplier = null, addedSuppliers = [], purchaseData = {}, priceData = {};

    // Set today's date
    purchaseDate.value = new Date().toISOString().split('T')[0];

    function esc(s) { return s ? String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : '' }
    function showToast(msg, type) { toast.textContent = msg; toast.className = 'toast ' + type; toast.style.display = 'block'; setTimeout(() => toast.style.display = 'none', 3000) }

    // Load from storage
    function loadData() {
        addedSuppliers = JSON.parse(localStorage.getItem('erp_purchase_suppliers') || '[]');
        purchaseData = JSON.parse(localStorage.getItem('erp_purchase_data') || '{}');
        priceData = JSON.parse(localStorage.getItem('erp_price_data') || '{}');
    }
    function saveData() {
        localStorage.setItem('erp_purchase_suppliers', JSON.stringify(addedSuppliers));
        localStorage.setItem('erp_purchase_data', JSON.stringify(purchaseData));
        localStorage.setItem('erp_price_data', JSON.stringify(priceData));
        // Dispatch event for other forms (like Svod) to update
        window.dispatchEvent(new CustomEvent('purchasesUpdated'));
    }

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            activeTab = this.dataset.tab;
            renderContent();
        });
    });

    // Category Tabs
    function renderCategoryTabs() {
        const products = StorageService.getProducts();
        const rawCategories = [...new Set(products.map(p => p.category || 'Без категории'))].sort();
        const categories = ['Все', ...rawCategories];

        if (!activeCategory || !categories.includes(activeCategory)) activeCategory = 'Все';

        categoryTabs.innerHTML = '';
        categories.forEach(cat => {
            const btn = document.createElement('div');
            btn.className = `tab ${cat === activeCategory ? 'active' : ''}`;
            btn.textContent = cat;
            btn.addEventListener('click', () => {
                activeCategory = cat;
                renderCategoryTabs();
                renderContent();
            });
            categoryTabs.appendChild(btn);
        });
    }

    // Suppliers panel
    function renderSuppliers() {
        if (addedSuppliers.length === 0) {
            suppliersPanel.innerHTML = '<div class="mml-note">Добавьте поставщиков через кнопку «Поставщики»</div>';
            return;
        }
        const allSuppliers = StorageService.getSuppliers();
        suppliersPanel.innerHTML = '';
        addedSuppliers.forEach(sid => {
            const s = allSuppliers.find(x => x.supplier_id === sid);
            if (!s) return;
            const div = document.createElement('div');
            div.className = 'supplier-item' + (selectedSupplier === sid ? ' active' : '');

            // Show MML count for this supplier
            const mmlCount = StorageService.getSupplierMML(sid).length;
            div.innerHTML = `<span>${esc(s.supplier_name)} <small style="opacity:.6">(${mmlCount})</small></span><span class="del-btn" data-sid="${sid}">✕</span>`;

            div.addEventListener('click', e => {
                if (e.target.classList.contains('del-btn')) return;
                selectedSupplier = sid;
                renderSuppliers();
                renderContent();
            });
            div.querySelector('.del-btn').addEventListener('click', e => {
                e.stopPropagation();
                addedSuppliers = addedSuppliers.filter(x => x !== sid);
                if (selectedSupplier === sid) selectedSupplier = addedSuppliers[0] || null;
                saveData();
                renderSuppliers();
                renderContent();
            });
            suppliersPanel.appendChild(div);
        });
    }

    // Suppliers modal
    btnSuppliers.addEventListener('click', () => {
        const allSuppliers = StorageService.getSuppliers();
        allSuppliersList.innerHTML = '';
        allSuppliers.forEach(s => {
            const added = addedSuppliers.includes(s.supplier_id);
            const mmlCount = StorageService.getSupplierMML(s.supplier_id).length;
            const div = document.createElement('div');
            div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:.5rem;border-bottom:1px solid var(--border)';
            div.innerHTML = `<span>${esc(s.supplier_name)} <small style="opacity:.6">(MML: ${mmlCount})</small></span><button class="btn btn-sm ${added ? 'btn-secondary' : 'btn-success'}" ${added ? 'disabled' : ''} data-sid="${s.supplier_id}">${added ? 'Добавлен' : '➕'}</button>`;
            if (!added) {
                div.querySelector('button').addEventListener('click', function () {
                    addedSuppliers.push(s.supplier_id);
                    if (!selectedSupplier) selectedSupplier = s.supplier_id;
                    saveData();
                    renderSuppliers();
                    this.disabled = true; this.textContent = 'Добавлен'; this.className = 'btn btn-sm btn-secondary';
                });
            }
            allSuppliersList.appendChild(div);
        });
        suppliersModal.classList.add('open');
    });

    window.closeModal = () => suppliersModal.classList.remove('open');

    window.addNewSupplier = () => {
        const name = newSupplierName.value.trim();
        if (!name) { showToast('Введите название', 'error'); return }
        const newId = 'sup_' + Date.now();
        StorageService.upsertSuppliers([{ supplier_id: newId, supplier_name: name }]);
        addedSuppliers.push(newId);
        if (!selectedSupplier) selectedSupplier = newId;
        saveData();
        newSupplierName.value = '';
        showToast('Поставщик добавлен', 'success');
        btnSuppliers.click();
        renderSuppliers();
    };

    // Content rendering
    function renderContent() {
        if (!selectedSupplier) {
            tableArea.innerHTML = '<div class="mml-note">Выберите поставщика</div>';
            return;
        }
        if (activeTab === 'prices') {
            renderPrices();
        } else {
            renderPurchases();
        }
    }

    // Prices Tab (Pricelist) - uses MML from supplier reference
    function renderPrices() {
        const date = purchaseDate.value;
        const mmlCodes = StorageService.getSupplierMML(selectedSupplier);
        const allProducts = StorageService.getProducts();

        // Get products in MML, filtered by category
        let products = mmlCodes
            .map(code => allProducts.find(p => p.product_code === code))
            .filter(p => p && (activeCategory === 'Все' || (p.category || 'Без категории') === activeCategory));

        const prices = priceData[`${selectedSupplier}_${date}`] || {};

        let html = `<div style="padding:1rem;background:var(--bg-secondary);border-radius:8px;margin-bottom:1rem;">
            <strong>📋 Прайс-лист для поставщика</strong><br>
            <small>Дата: ${date} | MML: ${mmlCodes.length} товаров (настройте в справочнике поставщиков)</small>
        </div>`;
        html += `<table><thead><tr><th>Код</th><th>Товар</th><th>Цена закупки</th></tr></thead><tbody>`;
        if (products.length === 0) {
            html += '<tr><td colspan="3" style="text-align:center;">MML пуст. Настройте MML в справочнике поставщиков</td></tr>';
        }
        products.forEach(p => {
            const code = p.product_code;
            const price = prices[code] || 0;
            html += `<tr data-code="${code}">
                <td>${esc(code)}</td>
                <td>${esc(p.short_name_morning || p.product_name)}</td>
                <td class="cell-num"><input type="number" class="cell-input price-input" data-code="${code}" value="${price}" step="0.01"></td>
            </tr>`;
        });
        html += '</tbody></table>';
        tableArea.innerHTML = html;

        // Listeners
        tableArea.querySelectorAll('.price-input').forEach(inp => {
            inp.addEventListener('change', () => {
                const code = inp.dataset.code;
                const key = `${selectedSupplier}_${purchaseDate.value}`;
                if (!priceData[key]) priceData[key] = {};
                priceData[key][code] = parseFloat(inp.value) || 0;
                saveData();
            });
        });
    }

    // Purchases Tab - shows products from MML that have price > 0
    function renderPurchases() {
        const date = purchaseDate.value;
        const priceKey = `${selectedSupplier}_${date}`;
        const prices = priceData[priceKey] || {};

        // Get MML products that have a price set
        const mmlCodes = StorageService.getSupplierMML(selectedSupplier);
        const allProducts = StorageService.getProducts();

        // Filter products: must be in MML and have price > 0
        const products = mmlCodes
            .map(code => allProducts.find(p => p.product_code === code))
            .filter(p => p && parseFloat(prices[p.product_code]) > 0)
            .filter(p => activeCategory === 'Все' || (p.category || 'Без категории') === activeCategory);

        const rows = purchaseData[priceKey] || {};

        let html = `<div style="padding:1rem;background:var(--bg-secondary);border-radius:8px;margin-bottom:1rem;">
            <strong>🛒 Закупки</strong><br>
            <small>Показаны позиции из MML с указанной ценой</small>
        </div>`;
        html += `<table><thead><tr><th>Товар</th><th>Тип оплаты</th><th>Кол-во</th><th>Цена закупки</th><th>Сумма</th></tr></thead><tbody>`;
        if (products.length === 0) {
            html += '<tr><td colspan="5" style="text-align:center;">Нет позиций. Укажите цены в табуляции «Цены / Прайс-лист»</td></tr>';
        }
        products.forEach(p => {
            const code = p.product_code;
            const r = rows[code] || { payment_type: '', qty: 0, price: 0 };

            // Use price from pricelist
            const price = parseFloat(prices[code]) || 0;
            const sum = (parseFloat(r.qty) || 0) * price;

            html += `<tr data-code="${code}">
                <td>${esc(p.short_name_morning || p.product_name)}</td>
                <td><input type="text" class="cell-input" data-field="payment_type" value="${esc(r.payment_type || '')}"></td>
                <td class="cell-num"><input type="number" class="cell-input" data-field="qty" value="${r.qty || 0}" step="0.01"></td>
                <td class="cell-num"><div class="cell-input readonly">${price.toFixed(2)}</div></td>
                <td class="cell-num"><div class="cell-input readonly sum-cell">${sum.toFixed(2)}</div></td>
            </tr>`;
        });
        html += '</tbody></table>';
        tableArea.innerHTML = html;

        // Listeners
        tableArea.querySelectorAll('tr[data-code]').forEach(tr => {
            const code = tr.dataset.code;
            tr.querySelectorAll('.cell-input').forEach(inp => {
                if (inp.tagName === 'DIV') return;
                inp.addEventListener('input', () => {
                    const qty = parseFloat(tr.querySelector('[data-field="qty"]').value) || 0;
                    const price = parseFloat(prices[code]) || 0;
                    tr.querySelector('.sum-cell').textContent = (qty * price).toFixed(2);
                });
                inp.addEventListener('change', () => savePurchaseRow(tr, code));
            });
        });
    }

    function savePurchaseRow(tr, code) {
        const date = purchaseDate.value;
        const key = `${selectedSupplier}_${date}`;
        const prices = priceData[key] || {};
        if (!purchaseData[key]) purchaseData[key] = {};
        purchaseData[key][code] = {
            payment_type: tr.querySelector('[data-field="payment_type"]').value,
            qty: parseFloat(tr.querySelector('[data-field="qty"]').value) || 0,
            price: parseFloat(prices[code]) || 0
        };
        saveData();
    }

    purchaseDate.addEventListener('change', renderContent);

    // Save Pricelist to Journal
    btnSavePrice.addEventListener('click', () => {
        if (!selectedSupplier) { showToast('Выберите поставщика', 'error'); return }
        const date = purchaseDate.value;
        if (!date) { showToast('Выберите дату', 'error'); return }

        const key = `${selectedSupplier}_${date}`;
        const prices = priceData[key] || {};
        const products = StorageService.getProducts();
        const supplier = StorageService.getSuppliers().find(s => s.supplier_id === selectedSupplier);

        const priceItems = products.map(p => {
            const code = p.product_code;
            return {
                product_code: code,
                product_name: p?.product_name || '',
                price: prices[code] || 0
            };
        }).filter(x => x.price > 0);

        if (priceItems.length === 0) { showToast('Нет цен для сохранения', 'error'); return }

        const snapshot = StorageService.snapshotPricelistToJournal(date, selectedSupplier, supplier?.supplier_name || '', priceItems);
        showToast(`Прайс сохранён: ${snapshot.total_items} позиций`, 'success');
    });

    // Save Purchases to Journal
    btnSave.addEventListener('click', () => {
        if (!selectedSupplier) { showToast('Выберите поставщика', 'error'); return }
        const date = purchaseDate.value;
        if (!date) { showToast('Выберите дату', 'error'); return }
        const key = `${selectedSupplier}_${date}`;
        const rows = purchaseData[key] || {};
        if (Object.keys(rows).length === 0) { showToast('Нет данных', 'error'); return }

        const products = StorageService.getProducts();
        const supplier = StorageService.getSuppliers().find(s => s.supplier_id === selectedSupplier);

        const purchaseRows = Object.entries(rows).map(([code, r]) => {
            const p = products.find(x => x.product_code === code);
            return {
                product_code: code,
                product_name: p?.product_name || '',
                payment_type: r.payment_type,
                quantity: r.qty,
                qty: r.qty,
                price: r.price,
                sum: r.qty * r.price
            };
        });

        const snapshot = StorageService.snapshotPurchasesToJournal(date, selectedSupplier, supplier?.supplier_name || '', purchaseRows);
        showToast(`Закупки сохранены: ${snapshot.rows.length} позиций`, 'success');
    });

    loadData();
    renderCategoryTabs();
    renderSuppliers();
    renderContent();
})();
