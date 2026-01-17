(function () {
    const suppliersList = document.getElementById('suppliers-list'),
        mmlArea = document.getElementById('mml-area'),
        mmlToolbar = document.getElementById('mml-toolbar'),
        btnAddProduct = document.getElementById('btn-add-product'),
        btnDeleteSelected = document.getElementById('btn-delete-selected'),
        productsModal = document.getElementById('products-modal'),
        productsSearch = document.getElementById('products-search'),
        productsList = document.getElementById('products-list'),
        newSupplierName = document.getElementById('new-supplier-name'),
        btnAddSupplier = document.getElementById('btn-add-supplier'),
        categoryTabs = document.getElementById('category-tabs'),
        editModal = document.getElementById('edit-modal'),
        editSupplierId = document.getElementById('edit-supplier-id'),
        editSupplierName = document.getElementById('edit-supplier-name'),
        editSupplierLegal = document.getElementById('edit-supplier-legal'),
        confirmModal = document.getElementById('confirm-modal'),
        confirmMessage = document.getElementById('confirm-message'),
        confirmOk = document.getElementById('confirm-ok-btn'),
        confirmCancel = document.getElementById('confirm-cancel-btn'),
        toast = document.getElementById('toast'),
        fileImport = document.getElementById('file-import'),
        supplierSearch = document.getElementById('supplier-search');

    let selectedSupplier = null;
    let activeCategory = 'Все';
    let pendingAction = null;
    let supplierSearchQuery = '';

    function esc(s) { return s ? String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : ''; }
    function showToast(msg, type) { toast.textContent = msg; toast.className = 'toast ' + type; toast.style.display = 'block'; setTimeout(() => toast.style.display = 'none', 3000); }
    function showConfirm(msg, onOk) { confirmMessage.textContent = msg; pendingAction = onOk; confirmModal.classList.add('open'); }
    function closeConfirm() { confirmModal.classList.remove('open'); pendingAction = null; }

    confirmOk.addEventListener('click', () => { if (pendingAction) pendingAction(); closeConfirm(); });
    confirmCancel.addEventListener('click', closeConfirm);

    // Supplier search
    supplierSearch.addEventListener('input', function () {
        supplierSearchQuery = this.value.toLowerCase().trim();
        renderSuppliers();
    });

    // Render suppliers list
    function renderSuppliers() {
        let suppliers = StorageService.getSuppliers();

        // Filter by search query
        if (supplierSearchQuery) {
            suppliers = suppliers.filter(s =>
                (s.supplier_name || '').toLowerCase().includes(supplierSearchQuery) ||
                (s.legal_name || '').toLowerCase().includes(supplierSearchQuery)
            );
        }

        if (suppliers.length === 0) {
            suppliersList.innerHTML = `<div class="mml-note">${supplierSearchQuery ? 'Ничего не найдено' : 'Нет поставщиков'}</div>`;
            return;
        }
        suppliersList.innerHTML = '';
        suppliers.forEach(s => {
            const div = document.createElement('div');
            div.className = 'supplier-item' + (selectedSupplier === s.supplier_id ? ' active' : '');
            div.innerHTML = `<span>${esc(s.supplier_name)}</span><span class="del-btn" data-sid="${s.supplier_id}">✕</span>`;
            div.addEventListener('click', e => {
                if (e.target.classList.contains('del-btn')) return;
                selectedSupplier = s.supplier_id;
                renderSuppliers();
                renderMML();
            });
            div.addEventListener('dblclick', () => openEditModal(s));
            div.querySelector('.del-btn').addEventListener('click', e => {
                e.stopPropagation();
                showConfirm(`Удалить "${s.supplier_name}"?`, () => {
                    StorageService.deleteSuppliers([s.supplier_id]);
                    if (selectedSupplier === s.supplier_id) selectedSupplier = null;
                    renderSuppliers();
                    renderMML();
                    showToast('Удалено', 'success');
                });
            });
            suppliersList.appendChild(div);
        });
    }

    // Add new supplier
    btnAddSupplier.addEventListener('click', () => {
        const name = newSupplierName.value.trim();
        if (!name) { showToast('Введите название', 'error'); return; }
        const newId = 'sup_' + Date.now();
        StorageService.upsertSuppliers([{ supplier_id: newId, supplier_name: name }]);
        selectedSupplier = newId;
        newSupplierName.value = '';
        renderSuppliers();
        renderMML();
        showToast('Поставщик добавлен', 'success');
    });

    // Edit modal
    function openEditModal(s) {
        editSupplierId.value = s.supplier_id;
        editSupplierName.value = s.supplier_name || '';
        editSupplierLegal.value = s.legal_name || '';
        editModal.classList.add('open');
    }
    window.closeEditModal = () => editModal.classList.remove('open');
    window.saveSupplierEdit = () => {
        const id = editSupplierId.value;
        const name = editSupplierName.value.trim();
        if (!name) { showToast('Введите название', 'error'); return; }
        StorageService.upsertSuppliers([{
            supplier_id: id,
            supplier_name: name,
            legal_name: editSupplierLegal.value.trim()
        }]);
        closeEditModal();
        renderSuppliers();
        showToast('Сохранено', 'success');
    };

    // Category tabs
    function renderCategoryTabs() {
        const products = StorageService.getProducts();
        const rawCategories = [...new Set(products.map(p => p.category || 'Без категории'))].sort();
        const categories = ['Все', ...rawCategories];

        categoryTabs.innerHTML = '';
        categories.forEach(cat => {
            const btn = document.createElement('div');
            btn.className = `tab ${cat === activeCategory ? 'active' : ''}`;
            btn.textContent = cat;
            btn.addEventListener('click', () => {
                activeCategory = cat;
                renderCategoryTabs();
                renderMML();
            });
            categoryTabs.appendChild(btn);
        });
    }

    // Render MML table - shows ONLY products in MML (empty by default)
    function renderMML() {
        if (!selectedSupplier) {
            mmlToolbar.style.display = 'none';
            mmlArea.innerHTML = '<div class="mml-note">Выберите поставщика для настройки MML</div>';
            return;
        }
        mmlToolbar.style.display = 'flex';

        const supplier = StorageService.getSuppliers().find(s => s.supplier_id === selectedSupplier);
        const mml = StorageService.getSupplierMML(selectedSupplier);
        const allProducts = StorageService.getProducts();

        // Get only products that are in MML
        let products = mml.map(code => allProducts.find(p => p.product_code === code)).filter(Boolean);

        // Filter by category
        if (activeCategory !== 'Все') {
            products = products.filter(p => (p.category || 'Без категории') === activeCategory);
        }

        let html = `<div style="padding:1rem;background:var(--bg-secondary);border-radius:8px;margin-bottom:1rem;">
            <strong>📦 MML для: ${esc(supplier?.supplier_name || '')}</strong>
            <span style="margin-left:1rem;opacity:.7">Всего: ${mml.length} товаров</span>
        </div>`;
        html += `<table><thead><tr><th style="width:40px;"><input type="checkbox" id="mml-select-all"></th><th>Код</th><th>Товар</th><th>Категория</th></tr></thead><tbody>`;

        if (products.length === 0) {
            html += '<tr><td colspan="4" style="text-align:center;">MML пуст. Нажмите «Добавить из справочника»</td></tr>';
        }

        products.forEach(p => {
            html += `<tr data-code="${p.product_code}">
                <td><input type="checkbox" class="mml-cb"></td>
                <td>${esc(p.product_code)}</td>
                <td>${esc(p.short_name_morning || p.product_name)}</td>
                <td>${esc(p.category || '')}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        mmlArea.innerHTML = html;

        // Select all checkbox
        const selectAll = document.getElementById('mml-select-all');
        if (selectAll) {
            selectAll.addEventListener('change', function () {
                mmlArea.querySelectorAll('.mml-cb').forEach(cb => cb.checked = this.checked);
            });
        }
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
                if (rows.length && String(rows[0][0] || '').toLowerCase().match(/id|supplier/)) rows = rows.slice(1);
                const items = rows.filter(r => r && r[0]).map(r => ({
                    supplier_id: String(r[0]).trim(),
                    supplier_name: String(r[1] || '').trim(),
                    legal_name: String(r[2] || '').trim()
                }));
                const res = StorageService.upsertSuppliers(items);
                renderSuppliers();
                showToast(`+${res.added}/${res.updated} upd`, 'success');
            } catch (err) {
                showToast('Ошибка импорта', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
        fileImport.value = '';
    });

    // Add Product button - opens search modal
    btnAddProduct.addEventListener('click', () => {
        if (!selectedSupplier) return;
        productsSearch.value = '';
        renderProductsList('');
        productsModal.classList.add('open');
        productsSearch.focus();
    });

    productsSearch.addEventListener('input', function () {
        renderProductsList(this.value);
    });

    function renderProductsList(query) {
        const mml = StorageService.getSupplierMML(selectedSupplier);
        let products = StorageService.getProducts();

        // Filter by search
        if (query.trim()) {
            const q = query.toLowerCase().trim();
            products = products.filter(p => {
                const name = (p.short_name_morning || p.product_name || '').toLowerCase();
                const code = (p.product_code || '').toLowerCase();
                return name.includes(q) || code.includes(q);
            });
        }

        productsList.innerHTML = '';
        if (products.length === 0) {
            productsList.innerHTML = '<div style="text-align:center;padding:1rem;opacity:.7">Ничего не найдено</div>';
            return;
        }

        products.forEach(p => {
            const inMML = mml.includes(p.product_code);
            const div = document.createElement('div');
            div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:.5rem;border-bottom:1px solid var(--border)';
            div.innerHTML = `<span>${esc(p.short_name_morning || p.product_name)} <small style="opacity:.6">[${esc(p.product_code)}]</small></span>
                <button class="btn btn-sm ${inMML ? 'btn-secondary' : 'btn-success'}" ${inMML ? 'disabled' : ''}>${inMML ? 'Добавлен' : '➕'}</button>`;
            if (!inMML) {
                div.querySelector('button').addEventListener('click', function () {
                    StorageService.addProductToMML(selectedSupplier, p.product_code);
                    this.disabled = true;
                    this.textContent = 'Добавлен';
                    this.className = 'btn btn-sm btn-secondary';
                    renderMML();
                });
            }
            productsList.appendChild(div);
        });
    }

    window.closeProductsModal = () => productsModal.classList.remove('open');

    // Delete Selected button - removes checked items from MML
    btnDeleteSelected.addEventListener('click', () => {
        if (!selectedSupplier) return;

        const checkedCodes = Array.from(mmlArea.querySelectorAll('.mml-cb:checked')).map(cb => cb.closest('tr').dataset.code);

        if (checkedCodes.length === 0) {
            showToast('Выберите позиции для удаления', 'info');
            return;
        }

        showConfirm(`Удалить ${checkedCodes.length} позиций из MML?`, () => {
            checkedCodes.forEach(code => StorageService.removeProductFromMML(selectedSupplier, code));
            showToast(`Удалено ${checkedCodes.length} позиций`, 'success');
            renderMML();
        });
    });

    // Init
    renderCategoryTabs();
    renderSuppliers();
    renderMML();
})();
