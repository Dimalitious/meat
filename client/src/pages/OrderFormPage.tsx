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
    priceMorning: number;
}

interface OrderItem {
    productId: string; // string for select value
    quantity: number;
    price: number;
}

const OrderFormPage = () => {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    const [formData, setFormData] = useState({
        customerId: '',
        date: new Date().toISOString().split('T')[0],
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
            items: [...formData.items, { productId: '', quantity: 1, price: 0 }]
        });
    };

    const updateItem = (index: number, field: keyof OrderItem, value: any) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };

        // Auto-set price if product changes
        if (field === 'productId') {
            const prod = products.find(p => String(p.id) === String(value));
            if (prod) {
                newItems[index].price = Number(prod.priceMorning) || 0;
            }
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
                items: formData.items.map(i => ({
                    productId: Number(i.productId),
                    quantity: Number(i.quantity),
                    price: Number(i.price)
                }))
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            navigate('/orders');
        } catch (err) {
            alert('Error creating order');
            console.error(err);
        }
    };

    const totalSum = formData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Новый заказ (New Order)</h1>
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow">

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Дата (Date)</label>
                        <input
                            type="date"
                            required
                            className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
                            value={formData.date}
                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Клиент (Customer)</label>
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
                </div>

                <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-medium">Товары (Items)</h3>
                        <button type="button" onClick={addItem} className="text-blue-600 hover:text-blue-800 font-medium">+ Добавить товар</button>
                    </div>

                    {formData.items.length === 0 && (
                        <div className="text-gray-500 italic text-center py-4 bg-gray-50 rounded">Нет товаров. Нажмите добавить.</div>
                    )}

                    {formData.items.map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-end mb-2 p-2 bg-gray-50 rounded">
                            <div className="flex-1">
                                <label className="block text-xs text-gray-500">Товар</label>
                                <select
                                    required
                                    className="w-full border rounded px-2 py-1"
                                    value={item.productId}
                                    onChange={e => updateItem(idx, 'productId', e.target.value)}
                                >
                                    <option value="">Select...</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-24">
                                <label className="block text-xs text-gray-500">Кол-во</label>
                                <input
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    required
                                    className="w-full border rounded px-2 py-1"
                                    value={item.quantity}
                                    onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value))}
                                />
                            </div>
                            <div className="w-24">
                                <label className="block text-xs text-gray-500">Цена</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    required
                                    className="w-full border rounded px-2 py-1"
                                    value={item.price}
                                    onChange={e => updateItem(idx, 'price', parseFloat(e.target.value))}
                                />
                            </div>
                            <div className="w-24 text-right">
                                <label className="block text-xs text-gray-500">Сумма</label>
                                <div className="py-1 font-medium">{(item.quantity * item.price).toFixed(2)}</div>
                            </div>
                            <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700 px-2">✕</button>
                        </div>
                    ))}
                </div>

                <div className="flex justify-between items-center border-t pt-4 mt-4">
                    <div className="text-xl font-bold">Итого: {totalSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
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
