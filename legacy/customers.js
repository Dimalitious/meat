(function () {
    const tableBody = document.getElementById('table-body'),
        emptyState = document.getElementById('empty-state'),
        selectAll = document.getElementById('select-all'),
        btnDelete = document.getElementById('btn-delete-selected'),
        btnAdd = document.getElementById('btn-add'),
        fileImport = document.getElementById('file-import'),
        modal = document.getElementById('item-modal'),
        modalTitle = document.getElementById('modal-title'),
        form = document.getElementById('item-form'),
        modalClose = document.getElementById('modal-close'),
        btnCancel = document.getElementById('btn-cancel'),
        editId = document.getElementById('edit-id'),
        inpDistrict = document.getElementById('inp-district'),
        inpManagerId = document.getElementById('inp-manager-id'),
        inpManagerName = document.getElementById('inp-manager-name'),
        managerModal = document.getElementById('manager-modal'),
        managerSearch = document.getElementById('manager-search'),
        managerList = document.getElementById('manager-list'),
        confirmModal = document.getElementById('confirm-modal'),
        confirmMessage = document.getElementById('confirm-message'),
        confirmOk = document.getElementById('confirm-ok-btn'),
        confirmCancel = document.getElementById('confirm-cancel-btn'),
        toast = document.getElementById('toast');

    let pendingAction = null;
    let currentEditingCustomerId = null; // For inline manager selection

    function esc(s) { return s ? String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : '' }

    function districtOpts(sel = '') {
        let o = '<option value="">—</option>';
        StorageService.getDistricts().forEach(d => o += `<option value="${d.district_id}" ${d.district_id === sel ? 'selected' : ''}>${esc(d.district_name)}</option>`);
        return o;
    }

    function render() {
        const items = StorageService.getCustomers(),
            districts = StorageService.getDistricts(),
            managers = StorageService.getManagers();
        tableBody.innerHTML = '';
        emptyState.style.display = items.length === 0 ? 'block' : 'none';

        items.forEach(c => {
            const dist = districts.find(d => String(d.district_id) === String(c.district_id));
            const manager = managers.find(m => String(m.manager_id) === String(c.manager_id));
            const managerName = manager ? manager.manager_name : '';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="col-checkbox"><input type="checkbox" class="row-cb" data-id="${c.customer_id}"></td>
                <td>${esc(c.customer_id)}</td>
                <td>${esc(c.customer_name)}</td>
                <td>${esc(c.legal_name || '')}</td>
                <td>${esc(dist ? dist.district_name : '')}</td>
                <td><span class="manager-cell ${managerName ? '' : 'empty'}" data-customer-id="${c.customer_id}">${managerName || 'Выбрать...'}</span></td>
                <td class="col-actions">
                    <button class="btn-icon" onclick="editItem('${c.customer_id}')">✏️</button>
                    <button class="btn-icon danger" onclick="deleteItem('${c.customer_id}')">🗑️</button>
                </td>`;
            tableBody.appendChild(tr);
        });

        // Attach click handlers for manager cells
        tableBody.querySelectorAll('.manager-cell').forEach(cell => {
            cell.addEventListener('click', function () {
                currentEditingCustomerId = this.dataset.customerId;
                openManagerModalForCell();
            });
        });

        updateBtn();
    }

    function updateBtn() { btnDelete.disabled = document.querySelectorAll('.row-cb:checked').length === 0 }

    selectAll.addEventListener('change', function () { document.querySelectorAll('.row-cb').forEach(cb => cb.checked = this.checked); updateBtn() });
    tableBody.addEventListener('change', e => { if (e.target.classList.contains('row-cb')) updateBtn() });

    btnDelete.addEventListener('click', function () {
        const ids = Array.from(document.querySelectorAll('.row-cb:checked')).map(cb => cb.dataset.id);
        if (!ids.length) return;
        showConfirm(`Удалить ${ids.length}?`, () => {
            StorageService.deleteCustomers(ids);
            selectAll.checked = false;
            render();
            showToast('Удалено', 'success');
        });
    });

    window.deleteItem = id => showConfirm('Удалить?', () => { StorageService.deleteCustomers([id]); render(); showToast('Удалено', 'success') });
    btnAdd.addEventListener('click', () => openModal());
    window.editItem = id => { const c = StorageService.getCustomers().find(x => String(x.customer_id) === String(id)); if (c) openModal(c) };

    function openModal(c = null) {
        form.reset();
        inpDistrict.innerHTML = districtOpts(c ? c.district_id : '');
        inpManagerId.value = '';
        inpManagerName.value = '';

        if (c) {
            modalTitle.textContent = 'Редактировать';
            editId.value = c.customer_id;
            document.getElementById('inp-id').value = c.customer_id;
            document.getElementById('inp-id').readOnly = true;
            document.getElementById('inp-name').value = c.customer_name || '';
            document.getElementById('inp-legal').value = c.legal_name || '';

            // Set manager
            if (c.manager_id) {
                const manager = StorageService.getManagers().find(m => String(m.manager_id) === String(c.manager_id));
                inpManagerId.value = c.manager_id;
                inpManagerName.value = manager ? manager.manager_name : '';
            }
        } else {
            modalTitle.textContent = 'Добавить';
            editId.value = '';
            document.getElementById('inp-id').readOnly = false;
        }
        modal.classList.add('open');
    }

    function closeModal() { modal.classList.remove('open') }
    modalClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const id = document.getElementById('inp-id').value.trim(),
            name = document.getElementById('inp-name').value.trim();
        if (!id || !name) { showToast('Заполните', 'error'); return }

        StorageService.upsertCustomers([{
            customer_id: id,
            customer_name: name,
            legal_name: document.getElementById('inp-legal').value.trim(),
            district_id: inpDistrict.value,
            manager_id: inpManagerId.value || null
        }]);
        closeModal();
        render();
        showToast('Сохранено', 'success');
    });

    // Manager modal functions
    window.openManagerModal = function () {
        currentEditingCustomerId = null; // We're in form mode
        managerSearch.value = '';
        renderManagerList('');
        managerModal.classList.add('open');
        managerSearch.focus();
    };

    function openManagerModalForCell() {
        managerSearch.value = '';
        renderManagerList('');
        managerModal.classList.add('open');
        managerSearch.focus();
    }

    window.closeManagerModal = function () {
        managerModal.classList.remove('open');
        currentEditingCustomerId = null;
    };

    window.clearManager = function () {
        inpManagerId.value = '';
        inpManagerName.value = '';
    };

    managerSearch.addEventListener('input', function () {
        renderManagerList(this.value);
    });

    function renderManagerList(searchQuery) {
        let managers = StorageService.getManagers();

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            managers = managers.filter(m =>
                (m.manager_name || '').toLowerCase().includes(q) ||
                (m.manager_id || '').toLowerCase().includes(q)
            );
        }

        managerList.innerHTML = '';
        if (managers.length === 0) {
            managerList.innerHTML = '<div style="text-align:center;padding:1rem;opacity:.7">Менеджеры не найдены. Добавьте в справочнике.</div>';
            return;
        }

        managers.forEach(m => {
            const div = document.createElement('div');
            div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:.6rem .8rem;border-bottom:1px solid var(--border);cursor:pointer;';
            div.innerHTML = `<span>${esc(m.manager_name)} <small style="opacity:.6">[${esc(m.manager_id)}]</small></span>`;
            div.addEventListener('click', () => selectManager(m));
            div.addEventListener('mouseenter', function () { this.style.background = 'rgba(99,102,241,.1)'; });
            div.addEventListener('mouseleave', function () { this.style.background = ''; });
            managerList.appendChild(div);
        });
    }

    function selectManager(manager) {
        if (currentEditingCustomerId) {
            // Direct cell edit - update customer immediately
            const customers = StorageService.getCustomers();
            const customer = customers.find(c => String(c.customer_id) === String(currentEditingCustomerId));
            if (customer) {
                StorageService.upsertCustomers([{ ...customer, manager_id: manager.manager_id }]);
                render();
                showToast('Менеджер назначен', 'success');
            }
        } else {
            // Form mode - just fill the input
            inpManagerId.value = manager.manager_id;
            inpManagerName.value = manager.manager_name;
        }
        closeManagerModal();
    }

    // Excel import
    fileImport.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (ev) {
            try {
                const data = new Uint8Array(ev.target.result);
                const wb = XLSX.read(data, { type: 'array' });
                let rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
                if (rows.length && String(rows[0][0] || '').toLowerCase().match(/id|customer/)) rows = rows.slice(1);
                const items = rows.filter(r => r && r[0]).map(r => ({
                    customer_id: String(r[0]).trim(),
                    customer_name: String(r[1] || '').trim(),
                    legal_name: String(r[2] || '').trim(),
                    district_id: String(r[3] || '').trim(),
                    manager_id: String(r[4] || '').trim() || null
                }));
                const res = StorageService.upsertCustomers(items);
                render();
                showToast(`+${res.added}/${res.updated}`, 'success');
            } catch (err) {
                showToast('Ошибка', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
        fileImport.value = '';
    });

    function showConfirm(msg, onOk) { confirmMessage.textContent = msg; pendingAction = onOk; confirmModal.classList.add('open') }
    function closeConfirm() { confirmModal.classList.remove('open'); pendingAction = null }
    confirmOk.addEventListener('click', () => { if (pendingAction) pendingAction(); closeConfirm() });
    confirmCancel.addEventListener('click', closeConfirm);
    function showToast(msg, type) { toast.textContent = msg; toast.className = 'toast ' + type; toast.style.display = 'block'; setTimeout(() => toast.style.display = 'none', 3000) }

    render();
})();
