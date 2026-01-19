import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Link } from 'react-router-dom';
import { Button } from "../components/ui/Button";
import { UserPlus, Printer, X, FileCheck, Download, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../components/ui/Table";

interface OrderItem {
    id: number;
    quantity: number;
    price: number;
    amount: number;
    shippedQty: number;
    product: {
        code: string;
        name: string;
        category?: string;
    };
}

interface Order {
    id: number;
    idn: string | null;
    date: string;
    customer: { name: string; code?: string; legalName?: string };
    totalAmount: number;
    status: string;
    paymentType?: string;
    expeditorId: number | null;
    expeditor?: { id: number; name: string; phone?: string } | null;
    signatureUrl?: string | null;
    signedInvoiceUrl?: string | null;
    deliveryStatus?: string;
    completedAt?: string | null;
    items: OrderItem[];
}

interface Expeditor {
    id: number;
    name: string;
    phone: string | null;
    isActive: boolean;
}

const PAYMENT_LABELS: { [key: string]: string } = {
    'cash': 'Наличные',
    'terminal': 'Терминал',
    'bank': 'Безнал',
    'Перечисление': 'Перечисление'
};

const OrdersPage = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [expeditors, setExpeditors] = useState<Expeditor[]>([]);
    const [showExpeditorModal, setShowExpeditorModal] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
    const [searchExpeditor, setSearchExpeditor] = useState('');

    // Signed invoice modal
    const [showSignedInvoiceModal, setShowSignedInvoiceModal] = useState(false);
    const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
    const [loadingInvoice, setLoadingInvoice] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const invoiceRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchOrders();
        fetchExpeditors();
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

    const sendToRework = async (order: Order) => {
        if (!order.idn) {
            alert('У заказа нет связи со сводкой');
            return;
        }
        if (!confirm('Отправить заказ на доработку? Он вернётся в сводку заказов.')) return;

        try {
            const token = localStorage.getItem('token');
            await axios.patch(`${API_URL}/api/orders/${order.id}`,
                { status: 'rework' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
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

    const openExpeditorModal = (orderId: number) => {
        setSelectedOrderId(orderId);
        setSearchExpeditor('');
        setShowExpeditorModal(true);
    };

    const assignExpeditor = async (expeditorId: number) => {
        if (!selectedOrderId) return;

        try {
            const token = localStorage.getItem('token');
            const order = orders.find(o => o.id === selectedOrderId);
            await axios.post(`${API_URL}/api/orders/${selectedOrderId}/assign-expeditor`,
                { expeditorId, deliveryAddress: order?.customer?.name },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setShowExpeditorModal(false);
            setSelectedOrderId(null);
            fetchOrders();
            alert('Экспедитор назначен!');
        } catch (err) {
            console.error('Failed to assign expeditor:', err);
            alert('Ошибка назначения экспедитора');
        }
    };

    const openSignedInvoice = async (order: Order) => {
        setLoadingInvoice(true);
        setShowSignedInvoiceModal(true);

        try {
            // Fetch full order with items
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/orders/${order.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSelectedInvoiceOrder(res.data);
        } catch (err) {
            console.error('Failed to fetch order details:', err);
            setSelectedInvoiceOrder(order);
        } finally {
            setLoadingInvoice(false);
        }
    };

    const downloadSignedInvoice = async () => {
        if (!invoiceRef.current || !selectedInvoiceOrder) return;

        setDownloading(true);
        try {
            const dataUrl = await toPng(invoiceRef.current, {
                quality: 1,
                pixelRatio: 2,
                backgroundColor: '#ffffff'
            });

            const link = document.createElement('a');
            link.download = `накладная_${selectedInvoiceOrder.id}_подписанная.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Failed to generate image:', err);
            alert('Ошибка генерации изображения');
        } finally {
            setDownloading(false);
        }
    };

    const filteredExpeditors = expeditors.filter(e =>
        e.isActive && (
            e.name.toLowerCase().includes(searchExpeditor.toLowerCase()) ||
            (e.phone && e.phone.includes(searchExpeditor))
        )
    );

    if (loading) return <div className="p-8 text-center text-slate-500">Загрузка...</div>;

    const totalSum = selectedInvoiceOrder?.items?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;

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
                            <TableHead>Экспедитор</TableHead>
                            <TableHead>Накладная</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead className="text-right">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center text-slate-500">
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
                                        {o.expeditor ? (
                                            <span className="text-purple-600 font-medium text-sm">
                                                {o.expeditor.name}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 text-sm">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {o.signatureUrl ? (
                                            <button
                                                onClick={() => openSignedInvoice(o)}
                                                className="flex items-center gap-1 text-green-600 hover:text-green-700 hover:underline text-sm font-medium"
                                                title="Открыть подписанную накладную"
                                            >
                                                <FileCheck size={16} />
                                                Подписана
                                            </button>
                                        ) : (
                                            <span className="text-gray-400 text-sm">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${o.status === 'new' ? 'bg-yellow-100 text-yellow-800' :
                                                o.status === 'assigned' ? 'bg-purple-100 text-purple-800' :
                                                    o.status === 'processing' ? 'bg-primary-100 text-primary-800' :
                                                        o.status === 'in_delivery' ? 'bg-blue-100 text-blue-800' :
                                                            o.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                                                                o.status === 'rework' ? 'bg-orange-100 text-orange-800' :
                                                                    'bg-gray-100 text-gray-800'
                                            }`}>
                                            {o.status === 'new' ? 'Новый' :
                                                o.status === 'assigned' ? 'Назначен' :
                                                    o.status === 'processing' ? 'В обработке' :
                                                        o.status === 'in_delivery' ? 'В доставке' :
                                                            o.status === 'delivered' ? 'Доставлен' :
                                                                o.status === 'rework' ? 'На доработке' : o.status}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1 flex-wrap">
                                            <Link to={`/orders/${o.id}`}>
                                                <Button variant="outline" size="sm">
                                                    Просмотр
                                                </Button>
                                            </Link>
                                            <Link to={`/orders/${o.id}/print`}>
                                                <Button variant="outline" size="sm" title="Печать накладной">
                                                    <Printer size={14} />
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openExpeditorModal(o.id)}
                                                className="text-purple-600 border-purple-300 hover:bg-purple-50"
                                                title="Прикрепить экспедитора"
                                            >
                                                <UserPlus size={14} />
                                            </Button>
                                            <Link to={`/orders/${o.id}/edit`}>
                                                <Button variant="secondary" size="sm">
                                                    Ред.
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
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Expeditor Selection Modal */}
            {showExpeditorModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-semibold">
                                Прикрепить экспедитора к заказу #{selectedOrderId}
                            </h3>
                            <button
                                onClick={() => setShowExpeditorModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
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
                        <div className="flex-1 overflow-auto p-2 max-h-[300px]">
                            {filteredExpeditors.length === 0 ? (
                                <p className="text-center text-gray-500 py-4">Экспедиторы не найдены</p>
                            ) : (
                                filteredExpeditors.map(exp => (
                                    <button
                                        key={exp.id}
                                        onClick={() => assignExpeditor(exp.id)}
                                        className="w-full text-left px-3 py-2 hover:bg-purple-50 rounded flex justify-between items-center"
                                    >
                                        <div>
                                            <div className="font-medium">{exp.name}</div>
                                            {exp.phone && <div className="text-sm text-gray-500">{exp.phone}</div>}
                                        </div>
                                        <span className="text-purple-600 text-sm">Назначить →</span>
                                    </button>
                                ))
                            )}
                        </div>
                        <div className="p-3 border-t text-center">
                            <Link
                                to="/expeditors"
                                className="text-purple-600 hover:underline text-sm"
                                onClick={() => setShowExpeditorModal(false)}
                            >
                                Открыть справочник экспедиторов
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Signed Invoice Modal with Full Details */}
            {showSignedInvoiceModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-[700px] max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-semibold">
                                    Подписанная накладная
                                </h3>
                                {selectedInvoiceOrder && (
                                    <p className="text-sm text-gray-500">
                                        Заказ #{selectedInvoiceOrder.id} • {selectedInvoiceOrder.customer?.name}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => {
                                    setShowSignedInvoiceModal(false);
                                    setSelectedInvoiceOrder(null);
                                }}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-4">
                            {loadingInvoice ? (
                                <div className="text-center py-8">
                                    <Loader2 className="animate-spin mx-auto mb-2" size={32} />
                                    <p className="text-gray-500">Загрузка...</p>
                                </div>
                            ) : selectedInvoiceOrder && (
                                /* Invoice Content for Download */
                                <div ref={invoiceRef} className="bg-white p-6" style={{ fontFamily: 'Arial, sans-serif' }}>
                                    {/* Header */}
                                    <div className="text-center mb-6 border-b pb-4">
                                        <div className="text-2xl font-bold">НАКЛАДНАЯ №{selectedInvoiceOrder.id}</div>
                                        <div className="text-gray-500 mt-1">
                                            от {new Date(selectedInvoiceOrder.date).toLocaleDateString('ru-RU')}
                                        </div>
                                        {selectedInvoiceOrder.idn && (
                                            <div className="text-sm text-gray-400 font-mono mt-1">IDN: {selectedInvoiceOrder.idn}</div>
                                        )}
                                    </div>

                                    {/* Customer & Expeditor Info */}
                                    <div className="grid grid-cols-2 gap-6 mb-6">
                                        <div>
                                            <div className="text-sm text-gray-500 mb-1">Покупатель:</div>
                                            <div className="font-semibold">{selectedInvoiceOrder.customer?.name}</div>
                                            {selectedInvoiceOrder.customer?.legalName && (
                                                <div className="text-sm text-gray-600">{selectedInvoiceOrder.customer.legalName}</div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-500 mb-1">Экспедитор:</div>
                                            <div className="font-semibold">{selectedInvoiceOrder.expeditor?.name || '—'}</div>
                                            {selectedInvoiceOrder.expeditor?.phone && (
                                                <div className="text-sm text-gray-600">{selectedInvoiceOrder.expeditor.phone}</div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-500 mb-1">Тип оплаты:</div>
                                            <div className="font-medium">
                                                {PAYMENT_LABELS[selectedInvoiceOrder.paymentType || ''] || selectedInvoiceOrder.paymentType || '—'}
                                            </div>
                                        </div>
                                        {selectedInvoiceOrder.completedAt && (
                                            <div>
                                                <div className="text-sm text-gray-500 mb-1">Дата выполнения:</div>
                                                <div className="font-medium text-green-600">
                                                    {new Date(selectedInvoiceOrder.completedAt).toLocaleString('ru-RU')}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Items Table */}
                                    <table className="w-full border-collapse mb-6" style={{ fontSize: '14px' }}>
                                        <thead>
                                            <tr className="bg-gray-100">
                                                <th className="border border-gray-300 px-2 py-2 text-left w-10">№</th>
                                                <th className="border border-gray-300 px-2 py-2 text-left">Наименование</th>
                                                <th className="border border-gray-300 px-2 py-2 text-center w-20">Кол-во</th>
                                                <th className="border border-gray-300 px-2 py-2 text-right w-24">Цена</th>
                                                <th className="border border-gray-300 px-2 py-2 text-right w-28">Сумма</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedInvoiceOrder.items?.map((item, idx) => (
                                                <tr key={item.id}>
                                                    <td className="border border-gray-300 px-2 py-1">{idx + 1}</td>
                                                    <td className="border border-gray-300 px-2 py-1">{item.product?.name}</td>
                                                    <td className="border border-gray-300 px-2 py-1 text-center">
                                                        {item.shippedQty || item.quantity}
                                                    </td>
                                                    <td className="border border-gray-300 px-2 py-1 text-right">
                                                        {Number(item.price).toFixed(2)}
                                                    </td>
                                                    <td className="border border-gray-300 px-2 py-1 text-right font-medium">
                                                        {Number(item.amount).toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-gray-50 font-bold">
                                                <td colSpan={4} className="border border-gray-300 px-2 py-2 text-right">
                                                    ИТОГО:
                                                </td>
                                                <td className="border border-gray-300 px-2 py-2 text-right text-lg">
                                                    {totalSum.toFixed(2)} ₽
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>

                                    {/* Signature */}
                                    <div className="border-t pt-4">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <div className="text-sm text-gray-500 mb-2">Отпустил:</div>
                                                <div className="border-b border-gray-400 h-8"></div>
                                                <div className="text-xs text-gray-400 mt-1">(подпись, ФИО)</div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-500 mb-2">Получил (подпись клиента):</div>
                                                {selectedInvoiceOrder.signatureUrl ? (
                                                    <div className="border border-gray-300 rounded p-2 bg-gray-50">
                                                        <img
                                                            src={selectedInvoiceOrder.signatureUrl}
                                                            alt="Подпись клиента"
                                                            className="max-h-16 mx-auto"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="border-b border-gray-400 h-8"></div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="mt-6 pt-4 border-t text-center text-xs text-gray-400">
                                        Документ сформирован: {new Date().toLocaleString('ru-RU')} • Meat ERP
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowSignedInvoiceModal(false);
                                    setSelectedInvoiceOrder(null);
                                }}
                            >
                                Закрыть
                            </Button>
                            <Button
                                onClick={downloadSignedInvoice}
                                disabled={downloading || loadingInvoice}
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                            >
                                {downloading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} />
                                        Генерация...
                                    </>
                                ) : (
                                    <>
                                        <Download size={16} />
                                        Скачать накладную PNG
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrdersPage;
