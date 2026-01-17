import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from '../components/ui/Table';
import { Button } from '../components/ui/Button';

interface Order {
    id: number;
    date: string;
    customer: { name: string; district?: { name: string } };
    expeditorId?: number;
    expeditor?: { name: string };
    totalAmount: number;
    status: string;
}

interface Expeditor {
    id: number;
    name: string;
}

const ShipmentsPage = () => {
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [expeditors, setExpeditors] = useState<Expeditor[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
        fetchExpeditors();
    }, [date]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/orders`, {
                params: { date }, // Filter by date
                headers: { Authorization: `Bearer ${token}` }
            });
            setOrders(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchExpeditors = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/expeditors`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setExpeditors(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAssignDriver = async (orderId: number, expeditorId: string) => {
        try {
            const token = localStorage.getItem('token');
            await axios.patch(`${API_URL}/api/orders/${orderId}`,
                { expeditorId: expeditorId ? Number(expeditorId) : null },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Optimistic update
            setOrders(orders.map(o => o.id === orderId ? { ...o, expeditorId: Number(expeditorId) } : o));
        } catch (err) {
            alert('Failed to assign driver');
            fetchData(); // Revert on error
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">Экспедиция</h1>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="flex h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    />
                </div>
                <Button onClick={handlePrint} className="bg-slate-800 hover:bg-slate-900 text-white">
                    Печать листа
                </Button>
            </div>

            <div className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-0">
                    {loading ? (
                        <div className="text-center py-12 text-slate-500">Загрузка...</div>
                    ) : orders.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">Нет заказов на эту дату</div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Клиент</TableHead>
                                    <TableHead>Сумма</TableHead>
                                    <TableHead>Водитель</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-medium text-slate-900">#{order.id}</TableCell>
                                        <TableCell>
                                            <span className="font-medium text-slate-700">{order.customer.name}</span>
                                        </TableCell>
                                        <TableCell className="font-bold text-slate-900">
                                            {Number(order.totalAmount).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <select
                                                value={order.expeditorId || ''}
                                                onChange={(e) => handleAssignDriver(order.id, e.target.value)}
                                                className="block w-full max-w-xs rounded-md border border-slate-300 bg-white py-1.5 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm print:hidden"
                                            >
                                                <option value="">-- Не назначен --</option>
                                                {expeditors.map(exp => (
                                                    <option key={exp.id} value={exp.id}>{exp.name}</option>
                                                ))}
                                            </select>
                                            {/* Print View Only */}
                                            <div className="hidden print:block text-sm font-bold">
                                                {expeditors.find(e => e.id === order.expeditorId)?.name || '________________'}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </div>

            <style>{`
                @media print {
                    @page { margin: 1cm; }
                    body { -webkit-print-color-adjust: exact; }
                }
            `}</style>
        </div>
    );
};

export default ShipmentsPage;
