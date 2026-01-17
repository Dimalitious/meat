(function () {
    const tabsContainer = document.getElementById('tabs');
    const tableHead = document.getElementById('table-head');
    const tableBody = document.getElementById('table-body');
    const emptyState = document.getElementById('empty-state');
    const toast = document.getElementById('toast');
    const dateInput = document.getElementById('pricelist-date');
    const btnSave = document.getElementById('btn-save-pricelist');

    // State
    let activeTab = '';
    let suppliersForColumns = Array(10).fill(''); // 10 columns

    // Initialize date
    dateInput.value = new Date().toISOString().split('T')[0];

    function showToast(msg, type = 'success') {
        toast.textContent = msg;
        toast.className = 'toast ' + type;
        toast.style.display = 'block';
        setTimeout(() => toast.style.display = 'none', 3000);
    }

    function init() {
        renderTabs();
        renderHeader();
        renderTable();
    }

    function renderTabs() {
        const categories = StorageService.getUniqueCategories();
        if (categories.length === 0) return;
        if (!activeTab) activeTab = categories[0];

        tabsContainer.innerHTML = '';
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = `tab-btn ${activeTab === cat ? 'active' : ''}`;
            btn.textContent = cat;
            btn.onclick = () => { activeTab = cat; renderTabs(); renderTable(); };
            tabsContainer.appendChild(btn);
        });
    }

    function getSupplierOpts(selectedId) {
        let html = '<option value="">—</option>';
        StorageService.getSuppliers().forEach(s => {
            html += `<option value="${s.supplier_id}" ${String(s.supplier_id) === String(selectedId) ? 'selected' : ''}>${s.supplier_name}</option>`;
        });
        return html;
    }

    function renderHeader() {
        let html = '<tr><th style="width:200px;">Продукция</th><th style="width:150px;">Утро (Название)</th><th style="width:100px;">Прайс (Утро)</th>';
        for (let i = 0; i < 10; i++) {
            html += `<th>
                <select class="header-select" data-col="${i}">
                    ${getSupplierOpts(suppliersForColumns[i])}
                </select>
                <div>Поставщик ${i + 1}</div>
            </th>`;
        }
        html += '</tr>';
        tableHead.innerHTML = html;

        // Attach listeners to headers
        tableHead.querySelectorAll('.header-select').forEach(sel => {
            sel.addEventListener('change', function () {
                const colIdx = parseInt(this.dataset.col);
                suppliersForColumns[colIdx] = this.value;
                renderTable(); // Re-render to fetch new prices
            });
        });
    }

    function renderTable() {
        const products = StorageService.getProducts().filter(p => p.category === activeTab);
        tableBody.innerHTML = '';

        if (products.length === 0) {
            emptyState.style.display = 'block';
            return;
        }
        emptyState.style.display = 'none';

        const date = dateInput.value;

        products.forEach(p => {
            const tr = document.createElement('tr');
            let html = `<td>${p.product_name}</td>
                <td>${p.short_name_morning || ''}</td>
                <td style="text-align:center;font-weight:bold;">${p.price_morning ? parseFloat(p.price_morning).toFixed(2) : '-'}</td>`;

            for (let i = 0; i < 10; i++) {
                const supplierId = suppliersForColumns[i];
                let priceDisplay = '-';

                if (supplierId) {
                    const price = StorageService.getPriceFromPricelist(supplierId, p.product_code, date);
                    if (price !== null && price > 0) {
                        priceDisplay = price.toFixed(2);
                    }
                }

                html += `<td style="text-align:center;">
                    <div style="font-weight:500;color:${priceDisplay !== '-' ? 'var(--text-primary)' : 'var(--text-secondary)'};">
                        ${priceDisplay}
                    </div>
                </td>`;
            }
            tr.innerHTML = html;
            tableBody.appendChild(tr);
        });
    }

    dateInput.addEventListener('change', renderTable);

    btnSave.addEventListener('click', function () {
        const date = dateInput.value;
        const products = StorageService.getProducts().filter(p => p.category === activeTab);

        // This snapshots THE WHOLE TABLE (current tab? No, should be ALL products? 
        // Or should we iterate all categories? The request says "tabulation", implying view. 
        // But usually a journal snapshot captures the whole state.
        // Let's capture ALL categories to be safe, but for now, let's just stick to the current view or iterate all.
        // Iterating all categories involves re-calculating logic without rendering.

        // Collecting data for ALL products
        const allProducts = StorageService.getProducts();
        const rows = {}; // { product_code: { col0: price, col1: price... } }

        allProducts.forEach(p => {
            const rowData = {};
            for (let i = 0; i < 10; i++) {
                const suppId = suppliersForColumns[i];
                if (suppId) {
                    const price = StorageService.getPriceFromPricelist(suppId, p.product_code, date);
                    rowData[`col_${i}`] = price;
                } else {
                    rowData[`col_${i}`] = null;
                }
            }
            rows[p.product_code] = rowData;
        });

        const snapshot = StorageService.snapshotShipmentPricelistToJournal(date, suppliersForColumns, rows);
        showToast(`Сохранено в журнал: ${date}`, 'success');
    });

    init();

})();
