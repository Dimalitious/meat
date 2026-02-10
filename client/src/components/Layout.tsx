import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard,
    BarChart3,
    ShoppingCart,
    Package,
    Truck,
    Users,

    Building2,
    BookOpen,
    Upload,
    LogOut,
    Menu,
    X,
    Warehouse,
    ChevronDown,
    ChevronRight,
    FolderOpen,
    DollarSign,
    MessageCircle,
    FileText,
} from 'lucide-react';

interface NavItem {
    label: string;
    path?: string;
    icon: React.ReactNode;
    children?: NavItem[];
    /** Single permission required to see this item */
    permission?: string;
    /** Show if user has ANY of these permissions */
    permissionsAny?: string[];
}

const Layout = ({ children }: { children: React.ReactNode }) => {
    const { user, logout, hasPermission, hasAnyPermission } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [expandedFolders, setExpandedFolders] = useState<string[]>(['Журналы', 'Справочник']);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleFolder = (label: string) => {
        setExpandedFolders(prev =>
            prev.includes(label)
                ? prev.filter(f => f !== label)
                : [...prev, label]
        );
    };

    const navItems: NavItem[] = [
        { label: 'Главная', path: '/', icon: <LayoutDashboard size={20} /> },
        { label: 'Сводка заказов', path: '/summary-orders', icon: <BarChart3 size={20} />, permission: 'summary.read' },
        { label: 'Сборка заказов', path: '/assembly-orders', icon: <Package size={20} />, permission: 'assembly.read' },
        { label: 'Распределение', path: '/dispatch', icon: <Truck size={20} />, permission: 'orders.assign_expeditor' },
        { label: 'Экспедиция', path: '/expedition', icon: <Truck size={20} />, permission: 'expedition.read' },
        { label: 'Производство', path: '/production-v3', icon: <Warehouse size={20} />, permission: 'production.read' },
        { label: 'Склад', path: '/warehouse', icon: <Warehouse size={20} />, permission: 'warehouses.read' },
        { label: 'Telegram заказы', path: '/telegram-orders', icon: <MessageCircle size={20} /> },
        {
            label: 'Прайсы',
            icon: <DollarSign size={20} />,
            children: [
                { label: 'Закупочный прайс', path: '/purchase-price-lists', icon: <DollarSign size={18} />, permission: 'prices.purchase.read' },
                { label: 'Продажный прайс', path: '/journals/sales-prices', icon: <DollarSign size={18} />, permission: 'prices.sales.read' },
            ]
        },
        {
            label: 'Журналы',
            icon: <FolderOpen size={20} />,
            children: [
                { label: 'Журнал заказов', path: '/orders', icon: <ShoppingCart size={18} />, permission: 'orders.read' },

                { label: 'Журнал закупок', path: '/purchases', icon: <BookOpen size={18} />, permission: 'purchases.read' },
                { label: 'Расчёты с поставщиками', path: '/supplier-account', icon: <DollarSign size={18} />, permissionsAny: ['supplier.returns.read', 'supplier.payments.read', 'supplier.statement.read'] },

            ]
        },
        {
            label: 'Справочник',
            icon: <FolderOpen size={20} />,
            children: [
                { label: 'Товары', path: '/products', icon: <Package size={18} />, permission: 'catalog.products' },
                { label: 'Клиенты', path: '/customers', icon: <Users size={18} />, permission: 'catalog.customers' },
                { label: 'Поставщики', path: '/suppliers', icon: <Building2 size={18} />, permission: 'catalog.suppliers' },
                { label: 'Склады', path: '/warehouses', icon: <Warehouse size={18} />, permission: 'warehouses.read' },
                { label: 'Техкарты (MML)', path: '/mmls', icon: <FolderOpen size={18} />, permission: 'mml.read' },

                { label: 'Типы оплат', path: '/payment-types', icon: <DollarSign size={18} />, permission: 'purchases.read' },
            ]
        },
        {
            label: 'Отчеты',
            icon: <FileText size={20} />,
            children: [
                { label: 'Материальный отчет', path: '/reports/material', icon: <FileText size={18} />, permission: 'reports.read' },
                { label: 'Отчет PL', path: '/reports/pl', icon: <FileText size={18} />, permission: 'reports.read' },
            ]
        },

        { label: 'Импорт', path: '/import', icon: <Upload size={20} />, permission: 'import.execute' },
        { label: 'Пользователи', path: '/admin/users', icon: <Users size={20} />, permission: 'admin.users' },
    ];

    /**
     * Permission-based menu filtering.
     * Policy: hide parent sections if they have no visible children after filtering.
     * Avoid mixing permission checks on both parent and children unless you intentionally
     * want "double gating".
     */
    const isVisible = (item: NavItem) => {
        if (!item.permission && !item.permissionsAny) return true;
        if (item.permission) return hasPermission(item.permission);
        return hasAnyPermission(item.permissionsAny || []);
    };

    const filterTree = (items: NavItem[]): NavItem[] => {
        return items
            .map((it) => {
                if (it.children?.length) {
                    const children = filterTree(it.children);
                    return { ...it, children };
                }
                return it;
            })
            .filter((it) => isVisible(it) && (!it.children || it.children.length > 0));
    };

    const visibleNavItems = filterTree(navItems);


    const renderNavItem = (item: NavItem, depth = 0) => {
        if (item.children) {
            const isExpanded = expandedFolders.includes(item.label);
            const hasActiveChild = item.children.some(child => location.pathname === child.path);

            return (
                <div key={item.label}>
                    <button
                        onClick={() => toggleFolder(item.label)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                            ${hasActiveChild
                                ? 'bg-slate-800 text-white'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                    >
                        <span className="text-slate-500">{item.icon}</span>
                        <span className="flex-1 text-left">{item.label}</span>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    {isExpanded && (
                        <div className="ml-4 mt-1 space-y-1 border-l border-slate-700 pl-2">
                            {item.children.map(child => renderNavItem(child, depth + 1))}
                        </div>
                    )}
                </div>
            );
        }

        const isActive = location.pathname === item.path;
        return (
            <Link
                key={item.path}
                to={item.path!}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                    ${isActive
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
            >
                <span className={`transition-colors ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>
                    {item.icon}
                </span>
                {item.label}
            </Link>
        );
    };

    const getCurrentPageLabel = (): string => {
        for (const item of navItems) {
            if (item.path === location.pathname) return item.label;
            if (item.children) {
                const child = item.children.find(c => c.path === location.pathname);
                if (child) return child.label;
            }
        }
        return 'Dashboard';
    };

    return (
        <div className="flex h-screen bg-gray-50 font-sans">
            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static
                    ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
                    <Link to="/" className="text-xl font-bold text-white tracking-tight hover:opacity-80 transition-opacity">
                        Meat ERP
                    </Link>
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="lg:hidden text-slate-500 hover:text-slate-700"
                    >
                        <X size={24} />
                    </button>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                    {visibleNavItems.map(item => renderNavItem(item))}
                </nav>

                <div className="p-4 border-t border-slate-800 bg-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm ring-1 ring-primary-500/30">
                            {user?.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user?.username || 'Пользователь'}</p>
                            <button
                                onClick={handleLogout}
                                className="text-xs text-red-400 hover:text-red-300 hover:underline font-medium flex items-center gap-1 mt-0.5"
                            >
                                <LogOut size={12} />
                                Выйти
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0 min-h-screen flex flex-col">
                <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 px-4 lg:px-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="lg:hidden text-slate-500 hover:text-slate-700"
                        >
                            <Menu size={24} />
                        </button>
                        <h1 className="text-xl font-semibold text-slate-800">
                            {getCurrentPageLabel()}
                        </h1>
                    </div>
                    {/* Header actions (optional) */}
                    <div className="flex items-center gap-2">
                        {/* Placeholder for future header items like notifications */}
                    </div>
                </header>

                <div className="p-4 lg:p-6 flex-1 overflow-auto">
                    <div className="w-full">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Layout;
