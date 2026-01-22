import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import { Filter, RefreshCw, Plus, Trash2, Save, Search } from 'lucide-react';
import SvodTab from '../components/SvodTab';

interface Customer {
    id: number;
    name: string;
    code: string;
    district?: string;
    address?: string;
}

interface Product {
    id: number;
    name: string;
    code: string;
    category: string | null;
    priceListName: string | null;
}

interface SummaryEntry {
    id: number;
    idn?: string;
    shipDate: string;
    paymentType: string;
    customerId: number | null;
    customerName: string;
    productId: number | null;
    productCode: string | null;
    productFullName: string;
    category: string | null;
    shortNameMorning: string | null;
    priceType: string | null;
    price: number;
    shippedQty: number;
    orderQty: number;
    sumWithRevaluation: number | null;
    distributionCoef: number | null;
    weightToDistribute: number | null;
    managerId: string | null;
    managerName: string | null;
    district: string | null;
    pointAddress: string | null;
    status: string;
    _dirty?: boolean; // Локальный флаг изменений
}

interface FilterOptions {
    categories: string[];
    districts: string[];
    managers: { id: string; name: string }[];
}

const PAYMENT_TYPES = [
    { value: 'bank', label: 'Перечисление' },
    { value: 'cash', label: 'Наличка' },
    { value: 'terminal', label: 'Терминал' }
];

// Форматирование чисел с разделителями
const formatNumber = (value: number | null | undefined, decimals = 2): string => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('ru-RU', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
};

// ============================================
// CUSTOM HOOK: useDebounce
// ============================================
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

export default function SummaryOrdersPage() {
    const { user } = useAuth();
    const [entries, setEntries] = useState<SummaryEntry[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [filterOptions, setFilterOptions] = useState<FilterOptions>({ categories: [], districts: [], managers: [] });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Вкладки (Заказы / СВОД)
    const [activeTab, setActiveTab] = useState<'orders' | 'svod'>('orders');

    // Pagination
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const LIMIT = 50;

    // Filters
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterCustomerId, setFilterCustomerId] = useState<number | ''>('');
    const [filterProductId, setFilterProductId] = useState<number | ''>('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterDistrict, setFilterDistrict] = useState('');
    const [filterManagerId, setFilterManagerId] = useState('');

    // Modal states
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const [activeEntryId, setActiveEntryId] = useState<number | null>(null);
    const [searchCustomer, setSearchCustomer] = useState('');
    const [searchProduct, setSearchProduct] = useState('');

    // Debounced search for server-side filtering
    const debouncedCustomerSearch = useDebounce(searchCustomer, 300);
    const debouncedProductSearch = useDebounce(searchProduct, 300);

    // Track dirty entries for batch save
    const dirtyEntryIds = useMemo(() => {
        return new Set(entries.filter(e => e._dirty).map(e => e.id));
    }, [entries]);

    useEffect(() => {
        fetchFilterOptions();
    }, []);

    useEffect(() => {
        // Reset and reload when filters change
        setPage(1);
        setEntries([]);
        fetchData(1, true);
    }, [filterDate, filterCustomerId, filterProductId, filterCategory, filterDistrict, filterManagerId]);

    // Lazy load customers/products only when modal opens
    useEffect(() => {
        if (showCustomerModal && customers.length === 0) {
            fetchCustomers();
        }
    }, [showCustomerModal]);

    useEffect(() => {
        if (showProductModal && products.length === 0) {
            fetchProducts();
        }
    }, [showProductModal]);

    const fetchFilterOptions = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/summary-orders/filter-options`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFilterOptions(res.data);
        } catch (err) {
            console.error('Failed to fetch filter options:', err);
        }
    };

    const fetchCustomers = async (search?: string) => {
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            params.append('limit', '100');
            const res = await axios.get(`${API_URL}/api/customers?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCustomers(res.data);
        } catch (err) {
            console.error('Failed to fetch customers:', err);
        }
    };

    const fetchProducts = async (search?: string) => {
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            params.append('limit', '100');
            const res = await axios.get(`${API_URL}/api/products?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProducts(res.data);
        } catch (err) {
            console.error('Failed to fetch products:', err);
        }
    };

    // Refresh customers/products on debounced search
    useEffect(() => {
        if (showCustomerModal) {
            fetchCustomers(debouncedCustomerSearch);
        }
    }, [debouncedCustomerSearch, showCustomerModal]);

    useEffect(() => {
        if (showProductModal) {
            fetchProducts(debouncedProductSearch);
        }
    }, [debouncedProductSearch, showProductModal]);

    const fetchData = async (pageNum: number, reset = false) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            params.append('date', filterDate);
            params.append('page', String(pageNum));
            params.append('limit', String(LIMIT));
            if (filterCustomerId) params.append('customerId', String(filterCustomerId));
            if (filterProductId) params.append('productId', String(filterProductId));
            if (filterCategory) params.append('category', filterCategory);
            if (filterDistrict) params.append('district', filterDistrict);
            if (filterManagerId) params.append('managerId', filterManagerId);

            const res = await axios.get(`${API_URL}/api/summary-orders?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const { data, pagination } = res.data;

            if (reset) {
                setEntries(data);
            } else {
                setEntries(prev => [...prev, ...data]);
            }
            setHasMore(pagination.hasMore);
            setTotalCount(pagination.total);
            setSelectedIds(new Set());
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadMore = () => {
        if (hasMore && !loading) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchData(nextPage, false);
        }
    };

    const resetFilters = () => {
        setFilterCustomerId('');
        setFilterProductId('');
        setFilterCategory('');
        setFilterDistrict('');
        setFilterManagerId('');
    };

    const addEntry = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/api/summary-orders`, {
                shipDate: filterDate,
                paymentType: 'bank',
                customerName: '',
                productFullName: '',
                price: 0,
                shippedQty: 0,
                orderQty: 0,
                managerId: user?.id ? String(user.id) : null,
                managerName: user?.username || 'Менеджер',
                status: 'draft'
            }, { headers: { Authorization: `Bearer ${token}` } });
            setEntries([res.data, ...entries]);
        } catch (err) {
            alert('Ошибка при добавлении записи');
        }
    };

    // ============================================
    // LOCAL UPDATE (no API call) - optimized!
    // ============================================
    const updateEntryLocal = useCallback((id: number, updates: Partial<SummaryEntry>) => {
        setEntries(prev => prev.map(e => {
            if (e.id !== id) return e;

            const updated = { ...e, ...updates, _dirty: true };

            // Пересчитываем сумму если изменились цена или факт
            if (updates.price !== undefined || updates.shippedQty !== undefined) {
                const price = updates.price !== undefined ? updates.price : e.price;
                const shippedQty = updates.shippedQty !== undefined ? updates.shippedQty : e.shippedQty;
                updated.sumWithRevaluation = price * shippedQty;
            }

            return updated;
        }));
    }, []);

    // ============================================
    // BATCH SAVE - saves all dirty entries at once
    // ============================================
    const saveAllChanges = async () => {
        const dirtyEntries = entries.filter(e => e._dirty);
        if (dirtyEntries.length === 0) {
            alert('Нет изменений для сохранения');
            return;
        }

        setSaving(true);
        try {
            const token = localStorage.getItem('token');

            // Batch update via Promise.all with chunking
            const chunkSize = 10;
            for (let i = 0; i < dirtyEntries.length; i += chunkSize) {
                const chunk = dirtyEntries.slice(i, i + chunkSize);
                await Promise.all(
                    chunk.map(entry => {
                        const { _dirty, ...data } = entry;
                        return axios.put(`${API_URL}/api/summary-orders/${entry.id}`, data, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                    })
                );
            }

            // Clear dirty flags
            setEntries(prev => prev.map(e => ({ ...e, _dirty: false })));
            alert(`Сохранено ${dirtyEntries.length} записей!`);
        } catch (err) {
            console.error('Save error:', err);
            alert('Ошибка сохранения');
        } finally {
            setSaving(false);
        }
    };

    const toggleSelect = (id: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        const selectable = entries.filter(e => e.status !== 'synced');
        if (selectedIds.size === selectable.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(selectable.map(e => e.id)));
        }
    };

    const deleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Удалить ${selectedIds.size} записей?`)) return;
        try {
            const token = localStorage.getItem('token');
            await Promise.all(
                Array.from(selectedIds).map(id =>
                    axios.delete(`${API_URL}/api/summary-orders/${id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                )
            );
            setEntries(entries.filter(e => !selectedIds.has(e.id)));
            setSelectedIds(new Set());
        } catch (err) {
            alert('Ошибка при удалении');
        }
    };

    const selectCustomer = (customer: Customer) => {
        if (activeEntryId) {
            updateEntryLocal(activeEntryId, {
                customerId: customer.id,
                customerName: customer.name,
                district: customer.district || null,
                pointAddress: customer.address || null
            });
        }
        setShowCustomerModal(false);
        setSearchCustomer('');
    };

    const selectProduct = (product: Product) => {
        if (activeEntryId) {
            updateEntryLocal(activeEntryId, {
                productId: product.id,
                productCode: product.code,
                productFullName: product.name,
                category: product.category,
                shortNameMorning: product.priceListName
            });
        }
        setShowProductModal(false);
        setSearchProduct('');
    };

    const deleteEntry = async (id: number) => {
        if (!confirm('Удалить запись?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/api/summary-orders/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEntries(entries.filter(e => e.id !== id));
        } catch (err) {
            alert('Ошибка при удалении');
        }
    };

    // Начать сборку - использует новый API с логированием
    const processEntry = async (id: number) => {
        try {
            const token = localStorage.getItem('token');

            // Используем новый endpoint который сохраняет историю
            const res = await axios.post(`${API_URL}/api/summary-orders/${id}/assembly/start`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log('[ASSEMBLY START]', res.data);

            // Обновляем локальное состояние
            setEntries(entries.map(e => e.id === id ? {
                ...e,
                status: 'forming',
                _dirty: false  // Сбрасываем dirty так как это серверная операция
            } : e));
        } catch (err: any) {
            console.error('Start assembly error:', err);
            alert(err.response?.data?.error || 'Ошибка отправки в сборку');
        }
    };

    const saveToJournal = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/journals/summary`, {
                summaryDate: filterDate,
                createdBy: user?.username || 'Unknown',
                data: entries
            }, { headers: { Authorization: `Bearer ${token}` } });
            alert('Сводка сохранена!');
        } catch (err) {
            alert('Ошибка сохранения');
        }
    };

    // Excel import - OPTIMIZED BULK VERSION
    const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = evt.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(sheet);

                if (jsonData.length === 0) {
                    alert('Файл Excel пуст или не содержит данных');
                    return;
                }

                const token = localStorage.getItem('token');

                // Prepare bulk import data
                const importData = (jsonData as any[]).map(row => ({
                    shipDate: filterDate,
                    paymentType: row['Оплата'] || 'bank',
                    customerName: row['Клиент'] || '',
                    productFullName: row['Товар'] || '',
                    price: Number(row['Цена'] || 0),
                    shippedQty: Number(row['Факт'] || 0),
                    orderQty: Number(row['Заказ'] || 0),
                    distributionCoef: Number(row['Коэф%'] || 0),
                    weightToDistribute: Number(row['Вес'] || 0),
                    managerId: user?.id ? String(user.id) : null,
                    managerName: user?.username || '',
                    status: 'draft'
                }));

                // FAST: Single bulk request instead of N individual requests
                const startTime = Date.now();
                const res = await axios.post(`${API_URL}/api/summary-orders/bulk`,
                    { items: importData },
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                const elapsed = Date.now() - startTime;
                alert(`✅ Импортировано ${res.data.count} записей за ${(elapsed / 1000).toFixed(1)}с`);
                fetchData(1, true);
            } catch (err: any) {
                console.error('Excel import error:', err);
                alert(err.response?.data?.error || 'Ошибка импорта');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    // Memoized filtered lists for modals (limited to 100 items for performance)
    const filteredCustomers = useMemo(() => {
        return customers.slice(0, 100);
    }, [customers]);

    const filteredProducts = useMemo(() => {
        return products.slice(0, 100);
    }, [products]);

    const selectableEntries = entries.filter(e => e.status !== 'synced');
    const allSelected = selectableEntries.length > 0 && selectedIds.size === selectableEntries.length;

    return (
        <div className="max-w-full mx-auto">
            {/* Табуляция */}
            <div className="flex gap-1 mb-4 border-b">
                <button
                    onClick={() => setActiveTab('orders')}
                    className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'orders'
                        ? 'border-blue-600 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                >
                    📝 Заказы
                </button>
                <button
                    onClick={() => setActiveTab('svod')}
                    className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'svod'
                        ? 'border-green-600 text-green-600 bg-green-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                >
                    📊 СВОД
                </button>
            </div>

            {/* Содержимое вкладки СВОД */}
            {activeTab === 'svod' && (
                <SvodTab selectedDate={filterDate} />
            )}

            {/* Содержимое вкладки Заказы */}
            {activeTab === 'orders' && (
                <>
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold">Сводка заказов</h1>
                            {dirtyEntryIds.size > 0 && (
                                <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium animate-pulse">
                                    {dirtyEntryIds.size} несохранённых
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2 items-center">
                            <input
                                type="date"
                                className="border rounded px-3 py-2"
                                value={filterDate}
                                onChange={e => setFilterDate(e.target.value)}
                            />
                            <button onClick={addEntry} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-1">
                                <Plus size={16} /> Добавить
                            </button>
                            <input type="file" accept=".xlsx,.xls" ref={fileInputRef} onChange={handleExcelImport} className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                                📥 Excel
                            </button>
                            <button
                                onClick={saveAllChanges}
                                disabled={dirtyEntryIds.size === 0 || saving}
                                className={`px-4 py-2 rounded flex items-center gap-1 ${dirtyEntryIds.size > 0
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                <Save size={16} /> {saving ? 'Сохранение...' : `Сохранить (${dirtyEntryIds.size})`}
                            </button>
                            <button onClick={saveToJournal} className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center gap-1">
                                <Save size={16} /> В журнал
                            </button>
                            {selectedIds.size > 0 && (
                                <button onClick={deleteSelected} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 flex items-center gap-1">
                                    <Trash2 size={16} /> ({selectedIds.size})
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filters Panel */}
                    <div className="bg-white rounded shadow p-4 mb-4">
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-2">
                                <Filter size={18} className="text-gray-500" />
                                <span className="font-medium text-sm">Фильтры:</span>
                            </div>

                            <select
                                className="border rounded px-2 py-1 text-sm min-w-[120px]"
                                value={filterCategory}
                                onChange={e => setFilterCategory(e.target.value)}
                            >
                                <option value="">Все категории</option>
                                {filterOptions.categories.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>

                            <select
                                className="border rounded px-2 py-1 text-sm min-w-[120px]"
                                value={filterDistrict}
                                onChange={e => setFilterDistrict(e.target.value)}
                            >
                                <option value="">Все районы</option>
                                {filterOptions.districts.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>

                            <select
                                className="border rounded px-2 py-1 text-sm min-w-[120px]"
                                value={filterManagerId}
                                onChange={e => setFilterManagerId(e.target.value)}
                            >
                                <option value="">Все менеджеры</option>
                                {filterOptions.managers.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>

                            <button onClick={resetFilters} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm">
                                <RefreshCw size={14} /> Сбросить
                            </button>

                            <span className="text-gray-500 text-sm ml-auto">
                                Всего: {totalCount} записей
                            </span>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded shadow overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100 sticky top-0">
                                <tr>
                                    <th className="border px-2 py-2 w-10">
                                        <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4" />
                                    </th>
                                    <th className="border px-2 py-2 text-left w-24">Дата</th>
                                    <th className="border px-2 py-2 text-left w-28">№ Сводки</th>
                                    <th className="border px-2 py-2 text-left w-28">Оплата</th>
                                    <th className="border px-2 py-2 text-left w-40">Клиент</th>
                                    <th className="border px-2 py-2 text-left w-20">Код товара</th>
                                    <th className="border px-2 py-2 text-left">Товар</th>
                                    <th className="border px-2 py-2 text-left w-24">Категория</th>
                                    <th className="border px-2 py-2 text-right w-24" style={{ minWidth: 80 }}>Цена</th>
                                    <th className="border px-2 py-2 text-right w-20" style={{ minWidth: 60 }}>Факт</th>
                                    <th className="border px-2 py-2 text-right w-24 bg-yellow-50" style={{ minWidth: 90 }}>Сумма</th>
                                    <th className="border px-2 py-2 text-right w-16">Заказ</th>
                                    <th className="border px-2 py-2 text-right w-16" style={{ minWidth: 50 }}>Коэф%</th>
                                    <th className="border px-2 py-2 text-right w-20" style={{ minWidth: 60 }}>Вес</th>
                                    <th className="border px-2 py-2 text-left w-28">Менеджер</th>
                                    <th className="border px-2 py-2 text-left w-24">Район</th>
                                    <th className="border px-2 py-2 text-left w-32">Адрес точки</th>
                                    <th className="border px-2 py-2 text-center w-28">Статус</th>
                                    <th className="border px-2 py-2 w-8"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && entries.length === 0 ? (
                                    <tr><td colSpan={19} className="text-center py-8 text-gray-500">Загрузка...</td></tr>
                                ) : entries.length === 0 ? (
                                    <tr><td colSpan={19} className="text-center py-8 text-gray-500">Нет записей. Нажмите "Добавить".</td></tr>
                                ) : (
                                    entries.map(entry => (
                                        <tr key={entry.id} className={`hover:bg-gray-50 ${entry.status === 'synced' ? 'bg-blue-50' : ''} ${entry._dirty ? 'bg-orange-50' : ''}`}>
                                            <td className="border px-2 py-1 text-center">
                                                <input type="checkbox" checked={selectedIds.has(entry.id)} onChange={() => toggleSelect(entry.id)} disabled={entry.status === 'synced'} className="w-4 h-4" />
                                            </td>
                                            <td className="border px-2 py-1 text-xs text-gray-600">{new Date(entry.shipDate).toLocaleDateString('ru-RU')}</td>
                                            <td className="border px-2 py-1 text-xs font-mono text-gray-500">{entry.idn || '-'}</td>
                                            <td className="border px-1 py-1">
                                                <select className="w-full border rounded px-1 py-1 text-xs" value={entry.paymentType || 'bank'} onChange={e => updateEntryLocal(entry.id, { paymentType: e.target.value })} disabled={entry.status === 'synced'}>
                                                    {PAYMENT_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                                                </select>
                                            </td>
                                            <td className="border px-1 py-1">
                                                <button className="w-full text-left text-blue-600 hover:underline text-xs truncate" onClick={() => { setActiveEntryId(entry.id); setShowCustomerModal(true); }} disabled={entry.status === 'synced'}>
                                                    {entry.customerName || 'Выбрать...'}
                                                </button>
                                            </td>
                                            <td className="border px-1 py-1 text-xs text-gray-600 font-mono">{entry.productCode || '-'}</td>
                                            <td className="border px-1 py-1">
                                                <button className="w-full text-left text-blue-600 hover:underline text-xs truncate" onClick={() => { setActiveEntryId(entry.id); setShowProductModal(true); }} disabled={entry.status === 'synced'}>
                                                    {entry.productFullName || 'Выбрать...'}
                                                </button>
                                            </td>
                                            <td className="border px-1 py-1 text-xs text-gray-600">{entry.category || '-'}</td>
                                            <td className="border px-1 py-1">
                                                <input type="number" step="0.01" className="w-full border rounded px-1 py-1 text-xs text-right" value={entry.price} onChange={e => updateEntryLocal(entry.id, { price: parseFloat(e.target.value) || 0 })} disabled={entry.status === 'synced'} />
                                            </td>
                                            <td className="border px-1 py-1">
                                                <input type="number" step="0.1" className="w-full border rounded px-1 py-1 text-xs text-right" value={entry.shippedQty} onChange={e => updateEntryLocal(entry.id, { shippedQty: parseFloat(e.target.value) || 0 })} disabled={entry.status === 'synced'} />
                                            </td>
                                            <td className="border px-1 py-1 text-right font-medium text-xs bg-yellow-50" title={formatNumber(entry.price * entry.shippedQty, 2)}>
                                                {formatNumber(entry.price * entry.shippedQty, 0)}
                                            </td>
                                            <td className="border px-1 py-1">
                                                <input type="number" step="0.1" className="w-full border rounded px-1 py-1 text-xs text-right" value={entry.orderQty} onChange={e => updateEntryLocal(entry.id, { orderQty: parseFloat(e.target.value) || 0 })} disabled={entry.status === 'synced'} />
                                            </td>
                                            <td className="border px-1 py-1">
                                                <input type="number" step="0.1" className="w-full border rounded px-1 py-1 text-xs text-right" value={entry.distributionCoef || 0} onChange={e => updateEntryLocal(entry.id, { distributionCoef: parseFloat(e.target.value) || 0 })} disabled={entry.status === 'synced'} />
                                            </td>
                                            <td className="border px-1 py-1">
                                                <input type="number" step="0.1" className="w-full border rounded px-1 py-1 text-xs text-right" value={entry.weightToDistribute || 0} onChange={e => updateEntryLocal(entry.id, { weightToDistribute: parseFloat(e.target.value) || 0 })} disabled={entry.status === 'synced'} />
                                            </td>
                                            <td className="border px-1 py-1 text-xs text-gray-600 truncate" title={entry.managerName || ''}>{entry.managerName || '-'}</td>
                                            <td className="border px-1 py-1 text-xs text-gray-600 truncate" title={entry.district || ''}>{entry.district || '-'}</td>
                                            <td className="border px-1 py-1 text-xs text-gray-600 truncate" title={entry.pointAddress || ''}>{entry.pointAddress || '-'}</td>
                                            <td className="border px-1 py-1 text-center">
                                                {entry.status === 'synced' ? (
                                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">✓ В заказах</span>
                                                ) : entry.status === 'forming' ? (
                                                    <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">🔄 Собирается</span>
                                                ) : (
                                                    <button onClick={() => processEntry(entry.id)} className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600">Начать сборку</button>
                                                )}
                                            </td>
                                            <td className="border px-1 py-1 text-center">
                                                {entry.status !== 'synced' && (
                                                    <button onClick={() => deleteEntry(entry.id)} className="text-red-500 hover:text-red-700">✕</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Load More Button */}
                    {hasMore && (
                        <div className="text-center mt-4">
                            <button
                                onClick={loadMore}
                                disabled={loading}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded border disabled:opacity-50"
                            >
                                {loading ? 'Загрузка...' : `Загрузить ещё (показано ${entries.length} из ${totalCount})`}
                            </button>
                        </div>
                    )}

                    {!hasMore && entries.length > 0 && (
                        <div className="text-center mt-4 text-gray-500 text-sm">
                            Показаны все {entries.length} записей
                        </div>
                    )}

                    {/* Customer Modal - Optimized with search */}
                    {showCustomerModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                            <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col">
                                <div className="p-4 border-b flex justify-between items-center">
                                    <h3 className="text-lg font-semibold">Выбор клиента</h3>
                                    <button onClick={() => setShowCustomerModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
                                </div>
                                <div className="p-4 border-b">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Поиск клиента..."
                                            className="w-full border rounded pl-10 pr-3 py-2"
                                            value={searchCustomer}
                                            onChange={e => setSearchCustomer(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto p-2 max-h-[400px]">
                                    {filteredCustomers.map(customer => (
                                        <button
                                            key={customer.id}
                                            onClick={() => selectCustomer(customer)}
                                            className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded"
                                        >
                                            <div className="font-medium">{customer.name}</div>
                                            <div className="text-xs text-gray-500">{customer.code} {customer.district && `• ${customer.district}`}</div>
                                        </button>
                                    ))}
                                    {filteredCustomers.length === 0 && (
                                        <div className="text-center text-gray-500 py-4">
                                            {searchCustomer ? 'Клиенты не найдены' : 'Загрузка...'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Product Modal - Optimized with search */}
                    {showProductModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                            <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col">
                                <div className="p-4 border-b flex justify-between items-center">
                                    <h3 className="text-lg font-semibold">Выбор товара</h3>
                                    <button onClick={() => setShowProductModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
                                </div>
                                <div className="p-4 border-b">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Поиск товара..."
                                            className="w-full border rounded pl-10 pr-3 py-2"
                                            value={searchProduct}
                                            onChange={e => setSearchProduct(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto p-2 max-h-[400px]">
                                    {filteredProducts.map(product => (
                                        <button
                                            key={product.id}
                                            onClick={() => selectProduct(product)}
                                            className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded"
                                        >
                                            <div className="font-medium">{product.name}</div>
                                            <div className="text-xs text-gray-500">{product.code} • {product.category || 'Без категории'}</div>
                                        </button>
                                    ))}
                                    {filteredProducts.length === 0 && (
                                        <div className="text-center text-gray-500 py-4">
                                            {searchProduct ? 'Товары не найдены' : 'Загрузка...'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

