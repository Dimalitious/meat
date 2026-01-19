import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import { Filter, RefreshCw, Plus, Trash2, Save, FileDown } from 'lucide-react';

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

export default function SummaryOrdersPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [entries, setEntries] = useState<SummaryEntry[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [filterOptions, setFilterOptions] = useState<FilterOptions>({ categories: [], districts: [], managers: [] });
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    useEffect(() => {
        fetchReferences();
    }, []);

    useEffect(() => {
        // Reset and reload when filters change
        setPage(1);
        setEntries([]);
        fetchData(1, true);
    }, [filterDate, filterCustomerId, filterProductId, filterCategory, filterDistrict, filterManagerId]);

    const fetchReferences = async () => {
        try {
            const token = localStorage.getItem('token');
            const [custRes, prodRes, optionsRes] = await Promise.all([
                axios.get(`${API_URL}/api/customers`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_URL}/api/products`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_URL}/api/summary-orders/filter-options`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setCustomers(custRes.data);
            setProducts(prodRes.data);
            setFilterOptions(optionsRes.data);
        } catch (err) {
            console.error('Failed to fetch references:', err);
        }
    };

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
                paymentType: 'bank', // Перечисление по умолчанию
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

    const updateEntry = async (id: number, updates: Partial<SummaryEntry>) => {
        try {
            const token = localStorage.getItem('token');
            const entry = entries.find(e => e.id === id);
            if (entry && (updates.price !== undefined || updates.shippedQty !== undefined)) {
                const price = updates.price !== undefined ? updates.price : entry.price;
                const shippedQty = updates.shippedQty !== undefined ? updates.shippedQty : entry.shippedQty;
                updates.sumWithRevaluation = price * shippedQty;
            }

            await axios.put(`${API_URL}/api/summary-orders/${id}`, updates, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEntries(entries.map(e => e.id === id ? { ...e, ...updates } : e));
        } catch (err) {
            console.error('Update error:', err);
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
            updateEntry(activeEntryId, {
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
            updateEntry(activeEntryId, {
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

    const processEntry = async (id: number) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_URL}/api/summary-orders/${id}`, { status: 'forming' }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEntries(entries.map(e => e.id === id ? { ...e, status: 'forming' } : e));
        } catch (err) {
            alert('Ошибка обработки');
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

    // Excel import
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
                const token = localStorage.getItem('token');

                for (const row of jsonData as any[]) {
                    const customer = customers.find(c =>
                        c.name.toLowerCase() === (row['Клиент'] || '').toLowerCase()
                    );
                    const product = products.find(p =>
                        p.name.toLowerCase() === (row['Товар'] || '').toLowerCase()
                    );

                    await axios.post(`${API_URL}/api/summary-orders`, {
                        shipDate: filterDate,
                        paymentType: row['Оплата'] || 'bank',
                        customerId: customer?.id || null,
                        customerName: row['Клиент'] || '',
                        productId: product?.id || null,
                        productCode: product?.code || null,
                        productFullName: row['Товар'] || '',
                        category: product?.category || null,
                        price: Number(row['Цена'] || 0),
                        shippedQty: Number(row['Факт'] || 0),
                        orderQty: Number(row['Заказ'] || 0),
                        distributionCoef: Number(row['Коэф%'] || 0),
                        weightToDistribute: Number(row['Вес'] || 0),
                        district: customer?.district || null,
                        managerId: user?.id ? String(user.id) : null,
                        managerName: user?.username || '',
                        status: 'draft'
                    }, { headers: { Authorization: `Bearer ${token}` } });
                }

                alert(`Импортировано ${jsonData.length} записей`);
                fetchData(1, true);
            } catch (err) {
                alert('Ошибка импорта');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
        c.code.toLowerCase().includes(searchCustomer.toLowerCase())
    );

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
        p.code.toLowerCase().includes(searchProduct.toLowerCase())
    );

    const selectableEntries = entries.filter(e => e.status !== 'synced');
    const allSelected = selectableEntries.length > 0 && selectedIds.size === selectableEntries.length;

    return (
        <div className="max-w-full mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Сводка заказов</h1>
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
                    <button onClick={saveToJournal} className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center gap-1">
                        <Save size={16} /> Сохранить
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
                        className="border rounded px-2 py-1 text-sm min-w-[150px]"
                        value={filterCustomerId}
                        onChange={e => setFilterCustomerId(e.target.value ? Number(e.target.value) : '')}
                    >
                        <option value="">Все клиенты</option>
                        {customers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>

                    <select
                        className="border rounded px-2 py-1 text-sm min-w-[150px]"
                        value={filterProductId}
                        onChange={e => setFilterProductId(e.target.value ? Number(e.target.value) : '')}
                    >
                        <option value="">Все товары</option>
                        {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>

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
                                <tr key={entry.id} className={`hover:bg-gray-50 ${entry.status === 'synced' ? 'bg-blue-50' : ''}`}>
                                    <td className="border px-2 py-1 text-center">
                                        <input type="checkbox" checked={selectedIds.has(entry.id)} onChange={() => toggleSelect(entry.id)} disabled={entry.status === 'synced'} className="w-4 h-4" />
                                    </td>
                                    <td className="border px-2 py-1 text-xs text-gray-600">{new Date(entry.shipDate).toLocaleDateString('ru-RU')}</td>
                                    <td className="border px-2 py-1 text-xs font-mono text-gray-500">{entry.idn || '-'}</td>
                                    <td className="border px-1 py-1">
                                        <select className="w-full border rounded px-1 py-1 text-xs" value={entry.paymentType || 'bank'} onChange={e => updateEntry(entry.id, { paymentType: e.target.value })} disabled={entry.status === 'synced'}>
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
                                        <input type="number" step="0.01" className="w-full border rounded px-1 py-1 text-xs text-right" value={entry.price} onChange={e => updateEntry(entry.id, { price: parseFloat(e.target.value) || 0 })} disabled={entry.status === 'synced'} />
                                    </td>
                                    <td className="border px-1 py-1">
                                        <input type="number" step="0.1" className="w-full border rounded px-1 py-1 text-xs text-right" value={entry.shippedQty} onChange={e => updateEntry(entry.id, { shippedQty: parseFloat(e.target.value) || 0 })} disabled={entry.status === 'synced'} />
                                    </td>
                                    <td className="border px-1 py-1 text-right font-medium text-xs bg-yellow-50" title={formatNumber(entry.price * entry.shippedQty, 2)}>
                                        {formatNumber(entry.price * entry.shippedQty, 0)}
                                    </td>
                                    <td className="border px-1 py-1">
                                        <input type="number" step="0.1" className="w-full border rounded px-1 py-1 text-xs text-right" value={entry.orderQty} onChange={e => updateEntry(entry.id, { orderQty: parseFloat(e.target.value) || 0 })} disabled={entry.status === 'synced'} />
                                    </td>
                                    <td className="border px-1 py-1">
                                        <input type="number" step="0.1" className="w-full border rounded px-1 py-1 text-xs text-right" value={entry.distributionCoef || 0} onChange={e => updateEntry(entry.id, { distributionCoef: parseFloat(e.target.value) || 0 })} disabled={entry.status === 'synced'} />
                                    </td>
                                    <td className="border px-1 py-1">
                                        <input type="number" step="0.1" className="w-full border rounded px-1 py-1 text-xs text-right" value={entry.weightToDistribute || 0} onChange={e => updateEntry(entry.id, { weightToDistribute: parseFloat(e.target.value) || 0 })} disabled={entry.status === 'synced'} />
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

            {/* Customer Modal */}
            {showCustomerModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Выбор клиента</h3>
                            <button onClick={() => setShowCustomerModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
                        </div>
                        <div className="p-4 border-b">
                            <input
                                type="text"
                                placeholder="Поиск..."
                                className="w-full border rounded px-3 py-2"
                                value={searchCustomer}
                                onChange={e => setSearchCustomer(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="flex-1 overflow-auto p-2 max-h-[400px]">
                            {filteredCustomers.slice(0, 50).map(customer => (
                                <button
                                    key={customer.id}
                                    onClick={() => selectCustomer(customer)}
                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded"
                                >
                                    <div className="font-medium">{customer.name}</div>
                                    <div className="text-xs text-gray-500">{customer.code} {customer.district && `• ${customer.district}`}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Product Modal */}
            {showProductModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Выбор товара</h3>
                            <button onClick={() => setShowProductModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
                        </div>
                        <div className="p-4 border-b">
                            <input
                                type="text"
                                placeholder="Поиск..."
                                className="w-full border rounded px-3 py-2"
                                value={searchProduct}
                                onChange={e => setSearchProduct(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="flex-1 overflow-auto p-2 max-h-[400px]">
                            {filteredProducts.slice(0, 50).map(product => (
                                <button
                                    key={product.id}
                                    onClick={() => selectProduct(product)}
                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded"
                                >
                                    <div className="font-medium">{product.name}</div>
                                    <div className="text-xs text-gray-500">{product.code} • {product.category || 'Без категории'}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
