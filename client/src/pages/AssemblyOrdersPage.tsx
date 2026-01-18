import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Check, Edit2, Search } from 'lucide-react';

interface AssemblyItem {
    id: number;
    productId: number;
    productName: string;
    category: string;
    orderedQty: number;
    loadedQty: number;
    confirmed: boolean;
    customerId: number;
    customerName: string;
}

interface Customer {
    id: number;
    name: string;
    items: AssemblyItem[];
}

// Category icons mapping
const getCategoryIcon = (category: string) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('курица') || cat.includes('птица')) return '🐔';
    if (cat.includes('говядина') || cat.includes('бык')) return '🐄';
    if (cat.includes('баранина') || cat.includes('баран')) return '🐑';
    if (cat.includes('рыба') || cat.includes('морепродукт')) return '🐟';
    return '📦';
};

export default function AssemblyOrdersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
    const [searchCustomer, setSearchCustomer] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAssemblyData();
    }, []);

    const loadAssemblyData = async () => {
        try {
            const token = localStorage.getItem('token');

            // Load from summary orders with status 'forming'
            const res = await axios.get(`${API_URL}/api/summary-orders`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Group by customer
            const formingEntries = res.data.filter((e: any) => e.status === 'forming');
            const customerMap: { [key: number]: Customer } = {};

            for (const entry of formingEntries) {
                if (!entry.customerId) continue;

                if (!customerMap[entry.customerId]) {
                    customerMap[entry.customerId] = {
                        id: entry.customerId,
                        name: entry.customerName,
                        items: []
                    };
                }

                customerMap[entry.customerId].items.push({
                    id: entry.id,
                    productId: entry.productId,
                    productName: entry.productFullName,
                    category: entry.category || '',
                    orderedQty: entry.orderQty || entry.shippedQty,
                    loadedQty: entry.shippedQty || 0,
                    confirmed: entry.status === 'synced',
                    customerId: entry.customerId,
                    customerName: entry.customerName
                });
            }

            const customerList = Object.values(customerMap);
            setCustomers(customerList);

            if (customerList.length > 0 && !selectedCustomerId) {
                setSelectedCustomerId(customerList[0].id);
            }
        } catch (err) {
            console.error('Failed to load assembly data:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateLoadedQty = (itemId: number, qty: number) => {
        setCustomers(customers.map(c => ({
            ...c,
            items: c.items.map(item =>
                item.id === itemId ? { ...item, loadedQty: qty } : item
            )
        })));
    };

    const confirmItem = async (itemId: number) => {
        try {
            const token = localStorage.getItem('token');

            // Find the item
            let targetItem: AssemblyItem | null = null;
            for (const c of customers) {
                const item = c.items.find(i => i.id === itemId);
                if (item) { targetItem = item; break; }
            }
            if (!targetItem) return;

            // Update summary order to synced and update shippedQty
            await axios.put(`${API_URL}/api/summary-orders/${itemId}`, {
                shippedQty: targetItem.loadedQty,
                status: 'synced'
            }, { headers: { Authorization: `Bearer ${token}` } });

            // Sync to orders
            await axios.post(`${API_URL}/api/summary-orders/sync`, {
                entryIds: [itemId]
            }, { headers: { Authorization: `Bearer ${token}` } });

            // Update local state
            setCustomers(customers.map(c => ({
                ...c,
                items: c.items.map(item =>
                    item.id === itemId ? { ...item, confirmed: true } : item
                )
            })));

        } catch (err) {
            console.error('Confirm error:', err);
            alert('Ошибка подтверждения');
        }
    };

    const enableEdit = (itemId: number) => {
        setCustomers(customers.map(c => ({
            ...c,
            items: c.items.map(item =>
                item.id === itemId ? { ...item, confirmed: false } : item
            )
        })));
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchCustomer.toLowerCase())
    );

    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

    if (loading) return <div className="p-8 text-center">Загрузка...</div>;

    return (
        <div className="flex h-[calc(100vh-80px)] gap-4">
            {/* Left Panel - Customers */}
            <div className="w-80 bg-white rounded-lg shadow flex flex-col">
                <div className="p-4 border-b">
                    <h2 className="text-lg font-bold mb-3">Клиенты</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Поиск клиента..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg"
                            value={searchCustomer}
                            onChange={e => setSearchCustomer(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    {filteredCustomers.length === 0 ? (
                        <p className="p-4 text-center text-gray-500">
                            Нет клиентов для сборки
                        </p>
                    ) : (
                        filteredCustomers.map(c => {
                            const confirmedCount = c.items.filter(i => i.confirmed).length;
                            const allConfirmed = confirmedCount === c.items.length;
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => setSelectedCustomerId(c.id)}
                                    className={`w-full text-left p-4 border-b hover:bg-gray-50 flex justify-between items-center
                                        ${selectedCustomerId === c.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}
                                    `}
                                >
                                    <div>
                                        <div className="font-medium">{c.name}</div>
                                        <div className="text-sm text-gray-500">
                                            {c.items.length} позиций
                                        </div>
                                    </div>
                                    {allConfirmed && (
                                        <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded">
                                            ✓ Готово
                                        </span>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right Panel - Order Items */}
            <div className="flex-1 bg-white rounded-lg shadow overflow-auto p-4">
                {!selectedCustomer ? (
                    <div className="h-full flex items-center justify-center text-gray-500">
                        Выберите клиента слева
                    </div>
                ) : (
                    <>
                        <h2 className="text-xl font-bold mb-4">
                            {selectedCustomer.name}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {selectedCustomer.items.map(item => (
                                <div
                                    key={item.id}
                                    className={`border rounded-lg overflow-hidden ${item.confirmed ? 'opacity-60 bg-gray-50' : 'bg-white'
                                        }`}
                                >
                                    {/* Card Header */}
                                    <div className="p-4 flex items-start gap-3">
                                        <span className={`text-4xl ${item.confirmed ? 'grayscale' : ''}`}>
                                            {getCategoryIcon(item.category)}
                                        </span>
                                        <div className="flex-1">
                                            <h3 className="font-medium text-sm leading-tight">
                                                {item.productName}
                                            </h3>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {item.category || 'Без категории'}
                                            </p>
                                        </div>
                                        {item.confirmed && (
                                            <button
                                                onClick={() => enableEdit(item.id)}
                                                className="text-blue-500 hover:text-blue-700 p-1"
                                                title="Редактировать"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Card Body - Quantities */}
                                    <div className="bg-gray-50 p-4 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-600">Заказано:</span>
                                            <span className="font-bold">{item.orderedQty} кг</span>
                                        </div>
                                        <div className="flex justify-between items-center gap-2">
                                            <span className="text-sm text-gray-600">Погрузили:</span>
                                            <input
                                                type="number"
                                                step="0.1"
                                                className="w-24 border rounded px-2 py-1 text-right font-medium"
                                                value={item.loadedQty}
                                                onChange={e => updateLoadedQty(item.id, parseFloat(e.target.value) || 0)}
                                                disabled={item.confirmed}
                                            />
                                            <span className="text-sm">кг</span>
                                        </div>
                                    </div>

                                    {/* Card Footer - Confirm Button */}
                                    {!item.confirmed && (
                                        <div className="p-3 border-t">
                                            <button
                                                onClick={() => confirmItem(item.id)}
                                                className="w-full bg-green-500 text-white py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-green-600"
                                            >
                                                <Check size={18} />
                                                Подтвердить
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
