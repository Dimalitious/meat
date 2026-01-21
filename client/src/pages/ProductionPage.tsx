import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import {
    Search, Plus, Trash2, Save, Check, Edit2, Copy, X, User, Calendar,
    Package, FileText, AlertCircle, ChevronRight
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

// MML и Batch интерфейсы
interface MmlItem {
    id: number;
    lineNo: number;
    componentProductId: number | null;
    componentProduct: Product | null;
}

interface Mml {
    id: number;
    productId: number;
    product: Product;
    creator: { id: number; name: string };
    isLocked: boolean;
    items: MmlItem[];
    createdAt: string;
}

interface BatchItem {
    id: number;
    lineNo: number;
    componentProductId: number | null;
    componentProduct: Product | null;
    value: number | null;
}

interface Batch {
    id: number;
    productId: number;
    product: Product;
    user: { id: number; name: string };
    quantity: number | null;
    mmlId: number | null;
    isLocked: boolean;
    items: BatchItem[];
    createdAt: string;
    warning?: string;
}

type ProductionTab = 'journal' | 'batch' | 'mml';

export default function ProductionPage() {
    const { user } = useAuth();
    const today = new Date().toISOString().split('T')[0];
    const token = localStorage.getItem('token');

    // Tab state
    const [activeTab, setActiveTab] = useState<ProductionTab>('journal');

    // Журнал производства state
    const [date, setDate] = useState(today);
    const [journal, setJournal] = useState<ProductionJournal | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
    const [showProductModal, setShowProductModal] = useState(false);
    const [modalSearch, setModalSearch] = useState('');
    const [editingItemId, setEditingItemId] = useState<number | null>(null);

    // MML state
    const [mmls, setMmls] = useState<Mml[]>([]);
    const [selectedMml, setSelectedMml] = useState<Mml | null>(null);

    // Batch state
    const [batches, setBatches] = useState<Batch[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);

    // MML/Batch modal state
    const [productModalType, setProductModalType] = useState<'add-card' | 'mml' | 'batch' | 'component'>('add-card');
    const [editingLine, setEditingLine] = useState<{ type: 'mml' | 'batch', id: number, lineNo: number } | null>(null);
    const [warning, setWarning] = useState<string | null>(null);

    useEffect(() => {
        fetchProducts();
    }, []);

    useEffect(() => {
        if (activeTab === 'journal') {
            loadJournal();
        } else if (activeTab === 'mml') {
            fetchMmls();
        } else if (activeTab === 'batch') {
            fetchBatches();
        }
    }, [date, activeTab]);

    const fetchProducts = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/products`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProducts(res.data.filter((p: any) => p.status === 'active'));
        } catch (err) {
            console.error('Failed to fetch products:', err);
        }
    };

    // ========== ЖУРНАЛ ПРОИЗВОДСТВА ==========
    const loadJournal = async () => {
        setLoading(true);
        try {
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

    // ========== MML ФУНКЦИИ ==========
    const fetchMmls = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/production-module/mml`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMmls(res.data);
        } catch (err) {
            console.error('Failed to fetch MMLs:', err);
        }
    };

    const createMml = async (productId: number) => {
        try {
            const res = await axios.post(`${API_URL}/api/production-module/mml`,
                { productId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMmls([res.data, ...mmls]);
            setSelectedMml(res.data);
            setShowProductModal(false);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка создания MML');
        }
    };

    const updateMmlItem = async (mmlId: number, lineNo: number, componentProductId: number | null) => {
        try {
            await axios.put(`${API_URL}/api/production-module/mml/${mmlId}/item/${lineNo}`,
                { componentProductId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const res = await axios.get(`${API_URL}/api/production-module/mml/${mmlId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSelectedMml(res.data);
            setMmls(mmls.map(m => m.id === mmlId ? res.data : m));
            setShowProductModal(false);
            setEditingLine(null);
        } catch (err) {
            console.error('Failed to update MML item:', err);
        }
    };

    const lockMml = async (mmlId: number) => {
        try {
            const res = await axios.post(`${API_URL}/api/production-module/mml/${mmlId}/lock`, {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSelectedMml(res.data);
            setMmls(mmls.map(m => m.id === mmlId ? res.data : m));
        } catch (err) {
            console.error('Failed to lock MML:', err);
        }
    };

    const deleteMml = async (mmlId: number) => {
        if (!confirm('Удалить MML?')) return;
        try {
            await axios.delete(`${API_URL}/api/production-module/mml/${mmlId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMmls(mmls.filter(m => m.id !== mmlId));
            if (selectedMml?.id === mmlId) setSelectedMml(null);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка удаления');
        }
    };

    // ========== BATCH ФУНКЦИИ ==========
    const fetchBatches = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/production-module/batch`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBatches(res.data);
        } catch (err) {
            console.error('Failed to fetch batches:', err);
        }
    };

    const createBatch = async (productId: number) => {
        try {
            const res = await axios.post(`${API_URL}/api/production-module/batch`,
                { productId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setBatches([res.data, ...batches]);
            setSelectedBatch(res.data);
            if (res.data.warning) {
                setWarning(res.data.warning);
                setTimeout(() => setWarning(null), 5000);
            }
            setShowProductModal(false);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка создания выработки');
        }
    };

    const updateBatch = async (batchId: number, quantity: number) => {
        try {
            const res = await axios.put(`${API_URL}/api/production-module/batch/${batchId}`,
                { quantity },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSelectedBatch(res.data);
            setBatches(batches.map(b => b.id === batchId ? res.data : b));
        } catch (err) {
            console.error('Failed to update batch:', err);
        }
    };

    const updateBatchItem = async (batchId: number, lineNo: number, data: { componentProductId?: number | null, value?: number | null }) => {
        try {
            await axios.put(`${API_URL}/api/production-module/batch/${batchId}/item/${lineNo}`,
                data,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const res = await axios.get(`${API_URL}/api/production-module/batch/${batchId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSelectedBatch(res.data);
            setBatches(batches.map(b => b.id === batchId ? res.data : b));
            setShowProductModal(false);
            setEditingLine(null);
        } catch (err) {
            console.error('Failed to update batch item:', err);
        }
    };

    const lockBatch = async (batchId: number) => {
        try {
            const res = await axios.post(`${API_URL}/api/production-module/batch/${batchId}/lock`, {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSelectedBatch(res.data);
            setBatches(batches.map(b => b.id === batchId ? res.data : b));
        } catch (err) {
            console.error('Failed to lock batch:', err);
        }
    };

    const cloneBatch = async (batchId: number) => {
        try {
            const res = await axios.post(`${API_URL}/api/production-module/batch/${batchId}/clone`, {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setBatches([res.data, ...batches]);
            setSelectedBatch(res.data);
        } catch (err) {
            console.error('Failed to clone batch:', err);
        }
    };

    const deleteBatch = async (batchId: number) => {
        if (!confirm('Удалить выработку?')) return;
        try {
            await axios.delete(`${API_URL}/api/production-module/batch/${batchId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBatches(batches.filter(b => b.id !== batchId));
            if (selectedBatch?.id === batchId) setSelectedBatch(null);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка удаления');
        }
    };

    // Filtered lists
    const filteredModalProducts = products.filter(p =>
        p.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
        p.code.toLowerCase().includes(modalSearch.toLowerCase())
    );

    const journalProducts = journal?.items || [];
    const filteredJournalProducts = journalProducts.filter(item =>
        (item.productName || item.product?.name || '')
            .toLowerCase()
            .includes(productSearch.toLowerCase())
    );

    const filteredMmls = mmls.filter(m =>
        m.product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        m.product.code.toLowerCase().includes(productSearch.toLowerCase())
    );

    const filteredBatches = batches.filter(b =>
        b.product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        b.product.code.toLowerCase().includes(productSearch.toLowerCase())
    );

    const staffName = journal?.staff?.fullName || journal?.staff?.user?.name || user?.name || '-';

    // Modal handlers
    const openAddProductModal = (type: 'add-card' | 'mml' | 'batch' | 'component') => {
        setProductModalType(type);
        setModalSearch('');
        setEditingItemId(null);
        setEditingLine(null);
        setShowProductModal(true);
    };

    const openComponentModal = (type: 'mml' | 'batch', id: number, lineNo: number) => {
        setProductModalType('component');
        setEditingLine({ type, id, lineNo });
        setModalSearch('');
        setShowProductModal(true);
    };

    const handleProductSelect = (product: Product) => {
        if (productModalType === 'add-card') {
            if (editingItemId) {
                updateCardProduct(editingItemId, product);
            } else {
                addNewCard(product);
            }
        } else if (productModalType === 'mml') {
            createMml(product.id);
        } else if (productModalType === 'batch') {
            createBatch(product.id);
        } else if (productModalType === 'component' && editingLine) {
            if (editingLine.type === 'mml') {
                updateMmlItem(editingLine.id, editingLine.lineNo, product.id);
            } else {
                updateBatchItem(editingLine.id, editingLine.lineNo, { componentProductId: product.id });
            }
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-120px)]">
            {/* Warning Toast */}
            {warning && (
                <div className="fixed top-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50">
                    <AlertCircle size={20} />
                    {warning}
                </div>
            )}

            {/* Header with Tabs */}
            <div className="bg-white rounded-lg shadow p-4 mb-4">
                <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold">Производство</h1>
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('journal')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'journal'
                                    ? 'bg-white shadow text-indigo-700'
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <Calendar size={16} /> Журнал
                        </button>
                        <button
                            onClick={() => setActiveTab('batch')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'batch'
                                    ? 'bg-white shadow text-indigo-700'
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <Package size={16} /> Выработка
                        </button>
                        <button
                            onClick={() => setActiveTab('mml')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'mml'
                                    ? 'bg-white shadow text-purple-700'
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <FileText size={16} /> MML
                        </button>
                    </div>
                </div>
            </div>

            {/* ЖУРНАЛ TAB */}
            {activeTab === 'journal' && (
                <div className="flex gap-4 flex-1 overflow-hidden">
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
                                        setProductModalType('add-card');
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

                        {/* Карточки grid */}
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
                                            <div className="p-3">
                                                <div
                                                    className={`p-3 rounded border-2 border-dashed text-center mb-3 ${item.state === 'editing'
                                                        ? 'border-blue-300 bg-blue-50 cursor-pointer hover:bg-blue-100'
                                                        : 'border-gray-200 bg-gray-50'
                                                        }`}
                                                    onClick={() => {
                                                        if (item.state === 'editing') {
                                                            setProductModalType('add-card');
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
                </div>
            )}

            {/* BATCH/MML TAB */}
            {(activeTab === 'batch' || activeTab === 'mml') && (
                <div className="flex gap-4 flex-1 overflow-hidden">
                    {/* Левая панель */}
                    <div className="w-80 bg-white rounded-lg shadow flex flex-col">
                        <div className="p-4 border-b">
                            <h2 className="font-semibold mb-2">
                                {activeTab === 'mml' ? 'Калькуляции MML' : 'Карточки выработки'}
                            </h2>
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
                            <Button
                                size="sm"
                                onClick={() => openAddProductModal(activeTab)}
                                className="w-full"
                            >
                                <Plus size={14} className="mr-1" />
                                Добавить позицию
                            </Button>
                        </div>

                        <div className="flex-1 overflow-auto p-2">
                            {activeTab === 'mml' ? (
                                filteredMmls.length === 0 ? (
                                    <div className="text-center text-gray-400 py-8">Нет MML</div>
                                ) : (
                                    filteredMmls.map(mml => (
                                        <div
                                            key={mml.id}
                                            onClick={() => setSelectedMml(mml)}
                                            className={`cursor-pointer px-3 py-2 rounded mb-1 flex items-center justify-between ${selectedMml?.id === mml.id ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-50'
                                                }`}
                                        >
                                            <div>
                                                <div className="font-medium text-sm">{mml.product.name}</div>
                                                <div className="text-xs text-gray-500">{mml.product.code}</div>
                                            </div>
                                            {mml.isLocked && <Check size={16} className="text-green-600" />}
                                        </div>
                                    ))
                                )
                            ) : (
                                filteredBatches.length === 0 ? (
                                    <div className="text-center text-gray-400 py-8">Нет выработок</div>
                                ) : (
                                    filteredBatches.map(batch => (
                                        <div
                                            key={batch.id}
                                            onClick={() => setSelectedBatch(batch)}
                                            className={`cursor-pointer px-3 py-2 rounded mb-1 flex items-center justify-between ${selectedBatch?.id === batch.id ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-50'
                                                }`}
                                        >
                                            <div>
                                                <div className="font-medium text-sm">{batch.product.name}</div>
                                                <div className="text-xs text-gray-500">{batch.product.code} • {batch.user.name}</div>
                                            </div>
                                            {batch.isLocked && <Check size={16} className="text-green-600" />}
                                        </div>
                                    ))
                                )
                            )}
                        </div>
                    </div>

                    {/* Правая панель - Карточка */}
                    <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
                        {activeTab === 'mml' && selectedMml ? (
                            <>
                                <div className="p-4 border-b flex justify-between items-start">
                                    <div>
                                        <h2 className="text-lg font-semibold">MML: {selectedMml.product.name}</h2>
                                        <div className="text-sm text-gray-500">Код: {selectedMml.product.code}</div>
                                        <div className="mt-2">
                                            {selectedMml.isLocked ? (
                                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">✓ Зафиксирован</span>
                                            ) : (
                                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">Редактирование</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {!selectedMml.isLocked && (
                                            <>
                                                <Button variant="outline" size="sm" onClick={() => lockMml(selectedMml.id)} className="text-green-600 border-green-600">
                                                    <Check size={16} className="mr-1" /> Зафиксировать
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => deleteMml(selectedMml.id)} className="text-red-600 border-red-600">
                                                    <Trash2 size={16} />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1 p-4 overflow-auto">
                                    <h3 className="font-medium mb-3">Состав (5 строк)</h3>
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="text-left px-4 py-2 text-sm font-medium text-gray-700 w-16">№</th>
                                                <th className="text-left px-4 py-2 text-sm font-medium text-gray-700">Компонент</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedMml.items.map(item => (
                                                <tr key={item.lineNo} className="border-b">
                                                    <td className="px-4 py-3 text-gray-500">{item.lineNo}</td>
                                                    <td className="px-4 py-3">
                                                        {selectedMml.isLocked ? (
                                                            item.componentProduct?.name || <span className="text-gray-400">—</span>
                                                        ) : (
                                                            <button
                                                                onClick={() => openComponentModal('mml', selectedMml.id, item.lineNo)}
                                                                className="text-left w-full px-3 py-1 border rounded hover:bg-gray-50 text-sm"
                                                            >
                                                                {item.componentProduct?.name || <span className="text-gray-400">Выбрать товар...</span>}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : activeTab === 'batch' && selectedBatch ? (
                            <>
                                <div className="p-4 border-b flex justify-between items-start">
                                    <div>
                                        <h2 className="text-lg font-semibold">Выработка: {selectedBatch.product.name}</h2>
                                        <div className="text-sm text-gray-500">Код: {selectedBatch.product.code}</div>
                                        <div className="flex gap-2 mt-2">
                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                                Пользователь: {selectedBatch.user.name}
                                            </span>
                                            {selectedBatch.isLocked ? (
                                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">✓ Зафиксирована</span>
                                            ) : (
                                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">Редактирование</span>
                                            )}
                                            {!selectedBatch.mmlId && (
                                                <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">⚠ Нет MML</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => cloneBatch(selectedBatch.id)}>
                                            <Copy size={16} className="mr-1" /> Клонировать
                                        </Button>
                                        {!selectedBatch.isLocked && (
                                            <>
                                                <Button variant="outline" size="sm" onClick={() => lockBatch(selectedBatch.id)} className="text-green-600 border-green-600">
                                                    <Check size={16} className="mr-1" /> Зафиксировать
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => deleteBatch(selectedBatch.id)} className="text-red-600 border-red-600">
                                                    <Trash2 size={16} />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1 p-4 overflow-auto">
                                    <div className="mb-6 flex items-center gap-4">
                                        <label className="font-medium">Количество:</label>
                                        <input
                                            type="number"
                                            value={selectedBatch.quantity ?? ''}
                                            onChange={e => updateBatch(selectedBatch.id, Number(e.target.value))}
                                            disabled={selectedBatch.isLocked}
                                            className="border rounded px-3 py-2 w-40 text-right disabled:bg-gray-100"
                                            step="0.001"
                                            placeholder="0.000"
                                        />
                                    </div>
                                    <h3 className="font-medium mb-3">Состав (5 строк)</h3>
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="text-left px-4 py-2 text-sm font-medium text-gray-700 w-16">№</th>
                                                <th className="text-left px-4 py-2 text-sm font-medium text-gray-700">Компонент</th>
                                                <th className="text-right px-4 py-2 text-sm font-medium text-gray-700 w-40">Значение</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedBatch.items.map(item => (
                                                <tr key={item.lineNo} className="border-b">
                                                    <td className="px-4 py-3 text-gray-500">{item.lineNo}</td>
                                                    <td className="px-4 py-3">
                                                        {selectedBatch.isLocked ? (
                                                            item.componentProduct?.name || <span className="text-gray-400">—</span>
                                                        ) : (
                                                            <button
                                                                onClick={() => openComponentModal('batch', selectedBatch.id, item.lineNo)}
                                                                className="text-left w-full px-3 py-1 border rounded hover:bg-gray-50 text-sm"
                                                            >
                                                                {item.componentProduct?.name || <span className="text-gray-400">Выбрать товар...</span>}
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="number"
                                                            value={item.value ?? ''}
                                                            onChange={e => updateBatchItem(selectedBatch.id, item.lineNo, { value: Number(e.target.value) || null })}
                                                            disabled={selectedBatch.isLocked}
                                                            className="w-full text-right border rounded px-3 py-1 text-sm disabled:bg-gray-100"
                                                            step="0.001"
                                                            placeholder="0.000"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-500">
                                <div className="text-center">
                                    {activeTab === 'mml' ? (
                                        <>
                                            <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                                            <p>Выберите MML из списка слева</p>
                                            <p className="text-sm mt-2">или создайте новый</p>
                                        </>
                                    ) : (
                                        <>
                                            <Package size={48} className="mx-auto mb-4 text-gray-300" />
                                            <p>Выберите выработку из списка слева</p>
                                            <p className="text-sm mt-2">или создайте новую</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Product Modal */}
            {showProductModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-semibold">
                                {productModalType === 'component' ? 'Выбор компонента' : 'Выбор позиции'}
                            </h3>
                            <button onClick={() => { setShowProductModal(false); setEditingItemId(null); setEditingLine(null); }} className="text-gray-500 hover:text-gray-700">
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
                            {filteredModalProducts.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">Товары не найдены</div>
                            ) : (
                                filteredModalProducts.slice(0, 50).map(product => (
                                    <button
                                        key={product.id}
                                        onClick={() => handleProductSelect(product)}
                                        className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded flex justify-between items-center group"
                                    >
                                        <div>
                                            <div className="font-medium group-hover:text-blue-700">{product.name}</div>
                                            <div className="text-xs text-gray-500">{product.code}</div>
                                        </div>
                                        <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-600" />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
