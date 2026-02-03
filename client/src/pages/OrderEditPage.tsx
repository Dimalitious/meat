import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useNavigate, useParams } from 'react-router-dom';

interface Customer {
    id: number;
    name: string;
}

interface Product {
    id: number;
    name: string;
    code: string;
    category: string | null;
    shortNameMorning: string | null;
    priceMorning: number;
}

interface OrderItem {
    id?: number;
    productId: string;
    quantity: number;
    price: number;
    shippedQty: number;
    sumWithRevaluation: number;
    distributionCoef: number;
    weightToDistribute: number;
    category: string;
    shortName: string;
}

const PAYMENT_TYPES = [
    { value: 'cash', label: 'Наличка' },
    { value: 'terminal', label: 'Терминал' },
    { value: 'bank', label: 'Безнал' }
];

const STATUS_OPTIONS = [
    { value: 'NEW', label: 'Новый' },
    { value: 'IN_ASSEMBLY', label: 'На сборке' },
    { value: 'DISTRIBUTING', label: 'Распределяется' },
    { value: 'LOADED', label: 'Погружен' },
    { value: 'SHIPPED', label: 'Отгружен' }
];

const OrderEditPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    const [formData, setFormData] = useState({
        customerId: '',
        date: '',
        paymentType: 'cash',
        status: 'new',
        items: [] as OrderItem[]
    });

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const [custRes, prodRes, orderRes] = await Promise.all([
                axios.get(`${API_URL}/api/customers`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_URL}/api/products`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_URL}/api/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } })
            ]);

            setCustomers(custRes.data);
            setProducts(prodRes.data);

            const order = orderRes.data;
            setFormData({
                customerId: String(order.customerId),
                date: order.date.split('T')[0],
                paymentType: order.paymentType || 'cash',
                status: order.status,
                items: order.items.map((item: any) => ({
                    id: item.id,
                    productId: String(item.productId),
                    quantity: item.quantity,
                    price: Number(item.price),
                    shippedQty: item.shippedQty || 0,
                    sumWithRevaluation: Number(item.sumWithRevaluation) || 0,
                    distributionCoef: item.distributionCoef || 0,
                    weightToDistribute: item.weightToDistribute || 0,
                    category: item.product?.category || '',
                    shortName: item.product?.shortNameMorning || ''
                }))
            });
        } catch (err) {
            console.error('Failed to fetch data:', err);
            alert('Ошибка загрузки заказа');
        } finally {
            setLoading(false);
        }
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, {
                productId: '',
                quantity: 1,
                price: 0,
                shippedQty: 0,
                sumWithRevaluation: 0,
                distributionCoef: 0,
                weightToDistribute: 0,
                category: '',
                shortName: ''
            }]
        });
    };

    const updateItem = (index: number, field: keyof OrderItem, value: any) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };

        if (field === 'productId') {
            const prod = products.find(p => String(p.id) === String(value));
            if (prod) {
                newItems[index].price = Number(prod.priceMorning) || 0;
                newItems[index].category = prod.category || '';
                newItems[index].shortName = prod.shortNameMorning || '';
            }
        }

        if (field === 'price' || field === 'quantity') {
            const item = newItems[index];
            newItems[index].sumWithRevaluation = item.quantity * item.price;
        }

        setFormData({ ...formData, items: newItems });
    };

    const removeItem = (index: number) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            // PATCH-01: Безопасный endpoint /edit, без status
            const payload = {
                customerId: Number(formData.customerId),
                date: formData.date,
                paymentType: formData.paymentType,
                deliveryAddress: (formData as any).deliveryAddress ?? undefined,
                // expeditorId НЕ отправлять через editOrder, см. PATCH-03
                items: formData.items.map(i => ({
                    id: i.id,
                    productId: Number(i.productId),
                    quantity: Number(i.quantity),
                    price: Number(i.price),
                    shippedQty: Number(i.shippedQty),
                    sumWithRevaluation: Number(i.sumWithRevaluation),
                    distributionCoef: Number(i.distributionCoef),
                    weightToDistribute: Number(i.weightToDistribute),
                })),
            };

            await axios.put(`${API_URL}/api/orders/${id}/edit`, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });
            navigate('/orders');
        } catch (err) {
            alert('Ошибка сохранения заказа');
            console.error(err);
        }
    };

    if (loading) return <div className="p-8 text-center">Загрузка...</div>;

    const totalSum = formData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    return (
        <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Редактирование заказа #{id}</h1>
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow">

                {/* Header Fields */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Дата отгрузки</label>
                        <input
                            type="date"
                            required
                            className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
                            value={formData.date}
                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Клиент</label>
                        <select
                            required
                            className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
                            value={formData.customerId}
                            onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                        >
                            <option value="">Выберите клиента...</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Тип оплаты</label>
                        <select
                            className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
                            value={formData.paymentType}
                            onChange={e => setFormData({ ...formData, paymentType: e.target.value })}
                        >
                            {PAYMENT_TYPES.map(pt => (
                                <option key={pt.value} value={pt.value}>{pt.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Статус</label>
                        <select
                            className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                        >
                            {STATUS_OPTIONS.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Items Table */}
                <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-medium">Товары</h3>
                        <button type="button" onClick={addItem} className="text-blue-600 hover:text-blue-800 font-medium">
                            + Добавить товар
                        </button>
                    </div>

                    {formData.items.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="border px-2 py-1 text-left">Товар</th>
                                        <th className="border px-2 py-1 w-20">Категория</th>
                                        <th className="border px-2 py-1 w-24">Короткое</th>
                                        <th className="border px-2 py-1 w-20">Цена</th>
                                        <th className="border px-2 py-1 w-20">Кол-во</th>
                                        <th className="border px-2 py-1 w-20">Факт</th>
                                        <th className="border px-2 py-1 w-24">Сумма переоц.</th>
                                        <th className="border px-2 py-1 w-16">Коэф %</th>
                                        <th className="border px-2 py-1 w-20">Вес распр.</th>
                                        <th className="border px-2 py-1 w-20">Сумма</th>
                                        <th className="border px-2 py-1 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="border px-1 py-1">
                                                <select
                                                    required
                                                    className="w-full border rounded px-1 py-1 text-sm"
                                                    value={item.productId}
                                                    onChange={e => updateItem(idx, 'productId', e.target.value)}
                                                >
                                                    <option value="">Выберите...</option>
                                                    {products.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="border px-1 py-1 text-center text-gray-600 text-xs">
                                                {item.category || '-'}
                                            </td>
                                            <td className="border px-1 py-1 text-center text-gray-600 text-xs">
                                                {item.shortName || '-'}
                                            </td>
                                            <td className="border px-1 py-1">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="w-full border rounded px-1 py-1 text-sm text-right"
                                                    value={item.price}
                                                    onChange={e => updateItem(idx, 'price', parseFloat(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="border px-1 py-1">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.1"
                                                    className="w-full border rounded px-1 py-1 text-sm text-right"
                                                    value={item.quantity}
                                                    onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="border px-1 py-1">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.1"
                                                    className="w-full border rounded px-1 py-1 text-sm text-right"
                                                    value={item.shippedQty}
                                                    onChange={e => updateItem(idx, 'shippedQty', parseFloat(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="border px-1 py-1">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="w-full border rounded px-1 py-1 text-sm text-right"
                                                    value={item.sumWithRevaluation}
                                                    onChange={e => updateItem(idx, 'sumWithRevaluation', parseFloat(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="border px-1 py-1">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="0.1"
                                                    className="w-full border rounded px-1 py-1 text-sm text-right"
                                                    value={item.distributionCoef}
                                                    onChange={e => updateItem(idx, 'distributionCoef', parseFloat(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="border px-1 py-1">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.1"
                                                    className="w-full border rounded px-1 py-1 text-sm text-right"
                                                    value={item.weightToDistribute}
                                                    onChange={e => updateItem(idx, 'weightToDistribute', parseFloat(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="border px-1 py-1 text-right font-medium">
                                                {(item.quantity * item.price).toFixed(2)}
                                            </td>
                                            <td className="border px-1 py-1 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(idx)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    ✕
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center border-t pt-4 mt-4">
                    <div className="text-xl font-bold">Итого: {totalSum.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽</div>
                    <div className="space-x-2">
                        <button
                            type="button"
                            onClick={() => navigate('/orders')}
                            className="bg-gray-200 text-gray-700 px-6 py-2 rounded font-medium hover:bg-gray-300"
                        >
                            Отмена
                        </button>
                        <button
                            type="submit"
                            className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700"
                        >
                            Сохранить изменения
                        </button>
                    </div>
                </div>

            </form>
        </div>
    );
};

export default OrderEditPage;
