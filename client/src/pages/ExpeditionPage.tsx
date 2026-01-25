import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import { Eye, Check, Truck, Edit2, EyeOff, Calendar, RefreshCw, Save, X } from 'lucide-react';

interface OrderItem {
    id: number;
    quantity: number;
    shippedQty: number;
    product: {
        name: string;
        code: string;
    };
}

interface ExpeditionOrder {
    id: number;
    idn: string | null;
    date: string;
    status: string;
    deliveryStatus: string;
    deliveryAddress: string | null;
    assignedAt: string;
    totalAmount: number;
    totalWeight: number;
    customer: {
        id: number;
        name: string;
        code: string;
    };
    items: OrderItem[];
    isHidden?: boolean; // Для скрытия выделенных
}

interface Expeditor {
    id: number;
    name: string;
}

const DELIVERY_STATUS_LABELS: { [key: string]: { label: string; color: string } } = {
    'pending': { label: 'К доставке', color: 'bg-yellow-100 text-yellow-800' },
    'in_delivery': { label: 'В пути', color: 'bg-blue-100 text-blue-800' },
    'delivered': { label: 'Доставлен', color: 'bg-green-100 text-green-800' }
};

export default function ExpeditionPage() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<ExpeditionOrder[]>([]);
    const [expeditors, setExpeditors] = useState<Expeditor[]>([]);
    const [selectedExpeditor, setSelectedExpeditor] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('');

    // Фильтр по датам (с - по)
    const today = new Date().toISOString().split('T')[0];
    const [dateFrom, setDateFrom] = useState(today);
    const [dateTo, setDateTo] = useState(today);

    // Режим редактирования
    const [isEditing, setIsEditing] = useState(false);

    // Выбранные заказы (чекбоксы)
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Скрытые заказы
    const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());

    // Статус сохранения
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetchExpeditors();
    }, []);

    useEffect(() => {
        if (selectedExpeditor) {
            fetchOrders();
        }
    }, [selectedExpeditor, filterStatus, dateFrom, dateTo]);

    const fetchExpeditors = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/expeditors`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setExpeditors(res.data.filter((e: Expeditor & { isActive: boolean }) => e.isActive));

            // Auto-select first expeditor if available
            if (res.data.length > 0) {
                setSelectedExpeditor(res.data[0].id);
            }
        } catch (err) {
            console.error('Failed to fetch expeditors:', err);
        }
    };

    const fetchOrders = async () => {
        if (!selectedExpeditor) return;

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            if (filterStatus) params.append('status', filterStatus);
            if (dateFrom) params.append('dateFrom', dateFrom);
            if (dateTo) params.append('dateTo', dateTo);

            const url = `${API_URL}/api/orders/expeditor/${selectedExpeditor}?${params}`;
            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setOrders(res.data);
            setSelectedIds(new Set());
            setSaved(false);
        } catch (err) {
            console.error('Failed to fetch orders:', err);
        } finally {
            setLoading(false);
        }
    };

    const startDelivery = async (orderId: number) => {
        try {
            const token = localStorage.getItem('token');
            await axios.patch(`${API_URL}/api/orders/${orderId}`,
                { status: 'in_delivery', deliveryStatus: 'in_delivery' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchOrders();
        } catch (err) {
            console.error('Failed to start delivery:', err);
            alert('Ошибка изменения статуса');
        }
    };

    const viewInvoice = (orderId: number) => {
        navigate(`/expedition/${orderId}/invoice`);
    };

    // Чекбоксы
    const toggleSelect = (orderId: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(orderId)) {
            newSet.delete(orderId);
        } else {
            newSet.add(orderId);
        }
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        const visibleOrders = orders.filter(o => !hiddenIds.has(o.id));
        if (selectedIds.size === visibleOrders.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(visibleOrders.map(o => o.id)));
        }
    };

    // Скрыть выделенные
    const hideSelected = () => {
        setHiddenIds(prev => {
            const newSet = new Set(prev);
            selectedIds.forEach(id => newSet.add(id));
            return newSet;
        });
        setSelectedIds(new Set());
    };

    // Показать все скрытые
    const showAllHidden = () => {
        setHiddenIds(new Set());
    };

    // Сохранить данные экспедиции в журнал
    const saveExpeditionData = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');

            // Подготовка данных для сохранения
            const expeditionData = {
                expeditorId: selectedExpeditor,
                expeditorName: expeditors.find(e => e.id === selectedExpeditor)?.name || '',
                dateFrom,
                dateTo,
                savedAt: new Date().toISOString(),
                orders: orders.filter(o => !hiddenIds.has(o.id)).map(o => ({
                    id: o.id,
                    idn: o.idn,
                    date: o.date,
                    customerId: o.customer.id,
                    customerName: o.customer.name,
                    deliveryStatus: o.deliveryStatus,
                    totalAmount: o.totalAmount,
                    totalWeight: o.totalWeight,
                    itemsCount: o.items.length,
                    assignedAt: o.assignedAt
                }))
            };

            await axios.post(`${API_URL}/api/journals/expedition`, expeditionData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSaved(true);
            setIsEditing(false);
            alert('Данные экспедиции сохранены');
        } catch (err) {
            console.error('Failed to save expedition data:', err);
            alert('Ошибка сохранения');
        } finally {
            setSaving(false);
        }
    };

    // Видимые заказы (исключая скрытые)
    const visibleOrders = useMemo(() => {
        return orders.filter(o => !hiddenIds.has(o.id));
    }, [orders, hiddenIds]);

    const pendingOrders = visibleOrders.filter(o => o.deliveryStatus === 'pending');
    const inDeliveryOrders = visibleOrders.filter(o => o.deliveryStatus === 'in_delivery');
    const deliveredOrders = visibleOrders.filter(o => o.deliveryStatus === 'delivered');

    // Статистика
    const stats = useMemo(() => ({
        totalOrders: visibleOrders.length,
        totalWeight: visibleOrders.reduce((sum, o) => sum + (o.totalWeight || 0), 0),
        totalAmount: visibleOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0),
        hiddenCount: hiddenIds.size
    }), [visibleOrders, hiddenIds]);

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Truck className="text-blue-600" size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">Экспедиция</h1>
                            <p className="text-sm text-gray-500">Управление доставкой заказов</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Фильтр по дате: с */}
                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-gray-400" />
                            <span className="text-sm text-gray-500">с</span>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="border rounded px-2 py-1 text-sm"
                            />
                            <span className="text-sm text-gray-500">по</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="border rounded px-2 py-1 text-sm"
                            />
                        </div>

                        {/* Экспедитор */}
                        <select
                            className="border rounded px-3 py-2 text-sm"
                            value={selectedExpeditor || ''}
                            onChange={e => setSelectedExpeditor(Number(e.target.value))}
                        >
                            <option value="">Выберите экспедитора</option>
                            {expeditors.map(exp => (
                                <option key={exp.id} value={exp.id}>{exp.name}</option>
                            ))}
                        </select>

                        {/* Статус */}
                        <select
                            className="border rounded px-3 py-2 text-sm"
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                        >
                            <option value="">Все статусы</option>
                            <option value="pending">К доставке</option>
                            <option value="in_delivery">В пути</option>
                            <option value="delivered">Доставлен</option>
                        </select>

                        {/* Обновить */}
                        <Button variant="outline" size="sm" onClick={fetchOrders} className="flex items-center gap-1">
                            <RefreshCw size={14} />
                            Обновить
                        </Button>
                    </div>
                </div>

                {/* Панель действий */}
                <div className="mt-4 pt-4 border-t flex flex-wrap items-center justify-between gap-3">
                    {/* Левая часть - чекбоксы и действия */}
                    <div className="flex items-center gap-3">
                        {isEditing && visibleOrders.length > 0 && (
                            <>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size === visibleOrders.length && visibleOrders.length > 0}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm">Выбрать все</span>
                                </label>

                                {selectedIds.size > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={hideSelected}
                                        className="flex items-center gap-1 text-orange-600 border-orange-300 hover:bg-orange-50"
                                    >
                                        <EyeOff size={14} />
                                        Скрыть выделенные ({selectedIds.size})
                                    </Button>
                                )}

                                {hiddenIds.size > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={showAllHidden}
                                        className="flex items-center gap-1 text-blue-600"
                                    >
                                        <Eye size={14} />
                                        Показать скрытые ({hiddenIds.size})
                                    </Button>
                                )}
                            </>
                        )}
                    </div>

                    {/* Правая часть - статистика и кнопки */}
                    <div className="flex items-center gap-4">
                        {/* Статистика */}
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>Заказов: <strong>{stats.totalOrders}</strong></span>
                            <span>Вес: <strong>{stats.totalWeight.toFixed(1)} кг</strong></span>
                            <span>Сумма: <strong className="text-green-600">{stats.totalAmount.toLocaleString('ru-RU')} ₽</strong></span>
                        </div>

                        {/* Кнопки редактирования и сохранения */}
                        {saved ? (
                            <div className="flex items-center gap-2">
                                <span className="text-green-600 flex items-center gap-1 text-sm">
                                    <Check size={16} /> Сохранено
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setSaved(false); setIsEditing(true); }}
                                    className="flex items-center gap-1"
                                >
                                    <Edit2 size={14} />
                                    Редактировать
                                </Button>
                            </div>
                        ) : isEditing ? (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setIsEditing(false); setSelectedIds(new Set()); setHiddenIds(new Set()); }}
                                    className="flex items-center gap-1"
                                >
                                    <X size={14} />
                                    Отмена
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={saveExpeditionData}
                                    disabled={saving}
                                    className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                                >
                                    <Save size={14} />
                                    {saving ? 'Сохранение...' : 'Сохранить'}
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-1"
                            >
                                <Edit2 size={14} />
                                Редактировать
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {!selectedExpeditor ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    Выберите экспедитора для просмотра назначенных заказов
                </div>
            ) : loading ? (
                <div className="p-8 text-center">Загрузка...</div>
            ) : visibleOrders.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    {hiddenIds.size > 0 ? (
                        <div>
                            <p>Все заказы скрыты</p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={showAllHidden}
                                className="mt-3"
                            >
                                <Eye size={14} className="mr-1" />
                                Показать скрытые ({hiddenIds.size})
                            </Button>
                        </div>
                    ) : (
                        'Нет назначенных заказов за выбранный период'
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Pending Orders */}
                    {pendingOrders.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                                К доставке ({pendingOrders.length})
                            </h2>
                            <div className="grid gap-4">
                                {pendingOrders.map(order => (
                                    <OrderCard
                                        key={order.id}
                                        order={order}
                                        onViewInvoice={() => viewInvoice(order.id)}
                                        onStartDelivery={() => startDelivery(order.id)}
                                        isEditing={isEditing}
                                        isSelected={selectedIds.has(order.id)}
                                        onToggleSelect={() => toggleSelect(order.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* In Delivery */}
                    {inDeliveryOrders.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                                В пути ({inDeliveryOrders.length})
                            </h2>
                            <div className="grid gap-4">
                                {inDeliveryOrders.map(order => (
                                    <OrderCard
                                        key={order.id}
                                        order={order}
                                        onViewInvoice={() => viewInvoice(order.id)}
                                        showCompleteButton
                                        isEditing={isEditing}
                                        isSelected={selectedIds.has(order.id)}
                                        onToggleSelect={() => toggleSelect(order.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Delivered */}
                    {deliveredOrders.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                Доставлены ({deliveredOrders.length})
                            </h2>
                            <div className="grid gap-4">
                                {deliveredOrders.map(order => (
                                    <OrderCard
                                        key={order.id}
                                        order={order}
                                        onViewInvoice={() => viewInvoice(order.id)}
                                        isCompleted
                                        isEditing={isEditing}
                                        isSelected={selectedIds.has(order.id)}
                                        onToggleSelect={() => toggleSelect(order.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

interface OrderCardProps {
    order: ExpeditionOrder;
    onViewInvoice: () => void;
    onStartDelivery?: () => void;
    showCompleteButton?: boolean;
    isCompleted?: boolean;
    isEditing?: boolean;
    isSelected?: boolean;
    onToggleSelect?: () => void;
}

function OrderCard({
    order,
    onViewInvoice,
    onStartDelivery,
    showCompleteButton,
    isCompleted,
    isEditing,
    isSelected,
    onToggleSelect
}: OrderCardProps) {
    const navigate = useNavigate();
    const statusInfo = DELIVERY_STATUS_LABELS[order.deliveryStatus] || { label: order.deliveryStatus, color: 'bg-gray-100' };

    return (
        <div className={`bg-white rounded-lg shadow p-4 ${isCompleted ? 'opacity-75' : ''} ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-start gap-3">
                    {/* Чекбокс */}
                    {isEditing && (
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={onToggleSelect}
                            className="w-5 h-5 mt-1 cursor-pointer"
                        />
                    )}
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">#{order.id}</span>
                            {order.idn && <span className="text-gray-500 text-sm font-mono">IDN: {order.idn}</span>}
                        </div>
                        <div className="text-gray-600">{order.customer.name}</div>
                        {order.deliveryAddress && (
                            <div className="text-sm text-gray-500 mt-1">📍 {order.deliveryAddress}</div>
                        )}
                        {/* Дата заказа */}
                        <div className="text-xs text-gray-400 mt-1">
                            📅 Дата: {new Date(order.date).toLocaleDateString('ru-RU')}
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                    </span>
                    <div className="text-lg font-bold text-green-600 mt-1">
                        {Number(order.totalAmount).toLocaleString('ru-RU')} ₽
                    </div>
                    {order.totalWeight > 0 && (
                        <div className="text-sm text-gray-500">
                            {order.totalWeight.toFixed(1)} кг
                        </div>
                    )}
                </div>
            </div>

            <div className="text-sm text-gray-500 mb-3">
                {order.items.length} позиций • Назначен: {new Date(order.assignedAt).toLocaleString('ru-RU')}
            </div>

            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onViewInvoice} className="flex items-center gap-1">
                    <Eye size={14} /> Накладная
                </Button>

                {onStartDelivery && order.deliveryStatus === 'pending' && (
                    <Button size="sm" onClick={onStartDelivery} className="flex items-center gap-1">
                        <Truck size={14} /> Начать доставку
                    </Button>
                )}

                {showCompleteButton && (
                    <Button
                        size="sm"
                        onClick={() => navigate(`/expedition/${order.id}/invoice`)}
                        className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                    >
                        <Check size={14} /> Подпись и завершение
                    </Button>
                )}

                {isCompleted && (
                    <span className="text-green-600 text-sm flex items-center gap-1">
                        <Check size={14} /> Выполнен
                    </span>
                )}
            </div>
        </div>
    );
}
