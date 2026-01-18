import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';

interface OrderItem {
    id: number;
    productId: number;
    quantity: number;
    price: number;
    amount: number;
    shippedQty: number;
    sumWithRevaluation: number | null;
    distributionCoef: number | null;
    weightToDistribute: number | null;
    product: {
        id: number;
        code: string;
        name: string;
        category: string | null;
        shortNameMorning: string | null;
    };
}

interface Order {
    id: number;
    date: string;
    status: string;
    paymentType: string | null;
    totalAmount: number;
    totalWeight: number;
    customer: {
        id: number;
        name: string;
        code: string;
    };
    items: OrderItem[];
    createdAt: string;
    updatedAt: string;
}

const STATUS_LABELS: { [key: string]: string } = {
    'new': 'Новый',
    'processing': 'В обработке',
    'delivered': 'Доставлен'
};

const PAYMENT_LABELS: { [key: string]: string } = {
    'cash': 'Наличка',
    'terminal': 'Терминал',
    'bank': 'Безнал'
};

export default function OrderViewPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrder();
    }, [id]);

    const fetchOrder = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/orders/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setOrder(res.data);
        } catch (err) {
            console.error('Failed to fetch order:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Загрузка...</div>;
    if (!order) return <div className="p-8 text-center text-red-500">Заказ не найден</div>;

    const totalSum = order.items.reduce((sum, item) => sum + Number(item.amount), 0);
    const totalSumRevaluation = order.items.reduce((sum, item) => sum + (Number(item.sumWithRevaluation) || 0), 0);

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Заказ #{order.id}</h1>
                    <p className="text-gray-500">
                        Создан: {new Date(order.createdAt).toLocaleString('ru-RU')}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate('/orders')}>
                        ← Назад к списку
                    </Button>
                </div>
            </div>

            {/* Order Info */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Информация о заказе</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <div className="text-sm text-gray-500">Дата отгрузки</div>
                        <div className="font-medium">{new Date(order.date).toLocaleDateString('ru-RU')}</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-500">Клиент</div>
                        <div className="font-medium">{order.customer.name}</div>
                        <div className="text-xs text-gray-400">Код: {order.customer.code}</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-500">Тип оплаты</div>
                        <div className="font-medium">{PAYMENT_LABELS[order.paymentType || ''] || order.paymentType || '-'}</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-500">Статус</div>
                        <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${order.status === 'new' ? 'bg-yellow-100 text-yellow-800' :
                                order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                    'bg-green-100 text-green-800'
                            }`}>
                            {STATUS_LABELS[order.status] || order.status}
                        </span>
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
                <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold">Товары ({order.items.length})</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-2 text-left">Код</th>
                                <th className="px-3 py-2 text-left">Товар</th>
                                <th className="px-3 py-2 text-left">Категория</th>
                                <th className="px-3 py-2 text-left">Короткое</th>
                                <th className="px-3 py-2 text-right">Цена</th>
                                <th className="px-3 py-2 text-right">Кол-во</th>
                                <th className="px-3 py-2 text-right">Факт</th>
                                <th className="px-3 py-2 text-right">Сумма переоц.</th>
                                <th className="px-3 py-2 text-right">Коэф %</th>
                                <th className="px-3 py-2 text-right">Вес распр.</th>
                                <th className="px-3 py-2 text-right">Сумма</th>
                            </tr>
                        </thead>
                        <tbody>
                            {order.items.map((item) => (
                                <tr key={item.id} className="border-t hover:bg-gray-50">
                                    <td className="px-3 py-2 text-gray-500">{item.product.code}</td>
                                    <td className="px-3 py-2 font-medium">{item.product.name}</td>
                                    <td className="px-3 py-2 text-gray-600">{item.product.category || '-'}</td>
                                    <td className="px-3 py-2 text-gray-600">{item.product.shortNameMorning || '-'}</td>
                                    <td className="px-3 py-2 text-right">{Number(item.price).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                                    <td className="px-3 py-2 text-right">{item.shippedQty}</td>
                                    <td className="px-3 py-2 text-right">{item.sumWithRevaluation?.toFixed(2) || '-'}</td>
                                    <td className="px-3 py-2 text-right">{item.distributionCoef?.toFixed(1) || '-'}%</td>
                                    <td className="px-3 py-2 text-right">{item.weightToDistribute?.toFixed(2) || '-'}</td>
                                    <td className="px-3 py-2 text-right font-medium">{Number(item.amount).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-medium">
                            <tr>
                                <td colSpan={10} className="px-3 py-2 text-right">Итого:</td>
                                <td className="px-3 py-2 text-right">{totalSum.toFixed(2)} ₽</td>
                            </tr>
                            <tr>
                                <td colSpan={10} className="px-3 py-2 text-right text-gray-600">С переоценкой:</td>
                                <td className="px-3 py-2 text-right text-gray-600">{totalSumRevaluation.toFixed(2)} ₽</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Summary */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <div className="text-2xl font-bold text-green-600">{totalSum.toLocaleString('ru-RU')} ₽</div>
                        <div className="text-sm text-gray-500">Сумма заказа</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{order.totalWeight.toFixed(2)} кг</div>
                        <div className="text-sm text-gray-500">Общий вес</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{order.items.length}</div>
                        <div className="text-sm text-gray-500">Позиций</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
