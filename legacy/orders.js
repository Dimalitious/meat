(function () {
    const tableBody = document.getElementById('table-body'), emptyState = document.getElementById('empty-state'), selectAll = document.getElementById('select-all'), btnDelete = document.getElementById('btn-delete-selected'), btnAddRow = document.getElementById('btn-add-row'), btnResetFilters = document.getElementById('btn-reset-filters'), btnExport = document.getElementById('btn-export'), btnSaveJournal = document.getElementById('btn-save-journal'), globalSearch = document.getElementById('global-search'), fileImport = document.getElementById('file-import'), confirmModal = document.getElementById('confirm-modal'), confirmMessage = document.getElementById('confirm-message'), confirmOk = document.getElementById('confirm-ok-btn'), confirmCancel = document.getElementById('confirm-cancel-btn'), toast = document.getElementById('toast'), orderDate = document.getElementById('order-date');
    let pendingAction = null, filters = {}, globalFilter = '', displayedOrders = [];

    // Initialize order date with system date
    if (orderDate) orderDate.value = new Date().toISOString().split('T')[0];

    function esc(s) { return s ? String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : '' }
    function customerOpts(sel = '') { let o = '<option value="">—</option>'; StorageService.getCustomers().forEach(c => o += `<option value="${c.customer_id}" ${c.customer_id === sel ? 'selected' : ''}>${esc(c.customer_name)}</option>`); return o }
    function productOpts(sel = '') { let o = '<option value="">—</option>'; StorageService.getProducts().forEach(p => o += `<option value="${p.product_code}" ${p.product_code === sel ? 'selected' : ''}>${esc(p.product_name)}</option>`); return o }
    function calcPrice(sum, val) { const s = parseFloat(sum) || 0, v = parseFloat(val) || 0; return v === 0 ? 0 : (s / v).toFixed(2) }
    function getOrderDate() { return orderDate?.value || new Date().toISOString().split('T')[0] }

    // Advanced filter
    function matchFilter(val, filter, col) {
        if (!filter) return true;
        const f = filter.trim().toLowerCase(), v = String(val || '').toLowerCase();
        if (col === 'processed') {
            const isProcessed = val === true || val === 'true' || val === 'да';
            if (f === 'да' || f === 'true' || f === '1') return isProcessed;
            if (f === 'нет' || f === 'false' || f === '0') return !isProcessed;
            return true;
        }
        const numVal = parseFloat(val);
        if ((f.includes('..') || /^\d+\.?\d*-\d+\.?\d*$/.test(f)) && !isNaN(numVal)) {
            const parts = f.includes('..') ? f.split('..') : f.split('-');
            const min = parseFloat(parts[0]), max = parseFloat(parts[1]);
            if (!isNaN(min) && !isNaN(max)) return numVal >= min && numVal <= max;
        }
        if (!isNaN(numVal)) {
            if (f.startsWith('>=')) return numVal >= parseFloat(f.slice(2));
            if (f.startsWith('<=')) return numVal <= parseFloat(f.slice(2));
            if (f.startsWith('>')) return numVal > parseFloat(f.slice(1));
            if (f.startsWith('<')) return numVal < parseFloat(f.slice(1));
        }
        if (f.includes('..') && col === 'shipment_date') {
            const parts = f.split('..');
            return v >= parts[0] && v <= parts[1];
        }
        return v.includes(f);
    }

    function getFilterValue(o, col) {
        if (col === 'product_category' || col === 'short_name_morning') {
            const p = StorageService.getProductByCode(o.product_code);
            return p ? (col === 'product_category' ? p.category : p.short_name_morning) || '' : '';
        }
        if (col === 'customer_id') {
            const c = StorageService.getCustomers().find(x => x.customer_id === o.customer_id);
            return c ? c.customer_name || '' : '';
        }
        return o[col];
    }

    function updateSummary() {
        const total = displayedOrders.reduce((sum, o) => sum + (parseFloat(o.order_value) || 0), 0);
        const summaryEl = document.getElementById('total-order-qty');
        if (summaryEl) summaryEl.textContent = total.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function renderTable() {
        let orders = StorageService.getOrders();
        if (globalFilter) { const g = globalFilter.toLowerCase(); orders = orders.filter(o => { const p = StorageService.getProductByCode(o.product_code), c = StorageService.getCustomers().find(x => x.customer_id === o.customer_id); return JSON.stringify({ ...o, pn: p?.product_name, cn: c?.customer_name, cat: p?.category, morn: p?.short_name_morning }).toLowerCase().includes(g) }) }
        Object.keys(filters).forEach(col => { const fval = filters[col]; if (!fval) return; orders = orders.filter(o => matchFilter(getFilterValue(o, col), fval, col)) });
        displayedOrders = orders;
        tableBody.innerHTML = ''; emptyState.style.display = orders.length === 0 ? 'block' : 'none';
        orders.forEach(o => {
            const p = StorageService.getProductByCode(o.product_code);
            const cat = p ? p.category || '' : '', morn = p ? p.short_name_morning || '' : '', price = calcPrice(o.order_sum, o.order_value);
            const distCoeff = morn ? StorageService.getPlanFactDiff(morn) : 0;
            const weightDist = (parseFloat(o.order_value) || 0) * distCoeff;
            const tr = document.createElement('tr'); tr.dataset.id = o.id;
            if (o.processed) tr.classList.add('processed-row');
            tr.innerHTML = `<td class="col-checkbox"><input type="checkbox" class="row-cb" data-id="${o.id}"></td>
                <td><input type="date" class="cell-input" data-field="shipment_date" value="${o.shipment_date || ''}"></td>
                <td><input type="text" class="cell-input" data-field="payment_type" value="${esc(o.payment_type || '')}"></td>
                <td><select class="cell-input" data-field="customer_id">${customerOpts(o.customer_id)}</select></td>
                <td><select class="cell-input product-sel" data-field="product_code">${productOpts(o.product_code)}</select></td>
                <td><div class="cell-input readonly cat-cell">${esc(cat)}</div></td>
                <td><div class="cell-input readonly morn-cell">${esc(morn)}</div></td>
                <td class="cell-num"><div class="cell-input readonly price-cell">${price}</div></td>
                <td class="cell-num"><input type="number" class="cell-input sum-input" data-field="order_sum" value="${o.order_sum || ''}" min="0" step="0.01"></td>
                <td class="cell-num"><input type="number" class="cell-input" data-field="shipped_fact" value="${o.shipped_fact || ''}" min="0" step="0.01"></td>
                <td class="cell-num"><input type="number" class="cell-input val-input" data-field="order_value" value="${o.order_value || ''}" min="0" step="0.01"></td>
                <td class="cell-num"><div class="cell-input readonly">${(distCoeff * 100).toFixed(1)}%</div></td>
                <td class="cell-num"><div class="cell-input readonly">${weightDist.toFixed(2)}</div></td>
                <td><button class="btn btn-proc ${o.processed ? 'btn-success' : 'btn-secondary'}" onclick="toggleProcessed(${o.id})">${o.processed ? '✓' : '○'}</button></td>
                <td class="col-actions"><button class="btn-icon danger" onclick="deleteOrder(${o.id})">🗑️</button></td>`;
            tableBody.appendChild(tr);
        });
        updateBtn(); attachListeners();
    }

    window.toggleProcessed = function (id) {
        const os = StorageService.getOrders(), o = os.find(x => x.id === id);
        if (o) {
            const newProcessed = !o.processed;
            StorageService.updateOrder(id, { processed: newProcessed });

            // Add to assembly queue when processed
            if (newProcessed) {
                addToAssemblyQueue(o);
            } else {
                removeFromAssemblyQueue(o);
            }

            renderTable();
            showToast(o.processed ? 'Снято' : 'Добавлено в сборку ✓', 'success')
        }
    };

    function addToAssemblyQueue(order) {
        // Use today's date (from form) as the assembly queue date
        const date = getOrderDate();
        const key = `erp_assembly_queue_${date}`;
        const queue = JSON.parse(localStorage.getItem(key) || '[]');

        // Check if already exists
        if (!queue.find(q => q.id === order.id)) {
            queue.push({
                id: order.id,
                customer_id: order.customer_id,
                customer_name: StorageService.getCustomers().find(c => c.customer_id === order.customer_id)?.customer_name || order.customer_id,
                product_code: order.product_code,
                product_name: StorageService.getProducts().find(p => p.product_code === order.product_code)?.product_name || order.product_code,
                category: StorageService.getProducts().find(p => p.product_code === order.product_code)?.category || '',
                order_qty: order.order_value || 0,
                date: date
            });
            localStorage.setItem(key, JSON.stringify(queue));
        }
    }

    function removeFromAssemblyQueue(order) {
        // Remove from today's date queue
        const date = getOrderDate();
        const key = `erp_assembly_queue_${date}`;
        const queue = JSON.parse(localStorage.getItem(key) || '[]');
        const filtered = queue.filter(q => q.id !== order.id);
        localStorage.setItem(key, JSON.stringify(filtered));
    }

    function attachListeners() {
        tableBody.querySelectorAll('tr').forEach(tr => {
            const id = parseInt(tr.dataset.id), productSel = tr.querySelector('.product-sel'), sumInput = tr.querySelector('.sum-input'), valInput = tr.querySelector('.val-input'), priceCell = tr.querySelector('.price-cell'), catCell = tr.querySelector('.cat-cell'), mornCell = tr.querySelector('.morn-cell');
            productSel?.addEventListener('change', function () { const p = StorageService.getProductByCode(this.value); catCell.textContent = p ? p.category || '' : ''; mornCell.textContent = p ? p.short_name_morning || '' : ''; saveRow(tr, id) });
            function updatePrice() { if (priceCell) priceCell.textContent = calcPrice(sumInput?.value, valInput?.value) }
            sumInput?.addEventListener('input', () => { updatePrice(); saveRow(tr, id) });
            valInput?.addEventListener('input', function () {
                const val = parseFloat(this.value) || 0;
                const order = displayedOrders.find(o => o.id === id);
                if (order) order.order_value = val;
                updatePrice();
                updateSummary();
                saveRow(tr, id);
            });
            tr.querySelectorAll('.cell-input').forEach(inp => { if (inp === productSel || inp === sumInput || inp === valInput) return; inp.addEventListener?.('change', () => saveRow(tr, id)) });
        });
        updateSummary();
    }

    function saveRow(tr, id) { const d = {}; tr.querySelectorAll('[data-field]').forEach(el => d[el.dataset.field] = el.value); StorageService.updateOrder(id, { shipment_date: d.shipment_date, payment_type: d.payment_type, customer_id: d.customer_id, product_code: d.product_code, order_sum: parseFloat(d.order_sum) || 0, shipped_fact: parseFloat(d.shipped_fact) || 0, order_value: parseFloat(d.order_value) || 0 }) }
    function updateBtn() { btnDelete.disabled = document.querySelectorAll('.row-cb:checked').length === 0 }
    selectAll.addEventListener('change', function () { document.querySelectorAll('.row-cb').forEach(cb => cb.checked = this.checked); updateBtn() });
    tableBody.addEventListener('change', e => { if (e.target.classList.contains('row-cb')) updateBtn() });
    btnDelete.addEventListener('click', function () { const ids = Array.from(document.querySelectorAll('.row-cb:checked')).map(cb => parseInt(cb.dataset.id)); if (!ids.length) return; showConfirm(`Удалить ${ids.length}?`, () => { StorageService.deleteOrders(ids); selectAll.checked = false; renderTable(); showToast('Удалено', 'success') }) });
    window.deleteOrder = id => showConfirm('Удалить?', () => { StorageService.deleteOrders([id]); renderTable(); showToast('Удалено', 'success') });
    btnAddRow.addEventListener('click', function () { StorageService.addOrder({ shipment_date: '', payment_type: '', customer_id: '', product_code: '', order_sum: 0, shipped_fact: 0, order_value: 0 }); renderTable() });
    globalSearch.addEventListener('input', function () { globalFilter = this.value; renderTable() });
    document.querySelectorAll('.filter-input').forEach(inp => inp.addEventListener('input', function () { filters[this.dataset.col] = this.value; renderTable() }));
    btnResetFilters.addEventListener('click', function () { filters = {}; globalFilter = ''; globalSearch.value = ''; document.querySelectorAll('.filter-input').forEach(inp => inp.value = ''); renderTable() });

    // Save Journal - uses form order date
    btnSaveJournal.addEventListener('click', function () {
        const journalDate = getOrderDate();
        const snapshot = StorageService.snapshotOrdersToJournal(journalDate, displayedOrders);
        showToast(`Форма сохранена в журнал (${snapshot.orders.length} строк)`, 'success');
    });

    // Excel Export
    btnExport.addEventListener('click', function () {
        const products = StorageService.getProducts(), customers = StorageService.getCustomers();
        const data = displayedOrders.map(o => {
            const p = products.find(x => x.product_code === o.product_code); const c = customers.find(x => x.customer_id === o.customer_id);
            const price = (parseFloat(o.order_value) || 0) > 0 ? (parseFloat(o.order_sum) / parseFloat(o.order_value)).toFixed(2) : 0;
            const distCoeff = p?.short_name_morning ? StorageService.getPlanFactDiff(p.short_name_morning) : 0;
            const weightDist = (parseFloat(o.order_value) || 0) * distCoeff;
            return { 'Дата отгрузки': o.shipment_date, 'Тип оплаты': o.payment_type, 'Заказчик': c?.customer_name || '', 'Товар': p?.product_name || '', 'Категория': p?.category || '', 'Утреннее имя': p?.short_name_morning || '', 'Цена': price, 'Сумма заказа': o.order_sum, 'Факт отгр.': o.shipped_fact, 'Кол-во заказа': o.order_value, 'Коэфф.распр.': (distCoeff * 100).toFixed(1) + '%', 'Вес к распр.': weightDist.toFixed(2), 'Обработано': o.processed ? 'Да' : 'Нет' };
        });
        const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Заказы'); XLSX.writeFile(wb, 'orders_export.xlsx'); showToast('Экспорт готов', 'success');
    });

    fileImport.addEventListener('change', function (e) {
        const file = e.target.files[0]; if (!file) return; const reader = new FileReader();
        reader.onload = function (ev) {
            try { const data = new Uint8Array(ev.target.result), wb = XLSX.read(data, { type: 'array' }); let rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }); if (rows.length && String(rows[0][0] || '').toLowerCase().match(/дата|date/)) rows = rows.slice(1); let added = 0; const customers = StorageService.getCustomers(), products = StorageService.getProducts(); rows.forEach(r => { if (!r || !r[0]) return; const custVal = String(r[2] || '').trim(), prodVal = String(r[3] || '').trim(); const cust = customers.find(c => c.customer_name === custVal || c.customer_id === custVal); const prod = products.find(p => p.product_name === prodVal || p.product_code === prodVal); StorageService.addOrder({ shipment_date: r[0] ? formatDate(r[0]) : '', payment_type: String(r[1] || '').trim(), customer_id: cust ? cust.customer_id : '', product_code: prod ? prod.product_code : '', order_sum: parseFloat(r[7]) || 0, shipped_fact: parseFloat(r[8]) || 0, order_value: parseFloat(r[9]) || 0 }); added++ }); renderTable(); showToast(`Импорт: ${added}`, 'success') } catch (err) { console.error(err); showToast('Ошибка', 'error') }
        };
        reader.readAsArrayBuffer(file); fileImport.value = '';
    });

    function formatDate(val) { if (typeof val === 'number') { const d = new Date((val - 25569) * 86400 * 1000); return d.toISOString().split('T')[0] } return String(val).trim() }
    function showConfirm(msg, onOk) { confirmMessage.textContent = msg; pendingAction = onOk; confirmModal.classList.add('open') }
    function closeConfirm() { confirmModal.classList.remove('open'); pendingAction = null }
    confirmOk.addEventListener('click', () => { if (pendingAction) pendingAction(); closeConfirm() }); confirmCancel.addEventListener('click', closeConfirm);
    function showToast(msg, type) { toast.textContent = msg; toast.className = 'toast ' + type; toast.style.display = 'block'; setTimeout(() => toast.style.display = 'none', 3000) }
    renderTable();
})();
