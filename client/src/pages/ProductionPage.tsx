import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import {
    Search, Plus, Trash2, Save, Check, Edit2, Copy, X, User, Calendar
} from 'lucide-react';

interface Product {
    id: number;
    code: string;
    name: string;
    category: string | null;
}

interface ProductionItem {
    id: number;
    journalId: number;
    productId: number | null;
    productName: string | null;
    state: 'editing' | 'locked';
    sortOrder: number;
    product?: Product | null;
    values?: { fieldKey: string; fieldValue: string }[];
}

interface ProductionJournal {
    id: number;
    productionDate: string;
    staffId: number;
    status: string;
    staff?: {
        id: number;
        fullName: string;
        user?: { name: string; username: string };
    };
    items: ProductionItem[];
}

export default function ProductionPage() {
    const { user } = useAuth();
    const today = new Date().toISOString().split('T')[0];

    const [date, setDate] = useState(today);
    const [journal, setJournal] = useState<ProductionJournal | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Левая панель - поиск и выбранные товары
    const [productSearch, setProductSearch] = useState('');
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());

    // Модалка выбора товара
    const [showProductModal, setShowProductModal] = useState(false);
    const [modalSearch, setModalSearch] = useState('');
    const [editingItemId, setEditingItemId] = useState<number | null>(null);

    useEffect(() => {
        fetchProducts();
    }, []);

    useEffect(() => {
        loadJournal();
    }, [date]);

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

    const loadJournal = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/production/journal/${date}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setJournal(res.data);
            setSelectedProducts(new Set());
        } catch (err) {
            console.error('Failed to load journal:', err);
        } finally {
            setLoading(false);
        }
    };

    const saveJournal = async () => {
        if (!journal) return;
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.put(`${API_URL}/api/production/journal/${journal.id}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setJournal(res.data);
            alert('Документ сохранён!');
        } catch (err) {
            console.error('Failed to save journal:', err);
            alert('Ошибка сохранения');
        } finally {
            setSaving(false);
        }
    };

    const addNewCard = async (product?: Product) => {
        if (!journal) return;
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/api/production/journal/${journal.id}/items`, {
                productId: product?.id || null,
                productName: product?.name || null
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setJournal({
                ...journal,
                items: [...journal.items, res.data]
            });
            setShowProductModal(false);
        } catch (err) {
            console.error('Failed to add card:', err);
        }
    };

    const updateCardProduct = async (itemId: number, product: Product) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.put(`${API_URL}/api/production/items/${itemId}`, {
                productId: product.id,
                productName: product.name
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (journal) {
                setJournal({
                    ...journal,
                    items: journal.items.map(i => i.id === itemId ? res.data : i)
                });
            }
            setShowProductModal(false);
            setEditingItemId(null);
        } catch (err) {
            console.error('Failed to update card:', err);
        }
    };

    const lockCard = async (itemId: number) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/api/production/items/${itemId}/lock`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (journal) {
                setJournal({
                    ...journal,
                    items: journal.items.map(i => i.id === itemId ? res.data : i)
                });
            }
        } catch (err) {
            console.error('Failed to lock card:', err);
        }
    };

    const unlockCard = async (itemId: number) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/api/production/items/${itemId}/unlock`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (journal) {
                setJournal({
                    ...journal,
                    items: journal.items.map(i => i.id === itemId ? res.data : i)
                });
            }
        } catch (err) {
            console.error('Failed to unlock card:', err);
        }
    };

    const cloneCard = async (itemId: number) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/api/production/items/${itemId}/clone`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (journal) {
                setJournal({
                    ...journal,
                    items: [...journal.items, res.data]
                });
            }
        } catch (err) {
            console.error('Failed to clone card:', err);
        }
    };

    const deleteSelectedItems = async () => {
        if (selectedProducts.size === 0) return;
        if (!confirm(`Удалить ${selectedProducts.size} позиций?`)) return;

        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/production/items/delete-multiple`, {
                ids: Array.from(selectedProducts)
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (journal) {
                setJournal({
                    ...journal,
                    items: journal.items.filter(i => !selectedProducts.has(i.id))
                });
            }
            setSelectedProducts(new Set());
        } catch (err) {
            console.error('Failed to delete items:', err);
        }
    };

    const toggleProductSelection = (itemId: number) => {
        const newSet = new Set(selectedProducts);
        if (newSet.has(itemId)) {
            newSet.delete(itemId);
        } else {
            newSet.add(itemId);
        }
        setSelectedProducts(newSet);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ru-RU');
    };

    // Фильтрованные товары в модалке
    const filteredModalProducts = products.filter(p =>
        p.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
        p.code.toLowerCase().includes(modalSearch.toLowerCase())
    );

    // Товары в левой панели (из карточек)
    const journalProducts = journal?.items || [];
    const filteredJournalProducts = journalProducts.filter(item =>
        (item.productName || item.product?.name || '')
            .toLowerCase()
            .includes(productSearch.toLowerCase())
    );

    const staffName = journal?.staff?.fullName || journal?.staff?.user?.name || user?.name || '-';

    return (
        <div className="flex h-[calc(100vh-120px)] gap-4">
            {/* Левая панель - Список товаров документа */}
            <div className="w-80 bg-white rounded-lg shadow flex flex-col">
                <div className="p-4 border-b">
                    <h2 className="font-semibold mb-2">Позиции документа</h2>
                    <div className="relative mb-3">
                        <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Поиск..."
                            className="w-full border rounded pl-8 pr-3 py-2 text-sm"
                            value={productSearch}
                            onChange={e => setProductSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={deleteSelectedItems}
                            disabled={selectedProducts.size === 0}
                            className="flex-1"
                        >
                            <Trash2 size={14} className="mr-1" />
                            Удалить ({selectedProducts.size})
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => {
                                setModalSearch('');
                                setEditingItemId(null);
                                setShowProductModal(true);
                            }}
                            className="flex-1"
                        >
                            <Plus size={14} className="mr-1" />
                            Добавить
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-2">
                    {filteredJournalProducts.length === 0 ? (
                        <div className="text-center text-gray-400 py-8">
                            Нет позиций
                        </div>
                    ) : (
                        filteredJournalProducts.map(item => (
                            <div
                                key={item.id}
                                className={`flex items-center gap-2 px-3 py-2 rounded mb-1 ${item.state === 'locked' ? 'bg-gray-100 opacity-60' : 'hover:bg-gray-50'
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedProducts.has(item.id)}
                                    onChange={() => toggleProductSelection(item.id)}
                                    className="rounded"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm truncate">
                                        {item.productName || item.product?.name || 'Не выбран'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {item.state === 'locked' ? '🔒 Заблокирована' : '✏️ Редактирование'}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-2 border-t">
                    <a href="/products" className="text-blue-600 hover:underline text-sm block text-center">
                        Открыть справочник товаров
                    </a>
                </div>
            </div>

            {/* Правая область - Карточки */}
            <div className="flex-1 flex flex-col">
                {/* Верхняя панель */}
                <div className="bg-white rounded-lg shadow p-4 mb-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Calendar size={18} className="text-gray-500" />
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="border rounded px-3 py-1.5"
                            />
                        </div>
                        {journal && (
                            <span className={`px-2.5 py-0.5 rounded text-xs font-medium ${journal.status === 'saved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                {journal.status === 'saved' ? 'Сохранено' : 'Черновик'}
                            </span>
                        )}
                    </div>
                    <Button onClick={saveJournal} disabled={saving || !journal}>
                        <Save size={16} className="mr-2" />
                        Сохранить
                    </Button>
                </div>

                {/* Карточки */}
                <div className="flex-1 bg-gray-50 rounded-lg p-4 overflow-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            Загрузка...
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {journal?.items.map(item => (
                                <div
                                    key={item.id}
                                    className={`bg-white rounded-lg shadow-sm border-2 transition-all ${item.state === 'locked'
                                            ? 'border-gray-200 opacity-70 bg-gray-50'
                                            : 'border-blue-200 hover:shadow-md'
                                        }`}
                                >
                                    {/* Шапка карточки */}
                                    <div className="p-3 border-b bg-gray-50 rounded-t-lg">
                                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                                            <User size={14} />
                                            <span className="font-medium">{staffName}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <Calendar size={12} />
                                            <span>{formatDate(journal?.productionDate || date)}</span>
                                        </div>
                                    </div>

                                    {/* Тело карточки */}
                                    <div className="p-3">
                                        {/* Товар */}
                                        <div
                                            className={`p-3 rounded border-2 border-dashed text-center mb-3 ${item.state === 'editing'
                                                    ? 'border-blue-300 bg-blue-50 cursor-pointer hover:bg-blue-100'
                                                    : 'border-gray-200 bg-gray-50'
                                                }`}
                                            onClick={() => {
                                                if (item.state === 'editing') {
                                                    setEditingItemId(item.id);
                                                    setModalSearch('');
                                                    setShowProductModal(true);
                                                }
                                            }}
                                        >
                                            {item.productName || item.product?.name ? (
                                                <span className="font-medium text-gray-800">
                                                    {item.productName || item.product?.name}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">
                                                    {item.state === 'editing' ? 'Нажмите для выбора товара' : 'Товар не выбран'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Кнопки действий */}
                                        <div className="flex justify-between items-center">
                                            <div className="flex gap-1">
                                                {item.state === 'editing' ? (
                                                    <button
                                                        onClick={() => lockCard(item.id)}
                                                        className="p-2 rounded bg-green-500 text-white hover:bg-green-600"
                                                        title="Сохранить (заблокировать)"
                                                    >
                                                        <Check size={16} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => unlockCard(item.id)}
                                                        className="p-2 rounded bg-blue-500 text-white hover:bg-blue-600"
                                                        title="Редактировать"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => cloneCard(item.id)}
                                                    className="p-2 rounded text-gray-600 hover:bg-gray-100"
                                                    title="Клонировать"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                                <button
                                                    onClick={() => addNewCard()}
                                                    className="p-2 rounded text-blue-600 hover:bg-blue-50"
                                                    title="Добавить пустую карточку"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Кнопка добавления новой карточки */}
                            <div
                                onClick={() => addNewCard()}
                                className="bg-white rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center min-h-[200px] cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
                            >
                                <div className="text-center text-gray-400">
                                    <Plus size={32} className="mx-auto mb-2" />
                                    <span>Добавить карточку</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Модальное окно выбора товара */}
            {showProductModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-semibold">
                                {editingItemId ? 'Выбор товара' : 'Добавить товар'}
                            </h3>
                            <button onClick={() => { setShowProductModal(false); setEditingItemId(null); }} className="text-gray-500 hover:text-gray-700">
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
                                    value={modalSearch}
                                    onChange={e => setModalSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-2 max-h-[400px]">
                            {filteredModalProducts.slice(0, 50).map(product => (
                                <button
                                    key={product.id}
                                    onClick={() => {
                                        if (editingItemId) {
                                            updateCardProduct(editingItemId, product);
                                        } else {
                                            addNewCard(product);
                                        }
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded flex justify-between items-center"
                                >
                                    <div>
                                        <div className="font-medium">{product.name}</div>
                                        <div className="text-xs text-gray-500">{product.code}</div>
                                    </div>
                                    <span className="text-blue-600 text-sm">Выбрать →</span>
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
