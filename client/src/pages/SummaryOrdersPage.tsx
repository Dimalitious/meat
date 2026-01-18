import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

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

export default function SummaryOrdersPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [entries, setEntries] = useState<SummaryEntry[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            setSelectedIds(new Set());
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

    // Checkbox handlers
    const toggleSelect = (id: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === entries.filter(e => e.status !== 'synced').length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(entries.filter(e => e.status !== 'synced').map(e => e.id)));
        }
    };

    const deleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Удалить ${selectedIds.size} выбранных записей?`)) return;

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

    // Excel import
    const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = evt.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);

                const token = localStorage.getItem('token');

                for (const row of jsonData as any[]) {
                    // Find customer by name
                    const customer = customers.find(c =>
                        c.name.toLowerCase() === (row['Клиент'] || row['customerName'] || '').toLowerCase()
                    );
                    // Find product by name
                    const product = products.find(p =>
                        p.name.toLowerCase() === (row['Товар'] || row['productFullName'] || '').toLowerCase()
                    );

                    await axios.post(`${API_URL}/api/summary-orders`, {
                        shipDate: filterDate,
                        paymentType: row['Тип оплаты'] || row['paymentType'] || 'cash',
                        customerId: customer?.id || null,
                        customerName: row['Клиент'] || row['customerName'] || '',
                        productId: product?.id || null,
                        productFullName: row['Товар'] || row['productFullName'] || '',
                        category: product?.category || row['Категория'] || null,
                        shortNameMorning: product?.shortNameMorning || row['Короткое'] || null,
                        price: Number(row['Цена'] || row['price'] || 0),
                        shippedQty: Number(row['Факт'] || row['shippedQty'] || 0),
                        orderQty: Number(row['Заказ'] || row['orderQty'] || 0),
                        distributionCoef: Number(row['Коэф%'] || row['distributionCoef'] || 0),
                        weightToDistribute: Number(row['Вес распр.'] || row['weightToDistribute'] || 0),
                        managerId: user?.id ? String(user.id) : null,
                        managerName: user?.username || 'Менеджер',
                        status: 'draft'
                    }, { headers: { Authorization: `Bearer ${token}` } });
                }

                alert(`Импортировано ${jsonData.length} записей`);
                fetchData();
            } catch (err) {
                console.error('Excel import error:', err);
                alert('Ошибка импорта Excel');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
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
            selectedIds.delete(id);
            setSelectedIds(new Set(selectedIds));
        } catch (err) {
            alert('Ошибка при удалении');
        }
    };

    // Process entry = mark as forming and navigate to assembly
    const processEntry = async (id: number) => {
        const entry = entries.find(e => e.id === id);
        if (!entry) return;

        if (entry.status === 'forming') {
            // Already forming, unmark
            await updateEntry(id, { status: 'draft' });
        } else {
            // Mark as forming and navigate to assembly
            try {
                const token = localStorage.getItem('token');

                await axios.put(`${API_URL}/api/summary-orders/${id}`, { status: 'forming' }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                // Navigate to assembly orders page
                navigate('/assembly-orders');
            } catch (err) {
                console.error('Process error:', err);
                alert('Ошибка обработки');
            }
        }
    };

    // Save to journal
    const saveToJournal = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/journals/summary`, {
                summaryDate: filterDate,
                createdBy: user?.username || 'Unknown',
                data: entries
            }, { headers: { Authorization: `Bearer ${token}` } });
            alert('Сводка сохранена в журнал!');
        } catch (err) {
            console.error('Save to journal error:', err);
            alert('Ошибка сохранения в журнал');
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
                    <button
                        onClick={addEntry}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                        + Добавить
                    </button>
                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        ref={fileInputRef}
                        onChange={handleExcelImport}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                    >
                        📥 Загрузить Excel
                    </button>
                    <button
                        onClick={saveToJournal}
                        className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                    >
                        💾 Сохранить
                    </button>
                    {selectedIds.size > 0 && (
                        <button
                            onClick={deleteSelected}
                            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                        >
                            🗑 Удалить ({selectedIds.size})
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded shadow overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border px-2 py-2 w-10">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4"
                                />
                            </th>
                            <th className="border px-2 py-2 text-left w-24">Дата</th>
                            <th className="border px-2 py-2 text-left w-20">Оплата</th>
                            <th className="border px-2 py-2 text-left w-36">Клиент</th>
                            <th className="border px-2 py-2 text-left">Товар</th>
                            <th className="border px-2 py-2 text-left w-20">Категория</th>
                            <th className="border px-2 py-2 text-left w-20">Короткое</th>
                            <th className="border px-2 py-2 text-right w-16">Цена</th>
                            <th className="border px-2 py-2 text-right w-14">Факт</th>
                            <th className="border px-2 py-2 text-right w-16">Сумма</th>
                            <th className="border px-2 py-2 text-right w-14">Заказ</th>
                            <th className="border px-2 py-2 text-right w-14">Коэф%</th>
                            <th className="border px-2 py-2 text-right w-16">Вес</th>
                            <th className="border px-2 py-2 text-left w-24">Менеджер</th>
                            <th className="border px-2 py-2 text-center w-24">Статус</th>
                            <th className="border px-2 py-2 w-8"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.length === 0 ? (
                            <tr>
                                <td colSpan={16} className="text-center py-8 text-gray-500">
                                    Нет записей на {filterDate}. Нажмите "Добавить" или "Загрузить Excel".
                                </td>
                            </tr>
                        ) : (
                            entries.map(entry => (
                                <tr key={entry.id} className={`hover:bg-gray-50 ${entry.status === 'synced' ? 'bg-blue-50' : ''}`}>
                                    <td className="border px-2 py-1 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(entry.id)}
                                            onChange={() => toggleSelect(entry.id)}
                                            disabled={entry.status === 'synced'}
                                            className="w-4 h-4"
                                        />
                                    </td>
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
                                            {entry.customerName || 'Выбрать...'}
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
                                            {entry.productFullName || 'Выбрать...'}
                                        </button>
                                    </td>
                                    <td className="border px-1 py-1 text-gray-600 text-xs">{entry.category || '-'}</td>
                                    <td className="border px-1 py-1 text-gray-600 text-xs">{entry.shortNameMorning || '-'}</td>
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
                                    <td className="border px-1 py-1 text-right font-medium text-xs bg-yellow-50">
                                        {(entry.price * entry.shippedQty).toFixed(0)}
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
                                    <td className="border px-1 py-1 text-gray-600 text-xs">
                                        {entry.managerName || '-'}
                                    </td>
                                    <td className="border px-1 py-1 text-center">
                                        {entry.status === 'synced' ? (
                                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                                ✓ В заказах
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => processEntry(entry.id)}
                                                className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
                                            >
                                                Обработать
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
                                placeholder="Поиск..."
                                className="w-full border rounded px-3 py-2"
                                value={searchCustomer}
                                onChange={e => setSearchCustomer(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="flex-1 overflow-auto p-2">
                            {filteredCustomers.length === 0 ? (
                                <p className="text-center text-gray-500 py-4">Не найдены</p>
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
                                placeholder="Поиск..."
                                className="w-full border rounded px-3 py-2"
                                value={searchProduct}
                                onChange={e => setSearchProduct(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="flex-1 overflow-auto p-2">
                            {filteredProducts.length === 0 ? (
                                <p className="text-center text-gray-500 py-4">Не найдены</p>
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
