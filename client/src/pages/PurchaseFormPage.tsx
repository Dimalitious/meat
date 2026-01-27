import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';

// ============================================
// ТИПЫ
// ============================================

interface Supplier {
    id: number;
    code: string;
    name: string;
}

interface Product {
    id: number;
    code: string;
    name: string;
    priceListName?: string;
}

interface PaymentType {
    id: number;
    name: string;
    isDefault?: boolean;
    isDisabled?: boolean;
}

interface PurchaseItem {
    id?: number;
    supplierId: number;
    productId: number;
    product?: Product;
    price: number;
    qty: number;
    amount: number;
    paymentTypeId: number | null;
}

interface MmlItem {
    productId: number;
    product: Product;
    price: number;
}

// ============================================
// КОМПОНЕНТ
// ============================================

const PurchaseFormPage: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditMode = !!id && id !== 'new';

    // Основные данные формы
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedSuppliers, setSelectedSuppliers] = useState<Supplier[]>([]);
    const [items, setItems] = useState<PurchaseItem[]>([]);
    const [idn, setIdn] = useState<string | null>(null);  // IDN закупки

    // Справочники
    const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);

    // Тип оплаты по умолчанию (используем ref для доступа в асинхронных функциях)
    const defaultPaymentTypeIdRef = useRef<number | null>(null);

    // Выбранный поставщик в левой панели
    const [activeSupplier, setActiveSupplier] = useState<Supplier | null>(null);

    // Модальные окна
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [addedProductIds, setAddedProductIds] = useState<Set<number>>(new Set());

    // Состояние
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const getHeaders = () => ({
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });

    // ============================================
    // ЗАГРУЗКА ДАННЫХ
    // ============================================

    // Загрузка справочников и типа оплаты по умолчанию
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [suppliersRes, productsRes, paymentTypesRes, defaultPtRes] = await Promise.all([
                    axios.get(`${API_URL}/api/suppliers`, getHeaders()),
                    axios.get(`${API_URL}/api/products`, getHeaders()),
                    axios.get(`${API_URL}/api/payment-types`, getHeaders()),
                    axios.get(`${API_URL}/api/payment-types/default`, getHeaders()).catch(() => null)
                ]);

                setAllSuppliers(suppliersRes.data.filter((s: any) => s.isActive !== false));
                setAllProducts(productsRes.data.filter((p: any) => p.status === 'active'));
                setPaymentTypes(paymentTypesRes.data.filter((pt: PaymentType) => !pt.isDisabled));

                // Установка типа оплаты по умолчанию
                if (defaultPtRes && defaultPtRes.data) {
                    defaultPaymentTypeIdRef.current = defaultPtRes.data.id;
                } else {
                    // Fallback: ищем "Перечисление" или берём первый
                    const ptList = paymentTypesRes.data.filter((pt: PaymentType) => !pt.isDisabled);
                    const perechislenie = ptList.find((pt: PaymentType) => pt.name === 'Перечисление');
                    const fallbackId = perechislenie?.id || ptList[0]?.id || null;
                    defaultPaymentTypeIdRef.current = fallbackId;
                }
            } catch (error) {
                console.error('Error loading dictionaries:', error);
            }
        };

        fetchData();
    }, []);

    // Загрузка существующей закупки
    useEffect(() => {
        if (isEditMode) {
            setLoading(true);
            axios.get(`${API_URL}/api/purchases/${id}`, getHeaders())
                .then(res => {
                    const data = res.data;
                    setPurchaseDate(data.purchaseDate.split('T')[0]);
                    setIdn(data.idn || null);  // Загружаем IDN

                    // Восстановить поставщиков
                    const suppliers = data.suppliers.map((s: any) => s.supplier);
                    setSelectedSuppliers(suppliers);
                    if (suppliers.length > 0) {
                        setActiveSupplier(suppliers[0]);
                    }

                    // Восстановить items (сохраняем оригинальный paymentTypeId)
                    setItems(data.items.map((item: any) => ({
                        id: item.id,
                        supplierId: item.supplierId,
                        productId: item.productId,
                        product: item.product,
                        price: Number(item.price),
                        qty: Number(item.qty),
                        amount: Number(item.amount),
                        paymentTypeId: item.paymentTypeId
                    })));
                })
                .catch(err => {
                    console.error('Error loading purchase:', err);
                    setError('Ошибка загрузки закупки');
                })
                .finally(() => setLoading(false));
        }
    }, [id, isEditMode]);

    // ============================================
    // ПОСТАВЩИКИ
    // ============================================

    const filteredSuppliers = useMemo(() => {
        const search = supplierSearch.toLowerCase();
        return allSuppliers.filter(s =>
            !selectedSuppliers.some(sel => sel.id === s.id) &&
            (s.name.toLowerCase().includes(search) || s.code.toLowerCase().includes(search))
        );
    }, [allSuppliers, selectedSuppliers, supplierSearch]);

    const addSupplier = async (supplier: Supplier) => {
        setSelectedSuppliers(prev => [...prev, supplier]);
        setIsSupplierModalOpen(false);
        setSupplierSearch('');

        // Загрузить MML поставщика
        try {
            const res = await axios.get(
                `${API_URL}/api/purchases/supplier/${supplier.id}/mml?purchaseDate=${purchaseDate}`,
                getHeaders()
            );
            const data = res.data;
            if (data.items && data.items.length > 0) {
                // При добавлении строк из MML - устанавливаем тип оплаты по умолчанию
                const defaultPtId = defaultPaymentTypeIdRef.current;
                const newItems: PurchaseItem[] = data.items.map((mmlItem: MmlItem) => ({
                    supplierId: supplier.id,
                    productId: mmlItem.productId,
                    product: mmlItem.product,
                    price: Number(mmlItem.price) || 0,
                    qty: 0,
                    amount: 0,
                    paymentTypeId: defaultPtId  // Устанавливаем "Перечисление" по умолчанию
                }));
                setItems(prev => [...prev, ...newItems]);
            }
        } catch (error) {
            console.error('Error loading supplier MML:', error);
        }

        setActiveSupplier(supplier);
    };

    const removeSupplier = (supplierId: number) => {
        setSelectedSuppliers(prev => prev.filter(s => s.id !== supplierId));
        setItems(prev => prev.filter(i => i.supplierId !== supplierId));
        if (activeSupplier?.id === supplierId) {
            const remaining = selectedSuppliers.filter(s => s.id !== supplierId);
            setActiveSupplier(remaining.length > 0 ? remaining[0] : null);
        }
    };

    // ============================================
    // ТОВАРЫ
    // ============================================

    const activeSupplierItems = useMemo(() => {
        if (!activeSupplier) return [];
        return items.filter(i => i.supplierId === activeSupplier.id);
    }, [items, activeSupplier]);

    const filteredProducts = useMemo(() => {
        if (!activeSupplier) return [];
        const search = productSearch.toLowerCase();
        const existingProductIds = new Set(
            items.filter(i => i.supplierId === activeSupplier.id).map(i => i.productId)
        );
        return allProducts.filter(p =>
            !existingProductIds.has(p.id) &&
            (p.name.toLowerCase().includes(search) || p.code.toLowerCase().includes(search))
        );
    }, [allProducts, items, activeSupplier, productSearch]);

    const addProduct = async (product: Product) => {
        if (!activeSupplier) return;

        // Получить последнюю цену
        let price = 0;
        try {
            const res = await axios.get(
                `${API_URL}/api/purchases/supplier/${activeSupplier.id}/product/${product.id}/price?purchaseDate=${purchaseDate}`,
                getHeaders()
            );
            price = Number(res.data.price) || 0;
        } catch (error) {
            console.error('Error fetching price:', error);
        }

        // При добавлении нового товара - устанавливаем тип оплаты по умолчанию
        const newItem: PurchaseItem = {
            supplierId: activeSupplier.id,
            productId: product.id,
            product,
            price,
            qty: 0,
            amount: 0,
            paymentTypeId: defaultPaymentTypeIdRef.current  // Устанавливаем "Перечисление" по умолчанию
        };

        setItems(prev => [...prev, newItem]);
        // Отмечаем товар как добавленный (не закрываем модальное окно)
        setAddedProductIds(prev => new Set(prev).add(product.id));
    };

    const removeItem = (supplierId: number, productId: number) => {
        setItems(prev => prev.filter(i => !(i.supplierId === supplierId && i.productId === productId)));
    };

    const updateItem = (supplierId: number, productId: number, field: keyof PurchaseItem, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.supplierId === supplierId && item.productId === productId) {
                const updated = { ...item, [field]: value };
                // Пересчёт суммы
                if (field === 'price' || field === 'qty') {
                    updated.amount = (Number(updated.price) || 0) * (Number(updated.qty) || 0);
                }
                return updated;
            }
            return item;
        }));
    };

    // ============================================
    // РАСЧЁТЫ
    // ============================================

    const totalAmount = useMemo(() => {
        return items.reduce((sum, item) => sum + (item.amount || 0), 0);
    }, [items]);

    const supplierTotals = useMemo(() => {
        const totals: Record<number, number> = {};
        for (const item of items) {
            totals[item.supplierId] = (totals[item.supplierId] || 0) + (item.amount || 0);
        }
        return totals;
    }, [items]);

    // ============================================
    // СОХРАНЕНИЕ
    // ============================================

    const validate = (): string | null => {
        if (!purchaseDate) return 'Укажите дату закупки';
        if (selectedSuppliers.length === 0) return 'Добавьте хотя бы одного поставщика';
        if (items.length === 0) return 'Добавьте хотя бы один товар';

        const itemsWithQty = items.filter(i => i.qty > 0);
        if (itemsWithQty.length === 0) return 'У всех товаров количество равно 0';

        for (const item of itemsWithQty) {
            if (!item.paymentTypeId) {
                return 'Укажите тип оплаты для всех товаров с количеством > 0';
            }
        }

        return null;
    };

    const handleSave = async () => {
        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        setError('');
        setSaving(true);

        try {
            const payload = {
                purchaseDate,
                suppliers: selectedSuppliers.map(s => s.id),
                items: items.filter(i => i.qty > 0).map(i => ({
                    supplierId: i.supplierId,
                    productId: i.productId,
                    price: i.price,
                    qty: i.qty,
                    paymentTypeId: i.paymentTypeId
                }))
            };

            if (isEditMode) {
                await axios.put(`${API_URL}/api/purchases/${id}`, payload, getHeaders());
            } else {
                await axios.post(`${API_URL}/api/purchases`, payload, getHeaders());
            }
            navigate('/purchases');
        } catch (error: any) {
            setError(error.response?.data?.error || 'Ошибка при сохранении');
        } finally {
            setSaving(false);
        }
    };

    // ============================================
    // РЕНДЕР
    // ============================================

    const formatCurrency = (amount: number) => {
        if (amount === 0 || amount === null || amount === undefined) return '—';
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'KZT',
            minimumFractionDigits: 0
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="p-8 text-center text-slate-500">
                Загрузка данных закупки...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Шапка */}
            <div className="flex justify-between items-center flex-wrap gap-4">
                <h1 className="text-2xl font-bold text-slate-900">
                    {isEditMode ? `Редактирование закупки #${id}` : 'Новая закупка'}
                </h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate('/purchases')}
                        className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                        ← Назад к журналу
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saving ? 'Сохранение...' : '💾 Сохранить закупку'}
                    </button>
                </div>
            </div>

            {/* Дата и итого */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-wrap gap-4 items-center">
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Дата закупки</label>
                    <input
                        type="date"
                        value={purchaseDate}
                        onChange={(e) => setPurchaseDate(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                </div>
                <div className="ml-auto flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg">
                    <span className="text-sm opacity-90">Итого:</span>
                    <span className="text-lg font-bold">{formatCurrency(totalAmount)}</span>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* Основной контент: 2 панели */}
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
                {/* Левая панель: Поставщики */}
                <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">Поставщики</h2>
                    <button
                        onClick={() => setIsSupplierModalOpen(true)}
                        className="w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 mb-4"
                    >
                        ➕ Добавить поставщика
                    </button>

                    <div className="space-y-2">
                        {selectedSuppliers.map(supplier => (
                            <div
                                key={supplier.id}
                                className={`p-3 rounded-lg cursor-pointer border-2 transition-all ${activeSupplier?.id === supplier.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-transparent bg-slate-50 hover:border-slate-300'
                                    }`}
                                onClick={() => setActiveSupplier(supplier)}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-medium text-slate-800">{supplier.name}</div>
                                        <div className="text-xs text-slate-500">{supplier.code}</div>
                                        <div className="text-sm font-semibold text-blue-600 mt-1">
                                            {formatCurrency(supplierTotals[supplier.id] || 0)}
                                        </div>
                                    </div>
                                    <button
                                        className="text-slate-400 hover:text-red-500 text-lg"
                                        onClick={(e) => { e.stopPropagation(); removeSupplier(supplier.id); }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}

                        {selectedSuppliers.length === 0 && (
                            <div className="text-center text-slate-400 py-8">
                                Добавьте поставщиков для оформления закупки
                            </div>
                        )}
                    </div>
                </div>

                {/* Правая панель: Товары выбранного поставщика */}
                <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-semibold text-slate-800">
                                {activeSupplier ? `Товары: ${activeSupplier.name}` : 'Товары'}
                            </h2>
                            {idn && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-mono rounded-md">
                                    IDN: {idn}
                                </span>
                            )}
                        </div>
                        {activeSupplier && (
                            <button
                                onClick={() => setIsProductModalOpen(true)}
                                className="px-3 py-1 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                            >
                                ➕ Добавить товар
                            </button>
                        )}
                    </div>

                    {activeSupplier ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-100">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Товар</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 w-24">Закуп. цена</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 w-20">Кол-во</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 w-28">Сумма</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 w-32">Тип оплаты</th>
                                        <th className="px-3 py-2 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeSupplierItems.map(item => (
                                        <tr key={`${item.supplierId}-${item.productId}`} className="border-b border-slate-100">
                                            <td className="px-3 py-2">
                                                <div className="font-medium text-slate-800">{item.product?.name}</div>
                                                <div className="text-xs text-slate-500">{item.product?.code}</div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                                                    value={item.price}
                                                    onChange={(e) => updateItem(item.supplierId, item.productId, 'price', Number(e.target.value))}
                                                    step="0.01"
                                                    min="0"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                                                    value={item.qty > 0 ? item.qty : ''}
                                                    onChange={(e) => updateItem(item.supplierId, item.productId, 'qty', Number(e.target.value))}
                                                    step="0.001"
                                                    min="0"
                                                    placeholder="—"
                                                />
                                            </td>
                                            <td className="px-3 py-2 font-semibold text-blue-600">
                                                {formatCurrency(item.amount)}
                                            </td>
                                            <td className="px-3 py-2">
                                                <select
                                                    className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                                                    value={item.paymentTypeId || ''}
                                                    onChange={(e) => updateItem(
                                                        item.supplierId,
                                                        item.productId,
                                                        'paymentTypeId',
                                                        e.target.value ? Number(e.target.value) : null
                                                    )}
                                                >
                                                    <option value="">—</option>
                                                    {paymentTypes.map(pt => (
                                                        <option key={pt.id} value={pt.id}>{pt.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-3 py-2">
                                                <button
                                                    className="text-slate-400 hover:text-red-500"
                                                    onClick={() => removeItem(item.supplierId, item.productId)}
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                    {activeSupplierItems.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                                                Нет товаров. Добавьте товары или они будут загружены из прайс-листа.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center text-slate-400 py-8">
                            Выберите поставщика слева для просмотра и редактирования товаров
                        </div>
                    )}
                </div>
            </div>

            {/* Модальное окно выбора поставщика */}
            {isSupplierModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800">Добавить поставщика</h2>
                            <button
                                onClick={() => setIsSupplierModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-4">
                            <input
                                type="text"
                                placeholder="Поиск по названию или коду..."
                                value={supplierSearch}
                                onChange={(e) => setSupplierSearch(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-4"
                                autoFocus
                            />
                            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                                {filteredSuppliers.map(s => (
                                    <div
                                        key={s.id}
                                        className="p-3 hover:bg-slate-50 cursor-pointer"
                                        onClick={() => addSupplier(s)}
                                    >
                                        <div className="font-medium text-slate-800">{s.name}</div>
                                        <div className="text-xs text-slate-500">{s.code}</div>
                                    </div>
                                ))}
                                {filteredSuppliers.length === 0 && (
                                    <div className="p-4 text-center text-slate-400">Нет доступных поставщиков</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Модальное окно выбора товара */}
            {isProductModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800">Добавить товар</h2>
                            <button
                                onClick={() => {
                                    setIsProductModalOpen(false);
                                    setProductSearch('');
                                    setAddedProductIds(new Set());
                                }}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-4">
                            <input
                                type="text"
                                placeholder="Поиск по названию или коду..."
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-4"
                                autoFocus
                            />
                            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                                {filteredProducts.map(p => {
                                    const isAdded = addedProductIds.has(p.id);
                                    return (
                                        <div
                                            key={p.id}
                                            className="p-3 hover:bg-slate-50 flex items-center justify-between"
                                        >
                                            <div className="flex-1">
                                                <div className="font-medium text-slate-800">{p.name}</div>
                                                <div className="text-xs text-slate-500">{p.code}</div>
                                            </div>
                                            <button
                                                onClick={() => !isAdded && addProduct(p)}
                                                disabled={isAdded}
                                                className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${isAdded
                                                        ? 'bg-green-100 text-green-700 cursor-default'
                                                        : 'bg-blue-500 text-white hover:bg-blue-600'
                                                    }`}
                                            >
                                                {isAdded ? '✓ Добавлен' : 'Добавить'}
                                            </button>
                                        </div>
                                    );
                                })}
                                {filteredProducts.length === 0 && (
                                    <div className="p-4 text-center text-slate-400">Нет доступных товаров</div>
                                )}
                            </div>
                        </div>
                        {/* Кнопка закрыть */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
                            <button
                                onClick={() => {
                                    setIsProductModalOpen(false);
                                    setProductSearch('');
                                    setAddedProductIds(new Set());
                                }}
                                className="w-full px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                                Закрыть
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurchaseFormPage;
