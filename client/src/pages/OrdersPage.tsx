import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Link } from 'react-router-dom';
import { Button } from "../components/ui/Button";
import {
    Plus, Printer, X, FileCheck, Download, Loader2,
    UserPlus, Filter, RefreshCw, Calendar, Check, Power, Edit2
} from 'lucide-react';
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
    returnTotalSum?: number;     // Возвраты из точек
    netTotalSum?: number;        // Сумма за минусом возвратов
    status: string;
    paymentType?: string;
    expeditorId: number | null;
    expeditor?: { id: number; name: string; phone?: string } | null;
    signatureUrl?: string | null;
    signedInvoiceUrl?: string | null;
    deliveryStatus?: string;
    completedAt?: string | null;
    isEdited?: boolean;  // ТЗ v2 §7: Флаг редактирования
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

const STATUS_LABELS: { [key: string]: string } = {
    'new': 'Новый',
    'assigned': 'Назначен',
    'processing': 'В обработке',
    'in_delivery': 'В доставке',
    'delivered': 'Доставлен',
    'rework': 'На доработке',
    'cancelled': 'Отменён'
};

const OrdersPage = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [expeditors, setExpeditors] = useState<Expeditor[]>([]);
    const [showExpeditorModal, setShowExpeditorModal] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
    const [searchExpeditor, setSearchExpeditor] = useState('');

    // Date filters - default: last week
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const [dateFrom, setDateFrom] = useState(weekAgo);
    const [dateTo, setDateTo] = useState(today);

    // Selection for disable
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [disabling, setDisabling] = useState(false);

    // Signed invoice modal
    const [showSignedInvoiceModal, setShowSignedInvoiceModal] = useState(false);
    const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
    const [loadingInvoice, setLoadingInvoice] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const invoiceRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchExpeditors();
        // Fetch orders on mount with default dates
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        setSelectedIds(new Set());
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            if (dateFrom) params.append('dateFrom', dateFrom);
            if (dateTo) params.append('dateTo', dateTo);

            const res = await axios.get(`${API_URL}/api/orders?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setOrders(res.data);
        } catch (err) {
            console.error('Failed to fetch orders:', err);
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

    const toggleSelectAll = () => {
        if (selectedIds.size === orders.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(orders.map(o => o.id)));
        }
    };

    const toggleSelect = (id: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleDisableSelected = async () => {
        if (selectedIds.size === 0) {
            alert('Выберите заказы для отключения');
            return;
        }

        if (!window.confirm(`Выключить выбранные заказы (${selectedIds.size})? Они пропадут из списка.`)) {
            return;
        }

        setDisabling(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/orders/disable`,
                { ids: Array.from(selectedIds) },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Refresh the list
            await fetchOrders();
            alert(`${selectedIds.size} заказ(ов) выключено`);
        } catch (err) {
            console.error('Failed to disable orders:', err);
            alert('Ошибка при отключении заказов');
        } finally {
            setDisabling(false);
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

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ru-RU');
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'new': return 'bg-yellow-100 text-yellow-800';
            case 'assigned': return 'bg-purple-100 text-purple-800';
            case 'processing': return 'bg-primary-100 text-primary-800';
            case 'in_delivery': return 'bg-blue-100 text-blue-800';
            case 'delivered': return 'bg-emerald-100 text-emerald-800';
            case 'rework': return 'bg-orange-100 text-orange-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const totalSum = selectedInvoiceOrder?.items?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;

    return (
        <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    Журнал заказов
                </h1>
                <Link to="/orders/new">
                    <Button>
                        <Plus size={16} className="mr-2" />
                        Новый заказ
                    </Button>
                </Link>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4 mb-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <Filter size={18} className="text-gray-500" />
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">С:</label>
                        <div className="relative">
                            <Calendar size={16} className="absolute left-2 top-2.5 text-gray-400" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="border rounded pl-8 pr-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">По:</label>
                        <div className="relative">
                            <Calendar size={16} className="absolute left-2 top-2.5 text-gray-400" />
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="border rounded pl-8 pr-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                    <Button onClick={fetchOrders} variant="outline" disabled={loading}>
                        <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Сформировать
                    </Button>
                </div>
            </div>

            {/* Action Bar */}
            <div className="bg-white rounded-lg shadow p-3 mb-4 flex items-center gap-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisableSelected}
                    disabled={selectedIds.size === 0 || disabling}
                    className={selectedIds.size > 0 ? 'border-red-300 text-red-700 hover:bg-red-50' : ''}
                >
                    <Power size={16} className="mr-2" />
                    Выключить выбранные {selectedIds.size > 0 && `(${selectedIds.size})`}
                </Button>

                {selectedIds.size > 0 && (
                    <span className="text-sm text-gray-500">
                        Выбрано: {selectedIds.size} из {orders.length}
                    </span>
                )}
            </div>

            {/* Table */}
            <div className="rounded-md border border-slate-200 overflow-hidden bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                            <TableHead className="w-[50px]">
                                <button
                                    onClick={toggleSelectAll}
                                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.size === orders.length && orders.length > 0
                                        ? 'bg-blue-600 border-blue-600 text-white'
                                        : 'border-gray-300 hover:border-gray-400'
                                        }`}
                                >
                                    {selectedIds.size === orders.length && orders.length > 0 && (
                                        <Check size={14} />
                                    )}
                                </button>
                            </TableHead>
                            <TableHead className="w-[80px]">№</TableHead>
                            <TableHead className="w-[110px]">Дата</TableHead>
                            <TableHead className="w-[100px]">№ Сводки</TableHead>
                            <TableHead>Клиент</TableHead>
                            <TableHead className="w-[120px] text-right">Сумма</TableHead>
                            <TableHead className="w-[110px] text-right">Возвраты</TableHead>
                            <TableHead className="w-[120px]">Экспедитор</TableHead>
                            <TableHead className="w-[100px]">Накладная</TableHead>
                            <TableHead className="w-[110px]">Статус</TableHead>
                            <TableHead className="text-right w-[200px]">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={11} className="h-24 text-center text-slate-500">
                                    <RefreshCw size={20} className="animate-spin inline mr-2" />
                                    Загрузка...
                                </TableCell>
                            </TableRow>
                        ) : orders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={11} className="h-24 text-center text-slate-500">
                                    Нет заказов за выбранный период
                                </TableCell>
                            </TableRow>
                        ) : (
                            orders.map((o) => (
                                <TableRow
                                    key={o.id}
                                    className={selectedIds.has(o.id) ? 'bg-blue-50' : ''}
                                >
                                    <TableCell>
                                        <button
                                            onClick={() => toggleSelect(o.id)}
                                            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.has(o.id)
                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                : 'border-gray-300 hover:border-gray-400'
                                                }`}
                                        >
                                            {selectedIds.has(o.id) && <Check size={14} />}
                                        </button>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <span>#{o.id}</span>
                                        {o.isEdited && (
                                            <span
                                                className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-100 text-amber-700"
                                                title="Заказ был отредактирован"
                                            >
                                                изм.
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>{formatDate(o.date)}</TableCell>
                                    <TableCell className="text-gray-500 font-mono text-xs">
                                        {o.idn || '—'}
                                    </TableCell>
                                    <TableCell className="font-medium text-slate-700">{o.customer?.name}</TableCell>
                                    <TableCell className="text-right font-medium">
                                        {Number(o.totalAmount).toLocaleString('ru-RU')} ₽
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {(o.returnTotalSum && Number(o.returnTotalSum) > 0) ? (
                                            <span className="text-red-600 font-medium">
                                                -{Number(o.returnTotalSum).toLocaleString('ru-RU')} ₽
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {o.expeditor ? (
                                            <span className="text-purple-600 font-medium text-sm">
                                                {o.expeditor.name}
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => openExpeditorModal(o.id)}
                                                className="text-gray-400 hover:text-purple-600 text-sm flex items-center gap-1"
                                            >
                                                <UserPlus size={14} />
                                                Назначить
                                            </button>
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
                                        <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${getStatusStyle(o.status)}`}>
                                            {STATUS_LABELS[o.status] || o.status}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Link to={`/orders/${o.id}`}>
                                                <Button variant="outline" size="sm" title="Редактировать">
                                                    <Edit2 size={14} />
                                                </Button>
                                            </Link>
                                            <Link to={`/orders/${o.id}/print`}>
                                                <Button variant="outline" size="sm" title="Печать накладной">
                                                    <Printer size={14} />
                                                </Button>
                                            </Link>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Footer info */}
            {orders.length > 0 && (
                <div className="mt-4 flex justify-between items-center text-sm text-gray-500">
                    <span>Всего заказов: {orders.length}</span>
                    <span>
                        Общая сумма: {orders.reduce((sum, o) => sum + Number(o.totalAmount), 0).toLocaleString('ru-RU')} ₽
                    </span>
                </div>
            )}

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
                                            от {formatDate(selectedInvoiceOrder.date)}
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

