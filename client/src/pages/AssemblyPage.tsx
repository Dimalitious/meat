import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Button } from '../components/ui/Button';

interface Order {
    id: number;
    date: string;
    customer: {
        name: string;
    };
    totalAmount: number;
    items: any[];
    status: string;
}

export default function AssemblyPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/api/assembly`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setOrders(response.data);
        } catch (error) {
            console.error('Failed to fetch assembly orders', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div>Загрузка...</div>;

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Сборка заказов (Assembly)</h1>
            <div className="bg-white rounded-lg shadow">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Дата</TableHead>
                            <TableHead>Клиент</TableHead>
                            <TableHead>Позиций</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead className="text-right">Действие</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                                    Нет заказов для сборки
                                </TableCell>
                            </TableRow>
                        ) : (
                            orders.map((order) => (
                                <TableRow key={order.id}>
                                    <TableCell>#{order.id}</TableCell>
                                    <TableCell>{new Date(order.date).toLocaleDateString()}</TableCell>
                                    <TableCell className="font-medium">{order.customer.name}</TableCell>
                                    <TableCell>{order.items.length}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded text-xs ${order.status === 'new' ? 'bg-yellow-100 text-yellow-800' :
                                                order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-emerald-100 text-emerald-800'
                                            }`}>
                                            {order.status === 'new' ? 'Новый' :
                                                order.status === 'processing' ? 'В обработке' :
                                                    order.status === 'delivered' ? 'Доставлен' : order.status}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Link to={`/assembly/${order.id}`}>
                                            <Button variant="default" size="sm">
                                                Начать сборку
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
