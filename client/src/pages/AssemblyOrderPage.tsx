import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';

interface OrderItem {
    id: number;
    productId: number;
    quantity: number; // Ordered qty
    shippedQty: number; // Fact qty
    product: {
        code: string;
        name: string;
        category: string;
    };
}

interface Order {
    id: number;
    date: string;
    customer: {
        name: string;
    };
    items: OrderItem[];
    status: string;
}

export default function AssemblyOrderPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [assembledItems, setAssembledItems] = useState<{ [key: number]: number }>({});

    useEffect(() => {
        fetchOrder();
    }, [id]);

    const fetchOrder = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/api/assembly/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = response.data;
            setOrder(data);

            // Initialize assembled items with current shippedQty or 0
            const initialItems: any = {};
            data.items.forEach((item: OrderItem) => {
                initialItems[item.id] = item.shippedQty;
            });
            setAssembledItems(initialItems);
        } catch (error) {
            console.error('Failed to fetch order', error);
        } finally {
            setLoading(false);
        }
    };

    const handleQuantityChange = (itemId: number, value: string) => {
        // Allow empty string for better typing experience
        if (value === '') {
            setAssembledItems(prev => ({ ...prev, [itemId]: 0 }));
            // Note: In a real app we might want to store string logic to allow empty input visually
            // For now, let's just parse float
            return;
        }

        setAssembledItems(prev => ({
            ...prev,
            [itemId]: parseFloat(value) || 0
        }));
    };

    const handleCopyAll = () => {
        if (!order) return;
        const newItems: any = {};
        order.items.forEach(item => {
            newItems[item.id] = item.quantity;
        });
        setAssembledItems(newItems);
    };

    const handleComplete = async () => {
        if (!order) return;
        try {
            const itemsToUpdate = Object.entries(assembledItems).map(([id, qty]) => ({
                id: Number(id),
                shippedQty: qty
            }));

            const token = localStorage.getItem('token');
            await axios.put(`${API_URL}/api/assembly/${order.id}`, {
                items: itemsToUpdate,
                status: 'assembled'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            navigate('/assembly');
        } catch (error) {
            console.error('Failed to complete assembly', error);
            alert('Ошибка при сохранении сборки');
        }
    };

    if (loading) return <div>Загрузка...</div>;
    if (!order) return <div>Заказ не найден</div>;

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Сборка заказа #{order.id}</h1>
                    <p className="text-slate-500">{order.customer.name} от {new Date(order.date).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate('/assembly')}>
                        Назад
                    </Button>
                    <Button variant="secondary" onClick={handleCopyAll}>
                        Заполнить всё как в заказе
                    </Button>
                    <Button variant="default" onClick={handleComplete}>
                        Завершить сборку
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Код</TableHead>
                            <TableHead>Товар</TableHead>
                            <TableHead className="text-right">Заказано</TableHead>
                            <TableHead className="w-40 text-right">Собрано (Факт)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {order.items.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="text-slate-500 text-sm py-2">{item.product.code}</TableCell>
                                <TableCell className="font-medium py-2">{item.product.name}</TableCell>
                                <TableCell className="text-right py-2">{item.quantity}</TableCell>
                                <TableCell className="text-right py-1">
                                    <Input
                                        type="number"
                                        className="w-32 ml-auto text-right h-8"
                                        value={assembledItems[item.id] || ''}
                                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
