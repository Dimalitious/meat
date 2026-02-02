import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import {
    Truck,
    Search,
    Package,
    User,
    Calendar,
    Eye,
    EyeOff,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Edit2,
    Save,
    Trash2,
    RotateCcw
} from 'lucide-react';
import { getStatusLabel, getStatusColor } from '../constants/orderStatus';

interface OrderItem {
    id: number;
    quantity: number;
    shippedQty: number;
    product: {
        id: number;
        name: string;
        code: string;
    };
}

interface Order {
    id: number;
    idn: string | null;
    date: string;
    status: string;
    paymentType: string;
    totalAmount: number;
    totalWeight: number;
    customer: {
        id: number;
        name: string;
        code: string;
    };
    items: OrderItem[];
    expeditor?: {
        id: number;
        name: string;
    } | null;
}

interface Expeditor {
    id: number;
    name: string;
    phone?: string;
    isActive: boolean;
}

export default function DispatchPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [expeditors, setExpeditors] = useState<Expeditor[]>([]);
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState<number | null>(null);
    const [searchCustomer, setSearchCustomer] = useState('');
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedExpeditor, setSelectedExpeditor] = useState<{ [orderId: number]: number }>({});
    const [successMessage, setSuccessMessage] = useState('');
    const [editingOrderId, setEditingOrderId] = useState<number | null>(null);

    // Checkboxes and soft delete
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [disabledIds, setDisabledIds] = useState<Set<number>>(new Set());
    const [showDeleted, setShowDeleted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetchData();
    }, [filterDate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // Fetch ALL orders for dispatch (including already assigned ones)
            const [ordersRes, expeditorsRes] = await Promise.all([
                axios.get(`${API_URL}/api/orders/pending-dispatch`, {
                    headers,
                    params: { date: filterDate, includeAssigned: true }
                }),
                axios.get(`${API_URL}/api/expeditors`, { headers })
            ]);

            setOrders(ordersRes.data);
            setExpeditors(expeditorsRes.data.filter((e: Expeditor) => e.isActive));

            // Предзаполняем выбранных экспедиторов для уже назначенных заказов
            const preselected: { [orderId: number]: number } = {};
            for (const order of ordersRes.data) {
                if (order.expeditor?.id) {
                    preselected[order.id] = order.expeditor.id;
                }
            }
            setSelectedExpeditor(preselected);
        } catch (err) {
            console.error('Failed to fetch dispatch data:', err);
        } finally {
            setLoading(false);
        }
    };

    const assignExpeditor = async (orderId: number) => {
        const expeditorId = selectedExpeditor[orderId];
        if (!expeditorId) {
            alert('Выберите экспедитора');
            return;
        }

        setAssigning(orderId);
        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `${API_URL}/api/orders/${orderId}/assign-expeditor`,
                { expeditorId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Обновляем заказ в списке (вместо удаления)
            const expeditor = expeditors.find(e => e.id === expeditorId);
            setOrders(prev => prev.map(o =>
                o.id === orderId
                    ? { ...o, expeditor: expeditor ? { id: expeditor.id, name: expeditor.name } : null }
                    : o
            ));

            // Выходим из режима редактирования
            setEditingOrderId(null);

            // Show success message
            setSuccessMessage(`Заказ #${orderId} назначен экспедитору ${expeditor?.name}`);
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            console.error('Failed to assign expeditor:', err);
            alert('Ошибка назначения экспедитора');
        } finally {
            setAssigning(null);
        }
    };

    const assignAllToExpeditor = async (expeditorId: number) => {
        if (!expeditorId) return;

        const orderIds = filteredOrders.map(o => o.id);
        if (orderIds.length === 0) {
            alert('Нет заказов для назначения');
            return;
        }

        if (!confirm(`Назначить ${orderIds.length} заказов экспедитору?`)) return;

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            for (const orderId of orderIds) {
                await axios.post(
                    `${API_URL}/api/orders/${orderId}/assign-expeditor`,
                    { expeditorId },
                    { headers }
                );
            }

            // Refresh data
            await fetchData();

            const expeditor = expeditors.find(e => e.id === expeditorId);
            setSuccessMessage(`${orderIds.length} заказов назначено экспедитору ${expeditor?.name}`);
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            console.error('Batch assign failed:', err);
            alert('Ошибка массового назначения');
        } finally {
            setLoading(false);
        }
    };

    // Filter orders by customer search and soft delete
    const filteredOrders = useMemo(() => {
        return orders.filter(o => {
            // Hide disabled orders unless showDeleted is true
            if (disabledIds.has(o.id) && !showDeleted) return false;

            return o.customer.name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
                o.idn?.includes(searchCustomer) ||
                String(o.id).includes(searchCustomer);
        });
    }, [orders, searchCustomer, disabledIds, showDeleted]);

    // Group orders by customer for better overview
    const ordersByCustomer = useMemo(() => {
        return filteredOrders.reduce((acc, order) => {
            const customerId = order.customer.id;
            if (!acc[customerId]) {
                acc[customerId] = {
                    customer: order.customer,
                    orders: []
                };
            }
            acc[customerId].orders.push(order);
            return acc;
        }, {} as { [key: number]: { customer: Order['customer']; orders: Order[] } });
    }, [filteredOrders]);

    // Checkbox handlers
    const toggleSelect = (orderId: number) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(orderId)) {
                newSet.delete(orderId);
            } else {
                newSet.add(orderId);
            }
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        const visibleOrderIds = filteredOrders.filter(o => !disabledIds.has(o.id)).map(o => o.id);
        if (selectedIds.size === visibleOrderIds.length && visibleOrderIds.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(visibleOrderIds));
        }
    };

    // Soft delete - mark orders as disabled
    const softDeleteSelected = async () => {
        if (selectedIds.size === 0) {
            alert('Выберите заказы для удаления');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `${API_URL}/api/orders/disable`,
                { ids: Array.from(selectedIds) },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Update local state
            setDisabledIds(prev => {
                const newSet = new Set(prev);
                selectedIds.forEach(id => newSet.add(id));
                return newSet;
            });
            setSelectedIds(new Set());
            setSuccessMessage(`${selectedIds.size} заказ(ов) удалено`);
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            console.error('Soft delete failed:', err);
            alert('Ошибка удаления заказов');
        }
    };

    // Restore - remove from disabled
    const restoreOrder = async (orderId: number) => {
        try {
            const token = localStorage.getItem('token');
            await axios.patch(
                `${API_URL}/api/orders/${orderId}`,
                { isDisabled: false },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setDisabledIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(orderId);
                return newSet;
            });
            setSuccessMessage(`Заказ #${orderId} восстановлен`);
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            console.error('Restore failed:', err);
            alert('Ошибка восстановления заказа');
        }
    };

    // Save distribution to journal
    const saveDistribution = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const activeOrders = orders.filter(o => !disabledIds.has(o.id));

            const distributionData = {
                date: filterDate,
                savedAt: new Date().toISOString(),
                ordersCount: activeOrders.length,
                orders: activeOrders.map(o => ({
                    id: o.id,
                    idn: o.idn,
                    customerId: o.customer.id,
                    customerName: o.customer.name,
                    expeditorId: o.expeditor?.id || null,
                    expeditorName: o.expeditor?.name || null,
                    totalAmount: o.totalAmount,
                    totalWeight: o.totalWeight,
                    itemsCount: o.items.length
                }))
            };

            await axios.post(`${API_URL}/api/journals/distribution`, distributionData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSaved(true);
            setSuccessMessage('Распределение сохранено');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            console.error('Save distribution failed:', err);
            alert('Ошибка сохранения распределения');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto">
            {/* Success Message */}
            {successMessage && (
                <div className="fixed top-20 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-in">
                    <CheckCircle2 size={20} />
                    {successMessage}
                </div>
            )}

            {/* Header */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <Truck className="text-orange-600" size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">Распределение заказов</h1>
                            <p className="text-sm text-gray-500">
                                Назначение экспедиторов для собранных заказов
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Date Filter */}
                        <div className="flex items-center gap-2">
                            <Calendar size={18} className="text-gray-400" />
                            <input
                                type="date"
                                value={filterDate}
                                onChange={e => setFilterDate(e.target.value)}
                                className="border rounded-lg px-3 py-2 text-sm"
                            />
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Поиск по клиенту, IDN..."
                                value={searchCustomer}
                                onChange={e => setSearchCustomer(e.target.value)}
                                className="pl-10 pr-4 py-2 border rounded-lg w-64 text-sm"
                            />
                        </div>

                        {/* Refresh */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchData}
                            className="flex items-center gap-2"
                        >
                            <RefreshCw size={16} />
                            Обновить
                        </Button>
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Заказов к распределению</div>
                    <div className="text-2xl font-bold text-orange-600">{filteredOrders.length}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Клиентов</div>
                    <div className="text-2xl font-bold">{Object.keys(ordersByCustomer).length}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Общий вес</div>
                    <div className="text-2xl font-bold">
                        {filteredOrders.reduce((sum, o) => sum + o.totalWeight, 0).toFixed(1)} кг
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Общая сумма</div>
                    <div className="text-2xl font-bold text-green-600">
                        {filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0).toLocaleString('ru-RU')} ₽
                    </div>
                </div>
            </div>

            {/* Action Toolbar */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Left side - Checkbox controls */}
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedIds.size > 0 && selectedIds.size === filteredOrders.filter(o => !disabledIds.has(o.id)).length}
                                onChange={toggleSelectAll}
                                className="w-4 h-4 rounded"
                            />
                            <span className="text-sm">Выбрать все</span>
                        </label>

                        {selectedIds.size > 0 && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={softDeleteSelected}
                                className="flex items-center gap-2 text-red-600 border-red-300 hover:bg-red-50"
                            >
                                <Trash2 size={14} />
                                Удалить выбранные ({selectedIds.size})
                            </Button>
                        )}

                        <button
                            onClick={() => setShowDeleted(!showDeleted)}
                            className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition ${showDeleted
                                ? 'bg-gray-200 text-gray-700'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                        >
                            {showDeleted ? <Eye size={14} /> : <EyeOff size={14} />}
                            {showDeleted ? 'Скрыть удалённые' : 'Показать удалённые'}
                            {disabledIds.size > 0 && ` (${disabledIds.size})`}
                        </button>
                    </div>

                    {/* Right side - Save button */}
                    <div className="flex items-center gap-3">
                        {saved && (
                            <span className="text-green-600 flex items-center gap-1 text-sm">
                                <CheckCircle2 size={16} />
                                Сохранено
                            </span>
                        )}
                        <Button
                            size="sm"
                            onClick={saveDistribution}
                            disabled={saving || filteredOrders.length === 0}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                        >
                            <Save size={16} />
                            {saving ? 'Сохранение...' : 'Сохранить распределение'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Bulk Assignment */}
            {filteredOrders.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-orange-800">
                            <AlertCircle size={20} />
                            <span className="font-medium">Массовое назначение</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <select
                                id="bulk-expeditor"
                                className="border rounded-lg px-3 py-2 text-sm"
                                defaultValue=""
                            >
                                <option value="">Выберите экспедитора</option>
                                {expeditors.map(exp => (
                                    <option key={exp.id} value={exp.id}>{exp.name}</option>
                                ))}
                            </select>
                            <Button
                                size="sm"
                                onClick={() => {
                                    const select = document.getElementById('bulk-expeditor') as HTMLSelectElement;
                                    const expId = Number(select.value);
                                    if (expId) assignAllToExpeditor(expId);
                                }}
                                className="bg-orange-500 hover:bg-orange-600 flex items-center gap-2"
                            >
                                <Truck size={16} />
                                Назначить всех ({filteredOrders.length})
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            {loading ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <RefreshCw className="animate-spin mx-auto text-gray-400 mb-2" size={32} />
                    <p className="text-gray-500">Загрузка заказов...</p>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <CheckCircle2 className="mx-auto text-green-400 mb-3" size={48} />
                    <h3 className="text-lg font-medium text-gray-700">Все заказы распределены!</h3>
                    <p className="text-gray-500 mt-1">
                        Нет заказов, ожидающих назначения экспедитора на выбранную дату.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {Object.values(ordersByCustomer).map(({ customer, orders: customerOrders }) => (
                        <div key={customer.id} className="bg-white rounded-lg shadow overflow-hidden">
                            {/* Customer Header */}
                            <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                        <User className="text-blue-600" size={16} />
                                    </div>
                                    <div>
                                        <div className="font-medium">{customer.name}</div>
                                        <div className="text-xs text-gray-500">
                                            {customerOrders.length} заказ(ов) •
                                            {customerOrders.reduce((s, o) => s + o.totalWeight, 0).toFixed(1)} кг
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Orders Grid */}
                            <div className="divide-y">
                                {customerOrders.map(order => (
                                    <div
                                        key={order.id}
                                        className={`p-4 hover:bg-gray-50 transition ${disabledIds.has(order.id) ? 'opacity-50 bg-red-50' : ''}`}
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                            {/* Checkbox */}
                                            {!disabledIds.has(order.id) && (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(order.id)}
                                                    onChange={() => toggleSelect(order.id)}
                                                    className="w-5 h-5 rounded cursor-pointer flex-shrink-0"
                                                />
                                            )}

                                            {/* Restore button for disabled orders */}
                                            {disabledIds.has(order.id) && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => restoreOrder(order.id)}
                                                    className="flex items-center gap-1 text-green-600 border-green-300 hover:bg-green-50 flex-shrink-0"
                                                >
                                                    <RotateCcw size={14} />
                                                    Восстановить
                                                </Button>
                                            )}

                                            {/* Order Info */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="font-bold text-lg">#{order.id}</span>
                                                    {order.idn && (
                                                        <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
                                                            IDN: {order.idn}
                                                        </span>
                                                    )}
                                                    <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(order.status)}`}>
                                                        {getStatusLabel(order.status)}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                                    <span className="flex items-center gap-1">
                                                        <Package size={14} />
                                                        {order.items.length} позиций
                                                    </span>
                                                    <span>{order.totalWeight.toFixed(1)} кг</span>
                                                    <span className="font-medium text-green-600">
                                                        {order.totalAmount.toLocaleString('ru-RU')} ₽
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Expeditor Selection / Display */}
                                            <div className="flex items-center gap-3">
                                                {/* Если экспедитор назначен и не в режиме редактирования */}
                                                {order.expeditor && editingOrderId !== order.id ? (
                                                    <>
                                                        <div className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-800 rounded-lg min-w-[180px]">
                                                            <Truck size={16} />
                                                            <span className="font-medium">{order.expeditor.name}</span>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                setEditingOrderId(order.id);
                                                                setSelectedExpeditor(prev => ({
                                                                    ...prev,
                                                                    [order.id]: order.expeditor?.id || 0
                                                                }));
                                                            }}
                                                            className="flex items-center gap-2"
                                                        >
                                                            <Edit2 size={14} />
                                                            Изменить
                                                        </Button>
                                                    </>
                                                ) : (
                                                    /* Режим выбора/редактирования экспедитора */
                                                    <>
                                                        <select
                                                            value={selectedExpeditor[order.id] || ''}
                                                            onChange={e => setSelectedExpeditor(prev => ({
                                                                ...prev,
                                                                [order.id]: Number(e.target.value)
                                                            }))}
                                                            className="border rounded-lg px-3 py-2 text-sm min-w-[180px]"
                                                        >
                                                            <option value="">Выберите экспедитора</option>
                                                            {expeditors.map(exp => (
                                                                <option key={exp.id} value={exp.id}>
                                                                    {exp.name}
                                                                </option>
                                                            ))}
                                                        </select>

                                                        <Button
                                                            size="sm"
                                                            onClick={() => assignExpeditor(order.id)}
                                                            disabled={assigning === order.id || !selectedExpeditor[order.id]}
                                                            className="flex items-center gap-2 min-w-[120px]"
                                                        >
                                                            {assigning === order.id ? (
                                                                <RefreshCw className="animate-spin" size={14} />
                                                            ) : (
                                                                <Truck size={14} />
                                                            )}
                                                            {order.expeditor ? 'Сохранить' : 'Назначить'}
                                                        </Button>

                                                        {/* Кнопка отмены редактирования */}
                                                        {editingOrderId === order.id && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => setEditingOrderId(null)}
                                                                className="text-gray-500"
                                                            >
                                                                Отмена
                                                            </Button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Order Items Preview (collapsed by default) */}
                                        <details className="mt-3">
                                            <summary className="text-sm text-blue-600 cursor-pointer hover:underline flex items-center gap-1">
                                                <Eye size={14} />
                                                Показать позиции
                                            </summary>
                                            <div className="mt-2 bg-gray-50 rounded-lg p-3 text-sm">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="text-gray-500 text-xs uppercase">
                                                            <th className="pb-2">Товар</th>
                                                            <th className="pb-2 text-right">Заказано</th>
                                                            <th className="pb-2 text-right">Погружено</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200">
                                                        {order.items.map(item => (
                                                            <tr key={item.id}>
                                                                <td className="py-1.5">{item.product.name}</td>
                                                                <td className="py-1.5 text-right">{item.quantity} кг</td>
                                                                <td className="py-1.5 text-right font-medium">
                                                                    {item.shippedQty} кг
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </details>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
