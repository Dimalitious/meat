import { useEffect, useState } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../config/api';
import { Check, Edit2, Search, Save, Undo2, X, ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AssemblyItem {
    id: number;
    idn: string;
    productId: number;
    productName: string;
    category: string;
    orderedQty: number;
    loadedQty: number;
    confirmed: boolean;
    customerId: number;
    customerName: string;
    price: number;
    status: string;  // Added to track forming/synced
    weightToShip?: number | null; // Необходимо отгрузить - из Свода
    recommendedQty?: number | null; // Рекомендуемое кол-во - из столбца "Вес" сводки заказов
    confirmedBy?: string | null; // Кто подтвердил
}

interface Customer {
    key: string;      // Unique key for selection (id_X or name_X)
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

// Return reasons
const RETURN_REASONS = [
    'Ошибка в заказе',
    'Отмена клиентом',
    'Нет товара на складе',
    'Изменение количества',
    'Другое'
];

export default function AssemblyOrdersPage() {
    const { user } = useAuth();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
    const [mobileView, setMobileView] = useState<'customers' | 'products'>('customers');
    const [searchCustomer, setSearchCustomer] = useState('');
    const [loading, setLoading] = useState(true);
    const [currentIdn, setCurrentIdn] = useState<string>('');
    const [assemblyDate, setAssemblyDate] = useState(new Date().toISOString().split('T')[0]);

    // Return modal state
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [returnItemId, setReturnItemId] = useState<number | null>(null);
    const [returnReason, setReturnReason] = useState('');
    const [returnComment, setReturnComment] = useState('');
    const [returning, setReturning] = useState(false);

    // Bulk delete state (ТЗ: Удаление из сборки)
    const [selectedCustomerKeys, setSelectedCustomerKeys] = useState<Set<string>>(new Set());
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        loadAssemblyData();
    }, [assemblyDate]);

    // Real-time updates via Socket.IO
    useEffect(() => {
        // API_URL is like "http://localhost:5000/api" - we need "http://localhost:5000"
        const socketUrl = API_URL.replace('/api', '');
        const socket: Socket = io(socketUrl, {
            transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
            console.log('[Socket] Connected for assembly updates');
        });

        socket.on('assembly:itemUpdated', (data: { itemId: number; status: string; shippedQty: number; confirmedBy: string }) => {
            console.log('[Socket] Item updated:', data);
            // Update local state with new data
            setCustomers(prev => prev.map(c => ({
                ...c,
                items: c.items.map(item =>
                    item.id === data.itemId
                        ? {
                            ...item,
                            status: data.status,
                            confirmed: data.status === 'synced',
                            loadedQty: data.shippedQty,
                            confirmedBy: data.confirmedBy
                        }
                        : item
                )
            })));
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const loadAssemblyData = async () => {
        try {
            const token = localStorage.getItem('token');

            // Параллельная загрузка: заказы + свод
            const [ordersRes, svodRes] = await Promise.all([
                // ОПТИМИЗАЦИЯ: фильтр по дате + статус (меньше данных с сервера)
                axios.get(`${API_URL}/api/summary-orders?status=forming,synced&date=${assemblyDate}&limit=200`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                // Загружаем данные свода для получения weightToShip
                axios.get(`${API_URL}/api/svod?date=${assemblyDate}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }).catch(() => ({ data: { svod: null } })) // Если свода нет - не ломаем загрузку
            ]);



            // Handle both old format (array) and new format ({ data, pagination })
            const allEntries = Array.isArray(ordersRes.data) ? ordersRes.data : (ordersRes.data.data || []);

            // Создаём карту weightToShip по productId из свода
            const weightToShipMap = new Map<number, number | null>();
            if (svodRes.data?.svod?.lines) {
                for (const line of svodRes.data.svod.lines) {
                    if (line.productId && line.weightToShip != null) {
                        weightToShipMap.set(line.productId, line.weightToShip);
                    }
                }
            }

            // All returned entries should already be filtered by status
            const relevantEntries = allEntries;
            const customerMap: { [key: string]: Customer } = {};  // Changed to string key for customerName fallback

            for (const entry of relevantEntries) {
                // Use customerId if available, otherwise use customerName as key
                const customerKey = entry.customerId ? `id_${entry.customerId}` : `name_${entry.customerName}`;
                if (!customerKey || customerKey === 'name_' || customerKey === 'name_null') continue;

                if (!customerMap[customerKey]) {
                    customerMap[customerKey] = {
                        key: customerKey,
                        id: entry.customerId || 0,  // Use 0 if no customerId
                        name: entry.customerName || 'Неизвестный клиент',
                        items: []
                    };
                }

                customerMap[customerKey].items.push({
                    id: entry.id,
                    idn: entry.idn || '',
                    productId: entry.productId,
                    productName: entry.productFullName,
                    category: entry.category || '',
                    orderedQty: entry.orderQty || entry.shippedQty,
                    loadedQty: entry.shippedQty || 0,
                    confirmed: entry.status === 'synced',
                    customerId: entry.customerId || 0,
                    customerName: entry.customerName || 'Неизвестный клиент',
                    price: Number(entry.price) || 0,
                    status: entry.status,
                    weightToShip: weightToShipMap.get(entry.productId) ?? null,
                    recommendedQty: entry.weightToDistribute ?? null,
                    confirmedBy: entry.confirmedBy || null
                });
            }

            const customerList = Object.values(customerMap);
            setCustomers(customerList);

            // Set current IDN from first entry
            if (relevantEntries.length > 0 && relevantEntries[0].idn) {
                setCurrentIdn(relevantEntries[0].idn);
            }

            if (customerList.length > 0 && !selectedCustomerKey) {
                setSelectedCustomerKey(customerList[0].key);
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
            console.log('[CLIENT] confirmItem called for itemId:', itemId);

            // Find the item
            let targetItem: AssemblyItem | null = null;
            for (const c of customers) {
                const item = c.items.find(i => i.id === itemId);
                if (item) { targetItem = item; break; }
            }
            if (!targetItem) {
                console.log('[CLIENT] Target item not found!');
                return;
            }
            console.log('[CLIENT] Found item:', targetItem);

            // Update summary order to synced and update shippedQty
            console.log('[CLIENT] Calling PUT to update status...');
            await axios.put(`${API_URL}/api/summary-orders/${itemId}`, {
                shippedQty: targetItem.loadedQty,
                status: 'synced'
            }, { headers: { Authorization: `Bearer ${token}` } });
            console.log('[CLIENT] PUT completed');

            // Sync to orders with IDN and dispatchDay
            console.log('[CLIENT] Calling sync API with dispatchDay:', assemblyDate);
            const syncRes = await axios.post(`${API_URL}/api/summary-orders/sync`, {
                entryIds: [itemId],
                dispatchDay: assemblyDate  // ← КЛЮЧЕВОЕ: передаём выбранную дату!
            }, { headers: { Authorization: `Bearer ${token}` } });
            console.log('[CLIENT] Sync response:', syncRes.data);

            // Update local state - mark as confirmed but keep visible
            setCustomers(customers.map(c => ({
                ...c,
                items: c.items.map(item =>
                    item.id === itemId ? { ...item, confirmed: true, status: 'synced', confirmedBy: user?.username || 'Unknown' } : item
                )
            })));

        } catch (err) {
            console.error('Confirm error:', err);
            alert('Ошибка подтверждения');
        }
    };

    const enableEdit = async (itemId: number) => {
        try {
            const token = localStorage.getItem('token');

            // Update status back to forming
            await axios.put(`${API_URL}/api/summary-orders/${itemId}`, {
                status: 'forming'
            }, { headers: { Authorization: `Bearer ${token}` } });

            setCustomers(customers.map(c => ({
                ...c,
                items: c.items.map(item =>
                    item.id === itemId ? { ...item, confirmed: false, status: 'forming' } : item
                )
            })));
        } catch (err) {
            console.error('Edit error:', err);
        }
    };

    // ============================================
    // RETURN FROM ASSEMBLY (Вернуть со сборки)
    // ============================================

    const openReturnModal = (itemId: number) => {
        setReturnItemId(itemId);
        setReturnReason('');
        setReturnComment('');
        setShowReturnModal(true);
    };

    const closeReturnModal = () => {
        setShowReturnModal(false);
        setReturnItemId(null);
        setReturnReason('');
        setReturnComment('');
    };

    const returnFromAssembly = async () => {
        if (!returnItemId) return;

        setReturning(true);
        try {
            const token = localStorage.getItem('token');

            const res = await axios.post(
                `${API_URL}/api/summary-orders/${returnItemId}/assembly/return`,
                {
                    reason: returnReason || null,
                    comment: returnComment || null
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            console.log('[RETURN] Response:', res.data);

            // Remove item from local state
            setCustomers(prev => prev.map(c => ({
                ...c,
                items: c.items.filter(item => item.id !== returnItemId)
            })).filter(c => c.items.length > 0));

            closeReturnModal();
            alert('Позиция возвращена в Сводку');

        } catch (err: any) {
            console.error('Return error:', err);
            alert(err.response?.data?.error || 'Ошибка возврата со сборки');
        } finally {
            setReturning(false);
        }
    };

    const saveToJournal = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/journals/assembly`, {
                assemblyDate,
                createdBy: user?.username || 'Unknown',
                sourceSummaryId: null,
                data: customers
            }, { headers: { Authorization: `Bearer ${token}` } });
            alert('Сборка сохранена в журнал');
        } catch (err) {
            console.error('Save error:', err);
            alert('Ошибка сохранения');
        }
    };

    const [savingCustomer, setSavingCustomer] = useState<string | null>(null);

    const saveCustomerToJournal = async (customerKey: string) => {
        const customer = customers.find(c => c.key === customerKey);
        if (!customer) return;

        setSavingCustomer(customerKey);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/journals/assembly`, {
                assemblyDate,
                createdBy: user?.username || 'Unknown',
                sourceSummaryId: null,
                data: [customer]  // Save only this customer
            }, { headers: { Authorization: `Bearer ${token}` } });
            alert(`Заказ "${customer.name}" сохранён`);
        } catch (err) {
            console.error('Save error:', err);
            alert('Ошибка сохранения');
        } finally {
            setSavingCustomer(null);
        }
    };

    // ============================================
    // Bulk Delete функции (ТЗ: Удаление из сборки)
    // ============================================
    const toggleCustomerSelection = (key: string) => {
        setSelectedCustomerKeys(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        if (selectedCustomerKeys.size === filteredCustomers.length) {
            setSelectedCustomerKeys(new Set());
        } else {
            setSelectedCustomerKeys(new Set(filteredCustomers.map(c => c.key)));
        }
    };

    const bulkDeleteOrders = async () => {
        // Собираем item IDs из выбранных клиентов
        // ВАЖНО: в текущей структуре данных отсутствует orderId напрямую
        // Нужно собрать item.id (summaryOrderJournal IDs) и найти связанные заказы

        const selectedItemIds: number[] = [];
        for (const key of selectedCustomerKeys) {
            const customer = customers.find(c => c.key === key);
            if (customer) {
                for (const item of customer.items) {
                    selectedItemIds.push(item.id);
                }
            }
        }

        if (selectedItemIds.length === 0) {
            alert('Не выбраны заказы для удаления');
            return;
        }

        setDeleting(true);
        try {
            const token = localStorage.getItem('token');

            // Backend bulk-delete работает с orderIds
            // Но в текущей структуре у нас summaryOrderJournal IDs
            // Нужно сначала найти связанные Order IDs через API или использовать другой подход

            // ДЛЯ ДАННОЙ РЕАЛИЗАЦИИ: предполагаем что item.id = summary entry id
            // и backend должен найти связанные orders

            const res = await axios.post(`${API_URL}/api/orders/bulk-delete`, {
                orderIds: selectedItemIds,  // Это на самом деле summary entry IDs
                reason: 'Удалено из сборки заказов'
            }, { headers: { Authorization: `Bearer ${token}` } });

            console.log('[BULK_DELETE] Response:', res.data);
            alert(`Удалено ${res.data.deletedCount} заказов. Восстановлено ${res.data.restoredSummaryCount} записей в сводке.`);

            setSelectedCustomerKeys(new Set());
            setShowDeleteModal(false);
            await loadAssemblyData();  // Перезагрузка данных

        } catch (err: any) {
            console.error('Bulk delete error:', err);
            const errorMsg = err.response?.data?.error || 'Ошибка удаления';
            const blocked = err.response?.data?.blocked;
            if (blocked && blocked.length > 0) {
                alert(`${errorMsg}\n\nБлокированные заказы:\n${blocked.map((b: any) => `ID ${b.orderId}: ${b.status}`).join('\n')}`);
            } else {
                alert(errorMsg);
            }
        } finally {
            setDeleting(false);
        }
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchCustomer.toLowerCase())
    );

    const selectedCustomer = customers.find(c => c.key === selectedCustomerKey);

    if (loading) return <div className="p-8 text-center">Загрузка...</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] gap-4">
            {/* Header with date and save button */}
            <div className="bg-white rounded-lg shadow p-3 md:p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-4">
                    {/* Mobile back button */}
                    {mobileView === 'products' && (
                        <button
                            onClick={() => setMobileView('customers')}
                            className="md:hidden p-2 -ml-2 text-gray-600"
                        >
                            <ChevronLeft size={24} />
                        </button>
                    )}
                    <h1 className="text-lg md:text-xl font-bold">
                        {mobileView === 'products' && selectedCustomer ? selectedCustomer.name : 'Сборка заказов'}
                    </h1>
                    {currentIdn && mobileView === 'customers' && (
                        <span className="text-xs md:text-sm text-gray-500 hidden sm:inline">
                            № Сводки: <span className="font-mono font-medium">{currentIdn}</span>
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                    <input
                        type="date"
                        value={assemblyDate}
                        onChange={e => setAssemblyDate(e.target.value)}
                        className="border rounded px-2 md:px-3 py-2 text-sm"
                    />
                </div>
            </div>

            <div className="flex flex-1 gap-4 overflow-hidden">
                {/* Left Panel - Customers (hidden on mobile when viewing products) */}
                <div className={`${mobileView === 'products' ? 'hidden' : 'flex'} md:flex w-full md:w-80 bg-white rounded-lg shadow flex-col`}>
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
                        {/* Bulk delete controls */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedCustomerKeys.size > 0 && selectedCustomerKeys.size === filteredCustomers.length}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-gray-300"
                                />
                                <span>Выбрать все ({selectedCustomerKeys.size})</span>
                            </label>
                            {selectedCustomerKeys.size > 0 && (
                                <button
                                    onClick={() => setShowDeleteModal(true)}
                                    className="px-3 py-1.5 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                                >
                                    Удалить ({selectedCustomerKeys.size})
                                </button>
                            )}
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
                                        key={c.key}
                                        onClick={() => {
                                            setSelectedCustomerKey(c.key);
                                            setMobileView('products');
                                        }}
                                        className={`w-full text-left p-4 border-b hover:bg-gray-50 transition-colors
                                            ${selectedCustomerKey === c.key ? 'bg-purple-50 border-l-4 border-l-purple-500' : ''}
                                        `}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCustomerKeys.has(c.key)}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        toggleCustomerSelection(c.key);
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-4 h-4 rounded border-gray-300"
                                                />
                                                <span className="font-medium text-gray-900">{c.name}</span>
                                            </div>
                                            {allConfirmed && (
                                                <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                                                    ✓ Готово
                                                </span>
                                            )}
                                        </div>
                                        {/* Progress bar */}
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-green-500 transition-all"
                                                    style={{ width: `${(confirmedCount / c.items.length) * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-gray-500 min-w-[40px]">
                                                {confirmedCount}/{c.items.length}
                                            </span>
                                        </div>
                                        {/* Item checkmarks */}
                                        <div className="flex gap-1 flex-wrap">
                                            {c.items.map((item, idx) => (
                                                <span
                                                    key={idx}
                                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs
                                                        ${item.confirmed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}
                                                    `}
                                                >
                                                    ✓
                                                </span>
                                            ))}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Panel - Order Items (hidden on mobile when viewing customers) */}
                <div className={`${mobileView === 'customers' ? 'hidden' : 'flex'} md:flex flex-1 bg-white rounded-lg shadow overflow-auto p-4 flex-col`}>
                    {!selectedCustomer ? (
                        <div className="h-full flex items-center justify-center text-gray-500">
                            Выберите клиента слева
                        </div>
                    ) : (
                        <>
                            {/* Header with save button - hidden on mobile as name is in top bar */}
                            <div className="mb-4 hidden md:flex md:justify-between md:items-center">
                                <h2 className="text-xl font-bold">
                                    {selectedCustomer.name}
                                </h2>
                                <button
                                    onClick={() => saveCustomerToJournal(selectedCustomer.key)}
                                    disabled={savingCustomer === selectedCustomer.key}
                                    className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700 disabled:opacity-50"
                                >
                                    <Save size={18} />
                                    {savingCustomer === selectedCustomer.key ? 'Сохранение...' : 'Сохранить клиента'}
                                </button>
                            </div>
                            {/* Mobile save button at bottom */}
                            <div className="md:hidden fixed bottom-4 left-4 right-4 z-10">
                                <button
                                    onClick={() => saveCustomerToJournal(selectedCustomer.key)}
                                    disabled={savingCustomer === selectedCustomer.key}
                                    className="w-full bg-purple-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <Save size={20} />
                                    {savingCustomer === selectedCustomer.key ? 'Сохранение...' : 'Сохранить заказ'}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {selectedCustomer.items.map(item => (
                                    <div
                                        key={item.id}
                                        className={`border rounded-lg overflow-hidden ${item.confirmed ? 'bg-green-50 border-green-200' : 'bg-white'
                                            }`}
                                    >
                                        {/* Card Header */}
                                        <div className="p-4 flex items-start gap-3">
                                            <span className={`text-4xl ${item.confirmed ? 'grayscale opacity-50' : ''}`}>
                                                {getCategoryIcon(item.category)}
                                            </span>
                                            <div className="flex-1">
                                                <h3 className={`font-medium text-sm leading-tight ${item.confirmed ? 'text-gray-500' : ''}`}>
                                                    {item.productName}
                                                </h3>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {item.category || 'Без категории'}
                                                </p>
                                            </div>
                                            <div className="flex gap-1">
                                                {/* Вернуть со сборки - только для forming (не synced) */}
                                                {item.status === 'forming' && (
                                                    <button
                                                        onClick={() => openReturnModal(item.id)}
                                                        className="bg-orange-100 text-orange-600 hover:bg-orange-200 p-2 rounded-lg"
                                                        title="Вернуть со сборки"
                                                    >
                                                        <Undo2 size={18} />
                                                    </button>
                                                )}
                                                {item.confirmed && (
                                                    <button
                                                        onClick={() => enableEdit(item.id)}
                                                        className="bg-blue-100 text-blue-600 hover:bg-blue-200 p-2 rounded-lg"
                                                        title="Редактировать"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Card Body - Quantities */}
                                        <div className={`p-4 space-y-3 ${item.confirmed ? 'bg-green-100/50' : 'bg-gray-50'}`}>
                                            {/* Необходимо отгрузить - из Свода */}
                                            {item.weightToShip != null && item.weightToShip > 0 && (
                                                <div className="flex justify-between items-center bg-blue-50 -mx-4 -mt-4 px-4 py-2 border-b border-blue-100">
                                                    <span className="text-sm text-blue-700 font-medium">📦 Необходимо отгрузить:</span>
                                                    <span className="font-bold text-blue-700">{item.weightToShip} кг</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">Заказано:</span>
                                                <span className="font-bold">{item.orderedQty} кг</span>
                                            </div>
                                            {/* Рекомендуемое кол-во - из столбца "Вес" формы Сводки заказов */}
                                            <div className="flex justify-between items-center bg-purple-50 -mx-4 px-4 py-2">
                                                <span className="text-sm text-purple-700 font-medium">📊 Рекомендуемое кол-во:</span>
                                                <span className="font-bold text-purple-700">
                                                    {item.recommendedQty != null && item.recommendedQty > 0
                                                        ? `${item.recommendedQty} кг`
                                                        : '—'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="text-sm text-gray-600">Погрузили:</span>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    className={`w-24 border rounded px-2 py-1 text-right font-medium ${item.confirmed ? 'bg-gray-100' : ''}`}
                                                    value={item.loadedQty === 0 ? '' : item.loadedQty}
                                                    placeholder="—"
                                                    onChange={e => updateLoadedQty(item.id, parseFloat(e.target.value) || 0)}
                                                    disabled={item.confirmed}
                                                />
                                                <span className="text-sm">кг</span>
                                            </div>
                                        </div>

                                        {/* Card Footer - Confirm Button */}
                                        <div className="p-3 border-t">
                                            {item.confirmed ? (
                                                <div className="space-y-1">
                                                    <div className="w-full bg-green-100 text-green-700 py-2 rounded-lg flex items-center justify-center gap-2">
                                                        <Check size={18} />
                                                        Подтверждено
                                                    </div>
                                                    {item.confirmedBy && (
                                                        <div className="text-xs text-gray-500 text-center">
                                                            Собрал: {item.confirmedBy}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => confirmItem(item.id)}
                                                    className="w-full bg-green-500 text-white py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-green-600"
                                                >
                                                    <Check size={18} />
                                                    Подтвердить
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Return Modal */}
            {showReturnModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-lg shadow-xl w-[450px] max-w-[90vw]">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Undo2 size={20} className="text-orange-500" />
                                Вернуть со сборки
                            </h3>
                            <button onClick={closeReturnModal} className="text-gray-500 hover:text-gray-700">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Причина возврата
                                </label>
                                <select
                                    value={returnReason}
                                    onChange={e => setReturnReason(e.target.value)}
                                    className="w-full border rounded px-3 py-2"
                                >
                                    <option value="">Выберите причину...</option>
                                    {RETURN_REASONS.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Комментарий (необязательно)
                                </label>
                                <textarea
                                    value={returnComment}
                                    onChange={e => setReturnComment(e.target.value)}
                                    className="w-full border rounded px-3 py-2 h-20 resize-none"
                                    placeholder="Дополнительная информация..."
                                />
                            </div>
                            <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm text-orange-800">
                                ⚠️ Позиция будет возвращена в форму "Сводка заказов" в исходный статус.
                            </div>
                        </div>
                        <div className="p-4 border-t flex justify-end gap-3">
                            <button
                                onClick={closeReturnModal}
                                className="px-4 py-2 border rounded hover:bg-gray-50"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={returnFromAssembly}
                                disabled={returning}
                                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
                            >
                                {returning ? 'Возврат...' : (
                                    <>
                                        <Undo2 size={16} />
                                        Вернуть
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg w-full max-w-md mx-4 shadow-xl">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-red-600 mb-4">
                                Удалить выбранные заказы?
                            </h3>
                            <p className="text-gray-700 mb-4">
                                Будет удалено <strong>{selectedCustomerKeys.size}</strong> клиентов
                                ({Array.from(selectedCustomerKeys).reduce((acc, key) => {
                                    const c = customers.find(c => c.key === key);
                                    return acc + (c?.items.length || 0);
                                }, 0)} позиций).
                            </p>
                            <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm text-orange-800">
                                ⚠️ Заказы будут удалены из БД. Записи в Сводке вернутся в статус "Начать сборку".
                            </div>
                        </div>
                        <div className="p-4 border-t flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="px-4 py-2 border rounded hover:bg-gray-50"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={bulkDeleteOrders}
                                disabled={deleting}
                                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                            >
                                {deleting ? 'Удаление...' : 'Да, удалить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
