(function () {
    const clientList = document.getElementById('client-list'), detailBody = document.getElementById('detail-body'), detailFooter = document.getElementById('detail-footer'), emptyDetail = document.getElementById('empty-detail'), btnPrint = document.getElementById('btn-print'), btnSave = document.getElementById('btn-save'), printContainer = document.getElementById('print-container'), toast = document.getElementById('toast');
    let selectedCustomer = null, selectedOrders = [];
    function esc(s) { return s ? String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : '' }
    function showToast(msg, type) { toast.textContent = msg; toast.className = 'toast ' + type; toast.style.display = 'block'; setTimeout(() => toast.style.display = 'none', 3000) }

    function renderClients() {
        const processed = StorageService.getProcessedOrders(), customers = StorageService.getCustomers();
        const groups = {};
        processed.forEach(o => { if (!groups[o.customer_id]) groups[o.customer_id] = []; groups[o.customer_id].push(o) });
        clientList.innerHTML = '';
        if (Object.keys(groups).length === 0) { clientList.innerHTML = '<div class="empty-state"><p>Нет обработанных</p></div>'; emptyDetail.style.display = 'block'; return }
        Object.keys(groups).forEach(cid => {
            const cust = customers.find(c => String(c.customer_id) === String(cid));
            const item = document.createElement('div'); item.className = 'client-item' + (selectedCustomer === cid ? ' active' : ''); item.dataset.cid = cid;
            item.textContent = cust ? cust.customer_name : 'ID: ' + cid;
            item.addEventListener('click', () => selectClient(cid));
            clientList.appendChild(item);
        });
        if (selectedCustomer && groups[selectedCustomer]) renderDetail(groups[selectedCustomer]);
        else { emptyDetail.style.display = 'block'; detailBody.innerHTML = ''; detailFooter.innerHTML = '' }
    }

    function selectClient(cid) {
        selectedCustomer = cid;
        document.querySelectorAll('.client-item').forEach(c => c.classList.toggle('active', c.dataset.cid === cid));
        selectedOrders = StorageService.getProcessedOrders().filter(o => String(o.customer_id) === String(cid));
        renderDetail(selectedOrders);
    }

    function renderDetail(orders) {
        if (!orders.length) { emptyDetail.style.display = 'block'; detailBody.innerHTML = ''; detailFooter.innerHTML = ''; return }
        emptyDetail.style.display = 'none';
        const products = StorageService.getProducts();
        let totalSum = 0, totalWeight = 0;
        detailBody.innerHTML = '';
        orders.forEach(o => {
            const p = products.find(x => x.product_code === o.product_code);
            const price = (parseFloat(o.order_value) || 0) > 0 ? (parseFloat(o.order_sum) / parseFloat(o.order_value)).toFixed(2) : 0;
            totalSum += parseFloat(o.order_sum) || 0;
            totalWeight += parseFloat(o.shipped_fact) || 0;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${esc(o.shipment_date)}</td><td>${esc(o.payment_type)}</td><td>${esc(p ? p.product_name : '')}</td><td>${price}</td><td>${o.order_sum || 0}</td><td>${o.shipped_fact || 0}</td>`;
            detailBody.appendChild(tr);
        });
        detailFooter.innerHTML = `<tr style="font-weight:600;border-top:2px solid var(--border);"><td colspan="4">ИТОГО:</td><td>${totalSum.toFixed(2)}</td><td>${totalWeight.toFixed(2)}</td></tr>`;
    }

    const shipmentDateEl = document.getElementById('shipment-date');

    // Initialize date
    if (shipmentDateEl) shipmentDateEl.value = new Date().toISOString().split('T')[0];

    btnSave.addEventListener('click', function () {
        const processed = StorageService.getProcessedOrders();
        if (!processed.length) { showToast('Нет данных', 'error'); return }
        const date = shipmentDateEl ? shipmentDateEl.value : (processed[0]?.shipment_date || new Date().toISOString().split('T')[0]);
        const snapshot = StorageService.snapshotShipmentsToJournal(date);
        showToast(`Журнал отгрузок: ${snapshot.total_count} записей`, 'success');
    });

    // Generate invoice HTML for print
    function generateInvoiceHTML(orders, customer) {
        const products = StorageService.getProducts();
        let totalSum = 0, totalWeight = 0;
        let tableRows = '';

        orders.forEach((o, idx) => {
            const p = products.find(x => x.product_code === o.product_code);
            const price = (parseFloat(o.order_value) || 0) > 0 ? (parseFloat(o.order_sum) / parseFloat(o.order_value)).toFixed(2) : 0;
            const sum = parseFloat(o.order_sum) || 0;
            const weight = parseFloat(o.shipped_fact) || 0;
            totalSum += sum;
            totalWeight += weight;
            tableRows += `<tr>
                <td>${idx + 1}</td>
                <td>${esc(p ? p.product_name : '')}</td>
                <td class="num">${weight.toFixed(2)}</td>
                <td class="num">${price}</td>
                <td class="num">${sum.toFixed(2)}</td>
            </tr>`;
        });

        const date = orders[0]?.shipment_date || new Date().toISOString().split('T')[0];
        const paymentType = orders[0]?.payment_type || '';

        return `
            <div class="invoice">
                <div class="invoice-header">
                    <h2>НАКЛАДНАЯ</h2>
                </div>
                <div class="invoice-info">
                    <div>
                        <p><strong>Дата:</strong> ${date}</p>
                        <p><strong>Заказчик:</strong> ${esc(customer?.customer_name || '')}</p>
                    </div>
                    <div style="text-align:right;">
                        <p><strong>Тип оплаты:</strong> ${esc(paymentType)}</p>
                    </div>
                </div>
                <table class="invoice-table">
                    <thead>
                        <tr>
                            <th style="width:5%">№</th>
                            <th style="width:50%">Наименование</th>
                            <th style="width:15%">Вес, кг</th>
                            <th style="width:15%">Цена</th>
                            <th style="width:15%">Сумма</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
                <div class="invoice-footer">
                    <span>Позиций: ${orders.length}</span>
                    <span>Вес: ${totalWeight.toFixed(2)} кг</span>
                    <span>Итого: ${totalSum.toFixed(2)} ₽</span>
                </div>
                <div class="invoice-signatures">
                    <div class="signature-line">Отпустил</div>
                    <div class="signature-line">Получил</div>
                </div>
            </div>`;
    }

    btnPrint.addEventListener('click', function () {
        if (!selectedCustomer || !selectedOrders.length) {
            showToast('Выберите клиента', 'error');
            return;
        }

        const customer = StorageService.getCustomers().find(c => String(c.customer_id) === String(selectedCustomer));

        // Generate 2 identical invoices on one A4 page
        const invoiceHTML = generateInvoiceHTML(selectedOrders, customer);
        printContainer.innerHTML = invoiceHTML + invoiceHTML;

        // Trigger print
        setTimeout(() => {
            window.print();
        }, 100);
    });

    renderClients();
    window.addEventListener('ordersUpdated', renderClients);
})();
