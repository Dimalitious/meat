(function () {
    const dateInput = document.getElementById('assembly-date'),
        clientsContainer = document.getElementById('clients-container'),
        productsGrid = document.getElementById('products-grid'),
        productsTitle = document.getElementById('products-title'),
        productsCount = document.getElementById('products-count'),
        emptyState = document.getElementById('empty-state'),
        btnSave = document.getElementById('btn-save'),
        btnComplete = document.getElementById('btn-complete'),
        toast = document.getElementById('toast');

    let selectedClient = null;
    let assemblyData = {}; // { clientId: { productCode: assembled_qty } }

    function showToast(msg, type) {
        toast.textContent = msg;
        toast.className = 'toast ' + type;
        toast.style.display = 'block';
        setTimeout(() => toast.style.display = 'none', 3000);
    }

    function esc(s) {
        return s ? String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : '';
    }

    // Set today's date
    dateInput.value = new Date().toISOString().split('T')[0];

    // Get orders from assembly queue (added via green checkmark in orders form)
    function getOrdersForDate() {
        const date = dateInput.value;
        const key = `erp_assembly_queue_${date}`;
        return JSON.parse(localStorage.getItem(key) || '[]');
    }

    // Get unique clients from orders
    function getClients() {
        const orders = getOrdersForDate();
        const clientMap = {};
        orders.forEach(o => {
            if (!clientMap[o.customer_id]) {
                clientMap[o.customer_id] = {
                    id: o.customer_id,
                    name: o.customer_name || o.customer_id,
                    address: o.point || '',
                    orderCount: 0,
                    totalQty: 0
                };
            }
            clientMap[o.customer_id].orderCount++;
            clientMap[o.customer_id].totalQty += parseFloat(o.order_qty) || 0;
        });
        return Object.values(clientMap);
    }

    // Render client list
    function renderClients() {
        const clients = getClients();

        if (clients.length === 0) {
            clientsContainer.innerHTML = `
                <div style="text-align:center;padding:2rem;color:var(--text-secondary);">
                    <p>Нет заказов на эту дату</p>
                </div>
            `;
            return;
        }

        let html = '';
        clients.forEach(c => {
            const isActive = selectedClient === c.id;
            const assembled = getClientAssembledCount(c.id);
            const total = c.orderCount;
            const progress = total > 0 ? Math.round((assembled / total) * 100) : 0;

            html += `
                <div class="client-item ${isActive ? 'active' : ''}" data-id="${c.id}">
                    <div class="client-name">${esc(c.name)}</div>
                    <div class="client-info">
                        ${c.orderCount} позиций | ${c.totalQty.toFixed(1)} кг
                        ${progress > 0 ? `<span style="color:var(--success);margin-left:0.5rem;">${progress}%</span>` : ''}
                    </div>
                </div>
            `;
        });

        clientsContainer.innerHTML = html;

        // Attach click handlers
        clientsContainer.querySelectorAll('.client-item').forEach(item => {
            item.addEventListener('click', () => {
                selectedClient = item.dataset.id;
                renderClients();
                renderProducts();
            });
        });
    }

    // Count assembled products for client
    function getClientAssembledCount(clientId) {
        const data = assemblyData[clientId] || {};
        return Object.keys(data).filter(k => data[k] > 0).length;
    }

    // Render product icons grid
    function renderProducts() {
        if (!selectedClient) {
            productsTitle.textContent = '📦 Выберите клиента';
            productsCount.textContent = '';
            productsGrid.innerHTML = `
                <div class="empty-products">
                    <div class="empty-products-icon">📦</div>
                    <p>Выберите клиента для сборки</p>
                </div>
            `;
            return;
        }

        const orders = getOrdersForDate().filter(o => o.customer_id === selectedClient);
        const client = getClients().find(c => c.id === selectedClient);

        productsTitle.textContent = `📦 ${client?.name || selectedClient}`;
        productsCount.textContent = `${orders.length} товаров`;

        if (orders.length === 0) {
            productsGrid.innerHTML = `
                <div class="empty-products">
                    <div class="empty-products-icon">📭</div>
                    <p>Нет товаров для сборки</p>
                </div>
            `;
            return;
        }

        const clientData = assemblyData[selectedClient] || {};

        let html = '';
        orders.forEach(order => {
            const assembled = clientData[order.product_code] || 0;
            const orderQty = parseFloat(order.order_qty) || 0;
            const isComplete = assembled >= orderQty && assembled > 0;
            const icon = getProductIcon(order.category);

            html += `
                <div class="product-tile ${isComplete ? 'completed' : ''}" data-code="${order.product_code}">
                    <div class="product-tile-icon">${icon}</div>
                    <div class="product-tile-name">${esc(order.product_name)}</div>
                    <div class="product-tile-order">Заказ: ${orderQty.toFixed(1)} кг</div>
                    <input type="number" class="product-tile-input" 
                           value="${assembled || ''}" 
                           placeholder="0"
                           step="0.1" 
                           min="0" 
                           inputmode="decimal"
                           data-code="${order.product_code}">
                </div>
            `;
        });

        productsGrid.innerHTML = html;

        // Attach input handlers
        productsGrid.querySelectorAll('.product-tile-input').forEach(inp => {
            inp.addEventListener('change', function () {
                const code = this.dataset.code;
                const value = parseFloat(this.value) || 0;

                if (!assemblyData[selectedClient]) {
                    assemblyData[selectedClient] = {};
                }
                assemblyData[selectedClient][code] = value;

                // Update tile status
                const tile = this.closest('.product-tile');
                const order = orders.find(o => o.product_code === code);
                const orderQty = parseFloat(order?.order_qty) || 0;

                if (value >= orderQty && value > 0) {
                    tile.classList.add('completed');
                } else {
                    tile.classList.remove('completed');
                }

                renderClients(); // Update progress
            });

            inp.addEventListener('focus', function () {
                this.select();
            });
        });
    }

    // Get icon based on category
    function getProductIcon(category) {
        const cat = (category || '').toLowerCase();
        if (cat.includes('говя') || cat.includes('beef')) return '🥩';
        if (cat.includes('баран') || cat.includes('lamb')) return '🐑';
        if (cat.includes('кур') || cat.includes('chicken')) return '🍗';
        if (cat.includes('кролик') || cat.includes('rabbit')) return '🐰';
        if (cat.includes('рыб') || cat.includes('fish')) return '🐟';
        return '📦';
    }

    // Date change
    dateInput.addEventListener('change', () => {
        selectedClient = null;
        loadData();
        renderClients();
        renderProducts();
    });

    // Save
    btnSave.addEventListener('click', () => {
        const date = dateInput.value;
        localStorage.setItem(`erp_assembly_${date}`, JSON.stringify(assemblyData));
        showToast('Сборка сохранена', 'success');
    });

    // Complete (mark all as done)
    btnComplete.addEventListener('click', () => {
        if (!selectedClient) {
            showToast('Выберите клиента', 'error');
            return;
        }

        const orders = getOrdersForDate().filter(o => o.customer_id === selectedClient);
        if (!assemblyData[selectedClient]) {
            assemblyData[selectedClient] = {};
        }

        orders.forEach(order => {
            if (!assemblyData[selectedClient][order.product_code]) {
                assemblyData[selectedClient][order.product_code] = parseFloat(order.order_qty) || 0;
            }
        });

        renderProducts();
        renderClients();
        showToast('Все позиции завершены', 'success');
    });

    // Load saved data
    function loadData() {
        const date = dateInput.value;
        const saved = localStorage.getItem(`erp_assembly_${date}`);
        assemblyData = saved ? JSON.parse(saved) : {};
    }

    // Init
    loadData();
    renderClients();
    renderProducts();
})();
