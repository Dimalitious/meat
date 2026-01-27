import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../config/api';

interface Supplier {
    id: number;
    code: string;
    name: string;
    legalName?: string;
    altName?: string;
    phone?: string;
    telegram?: string;
    isActive: boolean;
}

interface Product {
    id: number;
    code: string;
    name: string;
}

interface PriceItem {
    productId: number;
    productCode?: string;
    productName?: string;
    purchasePrice: number;
}

interface SupplierWithItems {
    supplierId: number;
    supplierName: string;
    items: PriceItem[];
}

export default function PurchasePriceListFormPage() {
    const { id } = useParams();
    const isEdit = id && id !== 'new';
    const navigate = useNavigate();

    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [name, setName] = useState('');
    const [suppliersData, setSuppliersData] = useState<SupplierWithItems[]>([]);
    const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);

    const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
    const [supplierModalSearch, setSupplierModalSearch] = useState('');
    const [templateLoaded, setTemplateLoaded] = useState(false);
    const [templateSource, setTemplateSource] = useState<{ id: number; date: string; name: string } | null>(null);
    const [addedProductIds, setAddedProductIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        fetchSuppliers();
        fetchProducts();
        if (isEdit) {
            fetchPriceList();
        } else {
            // При создании нового прайса — загружаем шаблон из последнего
            fetchTemplate();
        }
    }, [id]);

    const fetchSuppliers = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const res = await axios.get(`${API_URL}/api/suppliers`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAllSuppliers(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Fetch suppliers error:', err);
            setAllSuppliers([]);
        }
    };

    const fetchProducts = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const res = await axios.get(`${API_URL}/api/products`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAllProducts(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Fetch products error:', err);
            setAllProducts([]);
        }
    };

    // Загрузка шаблона из последнего активного прайса
    const fetchTemplate = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/purchase-price-lists/template`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const template = res.data;
            if (!template.hasTemplate) {
                console.log('No previous price list template available');
                setTemplateLoaded(false);
                return;
            }

            console.log('Template loaded from price list:', template.sourceId);
            setTemplateSource({
                id: template.sourceId,
                date: template.sourceDate,
                name: template.sourceName
            });

            // Заполняем форму данными из шаблона
            const suppliersFromTemplate: SupplierWithItems[] = template.suppliers.map((s: any) => ({
                supplierId: s.supplierId,
                supplierName: s.supplier?.name || '',
                items: s.items.map((item: any) => ({
                    productId: item.productId,
                    productCode: item.product?.code,
                    productName: item.product?.name,
                    purchasePrice: Number(item.purchasePrice) || 0
                }))
            }));

            setSuppliersData(suppliersFromTemplate);
            if (suppliersFromTemplate.length > 0) {
                setSelectedSupplierId(suppliersFromTemplate[0].supplierId);
            }
            setTemplateLoaded(true);
        } catch (err) {
            console.error('Fetch template error:', err);
            // Не показываем ошибку — просто открываем пустую форму
        } finally {
            setLoading(false);
        }
    };

    const fetchPriceList = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/purchase-price-lists/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const pl = res.data;
            setDate(new Date(pl.date).toISOString().split('T')[0]);
            setName(pl.name || '');

            // Группируем товары по поставщикам
            const suppliersMap = new Map<number, SupplierWithItems>();

            for (const s of pl.suppliers) {
                suppliersMap.set(s.supplierId, {
                    supplierId: s.supplierId,
                    supplierName: s.supplier.name,
                    items: []
                });
            }

            for (const item of pl.items) {
                const supplier = suppliersMap.get(item.supplierId);
                if (supplier) {
                    supplier.items.push({
                        productId: item.productId,
                        productCode: item.product?.code,
                        productName: item.product?.name,
                        purchasePrice: Number(item.purchasePrice)
                    });
                }
            }

            setSuppliersData(Array.from(suppliersMap.values()));
            if (suppliersMap.size > 0) {
                setSelectedSupplierId(Array.from(suppliersMap.keys())[0]);
            }
        } catch (err) {
            console.error('Fetch price list error:', err);
            alert('Ошибка загрузки прайс-листа');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!date) {
            alert('Укажите дату прайса');
            return;
        }

        if (suppliersData.length === 0) {
            alert('Добавьте хотя бы одного поставщика');
            return;
        }

        for (const s of suppliersData) {
            if (s.items.length === 0) {
                alert(`Поставщик "${s.supplierName}" не имеет товаров`);
                return;
            }
            for (const item of s.items) {
                if (!item.purchasePrice || item.purchasePrice <= 0) {
                    alert(`Укажите цену для товара "${item.productName}"`);
                    return;
                }
            }
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            const payload = {
                date,
                name: name || null,
                suppliers: suppliersData.map(s => ({
                    supplierId: s.supplierId,
                    items: s.items.map(i => ({
                        productId: i.productId,
                        purchasePrice: i.purchasePrice
                    }))
                }))
            };

            if (isEdit) {
                await axios.put(`${API_URL}/api/purchase-price-lists/${id}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                alert('Прайс-лист обновлён');
            } else {
                await axios.post(`${API_URL}/api/purchase-price-lists`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                alert('Прайс-лист создан');
            }

            navigate('/purchase-price-lists');
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка сохранения');
        } finally {
            setLoading(false);
        }
    };

    const handleAddSupplier = (supplier: Supplier) => {
        if (suppliersData.some(s => s.supplierId === supplier.id)) {
            alert('Поставщик уже добавлен');
            return;
        }

        setSuppliersData([...suppliersData, {
            supplierId: supplier.id,
            supplierName: supplier.name,
            items: []
        }]);
        setSelectedSupplierId(supplier.id);
        setShowAddSupplierModal(false);
    };

    const handleRemoveSupplier = (supplierId: number) => {
        if (!confirm('Удалить поставщика из прайса?')) return;

        setSuppliersData(suppliersData.filter(s => s.supplierId !== supplierId));
        if (selectedSupplierId === supplierId) {
            setSelectedSupplierId(suppliersData.length > 1 ? suppliersData[0].supplierId : null);
        }
    };

    const handleAddProduct = (product: Product) => {
        if (!selectedSupplierId) return;

        setSuppliersData(suppliersData.map(s => {
            if (s.supplierId !== selectedSupplierId) return s;

            if (s.items.some(i => i.productId === product.id)) {
                alert('Товар уже добавлен');
                return s;
            }

            return {
                ...s,
                items: [...s.items, {
                    productId: product.id,
                    productCode: product.code,
                    productName: product.name,
                    purchasePrice: 0
                }]
            };
        }));
        // Отмечаем товар как добавленный (не закрываем модальное окно)
        setAddedProductIds(prev => new Set(prev).add(product.id));
    };

    const handleRemoveProduct = (productId: number) => {
        if (!selectedSupplierId) return;

        setSuppliersData(suppliersData.map(s => {
            if (s.supplierId !== selectedSupplierId) return s;
            return {
                ...s,
                items: s.items.filter(i => i.productId !== productId)
            };
        }));
    };

    const handlePriceChange = (productId: number, price: number) => {
        if (!selectedSupplierId) return;

        setSuppliersData(suppliersData.map(s => {
            if (s.supplierId !== selectedSupplierId) return s;
            return {
                ...s,
                items: s.items.map(i =>
                    i.productId === productId ? { ...i, purchasePrice: price } : i
                )
            };
        }));
    };

    const selectedSupplier = suppliersData.find(s => s.supplierId === selectedSupplierId);

    const filteredSuppliers = suppliersData.filter(s =>
        s.supplierName.toLowerCase().includes(supplierSearch.toLowerCase())
    );

    const filteredProducts = allProducts.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.code.toLowerCase().includes(productSearch.toLowerCase())
    );

    // Фильтрация поставщиков в модальном окне
    const filteredModalSuppliers = allSuppliers.filter(s => {
        const search = supplierModalSearch.toLowerCase();
        if (!search) return true;
        return (
            s.name.toLowerCase().includes(search) ||
            (s.altName && s.altName.toLowerCase().includes(search)) ||
            (s.legalName && s.legalName.toLowerCase().includes(search)) ||
            (s.phone && s.phone.toLowerCase().includes(search)) ||
            (s.telegram && s.telegram.toLowerCase().includes(search))
        );
    });

    // Проверка, добавлен ли поставщик
    const isSupplierAdded = (supplierId: number) =>
        suppliersData.some(sd => sd.supplierId === supplierId);

    return (
        <div className="p-6 h-full flex flex-col">
            {/* Шапка */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        {isEdit ? 'Редактирование закупочного прайса' : 'Новый закупочный прайс'}
                    </h1>
                    {!isEdit && templateLoaded && templateSource && (
                        <p className="text-sm text-emerald-400 mt-1">
                            ✓ Структура загружена из прайса #{templateSource.id}
                            от {new Date(templateSource.date).toLocaleDateString('ru-RU')}
                            {templateSource.name && ` (${templateSource.name})`}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <div>
                        <label className="text-sm text-gray-400 mr-2">Дата прайса:</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                        />
                    </div>
                    <input
                        type="text"
                        placeholder="Название (опционально)"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white w-64"
                    />
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg disabled:opacity-50"
                    >
                        {loading ? 'Сохранение...' : 'Сохранить прайс-лист'}
                    </button>
                    <button
                        onClick={() => navigate('/purchase-price-lists')}
                        className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg"
                    >
                        Отмена
                    </button>
                </div>
            </div>

            {/* Основная область — split layout */}
            <div className="flex-1 flex gap-4 min-h-0">
                {/* Левая панель — Поставщики */}
                <div className="w-80 bg-slate-800 rounded-lg flex flex-col">
                    <div className="p-4 border-b border-slate-700">
                        <h2 className="text-lg font-semibold text-white mb-3">Поставщики</h2>
                        <input
                            type="text"
                            placeholder="Поиск поставщика..."
                            value={supplierSearch}
                            onChange={(e) => setSupplierSearch(e.target.value)}
                            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white mb-3"
                        />
                        <button
                            onClick={() => setShowAddSupplierModal(true)}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg"
                        >
                            + Добавить поставщика
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto p-2">
                        {filteredSuppliers.map(s => (
                            <div
                                key={s.supplierId}
                                className={`p-3 rounded-lg mb-2 cursor-pointer flex justify-between items-center ${selectedSupplierId === s.supplierId
                                    ? 'bg-purple-600'
                                    : 'bg-slate-700 hover:bg-slate-600'
                                    }`}
                                onClick={() => setSelectedSupplierId(s.supplierId)}
                            >
                                <div>
                                    <div className="text-white font-medium">{s.supplierName}</div>
                                    <div className="text-sm text-gray-400">Товаров: {s.items.length}</div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveSupplier(s.supplierId);
                                    }}
                                    className="text-red-400 hover:text-red-300 text-lg"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                        {filteredSuppliers.length === 0 && (
                            <div className="text-center text-gray-500 py-8">
                                Нет поставщиков
                            </div>
                        )}
                    </div>
                </div>

                {/* Правая панель — Товары */}
                <div className="flex-1 bg-slate-800 rounded-lg flex flex-col">
                    <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-white">
                            Товары {selectedSupplier ? `- ${selectedSupplier.supplierName}` : ''}
                        </h2>
                        {selectedSupplier && (
                            <button
                                onClick={() => setShowProductModal(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                            >
                                + Добавить продукцию
                            </button>
                        )}
                    </div>
                    <div className="flex-1 overflow-auto">
                        {!selectedSupplier ? (
                            <div className="text-center text-gray-500 py-16">
                                Выберите поставщика слева
                            </div>
                        ) : selectedSupplier.items.length === 0 ? (
                            <div className="text-center text-gray-500 py-16">
                                Нет товаров. Нажмите "Добавить продукцию"
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-slate-700 sticky top-0">
                                    <tr>
                                        <th className="text-left p-3 text-gray-300">Наименование товара</th>
                                        <th className="text-right p-3 text-gray-300 w-40">Цена закупки</th>
                                        <th className="text-center p-3 text-gray-300 w-32">Дата прайса</th>
                                        <th className="w-16"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedSupplier.items.map(item => (
                                        <tr key={item.productId} className="border-t border-slate-700">
                                            <td className="p-3 text-white">
                                                <div>{item.productName}</div>
                                                <div className="text-sm text-gray-500">{item.productCode}</div>
                                            </td>
                                            <td className="p-3">
                                                <input
                                                    type="number"
                                                    value={item.purchasePrice || ''}
                                                    onChange={(e) => handlePriceChange(item.productId, Number(e.target.value))}
                                                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-right"
                                                    placeholder="0.00"
                                                    min="0"
                                                    step="0.01"
                                                />
                                            </td>
                                            <td className="p-3 text-center text-gray-400">
                                                {date ? new Date(date).toLocaleDateString('ru-RU') : '-'}
                                            </td>
                                            <td className="p-3">
                                                <button
                                                    onClick={() => handleRemoveProduct(item.productId)}
                                                    className="text-red-400 hover:text-red-300"
                                                >
                                                    🗑
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Модальное окно добавления поставщика */}
            {showAddSupplierModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-slate-800 rounded-lg w-[900px] max-h-[700px] flex flex-col">
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-white">Выбор поставщика</h3>
                            <button
                                onClick={() => {
                                    setShowAddSupplierModal(false);
                                    setSupplierModalSearch('');
                                }}
                                className="text-gray-400 hover:text-white text-xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-4 border-b border-slate-700">
                            <input
                                type="text"
                                placeholder="Поиск по названию, альт. названию, телефону, Telegram..."
                                value={supplierModalSearch}
                                onChange={(e) => setSupplierModalSearch(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full">
                                <thead className="bg-slate-700 sticky top-0">
                                    <tr>
                                        <th className="text-left p-3 text-gray-300">Название поставщика</th>
                                        <th className="text-left p-3 text-gray-300">Юридическое название</th>
                                        <th className="text-left p-3 text-gray-300">Телефон</th>
                                        <th className="text-left p-3 text-gray-300">Telegram</th>
                                        <th className="w-32"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredModalSuppliers.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center p-8 text-gray-500">
                                                Поставщики не найдены
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredModalSuppliers.map(s => {
                                            const added = isSupplierAdded(s.id);
                                            const isInactive = !s.isActive;
                                            return (
                                                <tr key={s.id} className={`border-t border-slate-700 hover:bg-slate-700/50 ${isInactive ? 'opacity-50' : ''}`}>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-white font-medium">{s.name}</span>
                                                            {isInactive && (
                                                                <span className="text-xs bg-red-600/50 text-red-200 px-1.5 py-0.5 rounded">Неактивен</span>
                                                            )}
                                                        </div>
                                                        {s.altName && <div className="text-sm text-gray-500">{s.altName}</div>}
                                                    </td>
                                                    <td className="p-3 text-gray-300">{s.legalName || '-'}</td>
                                                    <td className="p-3 text-gray-300">{s.phone || '-'}</td>
                                                    <td className="p-3 text-gray-300">{s.telegram || '-'}</td>
                                                    <td className="p-3 text-center">
                                                        {added ? (
                                                            <span className="text-green-400 text-sm">✓ Добавлен</span>
                                                        ) : isInactive ? (
                                                            <span className="text-gray-500 text-sm">—</span>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleAddSupplier(s)}
                                                                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm"
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
                        <div className="p-4 border-t border-slate-700 flex justify-end">
                            <button
                                onClick={() => {
                                    setShowAddSupplierModal(false);
                                    setSupplierModalSearch('');
                                }}
                                className="bg-slate-600 hover:bg-slate-500 text-white px-6 py-2 rounded-lg"
                            >
                                Готово
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модальное окно добавления продукции */}
            {showProductModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-slate-800 rounded-lg w-[600px] max-h-[600px] flex flex-col">
                        <div className="p-4 border-b border-slate-700">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-lg font-semibold text-white">Добавить продукцию</h3>
                                <button
                                    onClick={() => {
                                        setShowProductModal(false);
                                        setProductSearch('');
                                        setAddedProductIds(new Set());
                                    }}
                                    className="text-gray-400 hover:text-white text-xl"
                                >
                                    ×
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="Поиск товара..."
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            {filteredProducts.slice(0, 50).map(p => {
                                const isAdded = addedProductIds.has(p.id);
                                const isAlreadyInList = selectedSupplier?.items.some(i => i.productId === p.id);
                                return (
                                    <div
                                        key={p.id}
                                        className="p-3 bg-slate-700 rounded-lg mb-2 flex items-center justify-between"
                                    >
                                        <div className="flex-1">
                                            <div className="text-white font-medium">{p.name}</div>
                                            <div className="text-sm text-gray-400">{p.code}</div>
                                        </div>
                                        <button
                                            onClick={() => !isAdded && !isAlreadyInList && handleAddProduct(p)}
                                            disabled={isAdded || isAlreadyInList}
                                            className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${isAdded || isAlreadyInList
                                                    ? 'bg-green-600/30 text-green-400 cursor-default'
                                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                                }`}
                                        >
                                            {isAdded || isAlreadyInList ? '✓ Добавлен' : 'Добавить'}
                                        </button>
                                    </div>
                                );
                            })}
                            {filteredProducts.length > 50 && (
                                <div className="text-center text-gray-500 py-2">
                                    Показано 50 из {filteredProducts.length}. Уточните поиск.
                                </div>
                            )}
                        </div>
                        {/* Кнопка закрыть */}
                        <div className="p-4 border-t border-slate-700 flex justify-end">
                            <button
                                onClick={() => {
                                    setShowProductModal(false);
                                    setProductSearch('');
                                    setAddedProductIds(new Set());
                                }}
                                className="bg-slate-600 hover:bg-slate-500 text-white px-6 py-2 rounded-lg"
                            >
                                Закрыть
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
