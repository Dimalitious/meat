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
    UserCheck,
    Building2,
    BookOpen,
    Upload,
    LogOut,
    Menu,
    X,
    Warehouse,
} from 'lucide-react';

const Layout = ({ children }: { children: React.ReactNode }) => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { label: 'Главная', path: '/', icon: <LayoutDashboard size={20} /> },
        { label: 'Сводка (Prod)', path: '/svod', icon: <BarChart3 size={20} /> },
        { label: 'Заказы', path: '/orders', icon: <ShoppingCart size={20} /> },
        { label: 'Товары', path: '/products', icon: <Package size={20} /> },
        { label: 'Экспедиция', path: '/shipments', icon: <Truck size={20} /> },
        { label: 'Водители', path: '/expeditors', icon: <UserCheck size={20} /> },
        { label: 'Клиенты', path: '/customers', icon: <Users size={20} /> },
        { label: 'Поставщики', path: '/suppliers', icon: <Building2 size={20} /> },
        { label: 'Справочники', path: '/dicts', icon: <BookOpen size={20} /> },
        { label: 'Сборка', path: '/assembly', icon: <Package size={20} /> },
        { label: 'Склад', path: '/warehouse', icon: <Warehouse size={20} /> },
        { label: 'Импорт', path: '/import', icon: <Upload size={20} /> },
    ];

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
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
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
                    })}
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
                            {navItems.find(i => i.path === location.pathname)?.label || 'Dashboard'}
                        </h1>
                    </div>
                    {/* Header actions (optional) */}
                    <div className="flex items-center gap-2">
                        {/* Placeholder for future header items like notifications */}
                    </div>
                </header>

                <div className="p-4 lg:p-8 flex-1 overflow-auto">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Layout;

