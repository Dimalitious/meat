import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Check, Trash2 } from 'lucide-react';

interface OrderItem {
    id: number;
    quantity: number;
    price: number;
    amount: number;
    shippedQty: number;
    qtyReturn?: number;
    product: {
        code: string;
        name: string;
    };
}

interface Order {
    id: number;
    idn: string | null;
    date: string;
    status: string;
    deliveryStatus: string;
    paymentType: string | null;
    totalAmount: number;
    returnTotalSum?: number;
    netTotalSum?: number;
    customer: {
        name: string;
        code: string;
        legalName?: string;
    };
    expeditor?: {
        name: string;
        phone: string | null;
    } | null;
    items: OrderItem[];
}

const PAYMENT_LABELS: { [key: string]: string } = {
    'cash': 'Наличные',
    'terminal': 'Терминал',
    'bank': 'Безнал',
    'Перечисление': 'Перечисление'
};

export default function ExpeditionInvoicePage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [signature, setSignature] = useState<string | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [completing, setCompleting] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);

    useEffect(() => {
        fetchOrder();
    }, [id]);

    // ТЗ §4: переинициализация canvas при order или signature=null
    useEffect(() => {
        if (order && !signature) {
            requestAnimationFrame(() => initCanvas());
        }
    }, [order, signature]);

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

    const initCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // ТЗ §4: использовать devicePixelRatio
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        const context = canvas.getContext('2d');
        if (!context) return;

        context.scale(dpr, dpr);
        context.lineCap = 'round';
        context.strokeStyle = '#000';
        context.lineWidth = 2;
        contextRef.current = context;

        // ТЗ §4: белый фон
        context.fillStyle = '#fff';
        context.fillRect(0, 0, rect.width, rect.height);
    }, []);

    const getCoordinates = (e: React.TouchEvent | React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();

        if ('touches' in e) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        } else {
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        }
    };

    const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
        e.preventDefault();
        const { x, y } = getCoordinates(e);
        contextRef.current?.beginPath();
        contextRef.current?.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isDrawing) return;
        e.preventDefault();
        const { x, y } = getCoordinates(e);
        contextRef.current?.lineTo(x, y);
        contextRef.current?.stroke();
    };

    const stopDrawing = () => {
        contextRef.current?.closePath();
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        const context = contextRef.current;
        if (!canvas || !context) return;

        const rect = canvas.getBoundingClientRect();
        context.fillStyle = '#fff';
        context.fillRect(0, 0, rect.width, rect.height);
    };

    const saveSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dataUrl = canvas.toDataURL('image/png');
        setSignature(dataUrl);
    };

    // ТЗ §4: переподписать — очистить signature и переинициализировать canvas
    const resignSignature = () => {
        setSignature(null);
        // useEffect со signature=null вызовет initCanvas
    };

    const completeOrder = async () => {
        if (!signature) {
            alert('Сначала сохраните подпись клиента');
            return;
        }

        setCompleting(true);
        try {
            const token = localStorage.getItem('token');

            await axios.post(`${API_URL}/api/orders/${id}/complete`, {
                signatureUrl: signature,
                signedInvoiceUrl: signature
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert('Заказ успешно выполнен!');
            navigate('/expedition');
        } catch (err) {
            console.error('Failed to complete order:', err);
            alert('Ошибка выполнения заказа');
        } finally {
            setCompleting(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Загрузка...</div>;
    if (!order) return <div className="p-8 text-center text-red-500">Заказ не найден</div>;

    // ТЗ §3: расчёты строго по shippedQty ?? 0
    const totalGoods = order.items.reduce((sum, item) => {
        const qtyShipped = item.shippedQty ?? 0;
        return sum + qtyShipped * Number(item.price ?? 0);
    }, 0);

    const totalReturn = order.items.reduce((sum, item) => {
        const qtyReturn = item.qtyReturn ?? 0;
        return sum + qtyReturn * Number(item.price ?? 0);
    }, 0);

    const totalNet = totalGoods - totalReturn;
    const hasReturns = totalReturn > 0;
    const isDelivered = order.deliveryStatus === 'delivered';

    return (
        <div className="max-w-2xl mx-auto pb-24">
            {/* Header */}
            <div className="sticky top-0 bg-white z-10 p-4 border-b flex items-center gap-4">
                <button onClick={() => navigate('/expedition')} className="text-gray-600">
                    <ArrowLeft size={24} />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-bold">Накладная #{order.id}</h1>
                    <p className="text-sm text-gray-500">{order.customer.name}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${order.deliveryStatus === 'delivered' ? 'bg-green-100 text-green-800' :
                    order.deliveryStatus === 'in_delivery' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                    }`}>
                    {order.deliveryStatus === 'delivered' ? 'Доставлен' :
                        order.deliveryStatus === 'in_delivery' ? 'В пути' : 'К доставке'}
                </span>
            </div>

            {/* Invoice Info */}
            <div className="p-4 bg-gray-50 border-b">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <div className="text-gray-500">Дата</div>
                        <div className="font-medium">{new Date(order.date).toLocaleDateString('ru-RU')}</div>
                    </div>
                    <div>
                        <div className="text-gray-500">Оплата</div>
                        <div className="font-medium">{PAYMENT_LABELS[order.paymentType || ''] || '-'}</div>
                    </div>
                    {order.idn && (
                        <div>
                            <div className="text-gray-500">IDN</div>
                            <div className="font-mono">{order.idn}</div>
                        </div>
                    )}
                    {order.expeditor && (
                        <div>
                            <div className="text-gray-500">Экспедитор</div>
                            <div className="font-medium">{order.expeditor.name}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* ТЗ §3: Items Table - 8 columns */}
            <div className="p-4">
                <h2 className="font-semibold mb-3">Товары ({order.items.length})</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="border border-gray-200 px-2 py-2 text-left font-medium">Товар</th>
                                <th className="border border-gray-200 px-2 py-2 text-center font-medium">Отгрузка</th>
                                <th className="border border-gray-200 px-2 py-2 text-right font-medium">Кол-во</th>
                                <th className="border border-gray-200 px-2 py-2 text-right font-medium">Возврат</th>
                                <th className="border border-gray-200 px-2 py-2 text-right font-medium">Цена</th>
                                <th className="border border-gray-200 px-2 py-2 text-right font-medium">Сумма</th>
                                <th className="border border-gray-200 px-2 py-2 text-right font-medium">Возвр.</th>
                                <th className="border border-gray-200 px-2 py-2 text-right font-medium">Итого</th>
                            </tr>
                        </thead>
                        <tbody>
                            {order.items.map((item) => {
                                // ТЗ §3: строго shippedQty ?? 0, НЕ ||
                                const qtyShipped = item.shippedQty ?? 0;
                                const qtyReturn = item.qtyReturn ?? 0;
                                const price = Number(item.price ?? 0);
                                const sumGoods = qtyShipped * price;
                                const sumReturn = qtyReturn * price;
                                const sumNet = sumGoods - sumReturn;

                                return (
                                    <tr key={item.id} className="border-b border-gray-200">
                                        <td className="border border-gray-200 px-2 py-2">
                                            <div className="font-medium">{item.product.name}</div>
                                            <div className="text-xs text-gray-400">{item.product.code}</div>
                                        </td>
                                        <td className="border border-gray-200 px-2 py-2 text-center text-xs text-gray-500">
                                            {qtyShipped.toFixed(2)}
                                        </td>
                                        <td className="border border-gray-200 px-2 py-2 text-right">
                                            {qtyShipped.toFixed(2)}
                                        </td>
                                        <td className="border border-gray-200 px-2 py-2 text-right text-red-600">
                                            {qtyReturn > 0 ? qtyReturn.toFixed(2) : '—'}
                                        </td>
                                        <td className="border border-gray-200 px-2 py-2 text-right">
                                            {price.toFixed(2)}
                                        </td>
                                        <td className="border border-gray-200 px-2 py-2 text-right">
                                            {sumGoods.toFixed(2)}
                                        </td>
                                        <td className="border border-gray-200 px-2 py-2 text-right text-red-600">
                                            {sumReturn > 0 ? `-${sumReturn.toFixed(2)}` : '—'}
                                        </td>
                                        <td className="border border-gray-200 px-2 py-2 text-right font-medium">
                                            {sumNet.toFixed(2)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Totals */}
                <div className="mt-4 pt-4 border-t space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-600">Сумма товаров:</span>
                        <span className="font-medium">{totalGoods.toFixed(2)} ₽</span>
                    </div>
                    {hasReturns && (
                        <div className="flex justify-between items-center text-red-600">
                            <span>Возвраты:</span>
                            <span className="font-medium">-{totalReturn.toFixed(2)} ₽</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t">
                        <span className="font-bold text-lg">ИТОГО:</span>
                        <span className="font-bold text-xl text-green-600">{totalNet.toFixed(2)} ₽</span>
                    </div>
                </div>
            </div>

            {/* Signature Section */}
            {!isDelivered && (
                <div className="p-4 border-t">
                    <h2 className="font-semibold mb-3">Подпись заказчика</h2>

                    {signature ? (
                        <div className="space-y-3">
                            <div className="border-2 border-green-500 rounded-lg p-2 bg-green-50">
                                <img src={signature} alt="Подпись" className="w-full h-32 object-contain" />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={resignSignature}
                                >
                                    <Trash2 size={16} className="mr-1" /> Переподписать
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white">
                                {/* ТЗ §4: touch-action: none */}
                                <canvas
                                    ref={canvasRef}
                                    className="w-full"
                                    style={{ height: '150px', touchAction: 'none' }}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                />
                            </div>
                            <p className="text-xs text-gray-500 text-center">
                                Подпишитесь пальцем в поле выше
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={clearSignature}>
                                    Очистить
                                </Button>
                                <Button className="flex-1" onClick={saveSignature}>
                                    Сохранить подпись
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Complete Button - ТЗ §5: disabled без подписи */}
            {!isDelivered && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
                    <Button
                        className="w-full py-4 text-lg bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2"
                        onClick={completeOrder}
                        disabled={!signature || completing}
                    >
                        {completing ? (
                            'Сохранение...'
                        ) : (
                            <>
                                <Check size={20} /> Выполнить заказ
                            </>
                        )}
                    </Button>
                    {!signature && (
                        <p className="text-xs text-center text-gray-500 mt-2">
                            Для завершения заказа получите подпись клиента
                        </p>
                    )}
                </div>
            )}

            {/* Already Delivered */}
            {isDelivered && (
                <div className="p-4 bg-green-50 border-t">
                    <div className="text-center text-green-700">
                        <Check size={48} className="mx-auto mb-2" />
                        <div className="font-bold text-lg">Заказ выполнен</div>
                        <div className="text-sm">Накладная подписана и сохранена</div>
                    </div>
                </div>
            )}
        </div>
    );
}
