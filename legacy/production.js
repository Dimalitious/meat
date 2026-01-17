(function () {
    const categoryGrid = document.getElementById('category-grid'),
        productsSection = document.getElementById('products-section'),
        productsList = document.getElementById('products-list'),
        productsTitle = document.getElementById('products-title'),
        btnBack = document.getElementById('btn-back'),
        dateInput = document.getElementById('production-date'),
        btnLoadSvod = document.getElementById('btn-load-svod'),
        btnSave = document.getElementById('btn-save'),
        dashCategory = document.getElementById('dash-category'),
        dashTotal = document.getElementById('dash-total'),
        categoryModal = document.getElementById('category-modal'),
        categoryModalTitle = document.getElementById('category-modal-title'),
        categoryNameInput = document.getElementById('category-name-input'),
        categoryIconInput = document.getElementById('category-icon-input'),
        categoryImageInput = document.getElementById('category-image-input'),
        imageUploadArea = document.getElementById('image-upload-area'),
        btnSaveCategory = document.getElementById('btn-save-category'),
        btnDeleteCategory = document.getElementById('btn-delete-category'),
        toast = document.getElementById('toast');

    // State - navigation path (array of node IDs)
    let navigationPath = []; // e.g. ['cat_1', 'part_123', 'subpart_456']
    let productionData = [];
    let editingNodeId = null;
    let editingNodeType = null; // 'category' or 'item'
    let uploadedImageData = null;

    // Default categories
    const defaultCategories = [
        { id: 'cat_1', name: 'баранье мясо', icon: '🐑', image: null, children: [] },
        { id: 'cat_2', name: 'говяжье мясо', icon: '🐄', image: null, children: [] },
        { id: 'cat_3', name: 'куриное мясо', icon: '🐔', image: null, children: [] },
        { id: 'cat_4', name: 'кроличье мясо', icon: '🐰', image: null, children: [] }
    ];

    function showToast(msg, type) {
        toast.textContent = msg;
        toast.className = 'toast ' + type;
        toast.style.display = 'block';
        setTimeout(() => toast.style.display = 'none', 3000);
    }

    function esc(s) {
        return s ? String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : '';
    }

    dateInput.value = new Date().toISOString().split('T')[0];

    // ========== STORAGE ==========
    function getData() {
        const saved = localStorage.getItem('erp_production_hierarchy_v3');
        if (saved) return JSON.parse(saved);
        saveData(defaultCategories);
        return defaultCategories;
    }

    function saveData(data) {
        localStorage.setItem('erp_production_hierarchy_v3', JSON.stringify(data));
    }

    // Production data per node per date
    function getProductionDataKey() {
        return `erp_production_data_${dateInput.value}`;
    }

    function getAllProductionData() {
        return JSON.parse(localStorage.getItem(getProductionDataKey()) || '{}');
    }

    function saveAllProductionData(data) {
        localStorage.setItem(getProductionDataKey(), JSON.stringify(data));
    }

    function getProductionDataForNode(nodeId) {
        const all = getAllProductionData();
        return all[nodeId] || { cleanWeight: 0, bones: 0, waste: 0, bunch: 0, completed: false };
    }

    function saveProductionDataForNode(nodeId, data) {
        const all = getAllProductionData();
        all[nodeId] = { ...all[nodeId], ...data };
        saveAllProductionData(all);
    }

    // Complete part (lock)
    window.completePart = function (nodeId) {
        const allData = getAllProductionData();
        if (!allData[nodeId]) allData[nodeId] = {};
        allData[nodeId].completed = true;
        saveAllProductionData(allData);
        showToast('Часть выполнена ✓', 'success');
        render();
    };

    // Unlock part (edit again)
    window.unlockPart = function (nodeId) {
        const allData = getAllProductionData();
        if (allData[nodeId]) {
            allData[nodeId].completed = false;
            saveAllProductionData(allData);
        }
        showToast('Редактирование разблокировано', 'info');
        render();
    };

    // Get current node and its children based on navigation path
    function getCurrentNodes() {
        let nodes = getData();
        if (navigationPath.length === 0) return nodes;

        // Traverse the path
        for (const id of navigationPath) {
            const node = findNodeById(nodes, id);
            if (!node) return [];
            nodes = node.children || [];
        }
        return nodes;
    }

    // Find node by ID in a tree
    function findNodeById(nodes, id) {
        for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children) {
                const found = findNodeById(node.children, id);
                if (found) return found;
            }
        }
        return null;
    }

    // Get parent node (for adding children)
    function getParentNode() {
        if (navigationPath.length === 0) return null;
        const data = getData();
        const parentId = navigationPath[navigationPath.length - 1];
        return findNodeById(data, parentId);
    }

    // Get breadcrumb path names
    function getBreadcrumb() {
        if (navigationPath.length === 0) return 'Все категории';
        const data = getData();
        return navigationPath.map(id => {
            const node = findNodeById(data, id);
            return node ? node.name : id;
        }).join(' → ');
    }

    // ========== RENDER CURRENT LEVEL ==========
    function render() {
        const nodes = getCurrentNodes();
        const isRoot = navigationPath.length === 0;

        dashCategory.textContent = getBreadcrumb();
        categoryGrid.style.display = 'grid';
        productsSection.style.display = 'none';

        let html = '';

        // Back button (if not at root)
        if (!isRoot) {
            html += `
                <div class="category-tile" onclick="goBack()" style="border-style:dashed;">
                    <div class="category-tile-image">←</div>
                    <div class="category-tile-name">Назад</div>
                </div>
            `;
        }

        // Render node tiles
        nodes.forEach(node => {
            const childCount = (node.children || []).length;
            const isProduct = node.productCode; // If linked to a product
            const prodData = getProductionDataForNode(node.id);
            const isCompleted = prodData.completed;
            // Show input fields only at depth 3 (navigationPath.length >= 2)
            const showInputs = isProduct && navigationPath.length >= 2;

            if (showInputs) {
                // Product part tile with input fields
                html += `
                    <div class="category-tile part-input-tile ${isCompleted ? 'completed' : ''}" data-id="${node.id}" style="aspect-ratio:auto;min-height:auto;padding:1rem;">
                        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;width:100%;">
                            <div style="font-size:2rem;">${node.image ? `<img src="${node.image}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;">` : node.icon || '🥩'}</div>
                            <div style="flex:1;font-weight:600;font-size:0.9rem;">${esc(node.name)}</div>
                            <button class="category-tile-edit" onclick="editNode('${node.id}', event)" style="position:static;">⚙️</button>
                        </div>
                        <div class="part-inputs" style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;width:100%;">
                            <div class="part-input-group">
                                <label>Чистый вес</label>
                                <input type="number" class="part-field" data-node="${node.id}" data-field="cleanWeight" 
                                       value="${prodData.cleanWeight || ''}" step="0.1" min="0" ${isCompleted ? 'disabled' : ''}>
                            </div>
                            <div class="part-input-group">
                                <label>Кости</label>
                                <input type="number" class="part-field" data-node="${node.id}" data-field="bones" 
                                       value="${prodData.bones || ''}" step="0.1" min="0" ${isCompleted ? 'disabled' : ''}>
                            </div>
                            <div class="part-input-group">
                                <label>Отход</label>
                                <input type="number" class="part-field" data-node="${node.id}" data-field="waste" 
                                       value="${prodData.waste || ''}" step="0.1" min="0" ${isCompleted ? 'disabled' : ''}>
                            </div>
                            <div class="part-input-group">
                                <label>Пучок</label>
                                <input type="number" class="part-field" data-node="${node.id}" data-field="bunch" 
                                       value="${prodData.bunch || ''}" step="0.1" min="0" ${isCompleted ? 'disabled' : ''}>
                            </div>
                        </div>
                        <div style="margin-top:0.75rem;width:100%;">
                            ${isCompleted
                        ? `<button class="btn btn-secondary btn-sm" onclick="unlockPart('${node.id}')" style="width:100%;">✏️ Редактировать</button>`
                        : `<button class="btn btn-success btn-sm" onclick="completePart('${node.id}')" style="width:100%;">✓ Выполнить</button>`
                    }
                        </div>
                    </div>
                `;
            } else {
                // Category/folder tile
                html += `
                    <div class="category-tile" data-id="${node.id}">
                        <button class="category-tile-edit" onclick="editNode('${node.id}', event)">⚙️</button>
                        <div class="category-tile-image">
                            ${node.image ? `<img src="${node.image}" alt="${esc(node.name)}">` : node.icon || '📦'}
                        </div>
                        <div class="category-tile-name">${esc(node.name)}</div>
                        <div class="category-tile-count">${childCount} элементов</div>
                    </div>
                `;
            }
        });

        // Add button
        if (isRoot) {
            // At root - add category (modal for name/icon)
            html += `
                <div class="category-tile add-category" onclick="openAddCategoryModal()">
                    <span class="add-category-icon">➕</span>
                    <div class="category-tile-name">Добавить категорию</div>
                </div>
            `;
        } else {
            // Inside a category/part - add from products reference
            html += `
                <div class="category-tile add-category" onclick="openProductSearchModal()">
                    <span class="add-category-icon">➕</span>
                    <div class="category-tile-name">Добавить часть</div>
                </div>
            `;
        }

        categoryGrid.innerHTML = html;

        // Click handlers for navigation (exclude part-input-tile which handles differently)
        categoryGrid.querySelectorAll('.category-tile:not(.add-category):not(.part-input-tile)').forEach(tile => {
            tile.addEventListener('click', (e) => {
                if (e.target.classList.contains('category-tile-edit')) return;
                const id = tile.dataset.id;
                if (id) navigateTo(id);
            });
        });

        // Part input field handlers
        categoryGrid.querySelectorAll('.part-field').forEach(inp => {
            inp.addEventListener('change', function () {
                const nodeId = this.dataset.node;
                const field = this.dataset.field;
                const value = parseFloat(this.value) || 0;
                saveProductionDataForNode(nodeId, { [field]: value });
            });
            inp.addEventListener('focus', function () {
                this.select();
            });
        });

        updateDashboard();
    }

    // Navigate into a node
    function navigateTo(id) {
        navigationPath.push(id);
        render();
    }

    // Go back one level
    window.goBack = function () {
        navigationPath.pop();
        render();
    };

    // ========== ADD CATEGORY MODAL ==========
    window.openAddCategoryModal = function () {
        editingNodeId = null;
        editingNodeType = 'category';
        categoryModalTitle.textContent = 'Новая категория';
        categoryNameInput.value = '';
        categoryIconInput.value = '📦';
        uploadedImageData = null;
        imageUploadArea.innerHTML = `
            <span class="upload-icon">📷</span>
            <span class="upload-text">Загрузить изображение</span>
        `;
        btnDeleteCategory.style.display = 'none';
        categoryModal.classList.add('open');
    };

    // Edit existing node
    window.editNode = function (id, event) {
        event.stopPropagation();
        const data = getData();
        const node = findNodeById(data, id);
        if (!node) return;

        editingNodeId = id;
        editingNodeType = node.productCode ? 'item' : 'category';
        categoryModalTitle.textContent = 'Редактировать';
        categoryNameInput.value = node.name;
        categoryIconInput.value = node.icon || '';
        uploadedImageData = node.image;

        if (node.image) {
            imageUploadArea.innerHTML = `<img src="${node.image}" alt="preview">`;
        } else {
            imageUploadArea.innerHTML = `
                <span class="upload-icon">📷</span>
                <span class="upload-text">Загрузить изображение</span>
            `;
        }

        btnDeleteCategory.style.display = 'inline-block';
        categoryModal.classList.add('open');
    };

    window.closeCategoryModal = function () {
        categoryModal.classList.remove('open');
    };

    categoryImageInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (ev) {
            uploadedImageData = ev.target.result;
            imageUploadArea.innerHTML = `<img src="${uploadedImageData}" alt="preview">`;
        };
        reader.readAsDataURL(file);
    });

    btnSaveCategory.addEventListener('click', () => {
        const name = categoryNameInput.value.trim();
        const icon = categoryIconInput.value.trim() || '📦';
        if (!name) { showToast('Введите название', 'error'); return; }

        const data = getData();

        if (editingNodeId) {
            // Update existing node
            const node = findNodeById(data, editingNodeId);
            if (node) {
                node.name = name;
                node.icon = icon;
                node.image = uploadedImageData;
            }
        } else {
            // Add new category at root
            data.push({
                id: 'cat_' + Date.now(),
                name: name,
                icon: icon,
                image: uploadedImageData,
                children: []
            });
        }

        saveData(data);
        closeCategoryModal();
        render();
        showToast('Сохранено', 'success');
    });

    btnDeleteCategory.addEventListener('click', () => {
        if (!editingNodeId) return;
        if (!confirm('Удалить этот элемент?')) return;

        const data = getData();
        removeNodeById(data, editingNodeId);
        saveData(data);
        closeCategoryModal();
        render();
        showToast('Удалено', 'success');
    });

    function removeNodeById(nodes, id) {
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].id === id) {
                nodes.splice(i, 1);
                return true;
            }
            if (nodes[i].children && removeNodeById(nodes[i].children, id)) {
                return true;
            }
        }
        return false;
    }

    // ========== PRODUCT SEARCH MODAL ==========
    window.openProductSearchModal = function () {
        categoryGrid.style.display = 'none';
        productsSection.style.display = 'block';
        productsTitle.textContent = '🔍 Выберите товар';

        const allProducts = StorageService.getProducts();
        const parent = getParentNode();
        const existingCodes = (parent?.children || []).filter(c => c.productCode).map(c => c.productCode);

        let html = `
            <div style="margin-bottom:1rem;">
                <input type="text" id="product-search-input" placeholder="🔍 Поиск по названию или коду..." 
                       style="width:100%;padding:0.8rem;font-size:1rem;border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border);">
            </div>
            <div id="product-search-list" style="max-height:400px;overflow-y:auto;">
        `;

        allProducts.forEach(p => {
            const isAdded = existingCodes.includes(p.product_code);
            html += `
                <div class="product-row product-select-item" data-code="${p.product_code}" 
                     style="cursor:${isAdded ? 'default' : 'pointer'};opacity:${isAdded ? '0.5' : '1'};">
                    <div class="product-info">
                        <div class="product-name">${esc(p.short_name_morning || p.product_name)}</div>
                        <div class="product-orders">${esc(p.product_code)} | ${esc(p.category || '')}</div>
                    </div>
                    ${isAdded ? '<span style="color:var(--success);">✓ Добавлено</span>' : '<span style="color:var(--primary);">➕</span>'}
                </div>
            `;
        });

        if (allProducts.length === 0) {
            html += `<div style="text-align:center;padding:2rem;color:var(--text-secondary);">
                Нет товаров в справочнике.<br>
                <a href="products.html" style="color:var(--primary);">📚 Открыть справочник товаров</a>
            </div>`;
        }

        html += `</div>`;

        productsList.innerHTML = html;

        // Search functionality
        document.getElementById('product-search-input')?.addEventListener('input', function () {
            const q = this.value.toLowerCase();
            document.querySelectorAll('.product-select-item').forEach(row => {
                const name = row.querySelector('.product-name').textContent.toLowerCase();
                const code = row.querySelector('.product-orders').textContent.toLowerCase();
                row.style.display = (name.includes(q) || code.includes(q)) ? 'flex' : 'none';
            });
        });

        // Click to add
        document.querySelectorAll('.product-select-item').forEach(row => {
            row.addEventListener('click', () => {
                const code = row.dataset.code;
                if (existingCodes.includes(code)) return;
                addProductAsChild(code);
            });
        });
    };

    function addProductAsChild(productCode) {
        const product = StorageService.getProducts().find(p => p.product_code === productCode);
        if (!product) return;

        const data = getData();
        const parent = findNodeById(data, navigationPath[navigationPath.length - 1]);
        if (!parent) return;

        if (!parent.children) parent.children = [];
        parent.children.push({
            id: 'item_' + Date.now(),
            name: product.short_name_morning || product.product_name,
            icon: '🥩',
            image: null,
            productCode: productCode,
            children: []
        });

        saveData(data);
        showToast('Часть добавлена', 'success');
        render();
    }

    // Back button handler
    btnBack.addEventListener('click', () => {
        if (productsSection.style.display !== 'none') {
            // Close product search
            render();
        } else {
            goBack();
        }
    });

    // ========== DASHBOARD ==========
    function updateDashboard() {
        const total = productionData.reduce((sum, row) => sum + (parseFloat(row.production) || 0), 0);
        dashTotal.textContent = total.toFixed(2);
    }

    // ========== LOAD / SAVE ==========
    btnLoadSvod.addEventListener('click', () => {
        const date = dateInput.value;
        if (!date) { showToast('Выберите дату', 'error'); return; }

        const svodData = StorageService.getSvod(date);
        const products = StorageService.getProducts();

        if (!svodData || svodData.length === 0) {
            showToast('Свод за эту дату не найден', 'error');
            return;
        }

        productionData = svodData.map(s => {
            const product = products.find(p => p.product_code === s.product_code) || {};
            return {
                product_code: s.product_code,
                product_name: product.short_name_morning || product.product_name || s.product_code,
                category: product.category || '',
                orders: parseFloat(s.orders) || 0,
                production: 0
            };
        }).filter(row => row.orders > 0);

        showToast(`Загружено ${productionData.length} позиций`, 'success');
        updateDashboard();
    });

    btnSave.addEventListener('click', () => {
        const date = dateInput.value;
        if (!date) { showToast('Выберите дату', 'error'); return; }

        StorageService.saveProduction(date, {
            date: date,
            saved_at: new Date().toISOString(),
            items: productionData
        });
        showToast('Производство сохранено', 'success');
    });

    dateInput.addEventListener('change', () => {
        const saved = StorageService.getProduction(dateInput.value);
        if (saved && saved.items) {
            productionData = saved.items;
            showToast('Загружены данные', 'info');
        } else {
            productionData = [];
        }
        updateDashboard();
    });

    // Init
    render();
})();
