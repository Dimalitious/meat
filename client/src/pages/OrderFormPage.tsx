import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useNavigate } from 'react-router-dom';

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
    coefficient: number;
}

interface OrderItem {
    productId: string;
    quantity: number;           // orderQty
    price: number;
    shippedQty: number;         // shippedActualQty
    sumWithRevaluation: number;
    distributionCoef: number;   // %
    weightToDistribute: number;
    // Auto-filled from product
    category: string;
    shortName: string;
}

const PAYMENT_TYPES = [
    { value: 'cash', label: 'Наличка' },
    { value: 'terminal', label: 'Терминал' },
    { value: 'bank', label: 'Безнал' }
];

const OrderFormPage = () => {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    const [formData, setFormData] = useState({
        customerId: '',
        date: new Date().toISOString().split('T')[0],
        paymentType: 'cash',
        items: [] as OrderItem[]
    });

    useEffect(() => {
        const fetchData = async () => {
            const token = localStorage.getItem('token');
            const [custRes, prodRes] = await Promise.all([
                axios.get(`${API_URL}/api/customers`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_URL}/api/products`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setCustomers(custRes.data);
            setProducts(prodRes.data);
        };
        fetchData();
    }, []);

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

        // Auto-fill product details when product changes
        if (field === 'productId') {
            const prod = products.find(p => String(p.id) === String(value));
            if (prod) {
                newItems[index].price = Number(prod.priceMorning) || 0;
                newItems[index].category = prod.category || '';
                newItems[index].shortName = prod.shortNameMorning || '';
            }
        }

        // Recalculate sumWithRevaluation when price or quantity changes
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
            await axios.post(`${API_URL}/api/orders`, {
                customerId: Number(formData.customerId),
                date: formData.date,
                paymentType: formData.paymentType,
                items: formData.items.map(i => ({
                    productId: Number(i.productId),
                    quantity: Number(i.quantity),
                    price: Number(i.price),
                    shippedQty: Number(i.shippedQty),
                    sumWithRevaluation: Number(i.sumWithRevaluation),
                    distributionCoef: Number(i.distributionCoef),
                    weightToDistribute: Number(i.weightToDistribute)
                }))
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            navigate('/orders');
        } catch (err) {
            alert('Ошибка создания заказа');
            console.error(err);
        }
    };

    const totalSum = formData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const totalSumWithRevaluation = formData.items.reduce((sum, item) => sum + item.sumWithRevaluation, 0);

    return (
        <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Новый заказ</h1>
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow">

                {/* Header Fields */}
                <div className="grid grid-cols-3 gap-4 mb-6">
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
                </div>

                {/* Items Table */}
                <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-medium">Товары</h3>
                        <button type="button" onClick={addItem} className="text-blue-600 hover:text-blue-800 font-medium">
                            + Добавить товар
                        </button>
                    </div>

                    {formData.items.length === 0 && (
                        <div className="text-gray-500 italic text-center py-4 bg-gray-50 rounded">
                            Нет товаров. Нажмите добавить.
                        </div>
                    )}

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
                                                    required
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
                    <div className="space-y-1">
                        <div className="text-lg">Итого: <span className="font-bold">{totalSum.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽</span></div>
                        <div className="text-sm text-gray-600">С переоценкой: {totalSumWithRevaluation.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽</div>
                    </div>
                    <button
                        type="submit"
                        className="bg-green-600 text-white px-6 py-2 rounded font-medium hover:bg-green-700"
                        disabled={formData.items.length === 0 || !formData.customerId}
                    >
                        Создать заказ
                    </button>
                </div>

            </form>
        </div>
    );
};

export default OrderFormPage;
