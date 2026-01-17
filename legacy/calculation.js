(function () {
    const tableBody = document.getElementById('table-body'), emptyState = document.getElementById('empty-state'), selectAll = document.getElementById('select-all'), btnDelete = document.getElementById('btn-delete-selected'), btnAdd = document.getElementById('btn-add'), modal = document.getElementById('item-modal'), modalTitle = document.getElementById('modal-title'), form = document.getElementById('item-form'), modalClose = document.getElementById('modal-close'), btnCancel = document.getElementById('btn-cancel'), editId = document.getElementById('edit-id'), confirmModal = document.getElementById('confirm-modal'), confirmMessage = document.getElementById('confirm-message'), confirmOk = document.getElementById('confirm-ok-btn'), confirmCancel = document.getElementById('confirm-cancel-btn'), toast = document.getElementById('toast'), inpProduct = document.getElementById('inp-product');
    let pendingAction = null;

    function productOpts(sel = '') { let o = '<option value="">—</option>'; StorageService.getProducts().forEach(p => o += `<option value="${p.product_code}" ${p.product_code === sel ? 'selected' : ''}>${esc(p.product_name)}</option>`); return o }
    function esc(s) { return s ? String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : '' }

    function render() {
        const items = StorageService.getCalculations(); tableBody.innerHTML = ''; emptyState.style.display = items.length === 0 ? 'block' : 'none';
        items.forEach(c => {
            const p = StorageService.getProductByCode(c.product_code);
            const cat = p ? p.category || '' : '', lossNorm = p ? p.loss_norm || 0 : 0, coeff = p ? p.coefficient || 1 : 1;
            const baseWeight = parseFloat(c.base_weight) || 0;
            const losses = baseWeight * (lossNorm / 100);
            const netWeight = baseWeight - losses;
            const finalWeight = netWeight * coeff;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="col-checkbox"><input type="checkbox" class="row-cb" data-id="${c.id}"></td>
                <td>${esc(c.date)}</td><td>${esc(p ? p.product_name : '')}</td><td>${esc(cat)}</td>
                <td>${baseWeight.toFixed(2)}</td><td>${lossNorm}%</td><td>${losses.toFixed(2)}</td><td>${netWeight.toFixed(2)}</td><td>${coeff}</td><td>${finalWeight.toFixed(2)}</td>
                <td>${esc(c.comment || '')}</td>
                <td class="col-actions"><button class="btn-icon" onclick="editItem(${c.id})">✏️</button><button class="btn-icon danger" onclick="deleteItem(${c.id})">🗑️</button></td>`;
            tableBody.appendChild(tr);
        });
        updateBtn();
    }

    function updateBtn() { btnDelete.disabled = document.querySelectorAll('.row-cb:checked').length === 0 }
    selectAll.addEventListener('change', function () { document.querySelectorAll('.row-cb').forEach(cb => cb.checked = this.checked); updateBtn() });
    tableBody.addEventListener('change', e => { if (e.target.classList.contains('row-cb')) updateBtn() });
    btnDelete.addEventListener('click', function () { const ids = Array.from(document.querySelectorAll('.row-cb:checked')).map(cb => parseInt(cb.dataset.id)); if (!ids.length) return; showConfirm(`Удалить ${ids.length}?`, () => { StorageService.deleteCalculations(ids); selectAll.checked = false; render(); showToast('Удалено', 'success') }) });
    window.deleteItem = id => showConfirm('Удалить?', () => { StorageService.deleteCalculations([id]); render(); showToast('Удалено', 'success') });
    btnAdd.addEventListener('click', () => openModal());
    window.editItem = id => { const c = StorageService.getCalculations().find(x => x.id === id); if (c) openModal(c) };

    function openModal(c = null) {
        form.reset(); inpProduct.innerHTML = productOpts(c ? c.product_code : '');
        if (c) { modalTitle.textContent = 'Редактировать'; editId.value = c.id; document.getElementById('inp-date').value = c.date || ''; document.getElementById('inp-base').value = c.base_weight || ''; document.getElementById('inp-comment').value = c.comment || '' }
        else { modalTitle.textContent = 'Добавить'; editId.value = '' }
        modal.classList.add('open');
    }
    function closeModal() { modal.classList.remove('open') }
    modalClose.addEventListener('click', closeModal); btnCancel.addEventListener('click', closeModal);
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const data = { date: document.getElementById('inp-date').value, product_code: inpProduct.value, base_weight: parseFloat(document.getElementById('inp-base').value) || 0, comment: document.getElementById('inp-comment').value };
        if (editId.value) { StorageService.updateCalculation(parseInt(editId.value), data) } else { StorageService.addCalculation(data) }
        closeModal(); render(); showToast('Сохранено', 'success');
    });

    function showConfirm(msg, onOk) { confirmMessage.textContent = msg; pendingAction = onOk; confirmModal.classList.add('open') }
    function closeConfirm() { confirmModal.classList.remove('open'); pendingAction = null }
    confirmOk.addEventListener('click', () => { if (pendingAction) pendingAction(); closeConfirm() }); confirmCancel.addEventListener('click', closeConfirm);
    function showToast(msg, type) { toast.textContent = msg; toast.className = 'toast ' + type; toast.style.display = 'block'; setTimeout(() => toast.style.display = 'none', 3000) }
    render();
})();
