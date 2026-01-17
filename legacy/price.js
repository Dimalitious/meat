(function () {
    const supplierSelect = document.getElementById('supplier-select'), tableBody = document.getElementById('table-body'), emptyState = document.getElementById('empty-state'), toast = document.getElementById('toast');

    function esc(s) { return s ? String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : '' }

    function loadSuppliers() {
        let opts = '<option value="">— Выберите —</option>';
        StorageService.getSuppliers().forEach(s => opts += `<option value="${s.supplier_id}">${esc(s.supplier_name)}</option>`);
        supplierSelect.innerHTML = opts;
    }

    function render() {
        const supplierId = supplierSelect.value;
        if (!supplierId) { tableBody.innerHTML = ''; emptyState.style.display = 'block'; return }
        emptyState.style.display = 'none';
        const priceList = StorageService.getPriceListForSupplier(supplierId);
        let products = StorageService.getProducts().slice();
        // Sort: Говядина, Баранина, Курица, then rest A-Z
        const catOrder = ['говядина', 'баранина', 'курица'];
        products.sort((a, b) => {
            const catA = (a.category || '').toLowerCase(), catB = (b.category || '').toLowerCase();
            const idxA = catOrder.findIndex(c => catA.includes(c)), idxB = catOrder.findIndex(c => catB.includes(c));
            const oA = idxA >= 0 ? idxA : 99, oB = idxB >= 0 ? idxB : 99;
            if (oA !== oB) return oA - oB;
            return (a.product_name || '').localeCompare(b.product_name || '', 'ru');
        });
        tableBody.innerHTML = '';
        products.forEach(p => {
            const price = priceList[p.product_code] || '';
            const tr = document.createElement('tr'); tr.dataset.code = p.product_code;
            tr.innerHTML = `<td>${esc(p.product_name)}</td><td>${esc(p.category || '')}</td><td><input type="number" class="cell-input price-input" value="${price}" min="0" step="0.01" style="width:100px"></td>`;
            tableBody.appendChild(tr);
        });
        attachListeners();
    }

    function attachListeners() {
        const supplierId = supplierSelect.value; if (!supplierId) return;
        tableBody.querySelectorAll('tr').forEach(tr => {
            const code = tr.dataset.code, inp = tr.querySelector('.price-input');
            inp.addEventListener('change', () => { StorageService.savePriceForProduct(supplierId, code, parseFloat(inp.value) || 0); showToast('Сохранено', 'success') });
        });
    }

    supplierSelect.addEventListener('change', render);
    function showToast(msg, type) { toast.textContent = msg; toast.className = 'toast ' + type; toast.style.display = 'block'; setTimeout(() => toast.style.display = 'none', 2000) }
    loadSuppliers(); render();
})();
