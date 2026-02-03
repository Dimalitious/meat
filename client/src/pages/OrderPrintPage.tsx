import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';

interface OrderItem {
    id: number;
    quantity: number;
    price: number;
    amount: number;
    shippedQty: number;
    qtyReturn?: number;         // Кол-во возврата
    product: {
        code: string;
        name: string;
        category: string | null;
    };
}

interface Order {
    id: number;
    idn: string | null;
    date: string;
    status: string;
    paymentType: string | null;
    totalAmount: number;
    totalWeight: number;
    returnTotalSum?: number;    // Сумма возвратов
    customer: {
        id: number;
        name: string;
        code: string;
        legalName?: string;
    };
    expeditor?: {
        name: string;
        phone: string | null;
    } | null;
    items: OrderItem[];
    createdAt: string;
}

const PAYMENT_LABELS: { [key: string]: string } = {
    'cash': 'Наличные',
    'terminal': 'Терминал',
    'bank': 'Безнал',
    'Перечисление': 'Перечисление'
};

// Maximum rows per invoice to fit 2 copies on A4
const MAX_ITEMS_PER_INVOICE = 15;

export default function OrderPrintPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const printRef = useRef<HTMLDivElement>(null);

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

    const handlePrint = () => {
        window.print();
    };

    if (loading) return <div className="p-8 text-center">Загрузка...</div>;
    if (!order) return <div className="p-8 text-center text-red-500">Заказ не найден</div>;

    const totalSum = order.items.reduce((sum, item) => sum + Number(item.amount), 0);
    const totalReturn = order.items.reduce((sum, item) => {
        const returnAmt = (item.qtyReturn || 0) * Number(item.price);
        return sum + returnAmt;
    }, 0);
    const netSum = totalSum - totalReturn;
    const hasReturns = totalReturn > 0;
    const displayItems = order.items.slice(0, MAX_ITEMS_PER_INVOICE);
    const hasMoreItems = order.items.length > MAX_ITEMS_PER_INVOICE;

    // Single invoice component
    const InvoiceCopy = ({ copyNumber }: { copyNumber: number }) => (
        <div className="invoice-copy" style={{
            pageBreakInside: 'avoid',
            padding: '8mm',
            fontSize: '9pt',
            fontFamily: 'Arial, sans-serif',
            height: 'calc(50% - 2mm)',
            boxSizing: 'border-box',
            borderBottom: copyNumber === 1 ? '1px dashed #999' : 'none'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6pt' }}>
                <div>
                    <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>
                        НАКЛАДНАЯ №{order.id}
                    </div>
                    <div style={{ fontSize: '8pt', color: '#666' }}>
                        {order.idn && `IDN: ${order.idn}`}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10pt' }}>
                        от {new Date(order.date).toLocaleDateString('ru-RU')}
                    </div>
                    <div style={{ fontSize: '8pt', color: '#666' }}>
                        {copyNumber === 1 ? 'Экземпляр продавца' : 'Экземпляр покупателя'}
                    </div>
                </div>
            </div>

            {/* Customer Info */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8pt',
                marginBottom: '8pt',
                fontSize: '8pt'
            }}>
                <div>
                    <strong>Покупатель:</strong> {order.customer.name}
                    {order.customer.legalName && <div style={{ color: '#666' }}>{order.customer.legalName}</div>}
                </div>
                <div>
                    <strong>Оплата:</strong> {PAYMENT_LABELS[order.paymentType || ''] || order.paymentType || '-'}
                    {order.expeditor && (
                        <div><strong>Экспедитор:</strong> {order.expeditor.name}</div>
                    )}
                </div>
            </div>

            {/* Items Table */}
            <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '8pt',
                marginBottom: '6pt'
            }}>
                <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                        <th style={{ border: '1px solid #ccc', padding: '2pt 4pt', textAlign: 'left', width: '5%' }}>№</th>
                        <th style={{ border: '1px solid #ccc', padding: '2pt 4pt', textAlign: 'left', width: '45%' }}>Наименование</th>
                        <th style={{ border: '1px solid #ccc', padding: '2pt 4pt', textAlign: 'center', width: '10%' }}>Кол-во</th>
                        <th style={{ border: '1px solid #ccc', padding: '2pt 4pt', textAlign: 'right', width: '15%' }}>Цена</th>
                        <th style={{ border: '1px solid #ccc', padding: '2pt 4pt', textAlign: 'right', width: '15%' }}>Сумма</th>
                    </tr>
                </thead>
                <tbody>
                    {displayItems.map((item, idx) => (
                        <tr key={item.id}>
                            <td style={{ border: '1px solid #ccc', padding: '2pt 4pt' }}>{idx + 1}</td>
                            <td style={{ border: '1px solid #ccc', padding: '2pt 4pt' }}>{item.product.name}</td>
                            <td style={{ border: '1px solid #ccc', padding: '2pt 4pt', textAlign: 'center' }}>
                                {item.shippedQty || item.quantity}
                            </td>
                            <td style={{ border: '1px solid #ccc', padding: '2pt 4pt', textAlign: 'right' }}>
                                {Number(item.price).toFixed(2)}
                            </td>
                            <td style={{ border: '1px solid #ccc', padding: '2pt 4pt', textAlign: 'right' }}>
                                {Number(item.amount).toFixed(2)}
                            </td>
                        </tr>
                    ))}
                    {hasMoreItems && (
                        <tr>
                            <td colSpan={5} style={{
                                border: '1px solid #ccc',
                                padding: '2pt 4pt',
                                textAlign: 'center',
                                fontStyle: 'italic',
                                color: '#666'
                            }}>
                                ... и ещё {order.items.length - MAX_ITEMS_PER_INVOICE} позиций (всего: {order.items.length})
                            </td>
                        </tr>
                    )}
                </tbody>
                <tfoot>
                    <tr style={{ fontWeight: 'bold' }}>
                        <td colSpan={4} style={{ border: '1px solid #ccc', padding: '2pt 4pt', textAlign: 'right' }}>
                            Сумма отгрузки:
                        </td>
                        <td style={{ border: '1px solid #ccc', padding: '2pt 4pt', textAlign: 'right' }}>
                            {totalSum.toFixed(2)} ₽
                        </td>
                    </tr>
                    {hasReturns && (
                        <>
                            <tr style={{ color: '#dc2626' }}>
                                <td colSpan={4} style={{ border: '1px solid #ccc', padding: '2pt 4pt', textAlign: 'right' }}>
                                    Возвраты:
                                </td>
                                <td style={{ border: '1px solid #ccc', padding: '2pt 4pt', textAlign: 'right' }}>
                                    -{totalReturn.toFixed(2)} ₽
                                </td>
                            </tr>
                            <tr style={{ fontWeight: 'bold' }}>
                                <td colSpan={4} style={{ border: '1px solid #ccc', padding: '2pt 4pt', textAlign: 'right' }}>
                                    ИТОГО:
                                </td>
                                <td style={{ border: '1px solid #ccc', padding: '2pt 4pt', textAlign: 'right' }}>
                                    {netSum.toFixed(2)} ₽
                                </td>
                            </tr>
                        </>
                    )}
                </tfoot>
            </table>

            {/* Footer */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16pt',
                marginTop: '8pt',
                fontSize: '8pt'
            }}>
                <div>
                    <div style={{ marginBottom: '4pt' }}>Отпустил: ____________________</div>
                    <div style={{ color: '#666' }}>(подпись, ФИО)</div>
                </div>
                <div>
                    <div style={{ marginBottom: '4pt' }}>Получил: ____________________</div>
                    <div style={{ color: '#666' }}>(подпись заказчика)</div>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Print Controls - hidden when printing */}
            <div className="print:hidden p-4 bg-gray-100 flex justify-between items-center mb-4">
                <Button variant="outline" onClick={() => navigate(`/orders/${id}`)}>
                    ← Назад к заказу
                </Button>
                <div className="flex gap-2">
                    <Button onClick={handlePrint}>
                        🖨️ Печать
                    </Button>
                </div>
            </div>

            {/* Print Area */}
            <div
                ref={printRef}
                className="print-area bg-white"
                style={{
                    width: '210mm',
                    minHeight: '297mm',
                    margin: '0 auto',
                    padding: '0',
                    boxSizing: 'border-box'
                }}
            >
                {/* Copy 1 - Seller's copy */}
                <InvoiceCopy copyNumber={1} />

                {/* Copy 2 - Buyer's copy */}
                <InvoiceCopy copyNumber={2} />
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 10mm;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    .print-area {
                        width: 100% !important;
                        margin: 0 !important;
                    }
                    .invoice-copy {
                        page-break-inside: avoid;
                    }
                }
            `}</style>
        </>
    );
}
