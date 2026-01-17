(function () {
    const mainView = document.getElementById('main-view'), viewMode = document.getElementById('view-mode'), editMode = document.getElementById('edit-mode');
    const tableBody = document.getElementById('table-body'), emptyState = document.getElementById('empty-state'), selectAll = document.getElementById('select-all'), btnDelete = document.getElementById('btn-delete-selected'), btnFilter = document.getElementById('btn-filter'), filterFrom = document.getElementById('filter-from'), filterTo = document.getElementById('filter-to');
    const viewTitle = document.getElementById('view-title'), viewBody = document.getElementById('view-body'), btnBackView = document.getElementById('btn-back-view');
    const editTitle = document.getElementById('edit-title'), editBody = document.getElementById('edit-body'), btnBackEdit = document.getElementById('btn-back-edit'), btnSaveChanges = document.getElementById('btn-save-changes'), editSelectAll = document.getElementById('edit-select-all'), btnAddEditRow = document.getElementById('btn-add-edit-row'), btnDeleteEditRows = document.getElementById('btn-delete-edit-rows');
    const toast = document.getElementById('toast');
    let currentDate = null, editRows = [];
    function esc(s) { return s ? String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]: ''}
    function showToast(msg, type) { toast.textContent = msg; toast.className = 'toast ' + type; toast.style.display = 'block'; setTimeout(() => toast.style.display = 'none', 3000) }
    function customerOpts(sel = '') { let o = '<option value="">—</option>'; StorageService.getCustomers().forEach(c => o += `<option value="${c.customer_id}" ${c.customer_id === sel ? 'selected' : ''}>${esc(c.customer_name)}</option>`); return o }
    function productOpts(sel = '') { let o = '<option value="">—</option>'; StorageService.getProducts().forEach(p => o += `<option value="${p.product_code}" ${p.product_code === sel ? 'selected' : ''}>${esc(p.product_name)}</option>`); return o }

    function renderMain() {
        let journal = StorageService.getJournalOrders();
        const from = filterFrom.value, to = filterTo.value;
        if (from) journal = journal.filter(j => j.date >= from);
        if (to) journal = journal.filter(j => j.date <= to);
        journal.sort((a, b) => b.date.localeCompare(a.date));
        tableBody.innerHTML = ''; emptyState.style.display = journal.length === 0 ? 'block' : 'none';
        journal.forEach(j => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="col-checkbox"><input type="checkbox" class="row-cb" data-date="${j.date}"></td><td>${esc(j.date)}</td><td>${j.total_weight.toFixed(2)}</td><td>${j.total_sum.toFixed(2)}</td><td><button class="btn btn-primary btn-sm" onclick="viewDate('${j.date}')">👁️</button></td><td><button class="btn btn-warning btn-sm" onclick="editDate('${j.date}')">✏️</button></td>`;
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
        StorageService.deleteJournalOrdersByDates(dates);
        selectAll.checked = false;
        renderMain();
        showToast('Удалено', 'success');
    });

    // VIEW MODE (read-only)
    window.viewDate = function (d) {
        const j = StorageService.getJournalOrders().find(x => x.date === d);
        if (!j || !j.orders || !j.orders.length) { showToast('Нет данных', 'error'); return }
        currentDate = d;
        viewTitle.textContent = 'Просмотр за ' + d;
        const customers = StorageService.getCustomers(), products = StorageService.getProducts();
        viewBody.innerHTML = '';
        j.orders.forEach(o => {
            const c = customers.find(x => x.customer_id === o.customer_id);
            const p = products.find(x => x.product_code === o.product_code);
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${esc(c ? c.customer_name : '')}</td><td>${esc(p ? p.product_name : '')}</td><td>${o.order_sum || 0}</td><td>${o.shipped_fact || 0}</td><td>${o.order_value || 0}</td>`;
            viewBody.appendChild(tr);
        });
        mainView.style.display = 'none';
        viewMode.style.display = 'block';
    };
    btnBackView.addEventListener('click', function () { viewMode.style.display = 'none'; mainView.style.display = 'block' });

    // EDIT MODE
    window.editDate = function (d) {
        const j = StorageService.getJournalOrders().find(x => x.date === d);
        if (!j) { showToast('Нет данных', 'error'); return }
        currentDate = d;
        editRows = JSON.parse(JSON.stringify(j.orders || []));
        // Ensure IDs
        editRows.forEach((r, i) => { if (!r.id) r.id = i + 1 });
        editTitle.textContent = 'Редактирование за ' + d;
        mainView.style.display = 'none';
        editMode.style.display = 'block';
        renderEditTable();
    };
    btnBackEdit.addEventListener('click', function () { editMode.style.display = 'none'; mainView.style.display = 'block' });

    function renderEditTable() {
        editBody.innerHTML = '';
        editRows.forEach((o, idx) => {
            const tr = document.createElement('tr'); tr.dataset.idx = idx;
            tr.innerHTML = `<td class="col-checkbox"><input type="checkbox" class="edit-cb" data-idx="${idx}"></td>
                <td><select class="cell-input" data-field="customer_id">${customerOpts(o.customer_id)}</select></td>
                <td><select class="cell-input" data-field="product_code">${productOpts(o.product_code)}</select></td>
                <td class="cell-num"><input type="number" class="cell-input" data-field="order_sum" value="${o.order_sum || 0}" step="0.01"></td>
                <td class="cell-num"><input type="number" class="cell-input" data-field="shipped_fact" value="${o.shipped_fact || 0}" step="0.01"></td>
                <td class="cell-num"><input type="number" class="cell-input" data-field="order_value" value="${o.order_value || 0}" step="0.01"></td>
                <td><button class="btn-icon danger" onclick="deleteEditRow(${idx})">🗑️</button></td>`;
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
                    editRows[idx][f] = f.endsWith('_id') ? this.value : (parseFloat(this.value) || 0);
                });
            });
        });
    }

    function updateEditBtn() { btnDeleteEditRows.disabled = document.querySelectorAll('.edit-cb:checked').length === 0 }
    editSelectAll.addEventListener('change', function () { document.querySelectorAll('.edit-cb').forEach(cb => cb.checked = this.checked); updateEditBtn() });
    editBody.addEventListener('change', e => { if (e.target.classList.contains('edit-cb')) updateEditBtn() });

    window.deleteEditRow = function (idx) { editRows.splice(idx, 1); renderEditTable() };

    btnDeleteEditRows.addEventListener('click', function () {
        const idxs = Array.from(document.querySelectorAll('.edit-cb:checked')).map(cb => parseInt(cb.dataset.idx)).sort((a, b) => b - a);
        idxs.forEach(i => editRows.splice(i, 1));
        editSelectAll.checked = false;
        renderEditTable();
    });

    btnAddEditRow.addEventListener('click', function () {
        editRows.push({ id: Date.now(), customer_id: '', product_code: '', order_sum: 0, shipped_fact: 0, order_value: 0 });
        renderEditTable();
    });

    btnSaveChanges.addEventListener('click', function () {
        StorageService.updateJournalOrdersRows(currentDate, editRows);
        showToast('Изменения сохранены', 'success');
        editMode.style.display = 'none';
        mainView.style.display = 'block';
        renderMain();
    });

    renderMain();
})();
