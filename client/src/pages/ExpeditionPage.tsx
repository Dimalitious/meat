import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import { Eye, Check, Truck } from 'lucide-react';

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

    useEffect(() => {
        fetchExpeditors();
    }, []);

    useEffect(() => {
        if (selectedExpeditor) {
            fetchOrders();
        }
    }, [selectedExpeditor, filterStatus]);

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
            let url = `${API_URL}/api/orders/expeditor/${selectedExpeditor}`;
            if (filterStatus) {
                url += `?status=${filterStatus}`;
            }
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

    const pendingOrders = orders.filter(o => o.deliveryStatus === 'pending');
    const inDeliveryOrders = orders.filter(o => o.deliveryStatus === 'in_delivery');
    const deliveredOrders = orders.filter(o => o.deliveryStatus === 'delivered');

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Экспедиция</h1>
                <div className="flex gap-4 items-center">
                    <select
                        className="border rounded px-3 py-2"
                        value={selectedExpeditor || ''}
                        onChange={e => setSelectedExpeditor(Number(e.target.value))}
                    >
                        <option value="">Выберите экспедитора</option>
                        {expeditors.map(exp => (
                            <option key={exp.id} value={exp.id}>{exp.name}</option>
                        ))}
                    </select>
                    <select
                        className="border rounded px-3 py-2"
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                    >
                        <option value="">Все статусы</option>
                        <option value="pending">К доставке</option>
                        <option value="in_delivery">В пути</option>
                        <option value="delivered">Доставлен</option>
                    </select>
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
                    Нет назначенных заказов
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
}

function OrderCard({ order, onViewInvoice, onStartDelivery, showCompleteButton, isCompleted }: OrderCardProps) {
    const navigate = useNavigate();
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
                </div>
                <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                    </span>
                    <div className="text-lg font-bold text-green-600 mt-1">
                        {Number(order.totalAmount).toLocaleString('ru-RU')} ₽
                    </div>
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
