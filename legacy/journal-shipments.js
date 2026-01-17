(function () {
    const mainView = document.getElementById('main-view'), viewMode = document.getElementById('view-mode'), editMode = document.getElementById('edit-mode');
    const tableBody = document.getElementById('table-body'), emptyState = document.getElementById('empty-state'), selectAll = document.getElementById('select-all'), btnDelete = document.getElementById('btn-delete-selected'), btnFilter = document.getElementById('btn-filter'), filterFrom = document.getElementById('filter-from'), filterTo = document.getElementById('filter-to');
    const viewTitle = document.getElementById('view-title'), viewClients = document.getElementById('view-clients'), viewBody = document.getElementById('view-body'), viewFooter = document.getElementById('view-footer'), btnBackView = document.getElementById('btn-back-view'), btnPrintView = document.getElementById('btn-print-view'), printArea = document.getElementById('print-area');
    const editTitle = document.getElementById('edit-title'), editClients = document.getElementById('edit-clients'), editBody = document.getElementById('edit-body'), editSelectAll = document.getElementById('edit-select-all'), btnBackEdit = document.getElementById('btn-back-edit'), btnSaveChanges = document.getElementById('btn-save-changes'), btnAddRow = document.getElementById('btn-add-row'), btnDeleteRows = document.getElementById('btn-delete-rows');
    const toast = document.getElementById('toast');
    let currentDate = null, currentShipments = [], selectedCustomer = null, editRows = [];
    function esc(s) { return s ? String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]: ''}
    function showToast(msg, type) { toast.textContent = msg; toast.className = 'toast ' + type; toast.style.display = 'block'; setTimeout(() => toast.style.display = 'none', 3000) }
    function productOpts(sel = '') { let o = '<option value="">—</option>'; StorageService.getProducts().forEach(p => o += `<option value="${p.product_code}" ${p.product_code === sel ? 'selected' : ''}>${esc(p.product_name)}</option>`); return o }

    function renderMain() {
        let journal = StorageService.getJournalShipments();
        const from = filterFrom.value, to = filterTo.value;
        if (from) journal = journal.filter(j => j.date >= from);
        if (to) journal = journal.filter(j => j.date <= to);
        journal.sort((a, b) => b.date.localeCompare(a.date));
        tableBody.innerHTML = ''; emptyState.style.display = journal.length === 0 ? 'block' : 'none';
        journal.forEach(j => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="col-checkbox"><input type="checkbox" class="row-cb" data-date="${j.date}"></td><td>${esc(j.date)}</td><td>${j.total_customers}</td><td>${j.total_sum.toFixed(2)}</td><td>${j.total_count}</td><td><button class="btn btn-primary btn-sm" onclick="viewDate('${j.date}')">👁️</button></td><td><button class="btn btn-warning btn-sm" onclick="editDate('${j.date}')">✏️</button></td>`;
            tableBody.appendChild(tr);
        });
        updateBtn();
    }

    function updateBtn() { btnDelete.disabled = document.querySelectorAll('.row-cb:checked').length === 0 }
    selectAll.addEventListener('change', function () { document.querySelectorAll('.row-cb').forEach(cb => cb.checked = this.checked); updateBtn() });
    tableBody.addEventListener('change', e => { if (e.target.classList.contains('row-cb')) updateBtn() });
    btnFilter.addEventListener('click', renderMain);
    btnDelete.addEventListener('click', function () {
        const dates = Array.from(document.querySelectorAll('.row-cb:checked')).map(cb => cb.dataset.date);
        if (!dates.length) return;
        StorageService.deleteJournalShipmentsByDates(dates);
        selectAll.checked = false;
        renderMain();
        showToast('Удалено', 'success');
    });

    // VIEW MODE
    window.viewDate = function (d) {
        const j = StorageService.getJournalShipments().find(x => x.date === d);
        if (!j || !j.shipments || !j.shipments.length) { showToast('Нет данных', 'error'); return }
        currentDate = d;
        currentShipments = j.shipments;
        selectedCustomer = null;
        viewTitle.textContent = 'Просмотр за ' + d;
        mainView.style.display = 'none';
        viewMode.style.display = 'block';
        renderViewClients();
    };
    btnBackView.addEventListener('click', function () { viewMode.style.display = 'none'; mainView.style.display = 'block' });

    function renderViewClients() {
        const customers = StorageService.getCustomers();
        const groups = {};
        currentShipments.forEach(o => { if (!groups[o.customer_id]) groups[o.customer_id] = []; groups[o.customer_id].push(o) });
        viewClients.innerHTML = '';
        Object.keys(groups).forEach(cid => {
            const cust = customers.find(c => String(c.customer_id) === String(cid));
            const item = document.createElement('div'); item.className = 'client-item' + (selectedCustomer === cid ? ' active' : ''); item.dataset.cid = cid;
            item.textContent = cust ? cust.customer_name : 'ID: ' + cid;
            item.addEventListener('click', () => selectViewClient(cid, groups[cid]));
            viewClients.appendChild(item);
        });
        if (Object.keys(groups).length > 0) { const first = Object.keys(groups)[0]; selectViewClient(first, groups[first]) }
    }

    function selectViewClient(cid, orders) {
        selectedCustomer = cid;
        document.querySelectorAll('#view-clients .client-item').forEach(c => c.classList.toggle('active', c.dataset.cid === cid));
        const products = StorageService.getProducts();
        viewBody.innerHTML = '';
        let totalSum = 0, totalWeight = 0;
        orders.forEach(o => {
            const p = products.find(x => x.product_code === o.product_code);
            const price = (parseFloat(o.order_value) || 0) > 0 ? (parseFloat(o.order_sum) / parseFloat(o.order_value)).toFixed(2) : 0;
            totalSum += parseFloat(o.order_sum) || 0;
            totalWeight += parseFloat(o.shipped_fact) || 0;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${esc(o.payment_type)}</td><td>${esc(p ? p.product_name : '')}</td><td>${price}</td><td>${o.order_sum || 0}</td><td>${o.shipped_fact || 0}</td>`;
            viewBody.appendChild(tr);
        });
        viewFooter.innerHTML = `<tr style="font-weight:600;border-top:2px solid var(--border);"><td colspan="3">ИТОГО:</td><td>${totalSum.toFixed(2)}</td><td>${totalWeight.toFixed(2)}</td></tr>`;
    }

    btnPrintView.addEventListener('click', function () {
        if (!selectedCustomer) return;
        const orders = currentShipments.filter(o => String(o.customer_id) === String(selectedCustomer));
        const cust = StorageService.getCustomers().find(c => String(c.customer_id) === String(selectedCustomer));
        const products = StorageService.getProducts();
        let totalSum = 0, totalWeight = 0, tableRows = '';
        orders.forEach(o => {
            const p = products.find(x => x.product_code === o.product_code);
            const price = (parseFloat(o.order_value) || 0) > 0 ? (parseFloat(o.order_sum) / parseFloat(o.order_value)).toFixed(2) : 0;
            totalSum += parseFloat(o.order_sum) || 0;
            totalWeight += parseFloat(o.shipped_fact) || 0;
            tableRows += `<tr><td>${esc(p ? p.product_name : '')}</td><td>${price}</td><td>${o.order_sum || 0}</td><td>${o.shipped_fact || 0}</td></tr>`;
        });
        const invoiceHTML = `<div class="invoice"><h3>НАКЛАДНАЯ</h3><p><strong>Дата:</strong> ${currentDate}</p><p><strong>Заказчик:</strong> ${esc(cust ? cust.customer_name : '')}</p><table><thead><tr><th>Товар</th><th>Цена</th><th>Сумма</th><th>Вес</th></tr></thead><tbody>${tableRows}</tbody></table><div class="invoice-footer"><p>Итого: ${totalSum.toFixed(2)} ₽ | ${totalWeight.toFixed(2)} кг</p></div></div>`;
        printArea.innerHTML = invoiceHTML + invoiceHTML;
        printArea.style.display = 'block';
        setTimeout(() => { window.print(); printArea.style.display = 'none' }, 100);
    });

    // EDIT MODE
    window.editDate = function (d) {
        const j = StorageService.getJournalShipments().find(x => x.date === d);
        if (!j) { showToast('Нет данных', 'error'); return }
        currentDate = d;
        editRows = JSON.parse(JSON.stringify(j.shipments || []));
        editRows.forEach((r, i) => { if (!r.id) r.id = i + 1 });
        selectedCustomer = null;
        editTitle.textContent = 'Редактирование за ' + d;
        mainView.style.display = 'none';
        editMode.style.display = 'block';
        renderEditClients();
    };
    btnBackEdit.addEventListener('click', function () { editMode.style.display = 'none'; mainView.style.display = 'block' });

    function renderEditClients() {
        const customers = StorageService.getCustomers();
        const groups = {};
        editRows.forEach(o => { if (!groups[o.customer_id]) groups[o.customer_id] = []; groups[o.customer_id].push(o) });
        editClients.innerHTML = '';
        Object.keys(groups).forEach(cid => {
            const cust = customers.find(c => String(c.customer_id) === String(cid));
            const item = document.createElement('div'); item.className = 'client-item' + (selectedCustomer === cid ? ' active' : ''); item.dataset.cid = cid;
            item.textContent = cust ? cust.customer_name : 'ID: ' + cid;
            item.addEventListener('click', () => selectEditClient(cid));
            editClients.appendChild(item);
        });
        if (Object.keys(groups).length > 0 && !selectedCustomer) { const first = Object.keys(groups)[0]; selectEditClient(first) }
        else if (selectedCustomer) selectEditClient(selectedCustomer);
    }

    function selectEditClient(cid) {
        selectedCustomer = cid;
        document.querySelectorAll('#edit-clients .client-item').forEach(c => c.classList.toggle('active', c.dataset.cid === cid));
        renderEditTable();
    }

    function renderEditTable() {
        const rows = editRows.filter(o => String(o.customer_id) === String(selectedCustomer));
        editBody.innerHTML = '';
        rows.forEach(o => {
            const globalIdx = editRows.indexOf(o);
            const tr = document.createElement('tr'); tr.dataset.idx = globalIdx;
            tr.innerHTML = `<td class="col-checkbox"><input type="checkbox" class="edit-cb" data-idx="${globalIdx}"></td>
                <td><input type="text" class="cell-input" data-field="payment_type" value="${esc(o.payment_type || '')}"></td>
                <td><select class="cell-input" data-field="product_code">${productOpts(o.product_code)}</select></td>
                <td class="cell-num"><input type="number" class="cell-input" data-field="order_sum" value="${o.order_sum || 0}" step="0.01"></td>
                <td class="cell-num"><input type="number" class="cell-input" data-field="shipped_fact" value="${o.shipped_fact || 0}" step="0.01"></td>
                <td><button class="btn-icon danger" onclick="deleteEditRow(${globalIdx})">🗑️</button></td>`;
            editBody.appendChild(tr);
        });
        attachEditListeners();
        updateEditBtn();
    }

    function attachEditListeners() {
        editBody.querySelectorAll('tr').forEach(tr => {
            const idx = parseInt(tr.dataset.idx);
            tr.querySelectorAll('.cell-input').forEach(inp => {
                inp.addEventListener('change', function () {
                    const f = this.dataset.field;
                    editRows[idx][f] = f === 'product_code' || f === 'payment_type' ? this.value : (parseFloat(this.value) || 0);
                });
            });
        });
    }

    function updateEditBtn() { btnDeleteRows.disabled = document.querySelectorAll('.edit-cb:checked').length === 0 }
    editSelectAll.addEventListener('change', function () { document.querySelectorAll('.edit-cb').forEach(cb => cb.checked = this.checked); updateEditBtn() });
    editBody.addEventListener('change', e => { if (e.target.classList.contains('edit-cb')) updateEditBtn() });

    window.deleteEditRow = function (idx) { editRows.splice(idx, 1); renderEditClients() };

    btnDeleteRows.addEventListener('click', function () {
        const idxs = Array.from(document.querySelectorAll('.edit-cb:checked')).map(cb => parseInt(cb.dataset.idx)).sort((a, b) => b - a);
        idxs.forEach(i => editRows.splice(i, 1));
        editSelectAll.checked = false;
        renderEditClients();
    });

    btnAddRow.addEventListener('click', function () {
        if (!selectedCustomer) { showToast('Выберите клиента', 'error'); return }
        editRows.push({ id: Date.now(), customer_id: selectedCustomer, payment_type: '', product_code: '', order_sum: 0, shipped_fact: 0, order_value: 0 });
        renderEditTable();
    });

    btnSaveChanges.addEventListener('click', function () {
        StorageService.updateJournalShipmentsRows(currentDate, editRows);
        showToast('Сохранено', 'success');
        editMode.style.display = 'none';
        mainView.style.display = 'block';
        renderMain();
    });

    renderMain();
})();
