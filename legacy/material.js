(function () {
    const tableBody = document.getElementById('table-body'), emptyState = document.getElementById('empty-state'), selectAll = document.getElementById('select-all'), btnDelete = document.getElementById('btn-delete-selected'), btnAdd = document.getElementById('btn-add'), modal = document.getElementById('item-modal'), modalTitle = document.getElementById('modal-title'), form = document.getElementById('item-form'), modalClose = document.getElementById('modal-close'), btnCancel = document.getElementById('btn-cancel'), editId = document.getElementById('edit-id'), confirmModal = document.getElementById('confirm-modal'), confirmMessage = document.getElementById('confirm-message'), confirmOk = document.getElementById('confirm-ok-btn'), confirmCancel = document.getElementById('confirm-cancel-btn'), toast = document.getElementById('toast'), inpProduct = document.getElementById('inp-product');
    let pendingAction = null;

    function productOpts(sel = '') { let o = '<option value="">—</option>'; StorageService.getProducts().forEach(p => o += `<option value="${p.product_code}" ${p.product_code === sel ? 'selected' : ''}>${esc(p.product_name)}</option>`); return o }
    function esc(s) { return s ? String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : '' }

    function render() {
        const items = StorageService.getMaterialReports(); tableBody.innerHTML = ''; emptyState.style.display = items.length === 0 ? 'block' : 'none';
        items.forEach(r => {
            const p = StorageService.getProductByCode(r.product_code);
            const cat = p ? p.category || '' : '';
            const endStock = (parseFloat(r.start_stock) || 0) + (parseFloat(r.income) || 0) - (parseFloat(r.expense) || 0);
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="col-checkbox"><input type="checkbox" class="row-cb" data-id="${r.id}"></td>
                <td>${esc(r.date)}</td><td>${esc(p ? p.product_name : '')}</td><td>${esc(cat)}</td>
                <td>${r.start_stock || 0}</td><td>${r.income || 0}</td><td>${r.expense || 0}</td><td>${endStock.toFixed(2)}</td>
                <td>${esc(r.comment || '')}</td>
                <td class="col-actions"><button class="btn-icon" onclick="editItem(${r.id})">✏️</button><button class="btn-icon danger" onclick="deleteItem(${r.id})">🗑️</button></td>`;
            tableBody.appendChild(tr);
        });
        updateBtn();
    }

    function updateBtn() { btnDelete.disabled = document.querySelectorAll('.row-cb:checked').length === 0 }
    selectAll.addEventListener('change', function () { document.querySelectorAll('.row-cb').forEach(cb => cb.checked = this.checked); updateBtn() });
    tableBody.addEventListener('change', e => { if (e.target.classList.contains('row-cb')) updateBtn() });
    btnDelete.addEventListener('click', function () { const ids = Array.from(document.querySelectorAll('.row-cb:checked')).map(cb => parseInt(cb.dataset.id)); if (!ids.length) return; showConfirm(`Удалить ${ids.length}?`, () => { StorageService.deleteMaterialReports(ids); selectAll.checked = false; render(); showToast('Удалено', 'success') }) });
    window.deleteItem = id => showConfirm('Удалить?', () => { StorageService.deleteMaterialReports([id]); render(); showToast('Удалено', 'success') });
    btnAdd.addEventListener('click', () => openModal());
    window.editItem = id => { const r = StorageService.getMaterialReports().find(x => x.id === id); if (r) openModal(r) };

    function openModal(r = null) {
        form.reset(); inpProduct.innerHTML = productOpts(r ? r.product_code : '');
        if (r) { modalTitle.textContent = 'Редактировать'; editId.value = r.id; document.getElementById('inp-date').value = r.date || ''; document.getElementById('inp-start').value = r.start_stock || ''; document.getElementById('inp-income').value = r.income || ''; document.getElementById('inp-expense').value = r.expense || ''; document.getElementById('inp-comment').value = r.comment || '' }
        else { modalTitle.textContent = 'Добавить'; editId.value = '' }
        modal.classList.add('open');
    }
    function closeModal() { modal.classList.remove('open') }
    modalClose.addEventListener('click', closeModal); btnCancel.addEventListener('click', closeModal);
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const data = { date: document.getElementById('inp-date').value, product_code: inpProduct.value, start_stock: parseFloat(document.getElementById('inp-start').value) || 0, income: parseFloat(document.getElementById('inp-income').value) || 0, expense: parseFloat(document.getElementById('inp-expense').value) || 0, comment: document.getElementById('inp-comment').value };
        if (editId.value) { StorageService.updateMaterialReport(parseInt(editId.value), data) } else { StorageService.addMaterialReport(data) }
        closeModal(); render(); showToast('Сохранено', 'success');
    });

    function showConfirm(msg, onOk) { confirmMessage.textContent = msg; pendingAction = onOk; confirmModal.classList.add('open') }
    function closeConfirm() { confirmModal.classList.remove('open'); pendingAction = null }
    confirmOk.addEventListener('click', () => { if (pendingAction) pendingAction(); closeConfirm() }); confirmCancel.addEventListener('click', closeConfirm);
    function showToast(msg, type) { toast.textContent = msg; toast.className = 'toast ' + type; toast.style.display = 'block'; setTimeout(() => toast.style.display = 'none', 3000) }
    render();
})();
