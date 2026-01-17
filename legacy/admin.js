(function () {
    const tableBody = document.getElementById('table-body'), emptyState = document.getElementById('empty-state'), btnAdd = document.getElementById('btn-add'), modal = document.getElementById('item-modal'), modalTitle = document.getElementById('modal-title'), form = document.getElementById('item-form'), modalClose = document.getElementById('modal-close'), btnCancel = document.getElementById('btn-cancel'), editId = document.getElementById('edit-id'), confirmModal = document.getElementById('confirm-modal'), confirmMessage = document.getElementById('confirm-message'), confirmOk = document.getElementById('confirm-ok-btn'), confirmCancel = document.getElementById('confirm-cancel-btn'), toast = document.getElementById('toast');
    let pendingAction = null;

    function esc(s) { return s ? String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : '' }

    function render() {
        const users = StorageService.getUsers(); tableBody.innerHTML = ''; emptyState.style.display = users.length === 0 ? 'block' : 'none';
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${esc(u.username)}</td><td><span class="badge ${u.role === 'admin' ? 'badge-active' : 'badge-inactive'}">${u.role}</span></td><td>${u.active ? '✅' : '❌'}</td>
                <td class="col-actions"><button class="btn-icon" onclick="editItem(${u.id})">✏️</button><button class="btn-icon danger" onclick="deleteItem(${u.id})">🗑️</button></td>`;
            tableBody.appendChild(tr);
        });
    }

    btnAdd.addEventListener('click', () => openModal());
    window.editItem = id => { const u = StorageService.getUsers().find(x => x.id === id); if (u) openModal(u) };
    window.deleteItem = id => showConfirm('Удалить пользователя?', () => { StorageService.deleteUsers([id]); render(); showToast('Удалено', 'success') });

    function openModal(u = null) {
        form.reset();
        if (u) { modalTitle.textContent = 'Редактировать'; editId.value = u.id; document.getElementById('inp-username').value = u.username; document.getElementById('inp-username').readOnly = true; document.getElementById('inp-password').value = ''; document.getElementById('inp-password').placeholder = 'Оставьте пустым'; document.getElementById('inp-role').value = u.role; document.getElementById('inp-active').checked = u.active }
        else { modalTitle.textContent = 'Добавить'; editId.value = ''; document.getElementById('inp-username').readOnly = false; document.getElementById('inp-password').placeholder = '' }
        modal.classList.add('open');
    }
    function closeModal() { modal.classList.remove('open') }
    modalClose.addEventListener('click', closeModal); btnCancel.addEventListener('click', closeModal);

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const username = document.getElementById('inp-username').value.trim(), password = document.getElementById('inp-password').value, role = document.getElementById('inp-role').value, active = document.getElementById('inp-active').checked;
        if (!username) { showToast('Заполните логин', 'error'); return }
        if (editId.value) {
            const updates = { role, active };
            if (password) updates.password = password;
            StorageService.updateUser(parseInt(editId.value), updates);
        } else {
            if (!password) { showToast('Укажите пароль', 'error'); return }
            StorageService.addUser({ username, password, role, active });
        }
        closeModal(); render(); showToast('Сохранено', 'success');
    });

    function showConfirm(msg, onOk) { confirmMessage.textContent = msg; pendingAction = onOk; confirmModal.classList.add('open') }
    function closeConfirm() { confirmModal.classList.remove('open'); pendingAction = null }
    confirmOk.addEventListener('click', () => { if (pendingAction) pendingAction(); closeConfirm() }); confirmCancel.addEventListener('click', closeConfirm);
    function showToast(msg, type) { toast.textContent = msg; toast.className = 'toast ' + type; toast.style.display = 'block'; setTimeout(() => toast.style.display = 'none', 3000) }
    render();
})();
