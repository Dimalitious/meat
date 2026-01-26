import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { formatNumber } from '../utils/formatters';
import {
    Search, Plus, Save, Check, Edit2, X, User, Calendar,
    Package, AlertCircle, FolderTree, Download, BarChart3
} from 'lucide-react';


// ============================================
// ИНТЕРФЕЙСЫ
// ============================================

interface Product {
    id: number;
    code: string;
    name: string;
    category: string | null;
}

interface MmlNode {
    id: number;
    mmlId: number;
    parentNodeId: number | null;
    productId: number;
    sortOrder: number;
    product: Product;
    children: MmlNode[];
}

interface Mml {
    id: number;
    productId: number;
    product: Product;
    creator: { id: number; name: string };
    isLocked: boolean;
    createdAt: string;
    rootNodes: MmlNode[];
}

interface RunValue {
    id: number;
    mmlNodeId: number;
    value: number | null;
    staffId?: number | null;
    recordedAt?: string;
    staff?: { id: number; fullName: string } | null;
    node?: MmlNode;
}

interface ProductionRun {
    id: number;
    productId: number;
    mmlId: number;
    userId: number;
    isLocked: boolean;
    createdAt: string;
    productionDate: string;
    plannedWeight: number | null;
    actualWeight: number | null;
    isHidden: boolean;
    sourceType: string;
    product: Product;
    mml: Mml;
    user: { id: number; name: string };
    values: RunValue[];
}

interface CategoryGroup {
    category: string;
    nodes: MmlNode[];
    count: number;
}

interface StaffInfo {
    id: number | null;
    fullName: string;
    userId: number;
}

interface PurchaseItem {
    purchaseItemId: number;
    purchaseId: number;
    purchaseDate: string;
    productId: number;
    productCode: string;
    productName: string;
    category: string | null;
    qty: number;
    supplierName: string;
}

interface OpeningBalanceItem {
    productId: number;
    productCode: string;
    productName: string;
    category: string | null;
    openingBalance: number;
    sourceDate: string;
}

export default function ProductionV3Page() {
    useAuth();
    const token = localStorage.getItem('token');

    // Состояния
    const [products, setProducts] = useState<Product[]>([]);
    const [runs, setRuns] = useState<ProductionRun[]>([]);
    const [selectedRun, setSelectedRun] = useState<ProductionRun | null>(null);
    const [runValues, setRunValues] = useState<Map<number, RunValue[]>>(new Map());
    const [categories, setCategories] = useState<CategoryGroup[]>([]);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [currentStaff, setCurrentStaff] = useState<StaffInfo | null>(null);

    // Фильтры
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const [productSearch, setProductSearch] = useState('');
    const [listLoaded, setListLoaded] = useState(false);

    // Вкладки левой панели: 'runs' | 'purchases' | 'balances'
    const [activeTab, setActiveTab] = useState<'runs' | 'purchases' | 'balances'>('runs');

    // Модальные окна
    const [showProductModal, setShowProductModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showAddValueModal, setShowAddValueModal] = useState(false);
    const [modalSearch, setModalSearch] = useState('');
    const [newValueAmount, setNewValueAmount] = useState('');
    const [selectedNodeForValue, setSelectedNodeForValue] = useState<MmlNode | null>(null);
    const [editingValueId, setEditingValueId] = useState<number | null>(null);

    // Редактируемые поля
    const [editPlannedWeight, setEditPlannedWeight] = useState('');
    const [editProductionDate, setEditProductionDate] = useState('');

    // UI
    const [loading, setLoading] = useState(false);
    const [warning, setWarning] = useState<string | null>(null);

    // Данные Закуп/Остатки
    const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
    const [balanceItems, setBalanceItems] = useState<OpeningBalanceItem[]>([]);
    const [selectedPurchaseItems, setSelectedPurchaseItems] = useState<Set<number>>(new Set());
    const [selectedBalanceItems, setSelectedBalanceItems] = useState<Set<number>>(new Set());
    const [purchaseLoading, setPurchaseLoading] = useState(false);
    const [balanceLoading, setBalanceLoading] = useState(false);

    // Выбранная позиция для детального просмотра
    const [selectedPurchase, setSelectedPurchase] = useState<PurchaseItem | null>(null);
    const [selectedBalance, setSelectedBalance] = useState<OpeningBalanceItem | null>(null);

    // MML модальное окно для закупок/остатков
    const [showMmlModal, setShowMmlModal] = useState(false);
    const [mmlModalData, setMmlModalData] = useState<{
        productId: number;
        productName: string;
        sourceType: 'PURCHASE' | 'OPENING_BALANCE';
        sourceQty: number;
        sourceItemId?: number;
    } | null>(null);
    const [mmlCategories, setMmlCategories] = useState<CategoryGroup[]>([]);
    const [mmlActiveCategory, setMmlActiveCategory] = useState<string | null>(null);
    const [mmlValues, setMmlValues] = useState<Map<number, number>>(new Map());
    const [mmlLoading, setMmlLoading] = useState(false);
    const [mmlId, setMmlId] = useState<number | null>(null);

    // ============================================
    // ЗАГРУЗКА ДАННЫХ
    // ============================================

    useEffect(() => {
        fetchProducts();
        fetchCurrentStaff();
        // Устанавливаем даты по умолчанию на сегодня
        const today = new Date().toISOString().slice(0, 10);
        if (!dateFrom) setDateFrom(today);
        if (!dateTo) setDateTo(today);
    }, []);

    // Автозагрузка списка при изменении дат
    useEffect(() => {
        if (dateFrom && dateTo) {
            const timer = setTimeout(() => {
                // Загружаем в зависимости от активной вкладки
                if (activeTab === 'runs') {
                    fetchRunsAuto();
                } else if (activeTab === 'purchases') {
                    loadPurchaseItems();
                } else if (activeTab === 'balances') {
                    loadBalanceItems();
                }
            }, 500); // debounce 500ms
            return () => clearTimeout(timer);
        }
    }, [dateFrom, dateTo, activeTab]);

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

    const fetchCurrentStaff = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/production-v2/staff/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCurrentStaff(res.data);
        } catch (err) {
            console.error('Failed to fetch current staff:', err);
        }
    };

    // Автоматическая загрузка (без предупреждений)
    const fetchRunsAuto = async () => {
        if (!dateFrom || !dateTo) return;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('dateFrom', dateFrom);
            params.append('dateTo', dateTo);

            const res = await axios.get(`${API_URL}/api/production-v2/runs?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRuns(res.data);
            setListLoaded(true);
        } catch (err) {
            console.error('Failed to fetch runs:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadRunDetails = async (runId: number) => {
        try {
            const res = await axios.get(`${API_URL}/api/production-v2/runs/${runId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const run = res.data as ProductionRun;
            setSelectedRun(run);

            // Загружаем значения с информацией о сотрудниках
            const valuesRes = await axios.get(`${API_URL}/api/production-v2/runs/${runId}/values-staff`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const grouped = valuesRes.data.grouped as Record<number, RunValue[]>;
            setRunValues(new Map(Object.entries(grouped).map(([k, v]) => [Number(k), v])));

            // Загружаем категории MML
            if (run.mmlId) {
                const catRes = await axios.get(`${API_URL}/api/production-v2/mml/${run.mmlId}/categories`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setCategories(catRes.data);
                if (catRes.data.length > 0) {
                    setActiveCategory(catRes.data[0].category);
                }
            }

            setEditPlannedWeight(run.plannedWeight !== null ? String(run.plannedWeight) : '');
            setEditProductionDate(run.productionDate ? run.productionDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
        } catch (err) {
            console.error('Failed to load run details:', err);
        }
    };

    // Загрузка позиций закупок
    const loadPurchaseItems = async () => {
        if (!dateFrom || !dateTo) {
            setWarning('Сначала укажите период');
            setTimeout(() => setWarning(null), 3000);
            return;
        }
        setPurchaseLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/production-v2/purchases`, {
                params: { dateFrom, dateTo },
                headers: { Authorization: `Bearer ${token}` }
            });
            setPurchaseItems(res.data.items || []);
            setSelectedPurchaseItems(new Set());
        } catch (err) {
            console.error('Failed to load purchases:', err);
        } finally {
            setPurchaseLoading(false);
        }
    };

    // Загрузка остатков на начало
    const loadBalanceItems = async () => {
        if (!dateFrom) {
            setWarning('Укажите дату начала периода');
            setTimeout(() => setWarning(null), 3000);
            return;
        }
        setBalanceLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/production-v2/opening-balances`, {
                params: { date: dateFrom },
                headers: { Authorization: `Bearer ${token}` }
            });
            setBalanceItems(res.data.items || []);
            setSelectedBalanceItems(new Set());
        } catch (err) {
            console.error('Failed to load balances:', err);
        } finally {
            setBalanceLoading(false);
        }
    };

    // ============================================
    // MML МОДАЛЬНОЕ ОКНО ДЛЯ ЗАКУПОК/ОСТАТКОВ
    // ============================================

    // Открыть MML модал для закупки или остатка
    const openMmlModal = async (productId: number, productName: string, sourceType: 'PURCHASE' | 'OPENING_BALANCE', sourceQty: number, sourceItemId?: number) => {
        setMmlLoading(true);
        setMmlModalData({ productId, productName, sourceType, sourceQty, sourceItemId });
        setShowMmlModal(true);
        setMmlValues(new Map());

        try {
            // Получаем MML для товара
            const mmlRes = await axios.get(`${API_URL}/api/production-v2/mml/product/${productId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!mmlRes.data) {
                setWarning(`У товара "${productName}" нет MML структуры`);
                setTimeout(() => setWarning(null), 3000);
                setShowMmlModal(false);
                return;
            }

            setMmlId(mmlRes.data.id);

            // Загружаем категории MML
            const catRes = await axios.get(`${API_URL}/api/production-v2/mml/${mmlRes.data.id}/categories`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMmlCategories(catRes.data);
            if (catRes.data.length > 0) {
                setMmlActiveCategory(catRes.data[0].category);
            }
        } catch (err) {
            console.error('Failed to load MML:', err);
            setWarning('Не удалось загрузить структуру MML');
            setTimeout(() => setWarning(null), 3000);
            setShowMmlModal(false);
        } finally {
            setMmlLoading(false);
        }
    };

    // Создать выработку из закупки/остатка с MML значениями
    const createRunFromSource = async () => {
        console.log('createRunFromSource called', { mmlModalData, mmlId, mmlValues: Array.from(mmlValues.entries()) });
        if (!mmlModalData || !mmlId) {
            console.log('Early return - missing data', { mmlModalData: !!mmlModalData, mmlId });
            return;
        }

        try {
            // Создаём выработку
            console.log('Creating run...');
            const res = await axios.post(`${API_URL}/api/production-v2/runs`, {
                productId: mmlModalData.productId,
                sourceType: mmlModalData.sourceType,
                sourceItemId: mmlModalData.sourceItemId,
                productionDate: dateFrom
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('Run created:', res.data);

            const newRun = res.data.run || res.data;
            console.log('newRun:', newRun);

            // Сохраняем значения MML
            const values: { mmlNodeId: number; value: number }[] = [];
            mmlValues.forEach((value, nodeId) => {
                if (value > 0) {
                    values.push({ mmlNodeId: nodeId, value });
                }
            });
            console.log('Values to save:', values);

            if (values.length > 0) {
                console.log('Saving values...');
                const valRes = await axios.put(`${API_URL}/api/production-v2/runs/${newRun.id}/values`, {
                    values,
                    productionDate: dateFrom,
                    plannedWeight: mmlModalData.sourceQty
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log('Values saved:', valRes.data);
            }

            // Обновляем список
            setRuns([newRun, ...runs]);
            setShowMmlModal(false);
            setMmlModalData(null);
            setMmlCategories([]);
            setMmlValues(new Map());

            // Переключаемся на вкладку выработок и открываем созданную
            setActiveTab('runs');
            await loadRunDetails(newRun.id);

            setWarning('Выработка создана!');
            setTimeout(() => setWarning(null), 2000);
        } catch (err: any) {
            console.error('Failed to create run from source:', err);
            alert(err.response?.data?.error || 'Ошибка создания выработки');
        }
    };

    // Обновить значение в MML модале
    const updateMmlValue = (nodeId: number, value: string) => {
        const newValues = new Map(mmlValues);
        const numValue = parseFloat(value) || 0;
        if (numValue > 0) {
            newValues.set(nodeId, numValue);
        } else {
            newValues.delete(nodeId);
        }
        setMmlValues(newValues);
    };

    // Получить узлы активной категории MML модала
    const mmlActiveCategoryNodes = mmlCategories.find(c => c.category === mmlActiveCategory)?.nodes || [];

    // Итого по MML модалу
    const mmlTotalValue = Array.from(mmlValues.values()).reduce((sum, v) => sum + v, 0);

    // ============================================
    // ДЕЙСТВИЯ
    // ============================================

    const createRun = async (productId: number) => {
        try {
            const res = await axios.post(`${API_URL}/api/production-v2/runs`,
                { productId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const newRun = res.data.run || res.data;
            setRuns([newRun, ...runs]);
            await loadRunDetails(newRun.id);
            setShowProductModal(false);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка создания');
        }
    };

    const saveRunValues = async () => {
        if (!selectedRun) return;
        try {
            const allValues: { mmlNodeId: number; value: number }[] = [];
            runValues.forEach((entries, nodeId) => {
                const total = entries.reduce((sum, e) => sum + (Number(e.value) || 0), 0);
                allValues.push({ mmlNodeId: nodeId, value: total });
            });

            await axios.put(`${API_URL}/api/production-v2/runs/${selectedRun.id}/values`,
                { values: allValues, productionDate: editProductionDate, plannedWeight: editPlannedWeight ? Number(editPlannedWeight) : null },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setWarning('Сохранено!');
            setTimeout(() => setWarning(null), 2000);
        } catch (err) {
            console.error('Failed to save:', err);
            alert('Ошибка сохранения');
        }
    };

    const addValueEntry = async () => {
        if (!selectedRun || !selectedNodeForValue || !newValueAmount) return;
        try {
            await axios.post(`${API_URL}/api/production-v2/runs/${selectedRun.id}/values`,
                { mmlNodeId: selectedNodeForValue.id, value: Number(newValueAmount) },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await loadRunDetails(selectedRun.id);
            setShowAddValueModal(false);
            setNewValueAmount('');
            setSelectedNodeForValue(null);
        } catch (err) {
            console.error('Failed to add value:', err);
        }
    };

    const updateValueEntry = async () => {
        if (!editingValueId || !newValueAmount) return;
        try {
            await axios.patch(`${API_URL}/api/production-v2/runs/values/${editingValueId}`,
                { value: Number(newValueAmount) },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (selectedRun) await loadRunDetails(selectedRun.id);
            setShowAddValueModal(false);
            setNewValueAmount('');
            setEditingValueId(null);
        } catch (err) {
            console.error('Failed to update value:', err);
        }
    };

    const toggleRunLock = async (runId: number) => {
        try {
            const res = await axios.patch(`${API_URL}/api/production-v2/runs/${runId}/lock`, {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSelectedRun(res.data);
            setRuns(runs.map(r => r.id === runId ? res.data : r));
        } catch (err) {
            console.error('Failed to toggle lock:', err);
        }
    };

    // Фильтрация
    const filteredRuns = runs.filter(r =>
        r.product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        r.product.code.toLowerCase().includes(productSearch.toLowerCase())
    );

    const filteredModalProducts = products.filter(p =>
        p.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
        p.code.toLowerCase().includes(modalSearch.toLowerCase())
    );

    // Расчёт фактического веса
    const calculateActualWeight = (): number => {
        let total = 0;
        runValues.forEach((entries) => {
            entries.forEach(e => {
                if (e.value !== null) total += Number(e.value);
            });
        });
        return total;
    };

    // Получить узлы активной категории
    const activeCategoryNodes = categories.find(c => c.category === activeCategory)?.nodes || [];

    // ============================================
    // РЕНДЕР
    // ============================================

    return (
        <div className="flex flex-col h-[calc(100vh-120px)]">
            {/* Warning Toast */}
            {warning && (
                <div className="fixed top-4 right-4 bg-yellow-500/90 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 backdrop-blur">
                    <AlertCircle size={20} />
                    {warning}
                </div>
            )}

            {/* Header - тёмный стиль */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl shadow-xl p-4 mb-4 border border-slate-700">
                <h1 className="text-xl font-bold flex items-center gap-2 text-white">
                    <FolderTree className="text-indigo-400" />
                    <span className="bg-gradient-to-r from-indigo-400 to-purple-400 text-transparent bg-clip-text">Производство v3</span>
                </h1>
            </div>

            <div className="flex gap-4 flex-1 overflow-hidden">
                {/* Левая панель - тёмная */}
                <div className="w-96 bg-gradient-to-b from-slate-900 to-slate-800 rounded-xl shadow-xl flex flex-col border border-slate-700">
                    <div className="p-4 border-b border-slate-700">
                        <h2 className="font-semibold mb-2 flex items-center justify-between text-white">
                            Журнал выработки
                            {loading && <span className="text-xs text-slate-400 animate-pulse">загрузка...</span>}
                        </h2>

                        {/* Фильтры дат */}
                        <div className="flex gap-2 mb-3">
                            <div className="flex-1">
                                <label className="text-xs text-slate-400 block mb-1">Дата С</label>
                                <input type="date" className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                                    value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-slate-400 block mb-1">Дата По</label>
                                <input type="date" className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                                    value={dateTo} onChange={e => setDateTo(e.target.value)} />
                            </div>
                        </div>

                        {/* Счётчик найденных */}
                        {listLoaded && (
                            <div className="text-xs text-slate-400 mb-2">
                                Найдено: <span className="font-medium text-white">{runs.length}</span> выработок
                            </div>
                        )}

                        {/* Поиск */}
                        <div className="relative mb-3">
                            <Search className="absolute left-2 top-2.5 text-slate-400" size={16} />
                            <input type="text" placeholder="Поиск..." className="w-full bg-slate-800 border border-slate-600 rounded pl-8 pr-3 py-2 text-sm text-white placeholder-slate-500"
                                value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                        </div>

                        {/* Вкладки */}
                        <div className="flex gap-1 mb-3">
                            <button
                                onClick={() => setActiveTab('runs')}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'runs' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                                <Plus size={14} className="inline mr-1" /> Новая
                            </button>
                            <button
                                onClick={() => { setActiveTab('purchases'); loadPurchaseItems(); }}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'purchases' ? 'bg-green-600 text-white' : 'bg-slate-700 text-green-400 hover:bg-slate-600'}`}>
                                <Download size={14} className="inline mr-1" /> Закуп
                            </button>
                            <button
                                onClick={() => { setActiveTab('balances'); loadBalanceItems(); }}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'balances' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-blue-400 hover:bg-slate-600'}`}>
                                <BarChart3 size={14} className="inline mr-1" /> Остатки
                            </button>
                        </div>
                    </div>

                    {/* Список — зависит от activeTab */}
                    <div className="flex-1 overflow-auto">
                        {activeTab === 'runs' && (
                            <>
                                {loading ? (
                                    <div className="text-center text-gray-400 py-8">
                                        <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                        Загрузка...
                                    </div>
                                ) : !listLoaded ? (
                                    <div className="text-center text-gray-400 py-8">
                                        Укажите даты для загрузки
                                    </div>
                                ) : filteredRuns.length === 0 ? (
                                    <div className="text-center text-gray-400 py-8">Нет выработок за этот период</div>
                                ) : (
                                    <>
                                        {/* Кнопка создания */}
                                        <div className="p-2 border-b">
                                            <Button onClick={() => { setModalSearch(''); setShowProductModal(true); }} className="w-full">
                                                <Plus size={16} className="mr-1" /> Создать выработку
                                            </Button>
                                        </div>
                                        {filteredRuns.map(run => (
                                            <div key={run.id}
                                                onClick={() => loadRunDetails(run.id)}
                                                className={`flex items-center gap-2 px-4 py-2 border-b cursor-pointer transition-colors ${selectedRun?.id === run.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-gray-50'}`}>
                                                {run.sourceType === 'PURCHASE' && <span className="text-xs bg-green-100 text-green-700 px-1 rounded">ЗАКУП</span>}
                                                {run.sourceType === 'OPENING_BALANCE' && <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">ОСТАТОК</span>}
                                                <Package size={14} className="text-indigo-600" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-sm truncate">{run.product.name}</div>
                                                    <div className="text-xs text-gray-500">{run.isLocked ? '🔒' : '✏️'} {run.user?.name}</div>
                                                </div>
                                                <div className="text-sm text-gray-600">{formatNumber(run.actualWeight, 2)}</div>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </>
                        )}

                        {activeTab === 'purchases' && (
                            <>
                                {purchaseLoading ? (
                                    <div className="text-center text-gray-400 py-8">
                                        <div className="animate-spin w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                        Загрузка закупок...
                                    </div>
                                ) : purchaseItems.length === 0 ? (
                                    <div className="text-center text-gray-400 py-8">Нет закупок за этот период</div>
                                ) : (
                                    <>
                                        <div className="p-2 border-b bg-green-50 text-sm text-green-800">
                                            Найдено: <span className="font-semibold">{purchaseItems.length}</span> закупок
                                        </div>
                                        {purchaseItems.map(item => (
                                            <div key={item.purchaseItemId}
                                                className={`flex items-center gap-2 px-4 py-2 border-b cursor-pointer transition-colors ${selectedRun?.sourceType === 'PURCHASE' && selectedPurchase?.purchaseItemId === item.purchaseItemId ? 'bg-green-100 border-l-4 border-green-600' : 'hover:bg-gray-50'}`}
                                                onClick={async () => {
                                                    setSelectedPurchase(item);
                                                    // Создаём выработку сразу при клике
                                                    try {
                                                        const res = await axios.post(`${API_URL}/api/production-v2/runs`, {
                                                            productId: item.productId,
                                                            sourceType: 'PURCHASE',
                                                            productionDate: dateFrom,
                                                            plannedWeight: item.qty
                                                        }, {
                                                            headers: { Authorization: `Bearer ${token}` }
                                                        });
                                                        const newRun = res.data.run || res.data;
                                                        setRuns([newRun, ...runs]);
                                                        await loadRunDetails(newRun.id);
                                                    } catch (err: any) {
                                                        if (err.response?.status === 400 && err.response?.data?.error?.includes('MML')) {
                                                            setWarning('У этого товара нет MML структуры');
                                                            setTimeout(() => setWarning(null), 3000);
                                                        } else {
                                                            console.error('Failed to create run:', err);
                                                        }
                                                    }
                                                }}>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-sm truncate">{item.productName}</div>
                                                    <div className="text-xs text-gray-500">{item.supplierName} • {item.category || '—'}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-medium text-green-700">{formatNumber(item.qty, 2)}</div>
                                                    <div className="text-xs text-gray-500">{new Date(item.purchaseDate).toLocaleDateString('ru-RU')}</div>
                                                </div>
                                            </div>
                                        ))}
                                        {selectedPurchaseItems.size > 0 && (
                                            <div className="p-3 border-t bg-green-50 sticky bottom-0">
                                                <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => {
                                                    setWarning(`Импорт ${selectedPurchaseItems.size} позиций (в разработке)`);
                                                    setTimeout(() => setWarning(null), 3000);
                                                }}>
                                                    Загрузить {selectedPurchaseItems.size} позиций в производство
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}

                        {activeTab === 'balances' && (
                            <>
                                {balanceLoading ? (
                                    <div className="text-center text-gray-400 py-8">
                                        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                        Загрузка остатков...
                                    </div>
                                ) : balanceItems.length === 0 ? (
                                    <div className="text-center text-gray-400 py-8">Нет остатков на эту дату</div>
                                ) : (
                                    <>
                                        <div className="p-2 border-b bg-blue-50 text-sm text-blue-800">
                                            Найдено: <span className="font-semibold">{balanceItems.length}</span> остатков
                                        </div>
                                        {balanceItems.map(item => (
                                            <div key={item.productId}
                                                className={`flex items-center gap-2 px-4 py-2 border-b cursor-pointer transition-colors ${selectedRun?.sourceType === 'OPENING_BALANCE' && selectedBalance?.productId === item.productId ? 'bg-blue-100 border-l-4 border-blue-600' : 'hover:bg-gray-50'}`}
                                                onClick={async () => {
                                                    setSelectedBalance(item);
                                                    // Создаём выработку сразу при клике
                                                    try {
                                                        const res = await axios.post(`${API_URL}/api/production-v2/runs`, {
                                                            productId: item.productId,
                                                            sourceType: 'OPENING_BALANCE',
                                                            productionDate: dateFrom,
                                                            plannedWeight: item.openingBalance
                                                        }, {
                                                            headers: { Authorization: `Bearer ${token}` }
                                                        });
                                                        const newRun = res.data.run || res.data;
                                                        setRuns([newRun, ...runs]);
                                                        await loadRunDetails(newRun.id);
                                                    } catch (err: any) {
                                                        if (err.response?.status === 400 && err.response?.data?.error?.includes('MML')) {
                                                            setWarning('У этого товара нет MML структуры');
                                                            setTimeout(() => setWarning(null), 3000);
                                                        } else {
                                                            console.error('Failed to create run:', err);
                                                        }
                                                    }
                                                }}>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-sm truncate">{item.productName}</div>
                                                    <div className="text-xs text-gray-500">{item.category || '—'}</div>
                                                </div>
                                                <div className="text-sm font-medium text-blue-700">{formatNumber(item.openingBalance, 2)} кг</div>
                                            </div>
                                        ))}
                                        {selectedBalanceItems.size > 0 && (
                                            <div className="p-3 border-t bg-blue-50 sticky bottom-0">
                                                <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => {
                                                    setWarning(`Импорт ${selectedBalanceItems.size} остатков (в разработке)`);
                                                    setTimeout(() => setWarning(null), 3000);
                                                }}>
                                                    Загрузить {selectedBalanceItems.size} остатков в производство
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Правая панель */}
                <div className="flex-1 bg-white rounded-lg shadow flex flex-col overflow-hidden">
                    {/* Placeholder когда нет выбранной выработки */}
                    {!selectedRun && (
                        <div className="flex-1 flex items-center justify-center text-gray-400">
                            <div className="text-center">
                                {activeTab === 'runs' && (
                                    <>
                                        <Package size={48} className="mx-auto mb-4 text-gray-300" />
                                        <p>Выберите карточку выработки</p>
                                    </>
                                )}
                                {activeTab === 'purchases' && (
                                    <>
                                        <Download size={48} className="mx-auto mb-4 text-green-300" />
                                        <p>Выберите позицию закупки</p>
                                        <p className="text-sm mt-1">Выработка создастся автоматически</p>
                                    </>
                                )}
                                {activeTab === 'balances' && (
                                    <>
                                        <BarChart3 size={48} className="mx-auto mb-4 text-blue-300" />
                                        <p>Выберите позицию остатка</p>
                                        <p className="text-sm mt-1">Выработка создастся автоматически</p>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Детали выработки (для всех вкладок когда выбрана выработка) */}
                    {selectedRun && (
                        <>
                            {/* Шапка */}
                            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                                <div>
                                    <h3 className="font-semibold text-lg">{selectedRun.product.name}</h3>
                                    <div className="text-sm text-gray-500 flex items-center gap-4 mt-1">
                                        <span className="flex items-center gap-1"><User size={14} /> {selectedRun.user?.name}</span>
                                        <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(selectedRun.createdAt).toLocaleDateString('ru-RU')}</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedRun.isLocked ? 'bg-gray-200' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {selectedRun.isLocked ? 'Зафиксировано' : 'Редактирование'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {!selectedRun.isLocked && (
                                        <Button variant="outline" size="sm" onClick={saveRunValues}>
                                            <Save size={14} className="mr-1" /> Сохранить
                                        </Button>
                                    )}
                                    <Button size="sm" onClick={() => toggleRunLock(selectedRun.id)}>
                                        {selectedRun.isLocked ? <Edit2 size={14} className="mr-1" /> : <Check size={14} className="mr-1" />}
                                        {selectedRun.isLocked ? 'Редактировать' : 'Зафиксировать'}
                                    </Button>
                                </div>
                            </div>

                            {/* Поля */}
                            <div className="p-4 border-b bg-white">
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">Дата выработки</label>
                                        <input type="date" className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-100"
                                            value={editProductionDate} onChange={e => setEditProductionDate(e.target.value)} disabled={selectedRun.isLocked} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">Плановый вес (кг)</label>
                                        <input type="number" className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-100"
                                            value={editPlannedWeight} onChange={e => setEditPlannedWeight(e.target.value)} disabled={selectedRun.isLocked} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">Фактический вес (кг)</label>
                                        <div className="w-full border rounded px-3 py-2 text-sm bg-gray-50 font-semibold text-indigo-700">
                                            {formatNumber(calculateActualWeight(), 3)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Вкладки категорий */}
                            <div className="p-4 border-b flex gap-2 overflow-x-auto">
                                {categories.map(cat => {
                                    // Считаем итого по категории
                                    const catTotal = cat.nodes.reduce((sum, node) => {
                                        const entries = runValues.get(node.id) || [];
                                        return sum + entries.reduce((s, e) => s + (Number(e.value) || 0), 0);
                                    }, 0);
                                    return (
                                        <button key={cat.category}
                                            onClick={() => { setActiveCategory(cat.category); setShowCategoryModal(true); }}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex flex-col items-center gap-1 ${activeCategory === cat.category ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                                            <span>{cat.category}</span>
                                            <span className={`text-xs ${activeCategory === cat.category ? 'text-indigo-100' : 'text-gray-500'}`}>
                                                {formatNumber(catTotal, 1)} кг
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Превью категории */}
                            <div className="flex-1 overflow-auto p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <p className="text-gray-500 text-sm">Нажмите на категорию для редактирования позиций</p>
                                    <div className="text-sm font-semibold text-indigo-700 bg-indigo-50 px-3 py-1 rounded">
                                        Всего: {formatNumber(calculateActualWeight(), 3)} кг
                                    </div>
                                </div>
                                {activeCategoryNodes.length > 0 && (
                                    <div className="border rounded-lg overflow-hidden shadow-sm">
                                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 flex justify-between text-xs font-semibold text-gray-700 border-b">
                                            <span>Позиция</span>
                                            <span>Итого (кг)</span>
                                        </div>
                                        {activeCategoryNodes.map((node, idx) => {
                                            const entries = runValues.get(node.id) || [];
                                            const total = entries.reduce((s, e) => s + (Number(e.value) || 0), 0);
                                            return (
                                                <div key={node.id} className={`flex items-center gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-indigo-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                                    <Package size={16} className={total > 0 ? 'text-indigo-500' : 'text-gray-300'} />
                                                    <span className="flex-1 text-sm">{node.product.name}</span>
                                                    <span className={`text-sm font-semibold tabular-nums ${total > 0 ? 'text-indigo-700' : 'text-gray-400'}`}>
                                                        {total > 0 ? formatNumber(total, 3) : '—'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                        {/* Итоговая строка */}
                                        <div className="flex items-center gap-3 px-4 py-3 bg-indigo-100 border-t-2 border-indigo-200">
                                            <span className="flex-1 text-sm font-semibold text-indigo-900">ИТОГО по категории</span>
                                            <span className="text-base font-bold text-indigo-800 tabular-nums">
                                                {formatNumber(activeCategoryNodes.reduce((sum, node) => {
                                                    const entries = runValues.get(node.id) || [];
                                                    return sum + entries.reduce((s, e) => s + (Number(e.value) || 0), 0);
                                                }, 0), 3)} кг
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Модальное окно выбора товара */}
            {showProductModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Создать выработку</h3>
                            <button onClick={() => setShowProductModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="p-4 border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                <input type="text" placeholder="Поиск товара..." className="w-full border rounded pl-10 pr-4 py-2"
                                    value={modalSearch} onChange={e => setModalSearch(e.target.value)} autoFocus />
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-2">
                            {filteredModalProducts.map(product => (
                                <div key={product.id} onClick={() => createRun(product.id)}
                                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded cursor-pointer">
                                    <Package size={16} className="text-gray-400" />
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">{product.name}</div>
                                        <div className="text-xs text-gray-500">{product.code}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Модальное окно категории MML */}
            {showCategoryModal && activeCategory && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[700px] max-h-[85vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Структура MML: {activeCategory}</h3>
                            <button onClick={() => setShowCategoryModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="p-4 border-b">
                            <Button size="sm" onClick={() => { setShowAddValueModal(true); setSelectedNodeForValue(activeCategoryNodes[0] || null); }}
                                className="bg-green-600 hover:bg-green-700" disabled={selectedRun?.isLocked}>
                                <Plus size={14} className="mr-1" /> Добавить строку
                            </Button>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="text-left px-4 py-2 font-medium">Позиция</th>
                                        <th className="text-right px-4 py-2 font-medium">Значение (кг)</th>
                                        <th className="text-left px-4 py-2 font-medium">Сотрудник</th>
                                        <th className="text-left px-4 py-2 font-medium">Дата/Время</th>
                                        <th className="px-4 py-2 font-medium">Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeCategoryNodes.map(node => {
                                        const entries = runValues.get(node.id) || [];
                                        if (entries.length === 0) {
                                            return (
                                                <tr key={node.id} className="border-b hover:bg-gray-50">
                                                    <td className="px-4 py-2">{node.product.name}</td>
                                                    <td className="px-4 py-2 text-right text-gray-400">—</td>
                                                    <td className="px-4 py-2 text-gray-400">—</td>
                                                    <td className="px-4 py-2 text-gray-400">—</td>
                                                    <td className="px-4 py-2">
                                                        <button onClick={() => { setSelectedNodeForValue(node); setShowAddValueModal(true); }}
                                                            className="text-green-600 hover:text-green-800" disabled={selectedRun?.isLocked}>
                                                            <Plus size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        }
                                        return entries.map((entry, idx) => (
                                            <tr key={entry.id} className="border-b hover:bg-gray-50">
                                                {idx === 0 && <td className="px-4 py-2" rowSpan={entries.length}>{node.product.name}</td>}
                                                <td className="px-4 py-2 text-right font-medium">{formatNumber(Number(entry.value), 3)}</td>
                                                <td className="px-4 py-2">{entry.staff?.fullName || '—'}</td>
                                                <td className="px-4 py-2 text-xs text-gray-500">
                                                    {entry.recordedAt ? new Date(entry.recordedAt).toLocaleString('ru-RU') : '—'}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <button onClick={() => { setEditingValueId(entry.id); setNewValueAmount(String(entry.value || '')); setShowAddValueModal(true); }}
                                                        className="text-blue-600 hover:text-blue-800" disabled={selectedRun?.isLocked}>
                                                        <Edit2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ));
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t flex justify-between items-center">
                            <div className="font-semibold">
                                Итого: {formatNumber(activeCategoryNodes.reduce((sum, node) => {
                                    const entries = runValues.get(node.id) || [];
                                    return sum + entries.reduce((s, e) => s + (Number(e.value) || 0), 0);
                                }, 0), 3)} кг
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setShowCategoryModal(false)}>Закрыть</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Модальное окно добавления/редактирования записи */}
            {showAddValueModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
                    <div className="bg-white rounded-lg shadow-xl w-[400px]">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-semibold">{editingValueId ? 'Редактировать запись' : 'Добавить запись'}</h3>
                            <button onClick={() => { setShowAddValueModal(false); setEditingValueId(null); setNewValueAmount(''); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="text-sm text-gray-500 block mb-1">Сотрудник</label>
                                <input type="text" className="w-full border rounded px-3 py-2 bg-gray-50" value={currentStaff?.fullName || ''} disabled />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-gray-500 block mb-1">Дата</label>
                                    <input type="text" className="w-full border rounded px-3 py-2 bg-gray-50" value={new Date().toLocaleDateString('ru-RU')} disabled />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500 block mb-1">Время</label>
                                    <input type="text" className="w-full border rounded px-3 py-2 bg-gray-50" value={new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} disabled />
                                </div>
                            </div>
                            {!editingValueId && (
                                <div>
                                    <label className="text-sm text-gray-500 block mb-1">Позиция</label>
                                    <select className="w-full border rounded px-3 py-2" value={selectedNodeForValue?.id || ''}
                                        onChange={e => setSelectedNodeForValue(activeCategoryNodes.find(n => n.id === Number(e.target.value)) || null)}>
                                        {activeCategoryNodes.map(node => (
                                            <option key={node.id} value={node.id}>{node.product.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="text-sm text-gray-500 block mb-1">Значение (кг)</label>
                                <input type="number" className="w-full border rounded px-3 py-2 text-lg font-medium" placeholder="0.000" step="0.001"
                                    value={newValueAmount} onChange={e => setNewValueAmount(e.target.value)} autoFocus />
                            </div>
                        </div>
                        <div className="p-4 border-t flex justify-end gap-2">
                            <Button variant="outline" onClick={() => { setShowAddValueModal(false); setEditingValueId(null); setNewValueAmount(''); }}>Отмена</Button>
                            <Button onClick={editingValueId ? updateValueEntry : addValueEntry} className="bg-green-600 hover:bg-green-700">
                                {editingValueId ? 'Сохранить' : 'Добавить'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модальное окно MML для закупок/остатков */}
            {showMmlModal && mmlModalData && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[700px] max-h-[85vh] flex flex-col">
                        <div className={`p-4 border-b flex justify-between items-center ${mmlModalData.sourceType === 'PURCHASE' ? 'bg-green-50' : 'bg-blue-50'}`}>
                            <div>
                                <h3 className="text-lg font-semibold">Структура MML: {mmlModalData.productName}</h3>
                                <div className="text-sm text-gray-600 mt-1">
                                    {mmlModalData.sourceType === 'PURCHASE' ? '📥 Закупка' : '📊 Остаток'}: {formatNumber(mmlModalData.sourceQty, 3)} кг
                                </div>
                            </div>
                            <button onClick={() => { setShowMmlModal(false); setMmlModalData(null); setMmlCategories([]); setMmlValues(new Map()); }} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        {mmlLoading ? (
                            <div className="flex-1 flex items-center justify-center py-12">
                                <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                            </div>
                        ) : mmlCategories.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center py-12 text-gray-400">
                                <div className="text-center">
                                    <Package size={48} className="mx-auto mb-4 text-gray-300" />
                                    <p>MML структура не найдена</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Вкладки категорий */}
                                <div className="p-3 border-b flex gap-2 overflow-x-auto">
                                    {mmlCategories.map(cat => (
                                        <button
                                            key={cat.category}
                                            onClick={() => setMmlActiveCategory(cat.category)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${mmlActiveCategory === cat.category ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                                        >
                                            {cat.category} ({cat.count})
                                        </button>
                                    ))}
                                </div>

                                {/* Таблица позиций */}
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="text-left px-4 py-2 font-medium">Позиция</th>
                                                <th className="text-right px-4 py-2 font-medium w-32">Значение (кг)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {mmlActiveCategoryNodes.map(node => (
                                                <tr key={node.id} className="border-b hover:bg-gray-50">
                                                    <td className="px-4 py-2">{node.product.name}</td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            step="0.001"
                                                            className="w-full border rounded px-2 py-1 text-right"
                                                            placeholder="0.000"
                                                            value={mmlValues.get(node.id) || ''}
                                                            onChange={(e) => updateMmlValue(node.id, e.target.value)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Футер */}
                                <div className="p-4 border-t flex justify-between items-center">
                                    <div className="text-sm">
                                        <span className="text-gray-500">Итого:</span>
                                        <span className={`ml-2 font-bold text-lg ${mmlTotalValue > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                            {formatNumber(mmlTotalValue, 3)} кг
                                        </span>
                                        {mmlTotalValue > 0 && mmlModalData.sourceQty > 0 && (
                                            <span className={`ml-2 text-xs ${Math.abs(mmlTotalValue - mmlModalData.sourceQty) < 0.01 ? 'text-green-600' : 'text-orange-500'}`}>
                                                ({formatNumber((mmlTotalValue / mmlModalData.sourceQty) * 100, 1)}%)
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100"
                                            onClick={() => { setShowMmlModal(false); setMmlModalData(null); setMmlCategories([]); setMmlValues(new Map()); }}
                                        >
                                            Закрыть
                                        </button>
                                        <button
                                            className={`px-4 py-2 rounded-lg text-white flex items-center ${mmlModalData.sourceType === 'PURCHASE' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} ${mmlTotalValue === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            onClick={() => {
                                                console.log('Button clicked!');
                                                createRunFromSource();
                                            }}
                                            disabled={mmlTotalValue === 0}
                                        >
                                            <Plus size={16} className="mr-1" /> Создать выработку
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
