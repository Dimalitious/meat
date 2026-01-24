import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import { Search, Plus, Trash2, Save, X, Users, Globe, ArrowLeft, Package, Calendar, ExternalLink } from 'lucide-react';

// Поставщик с ценой
interface SupplierInfo {
    id: number;
    name: string;
}

interface Customer {
    id: number;
    code: string;
    name: string;
    legalName?: string;
    district?: { name: string } | null;
    manager?: { name: string } | null;
    phone?: string;
    isActive?: boolean;
}

interface Product {
    id: number;
    code: string;
    name: string;
    priceListName: string | null;
    category: string | null;
}

interface PriceItem {
    id?: number;
    productId: number;
    productName?: string;
    priceListName?: string;
    salePrice: number;
    rowDate: string;
    product?: Product;
}

interface SalesPriceList {
    id: number;
    listType: 'GENERAL' | 'CUSTOMER';
    customerId: number | null;
    title: string | null;
    effectiveDate: string;
    status: string;
    isCurrent: boolean;
    customer?: Customer | null;
    items: PriceItem[];
}

type ViewMode = 'general' | 'customer';

export default function SalesPricePage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('id');

    const [viewMode, setViewMode] = useState<ViewMode>('general');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomers, setSelectedCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [priceList, setPriceList] = useState<SalesPriceList | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');

    // Effective date - common for the whole price list
    const [effectiveDate, setEffectiveDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );

    // Product modal
    const [showProductModal, setShowProductModal] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [productSearch, setProductSearch] = useState('');

    // Customer selection modal
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [customerModalSearch, setCustomerModalSearch] = useState('');

    // Закупочные цены поставщиков (горизонтальные колонки)
    const [allSuppliers, setAllSuppliers] = useState<SupplierInfo[]>([]); // Уникальные поставщики
    const [productPrices, setProductPrices] = useState<Map<string, number>>(new Map()); // key: "productId-supplierId"
    const [loadingSupplierPrices, setLoadingSupplierPrices] = useState(false);

    // === Новые состояния для отслеживания несохранённых изменений ===
    const [isDirty, setIsDirty] = useState(false); // Есть ли несохранённые изменения
    const [savedPriceListSnapshot, setSavedPriceListSnapshot] = useState<string>(''); // Снимок сохранённого прайса для сравнения
    const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
    const [pendingTabSwitch, setPendingTabSwitch] = useState<{ mode: ViewMode, customer?: Customer | null } | null>(null);

    // Кэш ID прайсов для каждого таба (чтобы восстановить при переключении)
    const [generalPriceListId, setGeneralPriceListId] = useState<number | null>(null);
    const [customerPriceListIds, setCustomerPriceListIds] = useState<Map<number, number>>(new Map()); // customerId -> priceListId

    // Загрузить закупочные цены для всех товаров в прайсе
    const fetchAllSupplierPrices = useCallback(async (productIds: number[]) => {
        if (productIds.length === 0) return;

        setLoadingSupplierPrices(true);
        try {
            const token = localStorage.getItem('token');
            const suppliersSet = new Map<number, SupplierInfo>();
            const pricesMap = new Map<string, number>();

            // Загружаем цены для каждого товара параллельно
            const promises = productIds.map(async (productId) => {
                const params = new URLSearchParams({
                    productId: String(productId),
                    targetDate: effectiveDate
                });
                const res = await axios.get(`${API_URL}/api/prices/purchase/product-prices?${params}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                return { productId, prices: res.data.supplierPrices || [] };
            });

            const results = await Promise.all(promises);

            for (const { productId, prices } of results) {
                for (const sp of prices) {
                    // Добавляем поставщика
                    if (!suppliersSet.has(sp.supplierId)) {
                        suppliersSet.set(sp.supplierId, { id: sp.supplierId, name: sp.supplierName });
                    }
                    // Добавляем цену
                    pricesMap.set(`${productId}-${sp.supplierId}`, sp.purchasePrice);
                }
            }

            // Сортируем поставщиков по имени
            const sortedSuppliers = Array.from(suppliersSet.values()).sort((a, b) =>
                a.name.localeCompare(b.name, 'ru')
            );

            setAllSuppliers(sortedSuppliers);
            setProductPrices(pricesMap);
        } catch (err) {
            console.error('Failed to fetch supplier prices:', err);
        } finally {
            setLoadingSupplierPrices(false);
        }
    }, [effectiveDate]);

    // Загружаем закупочные цены при изменении товаров в прайсе или даты
    useEffect(() => {
        if (priceList && priceList.items.length > 0) {
            const productIds = priceList.items.map(item => item.productId);
            fetchAllSupplierPrices(productIds);
        } else {
            setAllSuppliers([]);
            setProductPrices(new Map());
        }
    }, [priceList?.items, effectiveDate, fetchAllSupplierPrices]);

    useEffect(() => {
        fetchCustomers();
        fetchProducts();
    }, []);

    // Load existing price list if editing
    useEffect(() => {
        if (editId) {
            loadPriceListById(Number(editId));
        }
    }, [editId]);

    // === Функция для проверки изменений ===
    const checkForChanges = useCallback(() => {
        if (!priceList) return false;
        const currentSnapshot = JSON.stringify({
            items: priceList.items.map(i => ({ productId: i.productId, salePrice: i.salePrice })),
            effectiveDate
        });
        return currentSnapshot !== savedPriceListSnapshot;
    }, [priceList, savedPriceListSnapshot, effectiveDate]);

    // Обновляем isDirty при изменении прайса
    useEffect(() => {
        setIsDirty(checkForChanges());
    }, [priceList?.items, effectiveDate, checkForChanges]);

    // === Загрузка прайса по типу/дате/заказчику ===
    const loadPriceListForTab = useCallback(async (mode: ViewMode, customerId?: number) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const data: any = {
                listType: mode === 'general' ? 'GENERAL' : 'CUSTOMER',
                effectiveDate,
                title: mode === 'general'
                    ? `Общий прайс от ${new Date(effectiveDate).toLocaleDateString('ru-RU')}`
                    : `Прайс от ${new Date(effectiveDate).toLocaleDateString('ru-RU')}`
            };
            if (mode === 'customer' && customerId) {
                data.customerId = customerId;
            }

            // POST на /api/prices/sales вернёт существующий прайс или создаст новый
            const res = await axios.post(`${API_URL}/api/prices/sales`, data, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const loadedPriceList = res.data;
            setPriceList(loadedPriceList);

            // Сохраняем снимок для отслеживания изменений
            const snapshot = JSON.stringify({
                items: loadedPriceList.items.map((i: PriceItem) => ({ productId: i.productId, salePrice: i.salePrice })),
                effectiveDate: loadedPriceList.effectiveDate?.split('T')[0] || effectiveDate
            });
            setSavedPriceListSnapshot(snapshot);
            setIsDirty(false);

            // Кэшируем ID прайса
            if (mode === 'general') {
                setGeneralPriceListId(loadedPriceList.id);
            } else if (customerId) {
                setCustomerPriceListIds(prev => {
                    const newMap = new Map(prev);
                    newMap.set(customerId, loadedPriceList.id);
                    return newMap;
                });
            }

            if (loadedPriceList.effectiveDate) {
                setEffectiveDate(loadedPriceList.effectiveDate.split('T')[0]);
            }
            if (loadedPriceList.customer) {
                setSelectedCustomer(loadedPriceList.customer);
            }
        } catch (err) {
            console.error('Failed to load price list:', err);
            setPriceList(null);
        } finally {
            setLoading(false);
        }
    }, [effectiveDate]);

    // === Обработка переключения табов с проверкой несохранённых изменений ===
    const handleTabSwitch = useCallback((newMode: ViewMode, customer?: Customer | null) => {
        if (isDirty && priceList && priceList.items.length > 0) {
            // Есть несохранённые изменения — показываем предупреждение
            setPendingTabSwitch({ mode: newMode, customer });
            setShowUnsavedChangesModal(true);
            return;
        }

        // Переключаемся сразу
        executeTabSwitch(newMode, customer);
    }, [isDirty, priceList]);

    const executeTabSwitch = useCallback((newMode: ViewMode, customer?: Customer | null) => {
        setViewMode(newMode);
        if (newMode === 'general') {
            setSelectedCustomer(null);
            // Загружаем общий прайс на текущую дату
            loadPriceListForTab('general');
        } else {
            if (customer) {
                setSelectedCustomer(customer);
                // Загружаем прайс заказчика
                loadPriceListForTab('customer', customer.id);
            } else {
                setPriceList(null);
            }
        }
        setShowUnsavedChangesModal(false);
        setPendingTabSwitch(null);
    }, [loadPriceListForTab]);

    const fetchCustomers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/customers`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCustomers(res.data);
        } catch (err) {
            console.error('Failed to fetch customers:', err);
        }
    };

    const fetchProducts = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/products`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProducts(res.data.filter((p: any) => p.status === 'active'));
        } catch (err) {
            console.error('Failed to fetch products:', err);
        }
    };

    const loadPriceListById = async (id: number) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/prices/sales/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = res.data;
            setPriceList(data);
            setViewMode(data.listType === 'GENERAL' ? 'general' : 'customer');
            if (data.customer) {
                setSelectedCustomer(data.customer);
            }
            if (data.effectiveDate) {
                setEffectiveDate(data.effectiveDate.split('T')[0]);
            }
        } catch (err) {
            console.error('Failed to load price list:', err);
            alert('Ошибка загрузки прайс-листа');
        } finally {
            setLoading(false);
        }
    };

    const selectCustomer = async (customer: Customer) => {
        if (isDirty && priceList && priceList.items.length > 0) {
            // Есть несохранённые изменения — показываем предупреждение
            setPendingTabSwitch({ mode: 'customer', customer });
            setShowUnsavedChangesModal(true);
            return;
        }

        setSelectedCustomer(customer);
        // Загружаем прайс для этого заказчика
        loadPriceListForTab('customer', customer.id);
    };

    const createNewPriceList = async () => {
        if (!effectiveDate) {
            alert('Укажите дату вступления в силу');
            return;
        }

        if (viewMode === 'customer' && !selectedCustomer) {
            alert('Выберите заказчика');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const data: any = {
                listType: viewMode === 'general' ? 'GENERAL' : 'CUSTOMER',
                effectiveDate,
                title: viewMode === 'general'
                    ? `Общий прайс от ${new Date(effectiveDate).toLocaleDateString('ru-RU')}`
                    : `Прайс ${selectedCustomer?.name} от ${new Date(effectiveDate).toLocaleDateString('ru-RU')}`
            };

            if (viewMode === 'customer' && selectedCustomer) {
                data.customerId = selectedCustomer.id;
            }

            const res = await axios.post(`${API_URL}/api/prices/sales`, data, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPriceList(res.data);
        } catch (err) {
            console.error('Failed to create price list:', err);
            alert('Ошибка создания прайс-листа');
        }
    };

    const savePriceList = async (makeCurrent = false) => {
        if (!priceList) return;

        if (!effectiveDate) {
            alert('Укажите дату вступления в силу');
            return;
        }

        if (priceList.items.length === 0) {
            alert('Добавьте минимум одну позицию товара');
            return;
        }

        // Validate all prices
        const invalidItems = priceList.items.filter(item => !item.salePrice || item.salePrice <= 0);
        if (invalidItems.length > 0) {
            alert('Заполните все цены корректно (цена должна быть больше 0)');
            return;
        }

        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.put(`${API_URL}/api/prices/sales/${priceList.id}`, {
                title: priceList.title,
                effectiveDate,
                items: priceList.items.map(item => ({
                    productId: item.productId,
                    salePrice: item.salePrice,
                    rowDate: item.rowDate
                })),
                makeCurrent
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPriceList(res.data);
            if (res.data.effectiveDate) {
                setEffectiveDate(res.data.effectiveDate.split('T')[0]);
            }
            alert(makeCurrent ? 'Прайс сохранён и установлен как текущий!' : 'Прайс сохранён!');

            // Обновляем снимок после сохранения
            const snapshot = JSON.stringify({
                items: res.data.items.map((i: PriceItem) => ({ productId: i.productId, salePrice: i.salePrice })),
                effectiveDate: res.data.effectiveDate?.split('T')[0] || effectiveDate
            });
            setSavedPriceListSnapshot(snapshot);
            setIsDirty(false);

            // Обновляем кэш ID
            if (priceList.listType === 'GENERAL') {
                setGeneralPriceListId(res.data.id);
            } else if (priceList.customerId) {
                setCustomerPriceListIds(prev => {
                    const newMap = new Map(prev);
                    newMap.set(priceList.customerId!, res.data.id);
                    return newMap;
                });
            }
        } catch (err) {
            console.error('Failed to save price list:', err);
            alert('Ошибка сохранения');
        } finally {
            setSaving(false);
        }
    };

    const addProduct = (product: Product) => {
        if (!priceList) return;

        if (priceList.items.some(i => i.productId === product.id)) {
            alert('Товар уже добавлен');
            return;
        }

        const newItem: PriceItem = {
            productId: product.id,
            productName: product.name,
            priceListName: product.priceListName || product.name,
            salePrice: 0,
            rowDate: new Date().toISOString().split('T')[0],
            product
        };

        setPriceList({
            ...priceList,
            items: [...priceList.items, newItem]
        });
        setShowProductModal(false);
    };

    const removeItem = (productId: number) => {
        if (!priceList) return;
        setPriceList({
            ...priceList,
            items: priceList.items.filter(i => i.productId !== productId)
        });
    };

    const updateItemPrice = (productId: number, price: number) => {
        if (!priceList) return;
        setPriceList({
            ...priceList,
            items: priceList.items.map(i =>
                i.productId === productId ? { ...i, salePrice: price } : i
            )
        });
    };

    const filteredCustomers = selectedCustomers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.code.toLowerCase().includes(customerSearch.toLowerCase())
    );

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.code.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.priceListName && p.priceListName.toLowerCase().includes(productSearch.toLowerCase()))
    );

    // Фильтрация заказчиков в модальном окне
    const filteredModalCustomers = customers.filter(c => {
        if (c.isActive === false) return false;
        const search = customerModalSearch.toLowerCase();
        if (!search) return true;
        return (
            c.name.toLowerCase().includes(search) ||
            c.code.toLowerCase().includes(search) ||
            (c.legalName && c.legalName.toLowerCase().includes(search)) ||
            (c.phone && c.phone.toLowerCase().includes(search)) ||
            (c.district?.name && c.district.name.toLowerCase().includes(search)) ||
            (c.manager?.name && c.manager.name.toLowerCase().includes(search))
        );
    });

    // Проверка, добавлен ли заказчик
    const isCustomerAdded = (customerId: number) =>
        selectedCustomers.some(c => c.id === customerId);

    // Добавить заказчика в список
    const handleAddCustomer = (customer: Customer) => {
        if (!isCustomerAdded(customer.id)) {
            setSelectedCustomers([...selectedCustomers, customer]);
        }
    };

    // Удалить заказчика из списка
    const handleRemoveCustomer = (customerId: number) => {
        setSelectedCustomers(selectedCustomers.filter(c => c.id !== customerId));
        if (selectedCustomer?.id === customerId) {
            setSelectedCustomer(null);
            setPriceList(null);
        }
    };

    const canCreate = viewMode === 'general' || (viewMode === 'customer' && selectedCustomer);

    return (
        <div className="flex flex-col h-[calc(100vh-120px)]">
            {/* Top Header with Effective Date and Actions */}
            <div className="bg-white rounded-lg shadow p-4 mb-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="sm" onClick={() => navigate('/journals/sales-prices')}>
                            <ArrowLeft size={16} className="mr-2" />
                            К журналу
                        </Button>
                        <h1 className="text-xl font-bold">
                            {editId ? 'Редактирование прайс-листа' : 'Создание прайс-листа'}
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Effective Date - Common for all items */}
                        <div className="flex items-center gap-2">
                            <Calendar size={18} className="text-gray-500" />
                            <label className="text-sm font-medium text-gray-700">Дата вступления в силу:</label>
                            <input
                                type="date"
                                value={effectiveDate}
                                onChange={e => setEffectiveDate(e.target.value)}
                                className="border rounded px-3 py-2 text-sm font-medium"
                                required
                            />
                        </div>

                        {priceList && (
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => savePriceList(false)} disabled={saving}>
                                    <Save size={16} className="mr-1" />
                                    Сохранить
                                </Button>
                                <Button onClick={() => savePriceList(true)} disabled={saving}>
                                    <Save size={16} className="mr-1" />
                                    Сохранить как текущий
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content - Two Columns */}
            <div className="flex gap-4 flex-1 overflow-hidden">
                {/* Left Panel - Mode Switcher & Customers */}
                <div className="w-72 bg-white rounded-lg shadow flex flex-col overflow-hidden">
                    {/* Mode Tabs */}
                    <div className="p-2 border-b flex gap-1 flex-shrink-0">
                        <button
                            onClick={() => {
                                if (!editId && viewMode !== 'general') {
                                    handleTabSwitch('general');
                                }
                            }}
                            disabled={!!editId}
                            className={`flex-1 px-3 py-2 rounded text-sm font-medium flex items-center justify-center gap-1 transition-colors ${viewMode === 'general'
                                ? 'bg-purple-100 text-purple-700'
                                : editId ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-100'
                                }`}
                        >
                            <Globe size={16} /> Общий прайс
                            {isDirty && viewMode === 'general' && <span className="w-2 h-2 bg-orange-500 rounded-full" title="Есть несохранённые изменения"></span>}
                        </button>
                        <button
                            onClick={() => {
                                if (!editId && viewMode !== 'customer') {
                                    handleTabSwitch('customer');
                                }
                            }}
                            disabled={!!editId}
                            className={`flex-1 px-3 py-2 rounded text-sm font-medium flex items-center justify-center gap-1 transition-colors ${viewMode === 'customer'
                                ? 'bg-blue-100 text-blue-700'
                                : editId ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-100'
                                }`}
                        >
                            <Users size={16} /> По заказчику
                            {isDirty && viewMode === 'customer' && <span className="w-2 h-2 bg-orange-500 rounded-full" title="Есть несохранённые изменения"></span>}
                        </button>
                    </div>

                    {viewMode === 'customer' && (
                        <>
                            <div className="p-4 border-b flex-shrink-0">
                                <h2 className="font-semibold mb-2">Заказчики</h2>
                                <div className="relative mb-3">
                                    <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Поиск в списке..."
                                        className="w-full border rounded pl-8 pr-3 py-2 text-sm"
                                        value={customerSearch}
                                        onChange={e => setCustomerSearch(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={() => setShowCustomerModal(true)}
                                    disabled={!!editId}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                                >
                                    <Plus size={16} /> Добавить заказчика
                                </button>
                            </div>

                            <div className="flex-1 overflow-auto p-2">
                                {filteredCustomers.length === 0 ? (
                                    <div className="text-center text-gray-500 py-8 text-sm">
                                        {selectedCustomers.length === 0
                                            ? 'Нажмите "Добавить заказчика"'
                                            : 'Заказчики не найдены'}
                                    </div>
                                ) : (
                                    filteredCustomers.map(customer => (
                                        <div
                                            key={customer.id}
                                            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex justify-between items-center mb-1 ${selectedCustomer?.id === customer.id
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'hover:bg-gray-100'
                                                }`}
                                        >
                                            <button
                                                onClick={() => selectCustomer(customer)}
                                                className="flex-1 text-left"
                                            >
                                                <div className="font-medium">{customer.name}</div>
                                                <div className="text-xs text-gray-500">{customer.code}</div>
                                            </button>
                                            {!editId && (
                                                <button
                                                    onClick={() => handleRemoveCustomer(customer.id)}
                                                    className="text-red-400 hover:text-red-600 p-1"
                                                    title="Удалить из прайса"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}

                    {viewMode === 'general' && (
                        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-gray-500">
                            <Globe size={48} className="mb-4 text-purple-200" />
                            <p className="text-sm font-medium mb-2">Общий прайс</p>
                            <p className="text-xs">
                                Применяется ко всем заказчикам по умолчанию.
                            </p>
                            <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                <p className="text-xs text-yellow-800">
                                    <strong>Важно:</strong> Индивидуальные прайсы имеют приоритет и полностью заменяют общий прайс для конкретного заказчика.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel - Price List */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Price List Header */}
                    <div className="bg-white rounded-lg shadow p-4 mb-4 flex-shrink-0">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-semibold">
                                    {viewMode === 'general'
                                        ? 'Общий продажный прайс'
                                        : selectedCustomer
                                            ? `Прайс заказчика: ${selectedCustomer.name}`
                                            : 'Прайс заказчика'
                                    }
                                </h2>
                                {priceList && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${priceList.isCurrent ? 'bg-green-100 text-green-800' :
                                            priceList.status === 'saved' ? 'bg-blue-100 text-blue-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {priceList.isCurrent ? 'Текущий' : priceList.status === 'saved' ? 'Сохранён' : 'Черновик'}
                                        </span>
                                        <span className="text-sm text-gray-500">{priceList.items.length} позиций</span>
                                    </div>
                                )}
                            </div>

                            {canCreate && !priceList && (
                                <Button onClick={createNewPriceList}>
                                    <Plus size={16} className="mr-1" /> Создать прайс
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
                        {viewMode === 'customer' && !selectedCustomer ? (
                            <div className="flex-1 flex items-center justify-center text-gray-500">
                                <div className="text-center">
                                    <Users size={48} className="mx-auto mb-4 text-gray-300" />
                                    <p>Выберите заказчика из списка слева</p>
                                </div>
                            </div>
                        ) : loading ? (
                            <div className="flex-1 flex items-center justify-center text-gray-500">
                                <div className="text-center">
                                    <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                                    Загрузка...
                                </div>
                            </div>
                        ) : !priceList ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                                <Package size={48} className="mb-4 text-gray-300" />
                                <p className="mb-4">
                                    {viewMode === 'general'
                                        ? 'Создайте новый общий прайс'
                                        : 'Создайте прайс для выбранного заказчика'
                                    }
                                </p>
                                {canCreate && (
                                    <Button onClick={createNewPriceList}>
                                        <Plus size={16} className="mr-1" /> Создать прайс
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Toolbar */}
                                <div className="p-3 border-b flex items-center justify-between flex-shrink-0">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setProductSearch('');
                                            setShowProductModal(true);
                                        }}
                                    >
                                        <Plus size={16} className="mr-1" /> Добавить товар
                                    </Button>

                                    <div className="flex items-center gap-2">
                                        <a
                                            href="/journals/sales-prices"
                                            className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1"
                                        >
                                            Журнал прайсов
                                            <ExternalLink size={12} />
                                        </a>
                                        <span className="text-gray-300">|</span>
                                        <a
                                            href="/products"
                                            target="_blank"
                                            className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1"
                                        >
                                            Справочник товаров
                                            <ExternalLink size={12} />
                                        </a>
                                    </div>
                                </div>

                                {/* Items Table with horizontal supplier columns */}
                                <div className="flex-1 overflow-auto">
                                    {loadingSupplierPrices && (
                                        <div className="bg-blue-50 text-blue-700 text-sm px-4 py-2">
                                            Загрузка закупочных цен...
                                        </div>
                                    )}
                                    <table className="w-full">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 min-w-[200px]">
                                                    Наименование товара
                                                </th>
                                                {/* Динамические колонки поставщиков — компактный блок */}
                                                {allSuppliers.map((supplier, idx) => (
                                                    <th
                                                        key={supplier.id}
                                                        className={`text-right px-1.5 py-2 text-xs font-medium text-green-700 bg-green-50 whitespace-nowrap ${idx > 0 ? 'border-l border-green-200' : ''}`}
                                                        style={{ minWidth: '90px', maxWidth: '150px' }}
                                                        title={supplier.name}
                                                    >
                                                        <div className="truncate">{supplier.name}</div>
                                                        <div className="text-[10px] text-gray-500 font-normal border-t border-green-300 mt-1 pt-0.5">закуп.</div>
                                                    </th>
                                                ))}
                                                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700 w-32 bg-yellow-50 border-l-2 border-gray-300">
                                                    Цена продажи
                                                </th>
                                                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700 w-32">
                                                    Дата записи
                                                </th>
                                                <th className="w-12"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {priceList.items.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3 + allSuppliers.length} className="text-center py-12 text-gray-500">
                                                        <Package size={32} className="mx-auto mb-2 text-gray-300" />
                                                        Нет позиций. Добавьте товары
                                                    </td>
                                                </tr>
                                            ) : (
                                                priceList.items.map(item => (
                                                    <tr key={item.productId} className="border-b hover:bg-gray-50">
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium">
                                                                {item.product?.priceListName || item.priceListName || item.product?.name || item.productName}
                                                            </div>
                                                            <div className="text-xs text-gray-500">{item.product?.code}</div>
                                                        </td>
                                                        {/* Цены поставщиков — компактные ячейки */}
                                                        {allSuppliers.map((supplier, idx) => {
                                                            const price = productPrices.get(`${item.productId}-${supplier.id}`);
                                                            return (
                                                                <td
                                                                    key={supplier.id}
                                                                    className={`px-1.5 py-2 text-right text-sm bg-green-50/30 whitespace-nowrap ${idx > 0 ? 'border-l border-green-100' : ''}`}
                                                                    style={{ minWidth: '90px', maxWidth: '150px' }}
                                                                >
                                                                    {price !== undefined && price !== 0 ? (
                                                                        <span className="text-green-700 font-medium">
                                                                            {price.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-gray-300">—</span>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="px-4 py-3 bg-yellow-50/30 border-l-2 border-gray-300">
                                                            <input
                                                                type="number"
                                                                value={item.salePrice || ''}
                                                                onChange={e => updateItemPrice(item.productId, Number(e.target.value))}
                                                                className="w-full text-right border rounded px-3 py-2 text-sm font-medium"
                                                                min="0"
                                                                step="0.01"
                                                                placeholder="0.00"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-sm text-gray-500">
                                                            {item.rowDate ? new Date(item.rowDate).toLocaleDateString('ru-RU') : '-'}
                                                        </td>
                                                        <td className="px-2">
                                                            <button
                                                                onClick={() => removeItem(item.productId)}
                                                                className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                                                                title="Удалить"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Product Selection Modal */}
            {showProductModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Выбор товара</h3>
                            <button onClick={() => setShowProductModal(false)} className="text-gray-500 hover:text-gray-700">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Поиск по названию, коду или названию прайс-листа..."
                                    className="w-full border rounded pl-9 pr-3 py-2"
                                    value={productSearch}
                                    onChange={e => setProductSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-2 max-h-[400px]">
                            {filteredProducts.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    Товары не найдены
                                </div>
                            ) : (
                                filteredProducts.slice(0, 50).map(product => (
                                    <button
                                        key={product.id}
                                        onClick={() => addProduct(product)}
                                        className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded flex justify-between items-center group"
                                    >
                                        <div>
                                            <div className="font-medium group-hover:text-blue-700">
                                                {product.priceListName || product.name}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {product.code}
                                                {product.priceListName && product.priceListName !== product.name && (
                                                    <span className="ml-2">({product.name})</span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-blue-600 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                            Добавить →
                                        </span>
                                    </button>
                                ))
                            )}
                            {filteredProducts.length > 50 && (
                                <div className="text-center py-2 text-sm text-gray-500">
                                    Показано 50 из {filteredProducts.length}. Уточните поиск.
                                </div>
                            )}
                        </div>
                        <div className="p-3 border-t text-center bg-gray-50">
                            <a
                                href="/products"
                                target="_blank"
                                className="text-blue-600 hover:underline text-sm inline-flex items-center gap-1"
                            >
                                Открыть справочник товаров
                                <ExternalLink size={12} />
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Customer Selection Modal */}
            {showCustomerModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[900px] max-h-[700px] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Выбор заказчика</h3>
                            <button
                                onClick={() => {
                                    setShowCustomerModal(false);
                                    setCustomerModalSearch('');
                                }}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Поиск по названию, юр. названию, району, менеджеру, телефону..."
                                    className="w-full border rounded pl-9 pr-3 py-2"
                                    value={customerModalSearch}
                                    onChange={e => setCustomerModalSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Название</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Юридическое название</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Район</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Менеджер</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Телефон</th>
                                        <th className="w-32"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredModalCustomers.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-gray-500">
                                                Заказчики не найдены
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredModalCustomers.map(customer => {
                                            const added = isCustomerAdded(customer.id);
                                            return (
                                                <tr key={customer.id} className="border-b hover:bg-gray-50">
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium">{customer.name}</div>
                                                        <div className="text-xs text-gray-500">{customer.code}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">{customer.legalName || '-'}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">{customer.district?.name || '-'}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">{customer.manager?.name || '-'}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">{customer.phone || '-'}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        {added ? (
                                                            <span className="text-green-600 text-sm font-medium">✓ Добавлен</span>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleAddCustomer(customer)}
                                                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                                                            >
                                                                + Добавить
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t flex justify-end bg-gray-50">
                            <button
                                onClick={() => {
                                    setShowCustomerModal(false);
                                    setCustomerModalSearch('');
                                }}
                                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded font-medium"
                            >
                                Готово
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модальное окно предупреждения о несохранённых изменениях */}
            {showUnsavedChangesModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[450px] p-6">
                        <h3 className="text-lg font-semibold mb-4">Несохранённые изменения</h3>
                        <p className="text-gray-600 mb-6">
                            У вас есть несохранённые изменения в текущем прайс-листе. Что вы хотите сделать?
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowUnsavedChangesModal(false);
                                    setPendingTabSwitch(null);
                                }}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-medium"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={() => {
                                    // Не сохранять — просто переключаемся
                                    if (pendingTabSwitch) {
                                        setIsDirty(false);
                                        executeTabSwitch(pendingTabSwitch.mode, pendingTabSwitch.customer);
                                    }
                                }}
                                className="px-4 py-2 text-orange-600 hover:bg-orange-50 rounded font-medium"
                            >
                                Не сохранять
                            </button>
                            <button
                                onClick={async () => {
                                    // Сохранить и переключиться
                                    if (priceList && priceList.items.length > 0) {
                                        await savePriceList(false);
                                    }
                                    if (pendingTabSwitch) {
                                        executeTabSwitch(pendingTabSwitch.mode, pendingTabSwitch.customer);
                                    }
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                            >
                                Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
