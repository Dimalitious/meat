import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import { Search, Plus, Trash2, Save, X, Users, Globe } from 'lucide-react';

interface Customer {
    id: number;
    code: string;
    name: string;
}

interface Product {
    id: number;
    code: string;
    name: string;
    category: string | null;
}

interface PriceItem {
    id?: number;
    productId: number;
    productName?: string;
    salePrice: number;
    rowDate: string;
    product?: Product;
}

interface SalesPriceList {
    id: number;
    listType: 'GENERAL' | 'CUSTOMER';
    customerId: number | null;
    title: string | null;
    status: string;
    isCurrent: boolean;
    customer?: Customer | null;
    items: PriceItem[];
}

type ViewMode = 'general' | 'customer';

export default function SalesPricePage() {
    const [viewMode, setViewMode] = useState<ViewMode>('general');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [priceList, setPriceList] = useState<SalesPriceList | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');

    // Product modal
    const [showProductModal, setShowProductModal] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [productSearch, setProductSearch] = useState('');

    useEffect(() => {
        fetchCustomers();
        fetchProducts();
    }, []);

    useEffect(() => {
        if (viewMode === 'general') {
            loadGeneralPrice();
        } else {
            setPriceList(null);
        }
    }, [viewMode]);

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
            setProducts(res.data);
        } catch (err) {
            console.error('Failed to fetch products:', err);
        }
    };

    const loadGeneralPrice = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/prices/sales/general/current`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPriceList(res.data);
        } catch (err) {
            console.error('Failed to load general price:', err);
            setPriceList(null);
        } finally {
            setLoading(false);
        }
    };

    const selectCustomer = async (customer: Customer) => {
        setSelectedCustomer(customer);
        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/prices/sales/customer/${customer.id}/current`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPriceList(res.data);
        } catch (err) {
            console.error('Failed to load customer price:', err);
            setPriceList(null);
        } finally {
            setLoading(false);
        }
    };

    const createNewPriceList = async () => {
        try {
            const token = localStorage.getItem('token');
            const data: any = {
                listType: viewMode === 'general' ? 'GENERAL' : 'CUSTOMER',
                title: viewMode === 'general'
                    ? `Общий прайс от ${new Date().toLocaleDateString('ru-RU')}`
                    : `Прайс ${selectedCustomer?.name} от ${new Date().toLocaleDateString('ru-RU')}`
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
        }
    };

    const savePriceList = async (makeCurrent = false) => {
        if (!priceList) return;

        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.put(`${API_URL}/api/prices/sales/${priceList.id}`, {
                title: priceList.title,
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
            alert(makeCurrent ? 'Прайс сохранён и установлен как текущий!' : 'Прайс сохранён!');
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

    const updateItemDate = (productId: number, date: string) => {
        if (!priceList) return;
        setPriceList({
            ...priceList,
            items: priceList.items.map(i =>
                i.productId === productId ? { ...i, rowDate: date } : i
            )
        });
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.code.toLowerCase().includes(customerSearch.toLowerCase())
    );

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.code.toLowerCase().includes(productSearch.toLowerCase())
    );

    const canCreate = viewMode === 'general' || (viewMode === 'customer' && selectedCustomer);

    return (
        <div className="flex h-[calc(100vh-120px)] gap-4">
            {/* Left Panel - Mode Switcher & Customers */}
            <div className="w-72 bg-white rounded-lg shadow flex flex-col">
                {/* Mode Tabs */}
                <div className="p-2 border-b flex gap-1">
                    <button
                        onClick={() => { setViewMode('general'); setSelectedCustomer(null); }}
                        className={`flex-1 px-3 py-2 rounded text-sm font-medium flex items-center justify-center gap-1 ${viewMode === 'general'
                                ? 'bg-blue-100 text-blue-700'
                                : 'hover:bg-gray-100'
                            }`}
                    >
                        <Globe size={16} /> Общий
                    </button>
                    <button
                        onClick={() => setViewMode('customer')}
                        className={`flex-1 px-3 py-2 rounded text-sm font-medium flex items-center justify-center gap-1 ${viewMode === 'customer'
                                ? 'bg-blue-100 text-blue-700'
                                : 'hover:bg-gray-100'
                            }`}
                    >
                        <Users size={16} /> По заказчику
                    </button>
                </div>

                {viewMode === 'customer' && (
                    <>
                        <div className="p-4 border-b">
                            <h2 className="font-semibold mb-2">Заказчики</h2>
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Поиск..."
                                    className="w-full border rounded pl-8 pr-3 py-2 text-sm"
                                    value={customerSearch}
                                    onChange={e => setCustomerSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-2">
                            {filteredCustomers.map(customer => (
                                <button
                                    key={customer.id}
                                    onClick={() => selectCustomer(customer)}
                                    className={`w-full text-left px-3 py-2 rounded text-sm ${selectedCustomer?.id === customer.id
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'hover:bg-gray-100'
                                        }`}
                                >
                                    <div className="font-medium">{customer.name}</div>
                                    <div className="text-xs text-gray-500">{customer.code}</div>
                                </button>
                            ))}
                        </div>

                        <div className="p-2 border-t">
                            <a href="/customers" className="text-blue-600 hover:underline text-sm block text-center">
                                Открыть справочник заказчиков
                            </a>
                        </div>
                    </>
                )}

                {viewMode === 'general' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-gray-500">
                        <Globe size={48} className="mb-4 text-gray-300" />
                        <p className="text-sm">Общий прайс применяется ко всем заказчикам по умолчанию</p>
                        <p className="text-xs mt-2">Индивидуальные прайсы имеют приоритет</p>
                    </div>
                )}
            </div>

            {/* Right Panel - Price List */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="bg-white rounded-lg shadow p-4 mb-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold">
                            {viewMode === 'general'
                                ? 'Общий продажный прайс'
                                : selectedCustomer
                                    ? `Прайс заказчика: ${selectedCustomer.name}`
                                    : 'Прайс заказчика'
                            }
                        </h1>
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
                    <div className="flex gap-2">
                        {canCreate && !priceList && (
                            <Button onClick={createNewPriceList}>
                                <Plus size={16} className="mr-1" /> Добавить прайс
                            </Button>
                        )}
                        {priceList && (
                            <>
                                <Button variant="outline" onClick={() => savePriceList(false)} disabled={saving}>
                                    <Save size={16} className="mr-1" /> Сохранить
                                </Button>
                                <Button onClick={() => savePriceList(true)} disabled={saving}>
                                    <Save size={16} className="mr-1" /> Сохранить как текущий
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
                    {viewMode === 'customer' && !selectedCustomer ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500">
                            Выберите заказчика из списка слева
                        </div>
                    ) : loading ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500">
                            Загрузка...
                        </div>
                    ) : !priceList ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                            <p className="mb-4">
                                {viewMode === 'general'
                                    ? 'Нет общего прайса'
                                    : 'У заказчика нет индивидуального прайса'
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
                            <div className="p-3 border-b">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setProductSearch('');
                                        setShowProductModal(true);
                                    }}
                                >
                                    <Plus size={16} className="mr-1" /> Добавить продукцию
                                </Button>
                            </div>

                            {/* Items Table */}
                            <div className="flex-1 overflow-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="text-left px-4 py-2 text-sm font-medium text-gray-500">Товар</th>
                                            <th className="text-right px-4 py-2 text-sm font-medium text-gray-500 w-32">Цена продажи</th>
                                            <th className="text-center px-4 py-2 text-sm font-medium text-gray-500 w-36">Дата</th>
                                            <th className="w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {priceList.items.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="text-center py-8 text-gray-500">
                                                    Нет позиций. Добавьте товары
                                                </td>
                                            </tr>
                                        ) : (
                                            priceList.items.map(item => (
                                                <tr key={item.productId} className="border-b hover:bg-gray-50">
                                                    <td className="px-4 py-2">
                                                        <div className="font-medium">{item.product?.name || item.productName}</div>
                                                        <div className="text-xs text-gray-500">{item.product?.code}</div>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            value={item.salePrice}
                                                            onChange={e => updateItemPrice(item.productId, Number(e.target.value))}
                                                            className="w-full text-right border rounded px-2 py-1"
                                                            min="0"
                                                            step="0.01"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <input
                                                            type="date"
                                                            value={item.rowDate?.split('T')[0] || ''}
                                                            onChange={e => updateItemDate(item.productId, e.target.value)}
                                                            className="border rounded px-2 py-1 text-sm"
                                                        />
                                                    </td>
                                                    <td className="px-2">
                                                        <button
                                                            onClick={() => removeItem(item.productId)}
                                                            className="p-1 text-red-500 hover:bg-red-50 rounded"
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

            {/* Product Selection Modal */}
            {showProductModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Добавить продукцию</h3>
                            <button onClick={() => setShowProductModal(false)} className="text-gray-500 hover:text-gray-700">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Поиск товара..."
                                    className="w-full border rounded pl-9 pr-3 py-2"
                                    value={productSearch}
                                    onChange={e => setProductSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-2 max-h-[400px]">
                            {filteredProducts.slice(0, 50).map(product => (
                                <button
                                    key={product.id}
                                    onClick={() => addProduct(product)}
                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded flex justify-between items-center"
                                >
                                    <div>
                                        <div className="font-medium">{product.name}</div>
                                        <div className="text-xs text-gray-500">{product.code}</div>
                                    </div>
                                    <span className="text-blue-600 text-sm">Добавить →</span>
                                </button>
                            ))}
                        </div>
                        <div className="p-3 border-t text-center">
                            <a href="/products" className="text-blue-600 hover:underline text-sm">
                                Открыть справочник товаров
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
