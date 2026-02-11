import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import { Eye, Check, Truck, Edit2, Calendar, RefreshCw, RotateCcw, MapPin } from 'lucide-react';
import { ReturnModal } from '../components/ReturnModal';

interface OrderItem {
    id: number;
    quantity: number;
    shippedQty: number;
    price: number;
    qtyReturn?: number;
    product: {
        id: number;
        name: string;
        code: string;
    };
}

// ТЗ §1: ExpeditionStatus тип
type ExpeditionStatus = 'open' | 'closed';

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
    expeditionId: number | null;
    expeditionStatus: ExpeditionStatus;
    // Delivery geo snapshot
    deliveryLat: string | null;
    deliveryLng: string | null;
    deliveryAccuracyM: number | null;
    deliveryComment: string | null;
    customer: {
        id: number;
        name: string;
        code: string;
    };
    items: OrderItem[];
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

    // Модалка возврата
    const [returnModalOrder, setReturnModalOrder] = useState<ExpeditionOrder | null>(null);

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
            // ТЗ: фильтруем только активных, выбираем первого из активных
            const active = res.data.filter((e: Expeditor & { isActive: boolean }) => e.isActive);
            setExpeditors(active);
            if (active.length > 0) {
                setSelectedExpeditor(active[0].id);
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
        } catch (err) {
            console.error('Failed to fetch orders:', err);
        } finally {
            setLoading(false);
        }
    };

    const startDelivery = async (orderId: number) => {
        try {
            const token = localStorage.getItem('token');
            // ТЗ: FSM статусом управляет бэк, шлём только deliveryStatus
            await axios.patch(`${API_URL}/api/orders/${orderId}`,
                { deliveryStatus: 'in_delivery' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchOrders();
        } catch (err) {
            console.error('Failed to start delivery:', err);
            alert('Ошибка изменения статуса');
        }
    };

    // ТЗ §2: накладная использует expeditionId конкретного заказа
    const viewInvoice = (orderId: number, expeditionId: number | null) => {
        const url = expeditionId !== null
            ? `/expedition/${orderId}/invoice?expeditionId=${expeditionId}`
            : `/expedition/${orderId}/invoice`;
        navigate(url);
    };

    // Статистика
    const stats = useMemo(() => ({
        totalOrders: orders.length,
        totalWeight: orders.reduce((sum, o) => sum + (o.totalWeight || 0), 0),
        totalAmount: orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0)
    }), [orders]);

    const pendingOrders = orders.filter(o => o.deliveryStatus === 'pending');
    const inDeliveryOrders = orders.filter(o => o.deliveryStatus === 'in_delivery');
    const deliveredOrders = orders.filter(o => o.deliveryStatus === 'delivered');

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

                {/* Статистика */}
                <div className="mt-4 pt-4 border-t flex items-center gap-4 text-sm text-gray-600">
                    <span>Заказов: <strong>{stats.totalOrders}</strong></span>
                    <span>Вес: <strong>{stats.totalWeight.toFixed(1)} кг</strong></span>
                    <span>Сумма: <strong className="text-green-600">{stats.totalAmount.toLocaleString('ru-RU')} ₽</strong></span>
                </div>
            </div>

            {!selectedExpeditor ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    Выберите экспедитора для просмотра назначенных заказов
                </div>
            ) : loading ? (
                <div className="p-8 text-center">Загрузка...</div>
            ) : orders.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    Нет назначенных заказов за выбранный период
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
                                        onViewInvoice={() => viewInvoice(order.id, order.expeditionId)}
                                        onStartDelivery={() => startDelivery(order.id)}
                                        onReturn={() => setReturnModalOrder(order)}
                                        onEdit={() => navigate(`/orders/${order.id}`)}
                                        expeditionStatus={order.expeditionStatus}
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
                                        onViewInvoice={() => viewInvoice(order.id, order.expeditionId)}
                                        onReturn={() => setReturnModalOrder(order)}
                                        onEdit={() => navigate(`/orders/${order.id}`)}
                                        expeditionStatus={order.expeditionStatus}
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
                                        onViewInvoice={() => viewInvoice(order.id, order.expeditionId)}
                                        onReturn={() => setReturnModalOrder(order)}
                                        isCompleted
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Модалка возврата: используем expeditionId из заказа */}
            {returnModalOrder && returnModalOrder.expeditionId != null && (
                <ReturnModal
                    orderId={returnModalOrder.id}
                    orderNumber={returnModalOrder.idn || String(returnModalOrder.id)}
                    expeditionId={returnModalOrder.expeditionId}
                    items={returnModalOrder.items}
                    isOpen={true}
                    onClose={() => setReturnModalOrder(null)}
                    onSaved={() => fetchOrders()}
                />
            )}
        </div>
    );
}

interface OrderCardProps {
    order: ExpeditionOrder;
    onViewInvoice: () => void;
    onStartDelivery?: () => void;
    isCompleted?: boolean;
    onReturn?: () => void;
    onEdit?: () => void;
    expeditionStatus?: string; // open | closed
}

function OrderCard({
    order,
    onViewInvoice,
    onStartDelivery,
    isCompleted,
    onReturn,
    onEdit,
    expeditionStatus = 'open'
}: OrderCardProps) {
    const statusInfo = DELIVERY_STATUS_LABELS[order.deliveryStatus] || { label: order.deliveryStatus, color: 'bg-gray-100' };

    return (
        <div className={`bg-white rounded-lg shadow p-4 ${isCompleted ? 'opacity-75' : ''}`}>
            <div className="flex justify-between items-start mb-3">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">#{order.id}</span>
                        {order.idn && <span className="text-gray-500 text-sm font-mono">IDN: {order.idn}</span>}
                    </div>
                    <div className="text-gray-600">{order.customer.name}</div>
                    {order.deliveryAddress && (
                        <div className="text-sm text-gray-500 mt-1">📍 {order.deliveryAddress}</div>
                    )}
                    {/* Geo display */}
                    {order.deliveryLat != null && order.deliveryLng != null && (
                        <div className="mt-2 p-2 bg-gray-50 rounded">
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                <MapPin size={12} />
                                <span>
                                    {(() => {
                                        const lat = parseFloat(String(order.deliveryLat).replace(',', '.'));
                                        const lng = parseFloat(String(order.deliveryLng).replace(',', '.'));
                                        if (Number.isFinite(lat) && Number.isFinite(lng)) {
                                            return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                                        }
                                        return `${order.deliveryLat}, ${order.deliveryLng}`;
                                    })()}
                                </span>
                                {order.deliveryAccuracyM != null && Number(order.deliveryAccuracyM) > 500 && (
                                    <span className="text-orange-600 font-medium">⚠ ~{order.deliveryAccuracyM}м</span>
                                )}
                            </div>
                            {order.deliveryComment && (
                                <div className="text-xs text-gray-500 mt-1">💬 {order.deliveryComment}</div>
                            )}
                            <div className="flex gap-2 mt-1">
                                <a
                                    href={`geo:${String(order.deliveryLat).replace(',', '.')},${String(order.deliveryLng).replace(',', '.')}`}
                                    className="text-xs text-blue-600 underline"
                                >🧭 Навигатор</a>
                                <a
                                    href={`https://www.google.com/maps?q=${String(order.deliveryLat).replace(',', '.')},${String(order.deliveryLng).replace(',', '.')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-blue-600 underline"
                                >📍 Google Maps</a>
                            </div>
                        </div>
                    )}
                    {/* Дата заказа */}
                    <div className="text-xs text-gray-400 mt-1">
                        📅 Дата: {new Date(order.date).toLocaleDateString('ru-RU')}
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

                {/* Кнопка Редактировать - только при open и не завершён */}
                {onEdit && !isCompleted && expeditionStatus === 'open' && (
                    <Button variant="outline" size="sm" onClick={onEdit} className="flex items-center gap-1">
                        <Edit2 size={14} /> Редактировать
                    </Button>
                )}

                {/* "Начать доставку" показывается только при pending и open */}
                {onStartDelivery && order.deliveryStatus === 'pending' && expeditionStatus === 'open' && (
                    <Button size="sm" onClick={onStartDelivery} className="flex items-center gap-1">
                        <Truck size={14} /> Начать доставку
                    </Button>
                )}

                {/* "Возврат" при наличии expeditionId (для всех статусов, включая доставленные) */}
                {onReturn && order.expeditionId !== null && (
                    <Button variant="outline" size="sm" onClick={onReturn} className="flex items-center gap-1 text-orange-600 border-orange-300 hover:bg-orange-50">
                        <RotateCcw size={14} /> Возврат
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
