(function () {
    const page = location.pathname.split('/').pop();
    const currentUser = StorageService.getCurrentUser();
    const userRole = currentUser ? currentUser.role : null;
    const isAdmin = userRole === 'admin' || !currentUser;
    const isProduction = userRole === 'production';

    // Menu for production role - only Production page
    const productionMenu = [
        { href: 'production.html', label: 'Производство', icon: '🏭' }
    ];

    // Full menu for other roles
    const fullMenu = [
        { href: 'orders.html', label: 'Форма заказов', icon: '📋' },
        { href: 'assembly.html', label: 'Сборка товара', icon: '📦' },
        { href: 'shipments.html', label: 'Отгрузки', icon: '🚚' },
        { href: 'purchases.html', label: 'Закупки', icon: '🛒' },
        { href: 'svod.html', label: 'Свод', icon: '📊' },
        { href: 'production.html', label: 'Производство', icon: '🏭' },
        { href: 'pricelist-shipment.html', label: 'Прайс-лист отгруз.', icon: '🏷️' },
        {
            section: 'Журналы', icon: '📖', items: [
                { href: 'journal.html', label: 'Журнал заказов' },
                { href: 'journal-shipments.html', label: 'Журнал отгрузок' },
                { href: 'journal-purchases.html', label: 'Журнал закупок' },
                { href: 'journal-svod.html', label: 'Журнал сводов' },
                { href: 'journal-pricelists.html', label: 'Журнал прайс-листов' },
                { href: 'journal-pricelist-shipment.html', label: 'Журнал отгр. прайсов' }
            ]
        },
        {
            section: 'Отчёты', icon: '📑', items: [
                { href: 'report-material.html', label: 'Материальный отчёт' },
                { href: 'report-pnl.html', label: 'Отчёт по P&L' },
                { href: 'report-production.html', label: 'Производственный отчёт' }
            ]
        },
        { href: 'dashboard-orders.html', label: 'Дашборд заказов', icon: '📈' },
        { href: 'dashboard-svod.html', label: 'Дашборд свода', icon: '📉' },
        {
            section: 'Справочники', icon: '📚', adminOnly: true, items: [
                { href: 'products.html', label: 'Товары' },
                { href: 'suppliers.html', label: 'Поставщики' },
                { href: 'customers.html', label: 'Заказчики' },
                { href: 'districts.html', label: 'Регионы' },
                { href: 'expeditors.html', label: 'Экспедиторы' },
                { href: 'managers.html', label: 'Менеджеры' }
            ]
        },
        { href: 'admin.html', label: 'Администрирование', icon: '⚙️', adminOnly: true }
    ];

    // Select menu based on role
    const menu = isProduction ? productionMenu : fullMenu;

    const nav = document.getElementById('sidebar-nav'); if (!nav) return;
    let html = '';
    menu.forEach(m => {
        if (m.adminOnly && !isAdmin) return;
        if (m.section) {
            const isOpen = m.items.some(i => i.href === page);
            html += `<div class="nav-section ${isOpen ? 'open' : ''}" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')"><span>${m.icon || ''} ${m.section}</span><span class="arrow">▸</span></div><div class="nav-submenu ${isOpen ? 'open' : ''}">`;
            m.items.forEach(i => { if (i.adminOnly && !isAdmin) return; html += `<a href="${i.href}" class="nav-item ${i.href === page ? 'active' : ''}">${i.label}</a>` });
            html += '</div>';
        } else {
            html += `<a href="${m.href}" class="nav-item ${m.href === page ? 'active' : ''}">${m.icon || ''} ${m.label}</a>`;
        }
    });
    nav.innerHTML = html;
})();

