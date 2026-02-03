import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { X } from 'lucide-react';
import { Button } from './ui/Button';

interface OrderItem {
    id: number;
    quantity: number;
    price: number;
    qtyReturn?: number;
    product: {
        id: number;
        name: string;
        code: string;
    };
}

interface ReturnModalProps {
    orderId: number;
    orderNumber: string;
    expeditionId: number;        // Обязательно по ТЗ
    items: OrderItem[];
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
}

interface ReturnItemState {
    orderItemId: number;
    productName: string;
    qtyShip: number;
    qtyReturn: number;
    price: number;
}

export const ReturnModal = ({ orderId, orderNumber, expeditionId, items, isOpen, onClose, onSaved }: ReturnModalProps) => {
    const [returnItems, setReturnItems] = useState<ReturnItemState[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Флаг для предотвращения перезаписи при перерендере (ТЗ §4)
    const isInitialized = useRef(false);

    // Инициализация при открытии
    useEffect(() => {
        if (isOpen && items.length > 0 && !isInitialized.current) {
            loadExistingReturns();
            isInitialized.current = true;
        }

        // Сброс при закрытии
        if (!isOpen) {
            isInitialized.current = false;
        }
    }, [isOpen, items]);

    const loadExistingReturns = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            // API по expeditionId (ТЗ §4)
            const res = await axios.get(`${API_URL}/api/orders/${orderId}/returns/${expeditionId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Инициализируем состояние из позиций заказа
            const initialItems: ReturnItemState[] = items.map(item => {
                // Ищем сохранённый возврат
                const savedReturn = res.data?.items?.find(
                    (ri: any) => ri.orderItemId === item.id
                );

                return {
                    orderItemId: item.id,
                    productName: item.product.name,
                    qtyShip: item.quantity,
                    qtyReturn: savedReturn?.qtyReturn ?? item.qtyReturn ?? 0,
                    price: Number(item.price)
                };
            });

            setReturnItems(initialItems);
        } catch (err: any) {
            console.error('Failed to load returns:', err);
            // Fallback на props (ТЗ §4)
            const initialItems: ReturnItemState[] = items.map(item => ({
                orderItemId: item.id,
                productName: item.product.name,
                qtyShip: item.quantity,
                qtyReturn: item.qtyReturn ?? 0,
                price: Number(item.price)
            }));
            setReturnItems(initialItems);
        } finally {
            setLoading(false);
        }
    };

    // Обновление количества возврата (ТЗ §4: ?? 0, не || '')
    const updateQtyReturn = (orderItemId: number, value: string) => {
        // Позволяем пустую строку и "0."
        const numValue = value === '' ? 0 : parseFloat(value);
        if (!isNaN(numValue)) {
            setReturnItems(prev => prev.map(item =>
                item.orderItemId === orderItemId
                    ? { ...item, qtyReturn: numValue }
                    : item
            ));
        }
        setError(null);
    };

    // Валидация (ТЗ §3.3: 0 ≤ qtyReturn ≤ qtyShip)
    const validationErrors = useMemo(() => {
        const errors: string[] = [];
        for (const item of returnItems) {
            if (item.qtyReturn < 0) {
                errors.push(`${item.productName}: количество не может быть отрицательным`);
            }
            if (item.qtyReturn > item.qtyShip) {
                errors.push(`${item.productName}: количество возврата (${item.qtyReturn}) превышает отгрузку (${item.qtyShip})`);
            }
        }
        return errors;
    }, [returnItems]);

    const isValid = validationErrors.length === 0;

    // Расчёт итогов
    const totals = useMemo(() => {
        let sumShip = 0;
        let sumReturn = 0;
        let totalQtyReturn = 0;

        for (const item of returnItems) {
            sumShip += item.qtyShip * item.price;
            sumReturn += item.qtyReturn * item.price;
            totalQtyReturn += item.qtyReturn;
        }

        return {
            sumShip,
            sumReturn,
            sumNet: sumShip - sumReturn,
            totalQtyReturn
        };
    }, [returnItems]);

    // Сохранение
    const handleSave = async () => {
        if (!isValid) return;

        // Предупреждение если нет возвратов (ТЗ §3.3)
        if (totals.totalQtyReturn === 0) {
            if (!confirm('Возвратов нет. Сохранить нулевой возврат?')) {
                return;
            }
        }

        setSaving(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `${API_URL}/api/orders/${orderId}/returns`,
                {
                    expeditionId,  // Обязательно по ТЗ
                    items: returnItems.map(item => ({
                        orderItemId: item.orderItemId,
                        qtyReturn: item.qtyReturn
                    }))
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            onSaved();
            onClose();
        } catch (err: any) {
            console.error('Failed to save return:', err);
            setError(err.response?.data?.error || 'Ошибка сохранения');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">
                        Возврат по заказу #{orderNumber}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                    {loading && (
                        <div className="text-center py-4 text-gray-500">
                            Загрузка...
                        </div>
                    )}

                    {error && (
                        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                            {error}
                        </div>
                    )}

                    {validationErrors.length > 0 && (
                        <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 rounded-lg">
                            {validationErrors.map((err, i) => (
                                <div key={i}>⚠️ {err}</div>
                            ))}
                        </div>
                    )}

                    {!loading && (
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-sm text-gray-500 border-b">
                                    <th className="pb-2">Товар</th>
                                    <th className="pb-2 text-right">К отгрузке</th>
                                    <th className="pb-2 text-center">Возврат</th>
                                    <th className="pb-2 text-right">Отгружено</th>
                                </tr>
                            </thead>
                            <tbody>
                                {returnItems.map(item => {
                                    const shipped = item.qtyShip - item.qtyReturn;
                                    const hasError = item.qtyReturn < 0 || item.qtyReturn > item.qtyShip;

                                    return (
                                        <tr key={item.orderItemId} className="border-b">
                                            <td className="py-3">
                                                <div className="font-medium">{item.productName}</div>
                                            </td>
                                            <td className="py-3 text-right">
                                                {item.qtyShip.toFixed(2)}
                                            </td>
                                            <td className="py-3 text-center">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max={item.qtyShip}
                                                    value={item.qtyReturn === 0 ? '' : item.qtyReturn}
                                                    onChange={(e) => updateQtyReturn(item.orderItemId, e.target.value)}
                                                    className={`w-20 px-2 py-1 text-center border rounded ${hasError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                                        }`}
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="py-3 text-right font-medium">
                                                {shipped.toFixed(2)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Totals */}
                <div className="p-4 border-t bg-gray-50">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                            <span className="text-gray-500">Сумма к отгрузке:</span>
                            <div className="font-semibold">{totals.sumShip.toLocaleString()} ₽</div>
                        </div>
                        <div>
                            <span className="text-gray-500">Сумма возврата:</span>
                            <div className="font-semibold text-red-600">
                                {totals.sumReturn.toLocaleString()} ₽
                            </div>
                        </div>
                        <div>
                            <span className="text-gray-500">Итого отгружено:</span>
                            <div className="font-semibold text-green-600">
                                {totals.sumNet.toLocaleString()} ₽
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-4 border-t">
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Отмена
                    </Button>
                    <Button onClick={handleSave} disabled={!isValid || saving || loading}>
                        {saving ? 'Сохранение...' : 'Сохранить'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
