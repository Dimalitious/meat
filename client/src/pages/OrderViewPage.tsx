import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import { Printer, UserPlus, Download, X } from 'lucide-react';
import { getStatusLabel, getStatusColor } from '../constants/orderStatus';

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

interface Expeditor {
    id: number;
    name: string;
    phone: string | null;
    isActive: boolean;
}

interface OrderAttachment {
    id: number;
    type: string;
    filename: string;
    url: string;
    createdAt: string;
}

interface Order {
    id: number;
    idn: string | null;
    date: string;
    status: string;
    paymentType: string | null;
    totalAmount: number;
    totalWeight: number;
    deliveryAddress: string | null;
    deliveryStatus: string;
    expeditorId: number | null;
    assignedAt: string | null;
    completedAt: string | null;
    signatureUrl: string | null;
    signedInvoiceUrl: string | null;
    customer: {
        id: number;
        name: string;
        code: string;
        legalName?: string;
    };
    expeditor?: Expeditor | null;
    items: OrderItem[];
    attachments?: OrderAttachment[];
    createdAt: string;
    updatedAt: string;
}



const PAYMENT_LABELS: { [key: string]: string } = {
    'cash': 'Наличка',
    'terminal': 'Терминал',
    'bank': 'Безнал',
    'Перечисление': 'Перечисление'
};

export default function OrderViewPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [expeditors, setExpeditors] = useState<Expeditor[]>([]);
    const [showExpeditorModal, setShowExpeditorModal] = useState(false);
    const [searchExpeditor, setSearchExpeditor] = useState('');
    const [attachments, setAttachments] = useState<OrderAttachment[]>([]);

    useEffect(() => {
        fetchOrder();
        fetchExpeditors();
    }, [id]);

    const fetchOrder = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/orders/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setOrder(res.data);
            // Fetch attachments
            try {
                const attachRes = await axios.get(`${API_URL}/api/orders/${id}/attachments`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setAttachments(attachRes.data);
            } catch (e) {
                // Attachments endpoint may not exist yet
            }
        } catch (err) {
            console.error('Failed to fetch order:', err);
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
            console.error('Failed to fetch expeditors:', err);
        }
    };

    const assignExpeditor = async (expeditorId: number) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/orders/${id}/assign-expeditor`,
                { expeditorId, deliveryAddress: order?.customer?.name },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setShowExpeditorModal(false);
            fetchOrder();
            alert('Экспедитор назначен!');
        } catch (err) {
            console.error('Failed to assign expeditor:', err);
            alert('Ошибка назначения экспедитора');
        }
    };

    const handlePrint = () => {
        navigate(`/orders/${id}/print`);
    };

    const filteredExpeditors = expeditors.filter(e =>
        e.isActive && (
            e.name.toLowerCase().includes(searchExpeditor.toLowerCase()) ||
            (e.phone && e.phone.includes(searchExpeditor))
        )
    );

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
                        {order.idn && <span className="font-mono text-sm mr-2">IDN: {order.idn}</span>}
                        Создан: {new Date(order.createdAt).toLocaleString('ru-RU')}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate('/orders')}>
                        ← Назад к списку
                    </Button>
                    <Button variant="outline" onClick={handlePrint} className="flex items-center gap-2">
                        <Printer size={16} /> Печать накладной
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => setShowExpeditorModal(true)}
                        className="flex items-center gap-2"
                    >
                        <UserPlus size={16} /> Прикрепить экспедитора
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
                        <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                        </span>
                    </div>
                </div>

                {/* Expeditor Info */}
                {order.expeditor && (
                    <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center gap-4">
                            <div>
                                <div className="text-sm text-gray-500">Экспедитор</div>
                                <div className="font-medium">{order.expeditor.name}</div>
                                {order.expeditor.phone && (
                                    <div className="text-xs text-gray-400">{order.expeditor.phone}</div>
                                )}
                            </div>
                            {order.assignedAt && (
                                <div>
                                    <div className="text-sm text-gray-500">Назначен</div>
                                    <div className="text-sm">{new Date(order.assignedAt).toLocaleString('ru-RU')}</div>
                                </div>
                            )}
                            {order.completedAt && (
                                <div>
                                    <div className="text-sm text-gray-500">Выполнен</div>
                                    <div className="text-sm text-green-600">{new Date(order.completedAt).toLocaleString('ru-RU')}</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
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
                                    <td className="px-3 py-2 text-right font-medium">{Number(item.amount).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-medium">
                            <tr>
                                <td colSpan={7} className="px-3 py-2 text-right">Итого:</td>
                                <td className="px-3 py-2 text-right">{totalSum.toFixed(2)} ₽</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Attachments (signatures, signed invoices) */}
            {attachments.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-4">Вложения</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {attachments.map(att => (
                            <div key={att.id} className="border rounded p-3">
                                <div className="text-sm font-medium">{att.filename}</div>
                                <div className="text-xs text-gray-500 mb-2">
                                    {att.type === 'signature' ? '🖊️ Подпись' :
                                        att.type === 'signed_invoice' ? '📄 Накладная' : att.type}
                                </div>
                                <a
                                    href={att.url}
                                    download={att.filename}
                                    className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm"
                                >
                                    <Download size={14} /> Скачать
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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

            {/* Expeditor Modal */}
            {showExpeditorModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Прикрепить экспедитора</h3>
                            <button onClick={() => setShowExpeditorModal(false)} className="text-gray-500 hover:text-gray-700">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 border-b">
                            <input
                                type="text"
                                placeholder="Поиск по ФИО или телефону..."
                                className="w-full border rounded px-3 py-2"
                                value={searchExpeditor}
                                onChange={e => setSearchExpeditor(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="flex-1 overflow-auto p-2">
                            {filteredExpeditors.length === 0 ? (
                                <p className="text-center text-gray-500 py-4">Экспедиторы не найдены</p>
                            ) : (
                                filteredExpeditors.map(exp => (
                                    <button
                                        key={exp.id}
                                        onClick={() => assignExpeditor(exp.id)}
                                        className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded flex justify-between items-center"
                                    >
                                        <div>
                                            <div className="font-medium">{exp.name}</div>
                                            {exp.phone && <div className="text-sm text-gray-500">{exp.phone}</div>}
                                        </div>
                                        <span className="text-blue-600 text-sm">Назначить →</span>
                                    </button>
                                ))
                            )}
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
