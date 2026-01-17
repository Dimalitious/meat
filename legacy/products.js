(function () {
    const tableBody = document.getElementById('table-body');
    const emptyState = document.getElementById('empty-state');
    const selectAll = document.getElementById('select-all');
    const btnDelete = document.getElementById('btn-delete-selected');
    const btnAdd = document.getElementById('btn-add');
    const fileImport = document.getElementById('file-import');
    const modal = document.getElementById('product-modal');
    const modalTitle = document.getElementById('modal-title');
    const form = document.getElementById('product-form');
    const modalClose = document.getElementById('modal-close');
    const btnCancel = document.getElementById('btn-cancel');
    const editCode = document.getElementById('edit-code');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmOk = document.getElementById('confirm-ok-btn');
    const confirmCancel = document.getElementById('confirm-cancel-btn');
    const toast = document.getElementById('toast');
    const filterCode = document.getElementById('filter-code');
    const filterName = document.getElementById('filter-name');
    const filterCategory = document.getElementById('filter-category');
    let pendingAction = null;

    function render() {
        let products = StorageService.getProducts();

        // Apply filters
        const codeFilter = (filterCode?.value || '').toLowerCase().trim();
        const nameFilter = (filterName?.value || '').toLowerCase().trim();
        const categoryFilter = (filterCategory?.value || '').toLowerCase().trim();

        if (codeFilter) {
            products = products.filter(p => (p.product_code || '').toLowerCase().includes(codeFilter));
        }
        if (nameFilter) {
            products = products.filter(p => (p.product_name || '').toLowerCase().includes(nameFilter));
        }
        if (categoryFilter) {
            products = products.filter(p => (p.category || '').toLowerCase().includes(categoryFilter));
        }

        tableBody.innerHTML = '';
        emptyState.style.display = products.length === 0 ? 'block' : 'none';
        products.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="col-checkbox"><input type="checkbox" class="row-cb" data-code="${p.product_code}"></td>
                <td>${esc(p.product_code)}</td><td>${esc(p.product_name)}</td><td>${esc(p.alt_name || '')}</td>
                <td>${esc(p.short_name_fsa || '')}</td><td>${esc(p.short_name_pl || '')}</td><td>${esc(p.short_name_morning || '')}</td>
                <td>${p.price_morning ? parseFloat(p.price_morning).toFixed(2) : '-'}</td>
                <td>${esc(p.category || '')}</td><td><span class="badge badge-${statusClass(p.status)}">${esc(p.status || '')}</span></td>
                <td>${p.coefficient != null ? p.coefficient : 1}</td><td>${p.loss_norm != null ? p.loss_norm : 0}%</td>
                <td class="col-actions"><button class="btn-icon" onclick="editProduct('${p.product_code}')">✏️</button><button class="btn-icon danger" onclick="deleteProduct('${p.product_code}')">🗑️</button></td>`;
            tableBody.appendChild(tr);
        });
        updateBtn();
    }
    function esc(s) { return s ? String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : '' }
    function statusClass(s) { if (!s) return 'inactive'; s = s.toLowerCase(); if (s.includes('актив') && !s.includes('неактив')) return 'active'; if (s.includes('неактив')) return 'inactive'; return 'archive' }
    function updateBtn() { btnDelete.disabled = document.querySelectorAll('.row-cb:checked').length === 0 }
    selectAll.addEventListener('change', function () { document.querySelectorAll('.row-cb').forEach(cb => cb.checked = this.checked); updateBtn() });
    tableBody.addEventListener('change', e => { if (e.target.classList.contains('row-cb')) updateBtn() });

    btnDelete.addEventListener('click', function () {
        const codes = Array.from(document.querySelectorAll('.row-cb:checked')).map(cb => cb.dataset.code);
        if (!codes.length) return;
        showConfirm(`Удалить ${codes.length}?`, () => { StorageService.deleteProducts(codes); selectAll.checked = false; render(); showToast('Удалено', 'success') });
    });
    window.deleteProduct = code => showConfirm('Удалить?', () => { StorageService.deleteProducts([code]); render(); showToast('Удалено', 'success') });
    btnAdd.addEventListener('click', () => openModal());
    window.editProduct = code => { const p = StorageService.getProductByCode(code); if (p) openModal(p) };

    function openModal(p = null) {
        form.reset();
        if (p) {
            modalTitle.textContent = 'Редактировать'; editCode.value = p.product_code;
            document.getElementById('inp-code').value = p.product_code; document.getElementById('inp-code').readOnly = true;
            document.getElementById('inp-name').value = p.product_name || '';
            document.getElementById('inp-alt').value = p.alt_name || '';
            document.getElementById('inp-fsa').value = p.short_name_fsa || '';
            document.getElementById('inp-pl').value = p.short_name_pl || '';
            document.getElementById('inp-morning').value = p.short_name_morning || '';
            document.getElementById('inp-price-morning').value = p.price_morning || '';
            document.getElementById('inp-category').value = p.category || '';
            document.getElementById('inp-status').value = p.status || 'активен';
            document.getElementById('inp-coeff').value = p.coefficient != null ? p.coefficient : 1;
            document.getElementById('inp-loss').value = p.loss_norm != null ? p.loss_norm : 0;
        } else {
            modalTitle.textContent = 'Добавить'; editCode.value = ''; document.getElementById('inp-code').readOnly = false;
            document.getElementById('inp-coeff').value = 1; document.getElementById('inp-loss').value = 0;
        }
        modal.classList.add('open');
    }
    function closeModal() { modal.classList.remove('open') }
    modalClose.addEventListener('click', closeModal); btnCancel.addEventListener('click', closeModal);

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const code = document.getElementById('inp-code').value.trim();
        const name = document.getElementById('inp-name').value.trim();
        if (!code || !name) { showToast('Заполните обязательные поля', 'error'); return }
        StorageService.upsertProducts([{
            product_code: code, product_name: name,
            alt_name: document.getElementById('inp-alt').value.trim(),
            short_name_fsa: document.getElementById('inp-fsa').value.trim(),
            short_name_pl: document.getElementById('inp-pl').value.trim(),
            short_name_morning: document.getElementById('inp-morning').value.trim(),
            price_morning: parseFloat(document.getElementById('inp-price-morning').value) || 0,
            category: document.getElementById('inp-category').value.trim(),
            status: document.getElementById('inp-status').value,
            coefficient: parseFloat(document.getElementById('inp-coeff').value) || 1,
            loss_norm: parseFloat(document.getElementById('inp-loss').value) || 0
        }]);
        closeModal(); render(); showToast('Сохранено', 'success');
    });

    fileImport.addEventListener('change', function (e) {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = function (ev) {
            try {
                const data = new Uint8Array(ev.target.result);
                const wb = XLSX.read(data, { type: 'array' });
                let rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
                if (rows.length && String(rows[0][0] || '').toLowerCase().match(/код|code|product/)) rows = rows.slice(1);
                const products = [], errors = [];
                rows.forEach((r, i) => {
                    if (!r || !r[0]) return;
                    let coeff = 1, loss = 0;
                    if (r[8] !== undefined && r[8] !== '') { const c = parseFloat(r[8]); if (isNaN(c)) { errors.push(i); return } coeff = c }
                    if (r[9] !== undefined && r[9] !== '') { const l = parseFloat(r[9]); if (!isNaN(l)) loss = l }
                    products.push({
                        product_code: String(r[0]).trim(), product_name: String(r[1] || '').trim(),
                        alt_name: String(r[2] || '').trim(), short_name_fsa: String(r[3] || '').trim(),
                        short_name_pl: String(r[4] || '').trim(), short_name_morning: String(r[5] || '').trim(),
                        category: String(r[6] || '').trim(), status: String(r[7] || 'активен').trim(),
                        coefficient: coeff, loss_norm: loss
                    });
                });
                const res = StorageService.upsertProducts(products);
                render(); showToast(`+${res.added} /${res.updated} upd / ${res.errors + errors.length} err`, 'success');
            } catch (err) { console.error(err); showToast('Ошибка', 'error') }
        };
        reader.readAsArrayBuffer(file); fileImport.value = '';
    });

    function showConfirm(msg, onOk) { confirmMessage.textContent = msg; pendingAction = onOk; confirmModal.classList.add('open') }
    function closeConfirm() { confirmModal.classList.remove('open'); pendingAction = null }
    confirmOk.addEventListener('click', () => { if (pendingAction) pendingAction(); closeConfirm() });
    confirmCancel.addEventListener('click', closeConfirm);
    function showToast(msg, type) { toast.textContent = msg; toast.className = 'toast ' + type; toast.style.display = 'block'; setTimeout(() => toast.style.display = 'none', 3000) }

    // Filter event listeners
    if (filterCode) filterCode.addEventListener('input', render);
    if (filterName) filterName.addEventListener('input', render);
    if (filterCategory) filterCategory.addEventListener('input', render);

    render();
})();
