(function () {
    const tableBody = document.getElementById('table-body'), emptyState = document.getElementById('empty-state'), selectAll = document.getElementById('select-all'), btnDelete = document.getElementById('btn-delete-selected'), btnAdd = document.getElementById('btn-add'), fileImport = document.getElementById('file-import'), modal = document.getElementById('item-modal'), modalTitle = document.getElementById('modal-title'), form = document.getElementById('item-form'), modalClose = document.getElementById('modal-close'), btnCancel = document.getElementById('btn-cancel'), editId = document.getElementById('edit-id'), confirmModal = document.getElementById('confirm-modal'), confirmMessage = document.getElementById('confirm-message'), confirmOk = document.getElementById('confirm-ok-btn'), confirmCancel = document.getElementById('confirm-cancel-btn'), toast = document.getElementById('toast');
    let pendingAction = null;
    function esc(s) { return s ? String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : '' }
    function render() {
        const items = StorageService.getManagers(); tableBody.innerHTML = ''; emptyState.style.display = items.length === 0 ? 'block' : 'none';
        items.forEach(m => { const tr = document.createElement('tr'); tr.innerHTML = `<td class="col-checkbox"><input type="checkbox" class="row-cb" data-id="${m.manager_id}"></td><td>${esc(m.manager_id)}</td><td>${esc(m.manager_name)}</td><td class="col-actions"><button class="btn-icon" onclick="editItem('${m.manager_id}')">✏️</button><button class="btn-icon danger" onclick="deleteItem('${m.manager_id}')">🗑️</button></td>`; tableBody.appendChild(tr) });
        updateBtn();
    }
    function updateBtn() { btnDelete.disabled = document.querySelectorAll('.row-cb:checked').length === 0 }
    selectAll.addEventListener('change', function () { document.querySelectorAll('.row-cb').forEach(cb => cb.checked = this.checked); updateBtn() });
    tableBody.addEventListener('change', e => { if (e.target.classList.contains('row-cb')) updateBtn() });
    btnDelete.addEventListener('click', function () { const ids = Array.from(document.querySelectorAll('.row-cb:checked')).map(cb => cb.dataset.id); if (!ids.length) return; showConfirm(`Удалить ${ids.length}?`, () => { StorageService.deleteManagers(ids); selectAll.checked = false; render(); showToast('Удалено', 'success') }) });
    window.deleteItem = id => showConfirm('Удалить?', () => { StorageService.deleteManagers([id]); render(); showToast('Удалено', 'success') });
    btnAdd.addEventListener('click', () => openModal());
    window.editItem = id => { const m = StorageService.getManagers().find(x => String(x.manager_id) === String(id)); if (m) openModal(m) };
    function openModal(m = null) { form.reset(); if (m) { modalTitle.textContent = 'Редактировать'; editId.value = m.manager_id; document.getElementById('inp-id').value = m.manager_id; document.getElementById('inp-id').readOnly = true; document.getElementById('inp-name').value = m.manager_name || '' } else { modalTitle.textContent = 'Добавить'; editId.value = ''; document.getElementById('inp-id').readOnly = false } modal.classList.add('open') }
    function closeModal() { modal.classList.remove('open') }
    modalClose.addEventListener('click', closeModal); btnCancel.addEventListener('click', closeModal);
    form.addEventListener('submit', function (e) { e.preventDefault(); const id = document.getElementById('inp-id').value.trim(), name = document.getElementById('inp-name').value.trim(); if (!id || !name) { showToast('Заполните все поля', 'error'); return } StorageService.upsertManagers([{ manager_id: id, manager_name: name }]); closeModal(); render(); showToast('Сохранено', 'success') });
    fileImport.addEventListener('change', function (e) { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = function (ev) { try { const data = new Uint8Array(ev.target.result); const wb = XLSX.read(data, { type: 'array' }); let rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }); if (rows.length && String(rows[0][0] || '').toLowerCase().match(/id|номер|менедж/)) rows = rows.slice(1); const items = rows.filter(r => r && r[0]).map(r => ({ manager_id: String(r[0]).trim(), manager_name: String(r[1] || '').trim() })); const res = StorageService.upsertManagers(items); render(); showToast(`+${res.added}/${res.updated}`, 'success') } catch (err) { showToast('Ошибка импорта', 'error') } }; reader.readAsArrayBuffer(file); fileImport.value = '' });
    function showConfirm(msg, onOk) { confirmMessage.textContent = msg; pendingAction = onOk; confirmModal.classList.add('open') }
    function closeConfirm() { confirmModal.classList.remove('open'); pendingAction = null }
    confirmOk.addEventListener('click', () => { if (pendingAction) pendingAction(); closeConfirm() }); confirmCancel.addEventListener('click', closeConfirm);
    function showToast(msg, type) { toast.textContent = msg; toast.className = 'toast ' + type; toast.style.display = 'block'; setTimeout(() => toast.style.display = 'none', 3000) }
    render();
})();
