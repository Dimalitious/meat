import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';

interface Customer {
    id: number;
    name: string;
    code: string;
}

interface Product {
    id: number;
    name: string;
    code: string;
    category: string | null;
    shortNameMorning: string | null;
    priceMorning: number | null;
}

interface SummaryEntry {
    id: number;
    shipDate: string;
    paymentType: string;
    customerId: number | null;
    customerName: string;
    productId: number | null;
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
    status: string;
}

const PAYMENT_TYPES = [
    { value: 'cash', label: 'Наличка' },
    { value: 'terminal', label: 'Терминал' },
    { value: 'bank', label: 'Безнал' }
];

const STATUS_OPTIONS = [
    { value: 'draft', label: 'Не обработан', color: 'bg-gray-100 text-gray-700' },
    { value: 'forming', label: 'Обработан', color: 'bg-green-100 text-green-800' },
    { value: 'synced', label: 'В заказах', color: 'bg-blue-100 text-blue-800' }
];

export default function SummaryOrdersPage() {
    const { user } = useAuth();
    const [entries, setEntries] = useState<SummaryEntry[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const [activeEntryId, setActiveEntryId] = useState<number | null>(null);
    const [searchCustomer, setSearchCustomer] = useState('');
    const [searchProduct, setSearchProduct] = useState('');

    useEffect(() => {
        fetchData();
    }, [filterDate]);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const [entriesRes, custRes, prodRes] = await Promise.all([
                axios.get(`${API_URL}/api/summary-orders?date=${filterDate}`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_URL}/api/customers`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_URL}/api/products`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setEntries(entriesRes.data);
            setCustomers(custRes.data);
            setProducts(prodRes.data);
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    };

    const addEntry = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/api/summary-orders`, {
                shipDate: filterDate,
                paymentType: 'cash',
                customerName: '',
                productFullName: '',
                price: 0,
                shippedQty: 0,
                orderQty: 0,
                managerId: user?.id || null,
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

            // Calculate sumWithRevaluation if price or shippedQty changed
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

    const selectCustomer = (customer: Customer) => {
        if (activeEntryId) {
            updateEntry(activeEntryId, {
                customerId: customer.id,
                customerName: customer.name
            });
        }
        setShowCustomerModal(false);
        setSearchCustomer('');
    };

    const selectProduct = (product: Product) => {
        if (activeEntryId) {
            updateEntry(activeEntryId, {
                productId: product.id,
                productFullName: product.name,
                category: product.category,
                shortNameMorning: product.shortNameMorning,
                price: Number(product.priceMorning) || 0
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
        const entry = entries.find(e => e.id === id);
        if (!entry) return;

        const newStatus = entry.status === 'draft' ? 'forming' : 'draft';
        await updateEntry(id, { status: newStatus });
    };

    const syncFormingEntries = async () => {
        const formingIds = entries.filter(e => e.status === 'forming').map(e => e.id);
        if (formingIds.length === 0) {
            alert('Нет записей со статусом "Обработан"');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/summary-orders/sync`, {
                entryIds: formingIds
            }, { headers: { Authorization: `Bearer ${token}` } });

            alert(`Создано заказов: ${formingIds.length} записей синхронизированы!`);
            fetchData();
        } catch (err) {
            alert('Ошибка синхронизации');
        }
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
        c.code.toLowerCase().includes(searchCustomer.toLowerCase())
    );

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
        p.code.toLowerCase().includes(searchProduct.toLowerCase())
    );

    if (loading) return <div className="p-8 text-center">Загрузка...</div>;

    const formingCount = entries.filter(e => e.status === 'forming').length;

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
                    <button
                        onClick={addEntry}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                        + Добавить строку
                    </button>
                    {formingCount > 0 && (
                        <button
                            onClick={syncFormingEntries}
                            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                        >
                            Создать заказы ({formingCount})
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded shadow overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border px-2 py-2 text-left w-28">Дата</th>
                            <th className="border px-2 py-2 text-left w-24">Тип оплаты</th>
                            <th className="border px-2 py-2 text-left w-40">Клиент</th>
                            <th className="border px-2 py-2 text-left">Товар</th>
                            <th className="border px-2 py-2 text-left w-24">Категория</th>
                            <th className="border px-2 py-2 text-left w-24">Короткое</th>
                            <th className="border px-2 py-2 text-right w-20">Цена</th>
                            <th className="border px-2 py-2 text-right w-16">Факт</th>
                            <th className="border px-2 py-2 text-right w-20">Сумма переоц.</th>
                            <th className="border px-2 py-2 text-right w-16">Заказ</th>
                            <th className="border px-2 py-2 text-right w-16">Коэф%</th>
                            <th className="border px-2 py-2 text-right w-20">Вес распр.</th>
                            <th className="border px-2 py-2 text-left w-28">Менеджер</th>
                            <th className="border px-2 py-2 text-center w-28">Статус</th>
                            <th className="border px-2 py-2 w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.length === 0 ? (
                            <tr>
                                <td colSpan={15} className="text-center py-8 text-gray-500">
                                    Нет записей на {filterDate}. Нажмите "Добавить строку".
                                </td>
                            </tr>
                        ) : (
                            entries.map(entry => (
                                <tr key={entry.id} className={`hover:bg-gray-50 ${entry.status === 'synced' ? 'bg-blue-50' : ''}`}>
                                    <td className="border px-2 py-1 text-gray-600 text-xs">
                                        {new Date(entry.shipDate).toLocaleDateString('ru-RU')}
                                    </td>
                                    <td className="border px-1 py-1">
                                        <select
                                            className="w-full border rounded px-1 py-1 text-xs"
                                            value={entry.paymentType || 'cash'}
                                            onChange={e => updateEntry(entry.id, { paymentType: e.target.value })}
                                            disabled={entry.status === 'synced'}
                                        >
                                            {PAYMENT_TYPES.map(pt => (
                                                <option key={pt.value} value={pt.value}>{pt.label}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="border px-1 py-1">
                                        <button
                                            className="w-full text-left text-blue-600 hover:underline text-xs truncate"
                                            onClick={() => {
                                                setActiveEntryId(entry.id);
                                                setShowCustomerModal(true);
                                            }}
                                            disabled={entry.status === 'synced'}
                                        >
                                            {entry.customerName || 'Выбрать клиента...'}
                                        </button>
                                    </td>
                                    <td className="border px-1 py-1">
                                        <button
                                            className="w-full text-left text-blue-600 hover:underline text-xs truncate"
                                            onClick={() => {
                                                setActiveEntryId(entry.id);
                                                setShowProductModal(true);
                                            }}
                                            disabled={entry.status === 'synced'}
                                        >
                                            {entry.productFullName || 'Выбрать товар...'}
                                        </button>
                                    </td>
                                    <td className="border px-2 py-1 text-gray-600 text-xs">{entry.category || '-'}</td>
                                    <td className="border px-2 py-1 text-gray-600 text-xs">{entry.shortNameMorning || '-'}</td>
                                    <td className="border px-1 py-1">
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full border rounded px-1 py-1 text-xs text-right"
                                            value={entry.price}
                                            onChange={e => updateEntry(entry.id, { price: parseFloat(e.target.value) || 0 })}
                                            disabled={entry.status === 'synced'}
                                        />
                                    </td>
                                    <td className="border px-1 py-1">
                                        <input
                                            type="number"
                                            step="0.1"
                                            className="w-full border rounded px-1 py-1 text-xs text-right"
                                            value={entry.shippedQty}
                                            onChange={e => updateEntry(entry.id, { shippedQty: parseFloat(e.target.value) || 0 })}
                                            disabled={entry.status === 'synced'}
                                        />
                                    </td>
                                    <td className="border px-2 py-1 text-right font-medium text-xs bg-yellow-50">
                                        {(entry.price * entry.shippedQty).toFixed(2)}
                                    </td>
                                    <td className="border px-1 py-1">
                                        <input
                                            type="number"
                                            step="0.1"
                                            className="w-full border rounded px-1 py-1 text-xs text-right"
                                            value={entry.orderQty}
                                            onChange={e => updateEntry(entry.id, { orderQty: parseFloat(e.target.value) || 0 })}
                                            disabled={entry.status === 'synced'}
                                        />
                                    </td>
                                    <td className="border px-1 py-1">
                                        <input
                                            type="number"
                                            step="0.1"
                                            className="w-full border rounded px-1 py-1 text-xs text-right"
                                            value={entry.distributionCoef || 0}
                                            onChange={e => updateEntry(entry.id, { distributionCoef: parseFloat(e.target.value) || 0 })}
                                            disabled={entry.status === 'synced'}
                                        />
                                    </td>
                                    <td className="border px-1 py-1">
                                        <input
                                            type="number"
                                            step="0.1"
                                            className="w-full border rounded px-1 py-1 text-xs text-right"
                                            value={entry.weightToDistribute || 0}
                                            onChange={e => updateEntry(entry.id, { weightToDistribute: parseFloat(e.target.value) || 0 })}
                                            disabled={entry.status === 'synced'}
                                        />
                                    </td>
                                    <td className="border px-2 py-1 text-gray-600 text-xs">
                                        {entry.managerName || '-'}
                                    </td>
                                    <td className="border px-1 py-1 text-center">
                                        {entry.status === 'synced' ? (
                                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                                В заказах
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => processEntry(entry.id)}
                                                className={`px-2 py-1 rounded text-xs font-medium ${entry.status === 'forming'
                                                        ? 'bg-green-500 text-white'
                                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                    }`}
                                            >
                                                {entry.status === 'forming' ? '✓ Обработан' : 'Обработать'}
                                            </button>
                                        )}
                                    </td>
                                    <td className="border px-1 py-1 text-center">
                                        {entry.status !== 'synced' && (
                                            <button
                                                onClick={() => deleteEntry(entry.id)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Customer Modal */}
            {showCustomerModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Выбор клиента</h3>
                            <button onClick={() => setShowCustomerModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
                        </div>
                        <div className="p-4 border-b">
                            <input
                                type="text"
                                placeholder="Поиск по названию или коду..."
                                className="w-full border rounded px-3 py-2"
                                value={searchCustomer}
                                onChange={e => setSearchCustomer(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="flex-1 overflow-auto p-2">
                            {filteredCustomers.length === 0 ? (
                                <p className="text-center text-gray-500 py-4">Клиенты не найдены</p>
                            ) : (
                                filteredCustomers.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => selectCustomer(c)}
                                        className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded flex justify-between"
                                    >
                                        <span>{c.name}</span>
                                        <span className="text-gray-400 text-sm">{c.code}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Product Modal */}
            {showProductModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Выбор товара</h3>
                            <button onClick={() => setShowProductModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
                        </div>
                        <div className="p-4 border-b">
                            <input
                                type="text"
                                placeholder="Поиск по названию или коду..."
                                className="w-full border rounded px-3 py-2"
                                value={searchProduct}
                                onChange={e => setSearchProduct(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="flex-1 overflow-auto p-2">
                            {filteredProducts.length === 0 ? (
                                <p className="text-center text-gray-500 py-4">Товары не найдены</p>
                            ) : (
                                filteredProducts.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => selectProduct(p)}
                                        className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded flex justify-between items-center"
                                    >
                                        <div className="flex-1">
                                            <div className="font-medium">{p.name}</div>
                                            <div className="text-xs text-gray-500">
                                                {p.category || '-'} | {p.shortNameMorning || '-'}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm text-gray-400">{p.code}</div>
                                            <div className="text-sm font-medium">{p.priceMorning || 0} ₽</div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
