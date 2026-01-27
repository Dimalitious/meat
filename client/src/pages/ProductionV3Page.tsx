import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { formatNumber } from '../utils/formatters';
import {
    Search, Plus, Save, Edit2, X, User, Calendar,
    Package, AlertCircle, FolderTree, Download, Trash2
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

// Объединённая позиция (закуп + остаток)
interface PurchaseDetail {
    idn: string;           // IDN (supplier + date)
    qty: number;           // количество
    supplierName: string;  // поставщик
    date: string;          // дата закупки
}

interface CombinedItem {
    productId: number;
    productCode: string;
    productName: string;
    category: string | null;
    purchaseQty: number;      // кол-во из закупок
    balanceQty: number;       // кол-во из остатков
    totalQty: number;         // итого
    purchaseItemId?: number;  // ID позиции закупки (если есть)
    supplierName?: string;    // поставщик (если есть)
    purchaseDetails?: PurchaseDetail[]; // Пункт 13: детализация по IDN
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
    const [selectedMmlNodeIds, setSelectedMmlNodeIds] = useState<Set<number>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false); // Защита от двойного клика

    // Объединённые данные (закуп + остатки, сгруппированные по товару)
    const [combinedItems, setCombinedItems] = useState<CombinedItem[]>([]);
    const [combinedLoading, setCombinedLoading] = useState(false);
    const [selectedCombinedItem, setSelectedCombinedItem] = useState<CombinedItem | null>(null);
    const [selectedCombinedIds, setSelectedCombinedIds] = useState<Set<number>>(new Set());

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

    // Автозагрузка данных при изменении дат
    useEffect(() => {
        if (dateFrom && dateTo) {
            const timer = setTimeout(() => {
                fetchRunsAuto();
                loadCombinedItems(); // Загружаем закупки + остатки
            }, 500); // debounce 500ms
            return () => clearTimeout(timer);
        }
    }, [dateFrom, dateTo]);

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

                // Каждый узел MML = отдельный таб (данные с сервера)
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

    // Загрузка объединённых данных (закуп + остатки)
    const loadCombinedItems = async () => {
        if (!dateFrom || !dateTo) {
            setWarning('Сначала укажите период');
            setTimeout(() => setWarning(null), 3000);
            return;
        }
        setCombinedLoading(true);
        try {
            // Загружаем оба источника параллельно
            const [purchaseRes, balanceRes] = await Promise.all([
                axios.get(`${API_URL}/api/production-v2/purchases`, {
                    params: { dateFrom, dateTo },
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`${API_URL}/api/production-v2/opening-balances`, {
                    params: { date: dateFrom },
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            const purchases: PurchaseItem[] = purchaseRes.data.items || [];
            const balances: OpeningBalanceItem[] = balanceRes.data.items || [];

            // Объединяем по productId
            const map = new Map<number, CombinedItem>();

            // Добавляем закупки
            for (const p of purchases) {
                // Формируем IDN: первые буквы поставщика + дата
                const supplierShort = p.supplierName ? p.supplierName.toLowerCase().replace(/\s+/g, '').slice(0, 6) : 'unknown';
                const dateFormatted = new Date(p.purchaseDate).toLocaleDateString('ru-RU').replace(/\./g, '');
                const idn = `IDN ${supplierShort}${dateFormatted}`;

                const detail: PurchaseDetail = {
                    idn,
                    qty: p.qty,
                    supplierName: p.supplierName,
                    date: p.purchaseDate
                };

                if (map.has(p.productId)) {
                    const existing = map.get(p.productId)!;
                    existing.purchaseQty += p.qty;
                    existing.totalQty = existing.purchaseQty + existing.balanceQty;
                    existing.purchaseDetails = existing.purchaseDetails || [];
                    existing.purchaseDetails.push(detail);
                } else {
                    map.set(p.productId, {
                        productId: p.productId,
                        productCode: p.productCode,
                        productName: p.productName,
                        category: p.category,
                        purchaseQty: p.qty,
                        balanceQty: 0,
                        totalQty: p.qty,
                        purchaseItemId: p.purchaseItemId,
                        supplierName: p.supplierName,
                        purchaseDetails: [detail]
                    });
                }
            }

            // Добавляем остатки
            for (const b of balances) {
                if (map.has(b.productId)) {
                    const existing = map.get(b.productId)!;
                    existing.balanceQty += b.openingBalance;
                    existing.totalQty = existing.purchaseQty + existing.balanceQty;
                } else {
                    map.set(b.productId, {
                        productId: b.productId,
                        productCode: b.productCode,
                        productName: b.productName,
                        category: b.category,
                        purchaseQty: 0,
                        balanceQty: b.openingBalance,
                        totalQty: b.openingBalance
                    });
                }
            }

            // Сортируем по названию
            const combined = Array.from(map.values()).sort((a, b) => a.productName.localeCompare(b.productName));
            setCombinedItems(combined);
            setSelectedCombinedIds(new Set());
        } catch (err) {
            console.error('Failed to load combined items:', err);
        } finally {
            setCombinedLoading(false);
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

            // Обновляем список runs (actualWeight обновляется на сервере)
            await fetchRunsAuto();

            setShowMmlModal(false);
            setMmlModalData(null);
            setMmlCategories([]);
            setMmlValues(new Map());

            // Открываем созданную выработку
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

            // Обновляем список runs для отображения актуального actualWeight
            await fetchRunsAuto();

            setWarning('Сохранено!');
            setTimeout(() => setWarning(null), 2000);
        } catch (err) {
            console.error('Failed to save:', err);
            alert('Ошибка сохранения');
        }
    };

    const addValueEntry = async () => {
        if (!selectedRun || !selectedNodeForValue || !newValueAmount || isSubmitting) return;
        setIsSubmitting(true); // Защита от двойного клика
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
        } finally {
            setIsSubmitting(false);
        }
    };

    // Удаление записи значения (Баг 7 fix)
    const deleteValueEntry = async (valueId: number) => {
        if (!selectedRun || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await axios.delete(`${API_URL}/api/production-v2/runs/values/${valueId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await loadRunDetails(selectedRun.id);
        } catch (err) {
            console.error('Failed to delete value:', err);
        } finally {
            setIsSubmitting(false);
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

    // Расчёт выработки по productId (сумма всех runs для этого товара)
    const getYieldByProductId = (productId: number): number => {
        return runs
            .filter(r => r.productId === productId && !r.isHidden)
            .reduce((sum, r) => sum + (Number(r.actualWeight) || 0), 0);
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
                {/* Левая панель - БЕЛЫЙ ФОН */}
                <div className="w-96 bg-white rounded-xl shadow-lg flex flex-col border border-gray-200">
                    <div className="p-4 border-b border-gray-200">
                        <h2 className="font-semibold mb-2 flex items-center justify-between text-gray-800">
                            Журнал производства
                            {(loading || combinedLoading) && <span className="text-xs text-gray-400 animate-pulse">загрузка...</span>}
                        </h2>

                        {/* Фильтры дат */}
                        <div className="flex gap-2 mb-3">
                            <div className="flex-1">
                                <label className="text-xs text-gray-500 block mb-1">Дата С</label>
                                <input type="date" className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-sm"
                                    value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-gray-500 block mb-1">Дата По</label>
                                <input type="date" className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-sm"
                                    value={dateTo} onChange={e => setDateTo(e.target.value)} />
                            </div>
                        </div>

                        {/* Поиск */}
                        <div className="relative mb-3">
                            <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
                            <input type="text" placeholder="Поиск..." className="w-full bg-white border border-gray-300 rounded pl-8 pr-3 py-2 text-sm"
                                value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                        </div>

                        {/* Кнопки действий */}
                        <div className="flex gap-2">
                            <Button onClick={loadCombinedItems} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                                <Download size={16} className="mr-1" /> Загрузить данные
                            </Button>
                            {selectedCombinedIds.size > 0 && (
                                <Button variant="outline" onClick={() => setSelectedCombinedIds(new Set())} className="text-red-600 border-red-300 hover:bg-red-50">
                                    <Trash2 size={16} className="mr-1" /> Снять ({selectedCombinedIds.size})
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Объединённый список (закуп + остатки) */}
                    <div className="flex-1 overflow-auto">
                        {combinedLoading ? (
                            <div className="text-center text-gray-400 py-8">
                                <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                Загрузка данных...
                            </div>
                        ) : combinedItems.length === 0 ? (
                            <div className="text-center text-gray-400 py-8">
                                <Package size={32} className="mx-auto mb-2 text-gray-300" />
                                <p>Нет данных за выбранный период</p>
                                <p className="text-xs mt-1">Нажмите "Загрузить данные"</p>
                            </div>
                        ) : (
                            <>
                                {/* Счётчик */}
                                <div className="p-2 border-b bg-gray-50 text-sm text-gray-600">
                                    Найдено: <span className="font-semibold">{combinedItems.filter(item =>
                                        item.productName.toLowerCase().includes(productSearch.toLowerCase()) ||
                                        item.productCode.toLowerCase().includes(productSearch.toLowerCase())
                                    ).length}</span> позиций
                                </div>

                                {/* Список позиций */}
                                {combinedItems
                                    .filter(item =>
                                        item.productName.toLowerCase().includes(productSearch.toLowerCase()) ||
                                        item.productCode.toLowerCase().includes(productSearch.toLowerCase())
                                    )
                                    .map(item => (
                                        <div key={item.productId}
                                            className={`px-3 py-3 border-b cursor-pointer transition-colors ${selectedCombinedItem?.productId === item.productId
                                                ? 'bg-indigo-50 border-l-4 border-indigo-500'
                                                : selectedCombinedIds.has(item.productId)
                                                    ? 'bg-yellow-50 border-l-4 border-yellow-400'
                                                    : 'hover:bg-gray-50'
                                                }`}
                                            onClick={async () => {
                                                setSelectedCombinedItem(item);

                                                // Сначала проверяем, есть ли уже выработка для этого товара
                                                const existingRun = runs.find(r => r.productId === item.productId && !r.isHidden);

                                                if (existingRun) {
                                                    // Загружаем существующую выработку
                                                    await loadRunDetails(existingRun.id);
                                                } else {
                                                    // Создаём новую выработку только если нет существующей
                                                    try {
                                                        const sourceType = item.purchaseQty > 0 ? 'PURCHASE' : 'OPENING_BALANCE';
                                                        const res = await axios.post(`${API_URL}/api/production-v2/runs`, {
                                                            productId: item.productId,
                                                            sourceType,
                                                            productionDate: dateFrom,
                                                            plannedWeight: item.totalQty
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
                                                }
                                            }}>
                                            <div className="flex items-start gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCombinedIds.has(item.productId)}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const newSet = new Set(selectedCombinedIds);
                                                        if (newSet.has(item.productId)) {
                                                            newSet.delete(item.productId);
                                                        } else {
                                                            newSet.add(item.productId);
                                                        }
                                                        setSelectedCombinedIds(newSet);
                                                    }}
                                                    onChange={() => { }}
                                                    className="w-4 h-4 mt-1 accent-indigo-600"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    {/* Название товара */}
                                                    <div className="font-medium text-sm truncate text-gray-800">{item.productName}</div>
                                                    {/* Код товара */}
                                                    <div className="text-xs text-gray-400 mb-1">Код: {item.productCode}</div>
                                                    {/* Маркеры количества */}
                                                    <div className="flex flex-wrap gap-2 text-xs">
                                                        {item.purchaseQty > 0 && (
                                                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                                                📥 Закуп: {formatNumber(item.purchaseQty, 2)}
                                                            </span>
                                                        )}
                                                        {item.balanceQty > 0 && (
                                                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                                                📊 Остаток: {formatNumber(item.balanceQty, 2)}
                                                            </span>
                                                        )}
                                                        {/* Маркер выработки - сумма всех runs для этого товара */}
                                                        <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                                                            🏭 Выработка: {formatNumber(getYieldByProductId(item.productId), 2)}
                                                        </span>
                                                        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-semibold">
                                                            Итого: {formatNumber(item.totalQty, 2)} кг
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
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
                                <Package size={48} className="mx-auto mb-4 text-gray-300" />
                                <p>Выберите позицию слева</p>
                                <p className="text-sm mt-1">Выработка создастся автоматически</p>
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
                                    {!selectedRun.isLocked ? (
                                        <Button variant="outline" size="sm" onClick={saveRunValues}>
                                            <Save size={14} className="mr-1" /> Сохранить
                                        </Button>
                                    ) : (
                                        <Button variant="outline" size="sm" onClick={() => toggleRunLock(selectedRun.id)}>
                                            <Edit2 size={14} className="mr-1" /> Редактировать
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Поля — новый дизайн с Закупом/Остатком/Итого */}
                            <div className="p-4 border-b bg-white">
                                <div className="grid grid-cols-4 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">Дата выработки</label>
                                        <input type="date" className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-100"
                                            value={editProductionDate} onChange={e => setEditProductionDate(e.target.value)} disabled={selectedRun.isLocked} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">
                                            <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                                            Кол-во закупа (кг)
                                        </label>
                                        {/* Пункт 13: детализация по IDN */}
                                        <div className="w-full border rounded px-3 py-2 text-sm bg-green-50">
                                            {selectedCombinedItem?.purchaseDetails && selectedCombinedItem.purchaseDetails.length > 0 ? (
                                                <div className="space-y-1">
                                                    {selectedCombinedItem.purchaseDetails.map((d, i) => (
                                                        <div key={i} className="flex justify-between text-xs">
                                                            <span className="text-green-600">{d.idn}</span>
                                                            <span className="font-medium text-green-700">{formatNumber(d.qty, 2)} кг</span>
                                                        </div>
                                                    ))}
                                                    <div className="flex justify-between border-t pt-1 mt-1">
                                                        <span className="font-semibold text-green-800">Итого:</span>
                                                        <span className="font-bold text-green-800">{formatNumber(selectedCombinedItem.purchaseQty, 3)} кг</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="font-medium text-green-700">{formatNumber(selectedCombinedItem?.purchaseQty || 0, 3)}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">
                                            <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
                                            Кол-во остатков (кг)
                                        </label>
                                        <div className="w-full border rounded px-3 py-2 text-sm bg-blue-50 font-medium text-blue-700">
                                            {formatNumber(selectedCombinedItem?.balanceQty || 0, 3)}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">
                                            <span className="inline-block w-2 h-2 bg-purple-500 rounded-full mr-1"></span>
                                            Итого товара (кг)
                                        </label>
                                        <div className="w-full border rounded px-3 py-2 text-sm bg-purple-50 font-semibold text-purple-700">
                                            {formatNumber(selectedCombinedItem?.totalQty || 0, 3)}
                                        </div>
                                    </div>
                                </div>
                                {/* Факт выработка */}
                                <div className="mt-3 pt-3 border-t">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">
                                            <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mr-1"></span>
                                            Факт выработка:
                                        </span>
                                        <span className="text-lg font-bold text-orange-600">{formatNumber(calculateActualWeight(), 3)} кг</span>
                                    </div>
                                </div>
                                {/* Фактический вес */}
                                <div className="mt-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Фактический вес (из MML):</span>
                                        <span className="text-lg font-bold text-indigo-700">{formatNumber(calculateActualWeight(), 3)} кг</span>
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
                                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 flex justify-between items-center text-xs font-semibold text-gray-700 border-b">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={activeCategoryNodes.every(n => selectedMmlNodeIds.has(n.id))}
                                                    onChange={(e) => {
                                                        const newSet = new Set(selectedMmlNodeIds);
                                                        if (e.target.checked) {
                                                            activeCategoryNodes.forEach(n => newSet.add(n.id));
                                                        } else {
                                                            activeCategoryNodes.forEach(n => newSet.delete(n.id));
                                                        }
                                                        setSelectedMmlNodeIds(newSet);
                                                    }}
                                                    className="w-4 h-4 accent-indigo-600"
                                                />
                                                <span className="flex-1">Позиция</span>
                                                <span className="w-24 text-gray-500">Код</span>
                                                <span className="w-28 text-gray-500">Пользователь</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {selectedMmlNodeIds.size > 0 && (
                                                    <button
                                                        onClick={async () => {
                                                            if (!selectedRun) return;
                                                            // Удаляем значения для выбранных узлов
                                                            const newValues = new Map(runValues);
                                                            selectedMmlNodeIds.forEach(nodeId => {
                                                                newValues.delete(nodeId);
                                                            });
                                                            setRunValues(newValues);
                                                            setSelectedMmlNodeIds(new Set());
                                                            setWarning(`Очищено ${selectedMmlNodeIds.size} позиций (сохраните для применения)`);
                                                            setTimeout(() => setWarning(null), 2000);
                                                        }}
                                                        className="text-red-600 hover:text-red-800 flex items-center gap-1"
                                                    >
                                                        <Trash2 size={14} /> Очистить ({selectedMmlNodeIds.size})
                                                    </button>
                                                )}
                                                <span>Итого (кг)</span>
                                            </div>
                                        </div>
                                        {activeCategoryNodes.map((node, idx) => {
                                            const entries = runValues.get(node.id) || [];
                                            const total = entries.reduce((s, e) => s + (Number(e.value) || 0), 0);
                                            // Пункт 3: не показывать пустые строки
                                            if (total === 0) return null;
                                            return (
                                                <div key={node.id} className={`flex items-center gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-indigo-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${selectedMmlNodeIds.has(node.id) ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedMmlNodeIds.has(node.id)}
                                                        onChange={(e) => {
                                                            const newSet = new Set(selectedMmlNodeIds);
                                                            if (e.target.checked) {
                                                                newSet.add(node.id);
                                                            } else {
                                                                newSet.delete(node.id);
                                                            }
                                                            setSelectedMmlNodeIds(newSet);
                                                        }}
                                                        className="w-4 h-4 accent-indigo-600"
                                                    />
                                                    <Package size={16} className={total > 0 ? 'text-indigo-500' : 'text-gray-300'} />
                                                    <span className="flex-1 text-sm">{node.product.name}</span>
                                                    <span className="text-xs text-gray-400 w-24">{node.product.code}</span>
                                                    {/* Пункт 6: столбец Пользователь */}
                                                    <span className="text-xs text-gray-500 w-28 truncate" title={entries.map(e => e.staff?.fullName).filter(Boolean).join(', ')}>
                                                        {entries.length > 0 && entries[0].staff?.fullName ? entries[0].staff.fullName : '—'}
                                                    </span>
                                                    <span className={`text-sm font-semibold tabular-nums ${total > 0 ? 'text-indigo-700' : 'text-gray-400'}`}>
                                                        {total > 0 ? formatNumber(total, 3) : '—'}
                                                    </span>
                                                    {total > 0 && (
                                                        <button
                                                            onClick={() => {
                                                                const newValues = new Map(runValues);
                                                                newValues.delete(node.id);
                                                                setRunValues(newValues);
                                                            }}
                                                            className="text-red-400 hover:text-red-600 ml-2"
                                                            title="Очистить значение"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
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
            {
                showProductModal && (
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
                )
            }

            {/* Модальное окно категории MML */}
            {
                showCategoryModal && activeCategory && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg shadow-xl w-[700px] max-h-[85vh] flex flex-col">
                            <div className="p-4 border-b flex justify-between items-center">
                                <h3 className="text-lg font-semibold">Структура MML: {activeCategory}</h3>
                                <button onClick={() => setShowCategoryModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                            </div>
                            <div className="p-4 border-b flex gap-2">
                                <Button size="sm" onClick={() => { setShowAddValueModal(true); setSelectedNodeForValue(activeCategoryNodes[0] || null); }}
                                    className="bg-green-600 hover:bg-green-700" disabled={selectedRun?.isLocked}>
                                    <Plus size={14} className="mr-1" /> Добавить строку
                                </Button>
                                {selectedMmlNodeIds.size > 0 && (
                                    <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50"
                                        onClick={() => {
                                            const newValues = new Map(runValues);
                                            selectedMmlNodeIds.forEach(nodeId => {
                                                newValues.delete(nodeId);
                                            });
                                            setRunValues(newValues);
                                            setSelectedMmlNodeIds(new Set());
                                            setWarning(`Удалено ${selectedMmlNodeIds.size} записей`);
                                            setTimeout(() => setWarning(null), 2000);
                                        }}>
                                        <Trash2 size={14} className="mr-1" /> Удалить выбранные ({selectedMmlNodeIds.size})
                                    </Button>
                                )}
                            </div>
                            <div className="flex-1 overflow-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="text-left px-4 py-2 font-medium">
                                                <input
                                                    type="checkbox"
                                                    checked={activeCategoryNodes.every(n => selectedMmlNodeIds.has(n.id))}
                                                    onChange={(e) => {
                                                        const newSet = new Set(selectedMmlNodeIds);
                                                        if (e.target.checked) {
                                                            activeCategoryNodes.forEach(n => newSet.add(n.id));
                                                        } else {
                                                            activeCategoryNodes.forEach(n => newSet.delete(n.id));
                                                        }
                                                        setSelectedMmlNodeIds(newSet);
                                                    }}
                                                    className="w-4 h-4 accent-indigo-600 mr-2"
                                                />
                                                Позиция
                                            </th>
                                            <th className="text-left px-4 py-2 font-medium">Код</th>
                                            <th className="text-right px-4 py-2 font-medium">Значение (кг)</th>
                                            <th className="text-left px-4 py-2 font-medium">Сотрудник</th>
                                            <th className="text-left px-4 py-2 font-medium">Дата/Время</th>
                                            <th className="px-4 py-2 font-medium">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeCategoryNodes.map(node => {
                                            const entries = runValues.get(node.id) || [];
                                            // Пункт 3: не показывать пустые строки
                                            if (entries.length === 0) {
                                                return null;
                                            }
                                            return entries.map((entry, idx) => (
                                                <tr key={entry.id} className={`border-b hover:bg-gray-50 ${selectedMmlNodeIds.has(node.id) ? 'bg-yellow-50' : ''}`}>
                                                    {idx === 0 && (
                                                        <td className="px-4 py-2" rowSpan={entries.length}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedMmlNodeIds.has(node.id)}
                                                                onChange={(e) => {
                                                                    const newSet = new Set(selectedMmlNodeIds);
                                                                    if (e.target.checked) {
                                                                        newSet.add(node.id);
                                                                    } else {
                                                                        newSet.delete(node.id);
                                                                    }
                                                                    setSelectedMmlNodeIds(newSet);
                                                                }}
                                                                className="w-4 h-4 accent-indigo-600 mr-2"
                                                            />
                                                            {node.product.name}
                                                        </td>
                                                    )}
                                                    {idx === 0 && (
                                                        <td className="px-4 py-2 text-xs text-gray-400" rowSpan={entries.length}>{node.product.code}</td>
                                                    )}
                                                    <td className="px-4 py-2 text-right font-medium">{formatNumber(Number(entry.value), 3)}</td>
                                                    <td className="px-4 py-2">{entry.staff?.fullName || '—'}</td>
                                                    <td className="px-4 py-2 text-xs text-gray-500">
                                                        {entry.recordedAt ? new Date(entry.recordedAt).toLocaleString('ru-RU') : '—'}
                                                    </td>
                                                    <td className="px-4 py-2 flex items-center gap-2">
                                                        <button onClick={() => { setEditingValueId(entry.id); setNewValueAmount(String(entry.value || '')); setShowAddValueModal(true); }}
                                                            className="text-blue-600 hover:text-blue-800" disabled={selectedRun?.isLocked}>
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteValueEntry(entry.id)}
                                                            className="text-red-400 hover:text-red-600"
                                                            disabled={selectedRun?.isLocked || isSubmitting}
                                                            title="Удалить"
                                                        >
                                                            <Trash2 size={14} />
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
                )
            }

            {/* Модальное окно добавления/редактирования записи */}
            {
                showAddValueModal && (
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
                                <Button variant="outline" onClick={() => { setShowAddValueModal(false); setEditingValueId(null); setNewValueAmount(''); }} disabled={isSubmitting}>Отмена</Button>
                                <Button
                                    onClick={editingValueId ? updateValueEntry : addValueEntry}
                                    className="bg-green-600 hover:bg-green-700"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Загрузка...</>
                                    ) : (
                                        editingValueId ? 'Сохранить' : 'Добавить'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Модальное окно MML для закупок/остатков */}
            {
                showMmlModal && mmlModalData && (
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
                )
            }
        </div >
    );
}
