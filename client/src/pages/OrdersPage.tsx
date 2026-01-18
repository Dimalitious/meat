import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Link } from 'react-router-dom';
import { Button } from "../components/ui/Button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../components/ui/Table";

interface Order {
    id: number;
    idn: string | null;
    date: string;
    customer: { name: string };
    totalAmount: number;
    status: string;
    items: any[];
}

const OrdersPage = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/orders`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setOrders(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const deleteOrder = async (id: number) => {
        if (!confirm('Вы уверены, что хотите удалить этот заказ?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/api/orders/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchOrders();
        } catch (err) {
            alert('Ошибка при удалении');
        }
    };

    const confirmOrder = async (id: number) => {
        if (!confirm('Подтвердить заказ? Это отправит его на сборку.')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.patch(`${API_URL}/api/orders/${id}`,
                { status: 'processing' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchOrders();
        } catch (err) {
            console.error(err);
            alert('Не удалось подтвердить заказ');
        }
    };

    // Отправить на доработку - вернуть в Сводку по IDN
    const sendToRework = async (order: Order) => {
        if (!order.idn) {
            alert('У заказа нет связи со сводкой');
            return;
        }
        if (!confirm('Отправить заказ на доработку? Он вернётся в сводку заказов.')) return;

        try {
            const token = localStorage.getItem('token');
            // Обновить статус заказа
            await axios.patch(`${API_URL}/api/orders/${order.id}`,
                { status: 'rework' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Обновить статус сводки по IDN
            await axios.post(`${API_URL}/api/summary-orders/rework`,
                { idn: order.idn },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert('Заказ отправлен на доработку');
            fetchOrders();
        } catch (err) {
            console.error(err);
            alert('Ошибка при отправке на доработку');
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Загрузка...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Заказы</h1>
                <Link to="/orders/new">
                    <Button>
                        + Новый заказ
                    </Button>
                </Link>
            </div>

            <div className="rounded-md border border-slate-200 overflow-hidden bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                            <TableHead className="w-[80px]">№</TableHead>
                            <TableHead>Дата</TableHead>
                            <TableHead>№ Сводки</TableHead>
                            <TableHead>Клиент</TableHead>
                            <TableHead>Сумма</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead className="text-right">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                                    Нет заказов
                                </TableCell>
                            </TableRow>
                        ) : (
                            orders.map((o) => (
                                <TableRow key={o.id}>
                                    <TableCell className="font-medium">#{o.id}</TableCell>
                                    <TableCell>{new Date(o.date).toLocaleDateString('ru-RU')}</TableCell>
                                    <TableCell className="text-gray-500 font-mono text-xs">
                                        {o.idn || '-'}
                                    </TableCell>
                                    <TableCell className="font-medium text-slate-700">{o.customer?.name}</TableCell>
                                    <TableCell>{Number(o.totalAmount).toLocaleString('ru-RU')} ₽</TableCell>
                                    <TableCell>
                                        <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${o.status === 'new' ? 'bg-yellow-100 text-yellow-800' :
                                            o.status === 'processing' ? 'bg-primary-100 text-primary-800' :
                                                o.status === 'rework' ? 'bg-orange-100 text-orange-800' :
                                                    'bg-emerald-100 text-emerald-800'
                                            }`}>
                                            {o.status === 'new' ? 'Новый' :
                                                o.status === 'processing' ? 'В обработке' :
                                                    o.status === 'rework' ? 'На доработке' :
                                                        o.status === 'delivered' ? 'Доставлен' : o.status}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Link to={`/orders/${o.id}`}>
                                            <Button variant="outline" size="sm">
                                                Просмотр
                                            </Button>
                                        </Link>
                                        <Link to={`/orders/${o.id}/edit`}>
                                            <Button variant="secondary" size="sm">
                                                Редактировать
                                            </Button>
                                        </Link>
                                        {o.status === 'new' && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => confirmOrder(o.id)}
                                                className="text-primary-600 hover:text-primary-700 hover:bg-primary-50"
                                            >
                                                Подтвердить
                                            </Button>
                                        )}
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => deleteOrder(o.id)}
                                        >
                                            Удалить
                                        </Button>
                                        {o.idn && o.status !== 'rework' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => sendToRework(o)}
                                                className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                            >
                                                На доработку
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default OrdersPage;
