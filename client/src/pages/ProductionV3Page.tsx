import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { formatNumber } from '../utils/formatters';
import {
    Search, Plus, Save, Edit2, X, User, Calendar,
    Package, AlertCircle, FolderTree, Download, Trash2, List, Camera, Image
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

// V3: Operation types
type ProductionOpType = 'PRODUCTION' | 'WRITEOFF' | 'ADJUSTMENT';

interface RunValue {
    id: number;
    mmlNodeId: number;
    value: number | null;
    staffId?: number | null;
    recordedAt?: string;
    operationAt?: string; // V3: business operation time
    staff?: { id: number; fullName: string } | null;
    node?: MmlNode;
    // V3: Unified Operations
    opType?: ProductionOpType;
    reasonText?: string | null;
    photoUrl?: string | null;
    photoMeta?: {
        width?: number;
        height?: number;
        sizeBytes?: number;
        mime?: string;
        sha256?: string;
        confidence?: number;
        ocrRaw?: string;
    } | null;
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
    status: 'draft' | 'posted' | 'voided';  // V3
    needsReview?: boolean;  // V3
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
    isCarryover?: boolean;    // TZ7: маркер переноса с прошлых дат
}

// V3: Adjustment interface
interface Adjustment {
    id: number;
    productId: number;
    adjustmentDate: string;
    effectiveDate: string;
    deltaWeight: number;
    reason: string | null;
    status: 'draft' | 'posted' | 'voided';
    isLocked: boolean;
    createdAt: string;
    product: { id: number; code: string; name: string };
    creator: { id: number; name: string } | null;
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
    const [activeMainTab, setActiveMainTab] = useState<'production' | 'writeoff' | 'adjustments'>('production'); // V3: + adjustments

    // Inline редактирование значений
    const [editingNodeId, setEditingNodeId] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState<string>('');
    const [deleteConfirmNode, setDeleteConfirmNode] = useState<MmlNode | null>(null);

    // Объединённые данные (закуп + остатки, сгруппированные по товару)
    const [combinedItems, setCombinedItems] = useState<CombinedItem[]>([]);
    const [combinedLoading, setCombinedLoading] = useState(false);
    const [selectedCombinedItem, setSelectedCombinedItem] = useState<CombinedItem | null>(null);
    const [selectedCombinedIds, setSelectedCombinedIds] = useState<Set<number>>(new Set());
    // Мягкое удаление: скрытые productIds и показ скрытых
    const [markedForDeletion, setMarkedForDeletion] = useState<Set<number>>(new Set());
    const [showMarkedItems, setShowMarkedItems] = useState(false);

    // Мобильная навигация: 1=список товаров, 2=категории/детали, 3=редактирование
    const [mobileLevel, setMobileLevel] = useState<1 | 2 | 3>(1);
    const [isMobile, setIsMobile] = useState(false);

    // V3: Adjustments state
    const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
    const [adjustmentsLoading, setAdjustmentsLoading] = useState(false);
    const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
    const [editingAdjustment, setEditingAdjustment] = useState<Adjustment | null>(null);
    const [adjProductId, setAdjProductId] = useState<number | null>(null);
    const [adjDeltaWeight, setAdjDeltaWeight] = useState('');
    const [adjReason, setAdjReason] = useState('');

    // V3: Operation type state (used in showAddValueModal)
    const [selectedOpType, setSelectedOpType] = useState<ProductionOpType>('PRODUCTION');
    const [opReasonText, setOpReasonText] = useState('');
    const [opPhotoUrl, setOpPhotoUrl] = useState<string | null>(null);
    const [opPhotoMeta, setOpPhotoMeta] = useState<any>(null);
    const [opPhotoLoading, setOpPhotoLoading] = useState(false);
    const [opTypeFilter, setOpTypeFilter] = useState<ProductionOpType | 'all'>('all');
    // V3: OCR result state (for Apply button flow)
    const [ocrResult, setOcrResult] = useState<{ value: number; confidence: number; raw: string } | null>(null);

    // Определение мобильного режима
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

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
            // fetchRunsAuto теперь сам устанавливает productIdsWithRunOutsideFilter на основе данных с сервера
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
            params.append('includeProductsWithRunsOutside', 'true');
            const res = await axios.get(`${API_URL}/api/production-v2/runs?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Новый формат ответа: { runs, productIdsWithRunsOutsideRange }
            // NOTE: productIdsWithRunsOutsideRange больше не используется для скрытия
            const { runs: runsData } = res.data;

            if (runsData && runsData.length > 0) {
            }
            setRuns(runsData || []);
        } catch (err) {
            console.error('Failed to fetch runs:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadRunDetails = async (runId: number, skipDateOverwrite: boolean = false) => {
        console.trace('[DEBUG loadRunDetails] Called from:');
        try {
            const res = await axios.get(`${API_URL}/api/production-v2/runs/${runId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const run = res.data as ProductionRun;
            setSelectedRun(run);

            // CRITICAL: Sync the runs array with the updated actualWeight from server
            // This fixes the discrepancy between left (runs array) and right (selectedRun) panel values
            setRuns(prevRuns => prevRuns.map(r => r.id === runId ? { ...r, actualWeight: run.actualWeight } : r));

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

            // Устанавливаем дату ТОЛЬКО если не пропускаем перезапись
            if (!skipDateOverwrite) {
                const parsedDate = run.productionDate ? run.productionDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
                setEditPlannedWeight(run.plannedWeight !== null ? String(run.plannedWeight) : '');
                setEditProductionDate(parsedDate);
            } else {
            }
        } catch (err) {
            console.error('Failed to load run details:', err);
        }
    };

    // Загрузка объединённых данных (закуп + остатки + невыработанные)
    const loadCombinedItems = async () => {
        if (!dateFrom || !dateTo) {
            setWarning('Сначала укажите период');
            setTimeout(() => setWarning(null), 3000);
            return;
        }
        setCombinedLoading(true);
        try {
            // Загружаем все источники параллельно
            const [purchaseRes, balanceRes, unfinishedRes] = await Promise.all([
                axios.get(`${API_URL}/api/production-v2/purchases`, {
                    params: { dateFrom, dateTo },
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`${API_URL}/api/production-v2/opening-balances`, {
                    params: { date: dateFrom },
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`${API_URL}/api/production-v2/unfinished`, {
                    params: { beforeDate: dateFrom, daysBack: 30 },
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            const purchases: PurchaseItem[] = purchaseRes.data.items || [];
            const balances: OpeningBalanceItem[] = balanceRes.data.items || [];
            const unfinished: Array<{
                productId: number;
                productCode: string;
                productName: string;
                category: string | null;
                purchaseQty: number;
                balanceQty: number;
                remainingQty: number;
                purchaseDate: string | null;
                idn: string | null;
            }> = unfinishedRes.data.items || [];

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

            // TZ7: Добавляем невыработанные позиции с предыдущих дат
            for (const u of unfinished) {
                if (!map.has(u.productId)) {
                    // Товар из прошлых дат, который не полностью выработан
                    map.set(u.productId, {
                        productId: u.productId,
                        productCode: u.productCode,
                        productName: u.productName,
                        category: u.category,
                        purchaseQty: 0, // Закупка была на другой дате
                        balanceQty: u.remainingQty, // Остаток = невыработанное количество
                        totalQty: u.remainingQty,
                        purchaseDetails: u.purchaseDate ? [{
                            idn: u.idn || `IDN carryover${u.purchaseDate.substring(2, 10).replace(/-/g, '')}`,
                            qty: u.remainingQty,
                            supplierName: 'Перенос',
                            date: u.purchaseDate
                        }] : undefined,
                        isCarryover: true // Маркер переноса
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
        if (!mmlModalData || !mmlId) {
            return;
        }

        try {
            // Создаём выработку
            const res = await axios.post(`${API_URL}/api/production-v2/runs`, {
                productId: mmlModalData.productId,
                sourceType: mmlModalData.sourceType,
                sourcePurchaseItemId: mmlModalData.sourceItemId,
                productionDate: dateFrom
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const newRun = res.data.run || res.data;

            // Сохраняем значения MML
            const values: { mmlNodeId: number; value: number }[] = [];
            mmlValues.forEach((value, nodeId) => {
                if (value > 0) {
                    values.push({ mmlNodeId: nodeId, value });
                }
            });

            if (values.length > 0) {
                const valRes = await axios.put(`${API_URL}/api/production-v2/runs/${newRun.id}/values`, {
                    values,
                    productionDate: dateFrom,
                    plannedWeight: mmlModalData.sourceQty
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
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

        // TZ2: Сохраняем снапшот для отката при ошибке
        const snapshotRunValues = new Map(runValues);
        const snapshotSelectedRun = { ...selectedRun };

        // Сохраняем значения в локальные переменные (чтобы избежать stale closure)
        const savedProductionDate = editProductionDate;
        const savedRunId = selectedRun.id;
        const savedProductId = selectedRun.productId;

        try {
            // V3: Meta-only save — do NOT send values (preserves operationAt/opType/photo)
            const saveRes = await axios.put(`${API_URL}/api/production-v2/runs/${savedRunId}/values`,
                { productionDate: savedProductionDate, plannedWeight: editPlannedWeight ? Number(editPlannedWeight) : null },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Проверяем: дата попадает в текущий фильтр?
            const savedRunDate = new Date(savedProductionDate);
            savedRunDate.setHours(0, 0, 0, 0);
            const filterFromDateObj = new Date(dateFrom);
            filterFromDateObj.setHours(0, 0, 0, 0);
            const filterToDateObj = new Date(dateTo);
            filterToDateObj.setHours(23, 59, 59, 999);

            if (savedRunDate < filterFromDateObj || savedRunDate > filterToDateObj) {
                // Позиция перенесена в другую дату - очищаем выбор
                setSelectedRun(null);
                setWarning('Позиция перенесена в дату ' + new Date(savedProductionDate).toLocaleDateString('ru-RU'));
            } else {
                // Дата в пределах фильтра - СНАЧАЛА обновляем selectedRun локально
                setSelectedRun(prev => prev ? { ...prev, productionDate: savedProductionDate } : null);
                setWarning('Сохранено!');
            }

            // Пункт 9 ТЗ: Автообновление списков ПОСЛЕ обновления локального стейта
            await fetchRunsAuto();
            await loadCombinedItems();

            setTimeout(() => setWarning(null), 2000);
        } catch (err: any) {
            console.error('Failed to save:', err);

            // TZ2: Откатываем UI к состоянию ДО попытки сохранения
            setRunValues(snapshotRunValues);
            setSelectedRun(snapshotSelectedRun);

            // Перезагружаем данные run с сервера для синхронизации
            try {
                await loadRunDetails(savedRunId);
            } catch (reloadErr) {
                console.error('Failed to reload run details:', reloadErr);
            }

            // Показываем детальную причину ошибки
            const errorData = err.response?.data;
            if (errorData?.error && errorData?.details) {
                const d = errorData.details;
                alert(`${errorData.error}\n\nВыработка: ${d.produced} кг\nДоступно: ${d.available} кг\nЗакуп: ${d.purchase} кг\nОстаток: ${d.openingBalance} кг\nПревышение: ${d.exceeded} кг`);
            } else {
                alert(errorData?.error || 'Ошибка сохранения');
            }
        }
    };

    const addValueEntry = async () => {
        if (!selectedRun || !selectedNodeForValue || !newValueAmount || isSubmitting) return;

        // V3: Validation - reasonText required for WRITEOFF/ADJUSTMENT
        if ((selectedOpType === 'WRITEOFF' || selectedOpType === 'ADJUSTMENT') && !opReasonText.trim()) {
            alert('Укажите причину для операции списания/корректировки');
            return;
        }

        setIsSubmitting(true); // Защита от двойного клика
        try {
            await axios.post(`${API_URL}/api/production-v2/runs/${selectedRun.id}/values`,
                {
                    mmlNodeId: selectedNodeForValue.id,
                    value: Number(newValueAmount),
                    // V3: Operation type fields
                    opType: selectedOpType,
                    // Send null for PRODUCTION (ignore any leftover reasonText)
                    reasonText: selectedOpType === 'PRODUCTION' ? null : (opReasonText.trim() || null),
                    photoUrl: opPhotoUrl,
                    photoMeta: opPhotoMeta,
                    // V3: operationAt = selectedDay + current time
                    operationAt: new Date().toISOString()
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await loadRunDetails(selectedRun.id);
            setShowAddValueModal(false);
            setNewValueAmount('');
            setSelectedNodeForValue(null);
            // V3: Reset operation state
            setSelectedOpType('PRODUCTION');
            setOpReasonText('');
            setOpPhotoUrl(null);
            setOpPhotoMeta(null);
        } catch (err: any) {
            console.error('Failed to add value:', err);
            const errMsg = err.response?.data?.error || 'Ошибка добавления';
            alert(errMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    // V3: Photo upload handler with compression and OCR
    const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setOpPhotoLoading(true);
        try {
            // Client-side compression
            const compressImage = async (file: File, quality: number, maxSize?: number): Promise<Blob> => {
                return new Promise((resolve, reject) => {
                    const img = document.createElement('img');
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    img.onload = () => {
                        let { width, height } = img;

                        // Resize if maxSize specified
                        if (maxSize && (width > maxSize || height > maxSize)) {
                            if (width > height) {
                                height = (height / width) * maxSize;
                                width = maxSize;
                            } else {
                                width = (width / height) * maxSize;
                                height = maxSize;
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        ctx?.drawImage(img, 0, 0, width, height);

                        canvas.toBlob(
                            blob => blob ? resolve(blob) : reject(new Error('Compression failed')),
                            'image/jpeg',
                            quality
                        );
                    };
                    img.onerror = reject;
                    img.src = URL.createObjectURL(file);
                });
            };

            // Compress: quality 0.7, fallback to 0.6 if >250KB, then resize
            let compressed = await compressImage(file, 0.7);
            if (compressed.size > 250 * 1024) {
                compressed = await compressImage(file, 0.6);
            }
            if (compressed.size > 250 * 1024) {
                compressed = await compressImage(file, 0.6, 1024);
            }

            // Upload to server
            const formData = new FormData();
            formData.append('photo', compressed, 'photo.jpg');

            const uploadRes = await axios.post(`${API_URL}/api/production-v2/uploads/photo`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            const { photoUrl, meta } = uploadRes.data;
            setOpPhotoUrl(photoUrl);
            setOpPhotoMeta(meta);

            // Call OCR (stub)
            try {
                const ocrRes = await axios.post(`${API_URL}/api/production-v2/ocr/weight`,
                    { photoUrl },
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                // V3: Store OCR result for manual Apply (not auto-fill)
                // B1+ fix: convert to Number and check isNaN
                const ocrValue = Number(ocrRes.data.value);
                if (!Number.isNaN(ocrValue) && ocrValue > 0) {
                    setOcrResult({
                        value: ocrValue,
                        confidence: ocrRes.data.confidence || 0,
                        raw: ocrRes.data.raw || ''
                    });
                    setOpPhotoMeta((prev: any) => ({ ...prev, ocrValue, ocrConfidence: ocrRes.data.confidence }));
                } else if (ocrRes.data.raw) {
                    // OCR ran but couldn't parse number - show raw for debugging
                    setOcrResult({ value: 0, confidence: 0, raw: ocrRes.data.raw });
                }
            } catch (ocrErr) {
                console.warn('OCR failed, manual input required:', ocrErr);
                setOcrResult(null);
            }

        } catch (err: any) {
            console.error('Photo upload failed:', err);
            alert('Ошибка загрузки фото: ' + (err.response?.data?.error || err.message));
        } finally {
            setOpPhotoLoading(false);
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
                {
                    value: Number(newValueAmount),
                    // V3: Include photo when editing
                    photoUrl: opPhotoUrl,
                    photoMeta: opPhotoMeta
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (selectedRun) await loadRunDetails(selectedRun.id);
            setShowAddValueModal(false);
            setNewValueAmount('');
            setEditingValueId(null);
            // V3: Reset photo state
            setOpPhotoUrl(null);
            setOpPhotoMeta(null);
        } catch (err: any) {
            console.error('Failed to update value:', err);
            alert('Ошибка обновления: ' + (err.response?.data?.error || err.message));
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

    // V3: Провести документ (draft → posted)
    const postRun = async (runId: number) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            await axios.post(`${API_URL}/api/production-v2/runs/${runId}/post`, {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Обновляем данные
            await fetchRunsAuto();
            if (selectedRun?.id === runId) {
                const updatedRun = { ...selectedRun, status: 'posted' as const, isLocked: true };
                setSelectedRun(updatedRun);
            }
            setWarning('Документ проведён!');
            setTimeout(() => setWarning(null), 2000);
        } catch (err: any) {
            console.error('Failed to post run:', err);
            alert(err.response?.data?.error || 'Ошибка проведения документа');
        } finally {
            setIsSubmitting(false);
        }
    };

    // V3: Аннулировать документ (posted → voided)
    const voidRun = async (runId: number) => {
        if (isSubmitting) return;
        const reason = prompt('Причина аннулирования:');
        if (reason === null) return; // cancel

        setIsSubmitting(true);
        try {
            await axios.post(`${API_URL}/api/production-v2/runs/${runId}/void`,
                { reason },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await fetchRunsAuto();
            setSelectedRun(null);
            setWarning('Документ аннулирован');
            setTimeout(() => setWarning(null), 2000);
        } catch (err: any) {
            console.error('Failed to void run:', err);
            alert(err.response?.data?.error || 'Ошибка аннулирования');
        } finally {
            setIsSubmitting(false);
        }
    };

    // V3: Загрузка корректировок
    const loadAdjustments = async () => {
        setAdjustmentsLoading(true);
        try {
            const params = new URLSearchParams();
            if (dateFrom) params.append('date', dateFrom);
            const res = await axios.get(`${API_URL}/api/production-v2/adjustments?${params}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setAdjustments(res.data);
        } catch (err) {
            console.error('Failed to load adjustments:', err);
        } finally {
            setAdjustmentsLoading(false);
        }
    };

    // V3: Создать корректировку
    const createAdjustmentHandler = async () => {
        if (!adjProductId || !adjDeltaWeight) {
            alert('Выберите товар и укажите вес');
            return;
        }
        setIsSubmitting(true);
        try {
            await axios.post(`${API_URL}/api/production-v2/adjustments`, {
                productId: adjProductId,
                adjustmentDate: dateFrom || new Date().toISOString().slice(0, 10),
                deltaWeight: Number(adjDeltaWeight),
                reason: adjReason || null
            }, { headers: { Authorization: `Bearer ${token}` } });
            await loadAdjustments();
            setShowAdjustmentModal(false);
            setAdjProductId(null);
            setAdjDeltaWeight('');
            setAdjReason('');
            setWarning('Корректировка создана');
            setTimeout(() => setWarning(null), 2000);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка создания');
        } finally {
            setIsSubmitting(false);
        }
    };

    // V3: Провести корректировку
    const postAdjustmentHandler = async (id: number) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            await axios.post(`${API_URL}/api/production-v2/adjustments/${id}/post`, {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await loadAdjustments();
            setWarning('Корректировка проведена');
            setTimeout(() => setWarning(null), 2000);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка проведения');
        } finally {
            setIsSubmitting(false);
        }
    };

    // V3: Аннулировать корректировку
    const voidAdjustmentHandler = async (id: number) => {
        if (isSubmitting) return;
        const reason = prompt('Причина аннулирования:');
        if (reason === null) return;
        setIsSubmitting(true);
        try {
            await axios.post(`${API_URL}/api/production-v2/adjustments/${id}/void`,
                { reason },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await loadAdjustments();
            setWarning('Корректировка аннулирована');
            setTimeout(() => setWarning(null), 2000);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка аннулирования');
        } finally {
            setIsSubmitting(false);
        }
    };

    // V3: Удалить корректировку (только draft)
    const deleteAdjustmentHandler = async (id: number) => {
        if (isSubmitting) return;
        if (!confirm('Удалить корректировку?')) return;
        setIsSubmitting(true);
        try {
            await axios.delete(`${API_URL}/api/production-v2/adjustments/${id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await loadAdjustments();
            setWarning('Корректировка удалена');
            setTimeout(() => setWarning(null), 2000);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка удаления');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredModalProducts = products.filter(p =>
        p.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
        p.code.toLowerCase().includes(modalSearch.toLowerCase())
    );

    // Расчёт фактического веса (V3: только PRODUCTION)
    const calculateActualWeight = (): number => {
        let total = 0;
        runValues.forEach((entries) => {
            entries.forEach(e => {
                if (e.value !== null && (!e.opType || e.opType === 'PRODUCTION')) total += Number(e.value);
            });
        });
        return total;
    };

    // Расчёт выработки по productId (сумма всех runs для этого товара В ТЕКУЩЕМ ДИАПАЗОНЕ ДАТ)
    const getYieldByProductId = (productId: number): number => {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);

        return runs
            .filter(r => {
                if (r.productId !== productId || r.isHidden) return false;
                // Фильтруем по дате выработки
                const runDate = new Date(r.productionDate);
                return runDate >= fromDate && runDate <= toDate;
            })
            .reduce((sum, r) => sum + (Number(r.actualWeight) || 0), 0);
    };

    // Фильтрация позиций по дате ВЫРАБОТКИ (не по дате закупки)
    // - Если есть run с productionDate в текущем диапазоне — показываем
    // - Если нет run и есть закуп/остаток в текущем диапазоне — показываем
    // - Если run есть, но его дата ВНЕ диапазона — НЕ показываем
    // - Также добавляем runs из других дат, перенесённые в текущий диапазон
    const displayedItems = (() => {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);

        // Фильтруем существующие combinedItems
        // V3: Показываем ВСЕ позиции с carryover/закупками, независимо от runs на других датах
        const filteredItems = combinedItems.filter(item => {
            // Определяем наличие carryover/остатка
            const hasCarryover =
                (item.purchaseDetails?.some((d: any) => Number(d?.remainingQty ?? 0) > 0) ?? false) ||
                Boolean((item as any).isCarryover) ||
                Number(item.balanceQty ?? 0) > 0;

            // Если есть закуп или остаток — всегда показываем
            if (item.purchaseQty > 0 || hasCarryover) {
                return true;
            }

            // Ищем run для этого товара В ПРЕДЕЛАХ текущего диапазона дат
            const productRunInRange = runs.find(r => {
                if (r.productId !== item.productId || r.isHidden) return false;
                const runDate = new Date(r.productionDate);
                return runDate >= fromDate && runDate <= toDate;
            });

            // Если есть run в диапазоне — показываем
            return !!productRunInRange;
        });

        // Добавляем runs из других дат, у которых productionDate в текущем диапазоне
        // но они ещё не в списке combinedItems
        const existingProductIds = new Set(filteredItems.map(i => i.productId));

        // Дедуплицируем runs по productId — берём только первый run для каждого товара
        const runsInRangeByProduct = new Map<number, typeof runs[0]>();
        runs.forEach(r => {
            if (r.isHidden) return;
            const runDate = new Date(r.productionDate);
            const inRange = runDate >= fromDate && runDate <= toDate;
            const notInList = !existingProductIds.has(r.productId);
            if (inRange && notInList && !runsInRangeByProduct.has(r.productId)) {
                runsInRangeByProduct.set(r.productId, r);
            }
        });

        // Создаём виртуальные CombinedItem из уникальных runs
        const virtualItems: CombinedItem[] = Array.from(runsInRangeByProduct.values()).map(run => ({
            productId: run.productId,
            productCode: run.product.code,
            productName: run.product.name,
            category: run.product.category,
            purchaseQty: 0, // Закуп на другой дате
            balanceQty: 0,
            totalQty: Number(run.actualWeight) || 0,
            purchaseDetails: []
        }));

        const allItems = [...filteredItems, ...virtualItems];
        // Фильтруем по мягкому удалению
        if (showMarkedItems) {
            return allItems.filter(item => markedForDeletion.has(item.productId));
        } else {
            return allItems.filter(item => !markedForDeletion.has(item.productId));
        }
    })();

    // Получить узлы активной категории
    const activeCategoryNodes = categories.find(c => c.category === activeCategory)?.nodes || [];

    // FIX: Динамически ищем combinedItem по productId вместо использования устаревшего selectedCombinedItem
    const currentCombinedItem = useMemo(() => {
        if (!selectedRun) return null;
        return combinedItems.find(item => item.productId === selectedRun.productId) || selectedCombinedItem;
    }, [selectedRun?.productId, combinedItems, selectedCombinedItem]);



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
            {/* Мобильная навигация */}
            {isMobile && mobileLevel > 1 && (
                <div className="flex items-center gap-2 mb-3 md:hidden">
                    <button
                        onClick={() => {
                            if (mobileLevel === 3) setMobileLevel(2);
                            else if (mobileLevel === 2) {
                                setMobileLevel(1);
                                setSelectedCombinedItem(null);
                                setSelectedRun(null);
                            }
                        }}
                        className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                    >
                        <X size={16} /> Назад
                    </button>
                    <span className="text-sm text-gray-500">
                        {mobileLevel === 2 && selectedCombinedItem?.productName}
                        {mobileLevel === 3 && 'Редактирование'}
                    </span>
                </div>
            )}

            {/* Production Grid */}
            <div className="grid grid-cols-1 md:grid-cols-[20%_15%_1fr] gap-3 flex-1 overflow-hidden">
                {/* Левая панель - Журнал */}
                <div className={`bg-white rounded-xl shadow-lg flex flex-col border border-gray-200 overflow-hidden ${isMobile && mobileLevel !== 1 ? 'hidden' : ''}`}>
                    <div className="p-4 border-b border-gray-200">
                        <h2 className="font-semibold mb-2 flex items-center justify-between text-gray-800">
                            Журнал производства
                            {(loading || combinedLoading) && <span className="text-xs text-gray-400 animate-pulse">загрузка...</span>}
                        </h2>

                        {/* V3: Единый date picker "День" — dateTo автоматически = dateFrom */}
                        <div className="mb-3">
                            <label className="text-xs text-gray-500 block mb-1">День</label>
                            <input type="date" className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-sm"
                                value={dateFrom} onChange={e => { setDateFrom(e.target.value); setDateTo(e.target.value); }} />
                        </div>

                        {/* Поиск */}
                        <div className="relative mb-3">
                            <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
                            <input type="text" placeholder="Поиск..." className="w-full bg-white border border-gray-300 rounded pl-8 pr-3 py-2 text-sm"
                                value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                        </div>

                        {/* Кнопки действий */}
                        <div className="flex gap-2 flex-wrap">
                            <Button onClick={loadCombinedItems} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                                <Download size={16} className="mr-1" /> Загрузить
                            </Button>
                            {selectedCombinedIds.size > 0 && (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        const newMarked = new Set(markedForDeletion);
                                        selectedCombinedIds.forEach(id => newMarked.add(id));
                                        setMarkedForDeletion(newMarked);
                                        setSelectedCombinedIds(new Set());
                                    }}
                                    className="text-red-600 border-red-300 hover:bg-red-50"
                                >
                                    <Trash2 size={16} className="mr-1" /> Скрыть ({selectedCombinedIds.size})
                                </Button>
                            )}
                        </div>
                        {markedForDeletion.size > 0 && (
                            <button
                                onClick={() => setShowMarkedItems(!showMarkedItems)}
                                className="text-xs text-gray-500 hover:text-gray-700 underline mt-2"
                            >
                                {showMarkedItems ? 'Скрыть помеченные' : `Показать помеченные (${markedForDeletion.size})`}
                            </button>
                        )}
                    </div>

                    {/* Объединённый список (закуп + остатки) */}
                    <div className="flex-1 overflow-auto">
                        {combinedLoading ? (
                            <div className="text-center text-gray-400 py-8">
                                <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                Загрузка данных...
                            </div>
                        ) : displayedItems.length === 0 ? (
                            <div className="text-center text-gray-400 py-8">
                                <Package size={32} className="mx-auto mb-2 text-gray-300" />
                                <p>Нет данных за выбранный период</p>
                                <p className="text-xs mt-1">Нажмите "Загрузить данные"</p>
                            </div>
                        ) : (
                            <>
                                {/* Счётчик */}
                                <div className="p-2 border-b bg-gray-50 text-sm text-gray-600">
                                    Найдено: <span className="font-semibold">{displayedItems.filter(item =>
                                        item.productName.toLowerCase().includes(productSearch.toLowerCase()) ||
                                        item.productCode.toLowerCase().includes(productSearch.toLowerCase())
                                    ).length}</span> позиций
                                </div>

                                {/* Список позиций */}
                                {displayedItems
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
                                                // Фильтр дат для поиска run'а
                                                const fromDate = new Date(dateFrom);
                                                fromDate.setHours(0, 0, 0, 0);
                                                const toDate = new Date(dateTo);
                                                toDate.setHours(23, 59, 59, 999);

                                                // Ищем run для этого товара В ПРЕДЕЛАХ текущего фильтра дат
                                                const existingRun = runs.find(r => {
                                                    if (r.productId !== item.productId || r.isHidden) return false;
                                                    const runDate = new Date(r.productionDate);
                                                    return runDate >= fromDate && runDate <= toDate;
                                                });

                                                // Проверяем: если товар уже выбран — не перезагружаем вообще

                                                if (selectedRun?.productId === item.productId) {
                                                    return;
                                                }

                                                setSelectedCombinedItem(item);
                                                if (isMobile) setMobileLevel(2);

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
                                                    <div className="text-xs text-gray-400">Код: {item.productCode}</div>
                                                    {/* IDN закупки */}
                                                    {item.purchaseDetails && item.purchaseDetails.length > 0 && (
                                                        <div className="text-xs text-indigo-500 font-mono">{item.purchaseDetails[0].idn}</div>
                                                    )}
                                                    {/* Пункт 8 ТЗ: Даты закупки и выработки */}
                                                    <div className="flex flex-wrap gap-2 text-xs mb-1 mt-1">
                                                        {item.purchaseDetails && item.purchaseDetails.length > 0 && (
                                                            <span className="text-gray-500">
                                                                📅 Закуп: {new Date(item.purchaseDetails[0].date).toLocaleDateString('ru-RU')}
                                                            </span>
                                                        )}
                                                        {(() => {
                                                            // Приоритет: если есть выбранный run для этого товара — показываем РЕДАКТИРУЕМУЮ дату
                                                            const isSelected = selectedRun?.productId === item.productId;

                                                            // Ищем run в пределах текущего фильтра дат
                                                            const fromDate = new Date(dateFrom);
                                                            fromDate.setHours(0, 0, 0, 0);
                                                            const toDateObj = new Date(dateTo);
                                                            toDateObj.setHours(23, 59, 59, 999);

                                                            const productRun = isSelected
                                                                ? selectedRun
                                                                : runs.find(r => {
                                                                    if (r.productId !== item.productId || r.isHidden) return false;
                                                                    const runDate = new Date(r.productionDate);
                                                                    return runDate >= fromDate && runDate <= toDateObj;
                                                                });

                                                            // Если это выбранный товар - показываем editProductionDate (то что в инпуте справа)
                                                            // Иначе - показываем дату из productRun
                                                            const displayDate = isSelected && editProductionDate
                                                                ? editProductionDate
                                                                : productRun?.productionDate;

                                                            return displayDate ? (
                                                                <span className="text-gray-500">
                                                                    🏭 Выработка: {new Date(displayDate).toLocaleDateString('ru-RU')}
                                                                </span>
                                                            ) : null;
                                                        })()}
                                                    </div>
                                                    {/* Маркеры количества - ВЕРТИКАЛЬНЫЙ LAYOUT */}
                                                    <div className="flex flex-col gap-1 text-xs">
                                                        {item.purchaseQty > 0 && (
                                                            <div className="flex items-center gap-1">
                                                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                                <span className="text-gray-600">Закуп:</span>
                                                                <span className="font-medium text-green-700">{formatNumber(item.purchaseQty, 1)} кг</span>
                                                            </div>
                                                        )}
                                                        {item.balanceQty > 0 && (
                                                            <div className="flex items-center gap-1">
                                                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                                <span className="text-gray-600">Остаток:</span>
                                                                <span className="font-medium text-blue-700">{formatNumber(item.balanceQty, 1)} кг</span>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-1">
                                                            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                                            <span className="text-gray-600">Выработано:</span>
                                                            <span className="font-medium text-orange-700">{formatNumber(getYieldByProductId(item.productId), 1)} кг</span>
                                                        </div>
                                                        {(() => {
                                                            const remaining = (item.purchaseQty || 0) + (item.balanceQty || 0) - getYieldByProductId(item.productId);
                                                            return (
                                                                <div className="flex items-center gap-1">
                                                                    <span className={`w-2 h-2 rounded-full ${remaining < 0 ? 'bg-red-600' : remaining > 0 ? 'bg-amber-500' : 'bg-gray-400'}`}></span>
                                                                    <span className="text-gray-600">Осталось:</span>
                                                                    <span className={`font-semibold ${remaining < 0 ? 'text-red-600' : remaining > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                                                                        {formatNumber(remaining, 1)} кг
                                                                    </span>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </>
                        )}
                    </div>


                </div>

                {/* СРЕДНЯЯ ПАНЕЛЬ - Вертикальные табы категорий */}
                <div className={`bg-white rounded-xl shadow-lg flex flex-col border border-gray-200 overflow-hidden ${isMobile && mobileLevel !== 2 ? 'hidden' : ''}`}>
                    <div className="p-3 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                            <List size={16} className="text-indigo-600" />
                            Категории MML
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">Выберите категорию для редактирования</p>
                    </div>
                    <div className="flex-1 overflow-auto p-2 space-y-1">
                        {!selectedRun ? (
                            <div className="text-center text-gray-400 py-8">
                                <Package size={32} className="mx-auto mb-2 text-gray-300" />
                                <p className="text-sm">Сначала выберите позицию</p>
                            </div>
                        ) : categories.length === 0 ? (
                            <div className="text-center text-gray-400 py-8">
                                <Package size={32} className="mx-auto mb-2 text-gray-300" />
                                <p className="text-sm">Нет категорий</p>
                            </div>
                        ) : (
                            categories.map(cat => {
                                const catTotal = cat.nodes.reduce((sum, node) => {
                                    const entries = runValues.get(node.id) || [];
                                    return sum + entries.reduce((s, e) => s + (Number(e.value) || 0), 0);
                                }, 0);
                                const isActive = activeCategory === cat.category;
                                return (
                                    <button
                                        key={cat.category}
                                        onClick={() => { setActiveCategory(cat.category); if (isMobile) setMobileLevel(3); }}
                                        className={`w-full text-left px-3 py-3 rounded-lg transition-all ${isActive
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                                            }`}
                                    >
                                        <div className="font-medium text-sm truncate">{cat.category}</div>
                                        <div className={`text-xs mt-1 flex gap-1 ${isActive ? 'text-indigo-200' : ''}`}>
                                            <span className={`px-1.5 py-0.5 rounded ${isActive ? 'bg-indigo-500' : 'bg-green-100 text-green-700'}`}>
                                                {cat.nodes.length} поз.
                                            </span>
                                            <span className={`px-1.5 py-0.5 rounded ${isActive ? 'bg-indigo-500' : 'bg-purple-100 text-purple-700'}`}>
                                                {formatNumber(catTotal, 1)} кг
                                            </span>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                    {/* Итого по всем категориям */}
                    {selectedRun && (
                        <div className="p-3 border-t bg-indigo-50">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-600">Итого:</span>
                                <span className="text-lg font-bold text-indigo-700">{formatNumber(calculateActualWeight(), 3)} кг</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* ПРАВАЯ ПАНЕЛЬ - Детали */}
                <div className={`bg-white rounded-lg shadow flex flex-col overflow-hidden ${isMobile && mobileLevel !== 3 ? 'hidden' : ''}`}>
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
                            {/* Шапка - ультракомпактная */}
                            <div className="px-2 py-1 border-b bg-gray-50 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-sm">{selectedRun.product.name}</h3>
                                    <div className="text-xs text-gray-500 flex items-center gap-2">
                                        <span className="flex items-center gap-0.5"><User size={10} /> {selectedRun.user?.name}</span>
                                        <span className="flex items-center gap-0.5"><Calendar size={10} /> {new Date(selectedRun.productionDate).toLocaleDateString('ru-RU')}</span>
                                        {/* V3: Status badge */}
                                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${selectedRun.status === 'posted' ? 'bg-green-100 text-green-700' :
                                            selectedRun.status === 'voided' ? 'bg-red-100 text-red-700' :
                                                'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {selectedRun.status === 'posted' ? '✓ Проведён' :
                                                selectedRun.status === 'voided' ? '✕ Аннулирован' :
                                                    '○ Черновик'}
                                        </span>
                                        {/* V3: needsReview indicator */}
                                        {selectedRun.needsReview && (
                                            <span className="px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-700 font-medium">
                                                ⚠ Требует проверки
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    {/* V3: Save button first (left) */}
                                    {selectedRun.status !== 'voided' && (
                                        !selectedRun.isLocked ? (
                                            <button onClick={saveRunValues} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded flex items-center gap-1">
                                                <Save size={12} /> Сохранить
                                            </button>
                                        ) : (
                                            <button onClick={() => toggleRunLock(selectedRun.id)} className="text-xs bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded flex items-center gap-1">
                                                <Edit2 size={12} /> Ред.
                                            </button>
                                        )
                                    )}
                                    {/* V3: Post/Void buttons second (right) */}
                                    {selectedRun.status === 'draft' && (
                                        <button
                                            onClick={() => postRun(selectedRun.id)}
                                            disabled={isSubmitting}
                                            className="text-xs bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-2 py-1 rounded flex items-center gap-1"
                                        >
                                            ✓ Провести
                                        </button>
                                    )}
                                    {selectedRun.status === 'posted' && (
                                        <button
                                            onClick={() => voidRun(selectedRun.id)}
                                            disabled={isSubmitting}
                                            className="text-xs bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-2 py-1 rounded flex items-center gap-1"
                                        >
                                            ✕ Аннулировать
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Поля — ультракомпактный дизайн */}
                            <div className="px-2 py-1 border-b bg-white">
                                <div className="grid grid-cols-5 gap-1 items-end">
                                    <div>
                                        <label className="text-[10px] text-gray-500 block">Дата</label>
                                        <input type="date" className="w-full border rounded px-1 py-0.5 text-xs disabled:bg-gray-100"
                                            value={editProductionDate} onChange={e => setEditProductionDate(e.target.value)} disabled={selectedRun.isLocked} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 block">
                                            <span className="inline-block w-1 h-1 bg-green-500 rounded-full mr-0.5"></span>Закуп
                                        </label>
                                        <div className="border rounded px-1 py-0.5 text-xs bg-green-50 font-medium text-green-700">
                                            {formatNumber(currentCombinedItem?.purchaseQty || 0, 1)}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 block">
                                            <span className="inline-block w-1 h-1 bg-blue-500 rounded-full mr-0.5"></span>Остаток
                                        </label>
                                        <div className="border rounded px-1 py-0.5 text-xs bg-blue-50 font-medium text-blue-700">
                                            {formatNumber(currentCombinedItem?.balanceQty || 0, 1)}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 block">
                                            <span className="inline-block w-1 h-1 bg-purple-500 rounded-full mr-0.5"></span>Итого
                                        </label>
                                        <div className="border rounded px-1 py-0.5 text-xs bg-purple-50 font-bold text-purple-700">
                                            {formatNumber(currentCombinedItem?.totalQty || 0, 1)}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 block">
                                            <span className="inline-block w-1 h-1 bg-orange-500 rounded-full mr-0.5"></span>Факт
                                        </label>
                                        <div className="border rounded px-1 py-0.5 text-xs bg-orange-50 font-bold text-orange-600">
                                            {formatNumber(calculateActualWeight(), 1)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Таблица деталей категории - INLINE КОМПАКТНАЯ */}
                            <div className="flex-1 overflow-auto px-3 py-2">
                                <div className="flex justify-between items-center mb-2">
                                    <div>
                                        <h4 className="font-semibold text-sm text-gray-800">{activeCategory || 'Выберите категорию'}</h4>
                                        <p className="text-gray-500 text-xs">{activeCategoryNodes.length} позиций</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                                            onClick={() => {
                                                if (activeCategoryNodes.length > 0) {
                                                    // Открываем модальное окно для добавления новой записи
                                                    setSelectedNodeForValue(activeCategoryNodes[0]);
                                                    setNewValueAmount('');
                                                    setEditingValueId(null);
                                                    setShowAddValueModal(true);
                                                } else {
                                                    setWarning('Сначала выберите категорию');
                                                    setTimeout(() => setWarning(null), 2000);
                                                }
                                            }}
                                        >
                                            <Plus size={14} /> Добавить строку
                                        </button>
                                        <div className="text-sm font-semibold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded">
                                            Итого: {formatNumber(activeCategoryNodes.reduce((sum, node) => {
                                                const entries = runValues.get(node.id) || [];
                                                return sum + entries.reduce((s, e) => s + (Number(e.value) || 0), 0);
                                            }, 0), 3)} кг
                                        </div>
                                    </div>
                                </div>
                                {activeCategoryNodes.length > 0 && (
                                    <div className="border rounded-lg overflow-hidden shadow-sm overflow-x-auto">
                                        <div className="min-w-[900px]">
                                            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2 grid grid-cols-[auto_minmax(0,1fr)_4rem_3.5rem_3rem_6rem_7rem_4rem_5rem_4rem] gap-2 items-center text-xs font-semibold text-gray-700 border-b">
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
                                                <span>Позиция</span>
                                                <span className="text-center text-gray-500">Тип</span>
                                                <span className="text-center text-gray-500">Фото</span>
                                                <span className="text-center text-gray-500 hidden md:block">Код</span>
                                                <span className="text-center text-gray-500 hidden md:block">Пользователь</span>
                                                <span className="text-center text-gray-500">Время</span>
                                                <span className="text-center">Итого (кг)</span>
                                                <span className="text-center">
                                                    {selectedMmlNodeIds.size > 0 ? (
                                                        <button
                                                            onClick={async () => {
                                                                if (!selectedRun) return;
                                                                const newValues = new Map(runValues);
                                                                selectedMmlNodeIds.forEach(nodeId => {
                                                                    newValues.delete(nodeId);
                                                                });
                                                                setRunValues(newValues);
                                                                setSelectedMmlNodeIds(new Set());
                                                                setWarning(`Очищено ${selectedMmlNodeIds.size} позиций`);
                                                                setTimeout(() => setWarning(null), 2000);
                                                            }}
                                                            className="text-red-600 hover:text-red-800"
                                                            title={`Очистить ${selectedMmlNodeIds.size} выбранных`}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    ) : 'Действия'}
                                                </span>
                                            </div>
                                            {activeCategoryNodes.map((node, idx) => {
                                                const entries = runValues.get(node.id) || [];
                                                const total = entries.reduce((s, e) => s + (Number(e.value) || 0), 0);
                                                // Пункт 3: не показывать пустые строки, КРОМЕ тех что редактируются
                                                if (total === 0 && editingNodeId !== node.id) return null;

                                                // TZ4: Показываем каждую запись как отдельную строку
                                                return (
                                                    <div key={node.id}>
                                                        {/* Заголовок позиции */}
                                                        <div className={`grid grid-cols-[auto_minmax(0,1fr)_4rem_3.5rem_3rem_6rem_7rem_4rem_5rem_4rem] gap-2 items-center px-4 py-2 border-b hover:bg-indigo-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${selectedMmlNodeIds.has(node.id) ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}`}>
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
                                                            <span className="text-sm truncate font-medium" title={node.product.name}>{node.product.name}</span>
                                                            {/* V3: Тип — показываем для первой записи или — */}
                                                            <span className="text-center">
                                                                {entries.length === 1 ? (
                                                                    <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${entries[0].opType === 'WRITEOFF' ? 'bg-red-100 text-red-600' :
                                                                        entries[0].opType === 'ADJUSTMENT' ? 'bg-orange-100 text-orange-600' :
                                                                            'bg-green-100 text-green-600'
                                                                        }`}>
                                                                        {entries[0].opType === 'WRITEOFF' ? 'Сп' : entries[0].opType === 'ADJUSTMENT' ? 'Кр' : 'Выр'}
                                                                    </span>
                                                                ) : entries.length > 1 ? (
                                                                    <span className="text-[10px] text-gray-400">{entries.length}</span>
                                                                ) : <span className="text-gray-300">—</span>}
                                                            </span>
                                                            {/* V3: Фото — показываем thumbnail для первой записи */}
                                                            <span className="text-center">
                                                                {entries.length === 1 && entries[0].photoUrl ? (
                                                                    <img src={`${API_URL}${entries[0].photoUrl}`} alt="" className="w-6 h-6 object-cover rounded mx-auto cursor-pointer hover:opacity-80" onClick={() => window.open(`${API_URL}${entries[0].photoUrl}`, '_blank')} />
                                                                ) : <span className="text-gray-300">—</span>}
                                                            </span>
                                                            <span className="text-xs text-gray-400 text-center hidden md:block">{node.product.code}</span>
                                                            {/* Показываем первого пользователя или количество записей */}
                                                            <span className="text-xs text-gray-500 truncate text-center hidden md:block">
                                                                {entries.length > 1
                                                                    ? `${entries.length} записей`
                                                                    : entries.length > 0 && entries[0].staff?.fullName
                                                                        ? entries[0].staff.fullName
                                                                        : '—'}
                                                            </span>
                                                            <span className="text-xs text-gray-400 text-center">
                                                                {entries.length === 1 && (entries[0].operationAt || entries[0].recordedAt)
                                                                    ? new Date(entries[0].operationAt || entries[0].recordedAt!).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                                                                    : entries.length > 1 ? '—' : '—'}
                                                            </span>
                                                            {/* Итого по позиции */}
                                                            <div className="flex justify-center">
                                                                <span className={`text-sm font-bold tabular-nums ${total > 0 ? 'text-indigo-700' : 'text-gray-400'}`}>
                                                                    {total > 0 ? formatNumber(total, 3) : '—'}
                                                                </span>
                                                            </div>
                                                            {/* Кнопка добавления */}
                                                            <div className="flex items-center gap-1 justify-center">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedNodeForValue(node);
                                                                        setNewValueAmount('');
                                                                        setEditingValueId(null);
                                                                        setShowAddValueModal(true);
                                                                    }}
                                                                    className="text-green-500 hover:text-green-700 p-0.5"
                                                                    title="Добавить запись"
                                                                >
                                                                    <Plus size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {/* TZ4: Отдельные строки для каждой записи */}
                                                        {entries.map((entry, entryIdx) => (
                                                            <div key={entry.id} className={`grid grid-cols-[auto_minmax(0,1fr)_4rem_3.5rem_3rem_6rem_7rem_4rem_5rem_4rem] gap-2 items-center px-4 py-1.5 border-b bg-gray-50/80 text-sm`}>
                                                                <span className="w-4"></span>
                                                                <span className="text-xs text-gray-400 pl-4">└ Запись #{entryIdx + 1}</span>
                                                                {/* V3: Тип badge */}
                                                                <span className="text-center">
                                                                    <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${entry.opType === 'WRITEOFF' ? 'bg-red-100 text-red-600' :
                                                                        entry.opType === 'ADJUSTMENT' ? 'bg-orange-100 text-orange-600' :
                                                                            'bg-green-100 text-green-600'
                                                                        }`}>
                                                                        {entry.opType === 'WRITEOFF' ? 'Сп' : entry.opType === 'ADJUSTMENT' ? 'Кр' : 'Выр'}
                                                                    </span>
                                                                </span>
                                                                {/* V3: Фото thumbnail */}
                                                                <span className="text-center">
                                                                    {entry.photoUrl ? (
                                                                        <img src={`${API_URL}${entry.photoUrl}`} alt="" className="w-5 h-5 object-cover rounded mx-auto cursor-pointer hover:opacity-80" onClick={() => window.open(`${API_URL}${entry.photoUrl}`, '_blank')} />
                                                                    ) : <span className="text-gray-300">—</span>}
                                                                </span>
                                                                <span className="text-xs text-gray-400 text-center hidden md:block">—</span>
                                                                <span className="text-xs text-blue-600 truncate text-center hidden md:block" title={entry.staff?.fullName || ''}>
                                                                    {entry.staff?.fullName || '—'}
                                                                </span>
                                                                <span className="text-xs text-gray-400 text-center">
                                                                    {(entry.operationAt || entry.recordedAt)
                                                                        ? new Date(entry.operationAt || entry.recordedAt!).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                                                                        : '—'}
                                                                </span>
                                                                <span className="text-xs text-indigo-600 font-medium text-center">
                                                                    {formatNumber(Number(entry.value) || 0, 3)}
                                                                </span>
                                                                <div className="flex items-center gap-1 justify-center">
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedNodeForValue(node);
                                                                            setEditingValueId(entry.id);
                                                                            setNewValueAmount(String(entry.value));
                                                                            setShowAddValueModal(true);
                                                                        }}
                                                                        className="text-blue-400 hover:text-blue-600 p-0.5"
                                                                        title="Редактировать"
                                                                    >
                                                                        <Edit2 size={12} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => deleteValueEntry(entry.id)}
                                                                        className="text-red-400 hover:text-red-600 p-0.5"
                                                                        title="Удалить"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                            {/* Итоговая строка */}
                                            <div className="grid grid-cols-[auto_minmax(0,1fr)_4rem_3.5rem_3rem_6rem_7rem_4rem_5rem_4rem] gap-2 items-center px-4 py-2 bg-indigo-100 border-t-2 border-indigo-200">
                                                <span></span>
                                                <span className="text-sm font-semibold text-indigo-900">ИТОГО по категории</span>
                                                <span></span>
                                                <span></span>
                                                <span></span>
                                                <span></span>
                                                <span></span>
                                                <span className="text-sm font-bold text-indigo-800 tabular-nums text-center">
                                                    {formatNumber(activeCategoryNodes.reduce((sum, node) => {
                                                        const entries = runValues.get(node.id) || [];
                                                        return sum + entries.reduce((s, e) => s + (Number(e.value) || 0), 0);
                                                    }, 0), 3)}
                                                </span>
                                                <span className="text-xs text-indigo-600 text-center">кг</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>


            {/* Модальное окно подтверждения удаления */}
            {deleteConfirmNode && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[400px] p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <Trash2 size={20} className="text-red-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">Подтверждение удаления</h3>
                        </div>
                        <p className="text-gray-600 mb-6">
                            Вы уверены что хотите удалить позицию <strong>"{deleteConfirmNode.product.name}"</strong>?
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteConfirmNode(null)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={() => {
                                    const newValues = new Map(runValues);
                                    newValues.delete(deleteConfirmNode.id);
                                    setRunValues(newValues);
                                    setDeleteConfirmNode(null);
                                    setWarning('Позиция удалена (сохраните для применения)');
                                    setTimeout(() => setWarning(null), 2000);
                                }}
                                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                            >
                                Удалить
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                            <th className="text-left px-4 py-2 font-medium">
                                                <select
                                                    value={opTypeFilter}
                                                    onChange={e => setOpTypeFilter(e.target.value as ProductionOpType | 'all')}
                                                    className="bg-transparent border-none font-medium cursor-pointer hover:text-indigo-600"
                                                >
                                                    <option value="all">Тип ▾</option>
                                                    <option value="PRODUCTION">✅ Выработка</option>
                                                    <option value="WRITEOFF">❌ Списание</option>
                                                    <option value="ADJUSTMENT">⚖️ Корректировка</option>
                                                </select>
                                            </th>
                                            <th className="text-right px-4 py-2 font-medium">Значение (кг)</th>
                                            <th className="px-2 py-2 font-medium w-12">📷</th>
                                            <th className="text-left px-4 py-2 font-medium">Сотрудник</th>
                                            <th className="text-left px-4 py-2 font-medium">Дата/Время</th>
                                            <th className="px-4 py-2 font-medium">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeCategoryNodes.map(node => {
                                            let entries = runValues.get(node.id) || [];
                                            // V3: Filter by opType
                                            if (opTypeFilter !== 'all') {
                                                entries = entries.filter(e => e.opType === opTypeFilter);
                                            }
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
                                                    {/* V3: Operation Type Badge */}
                                                    <td className="px-4 py-2">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${entry.opType === 'WRITEOFF' ? 'bg-red-100 text-red-700' :
                                                            entry.opType === 'ADJUSTMENT' ? 'bg-orange-100 text-orange-700' :
                                                                'bg-green-100 text-green-700'
                                                            }`}>
                                                            {entry.opType === 'WRITEOFF' ? 'Спис.' :
                                                                entry.opType === 'ADJUSTMENT' ? 'Корр.' : 'Выр.'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-medium">{formatNumber(Number(entry.value), 3)}</td>
                                                    {/* V3: Photo thumbnail */}
                                                    <td className="px-2 py-2 text-center">
                                                        {entry.photoUrl ? (
                                                            <img
                                                                src={`${API_URL}${entry.photoUrl}`}
                                                                alt="Фото"
                                                                className="w-8 h-8 object-cover rounded cursor-pointer hover:opacity-80"
                                                                onClick={() => window.open(`${API_URL}${entry.photoUrl}`, '_blank')}
                                                                title="Клик для увеличения"
                                                            />
                                                        ) : (
                                                            <span className="text-gray-300">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2">{entry.staff?.fullName || '—'}</td>
                                                    <td className="px-4 py-2 text-xs text-gray-500">
                                                        {(entry.operationAt || entry.recordedAt) ? new Date(entry.operationAt || entry.recordedAt!).toLocaleString('ru-RU') : '—'}
                                                    </td>
                                                    <td className="px-4 py-2 flex items-center gap-2">
                                                        <button onClick={() => {
                                                            setEditingValueId(entry.id);
                                                            setNewValueAmount(String(entry.value || ''));
                                                            // V3: Load existing photo
                                                            setOpPhotoUrl(entry.photoUrl || null);
                                                            setOpPhotoMeta(entry.photoMeta || null);
                                                            setShowAddValueModal(true);
                                                        }}
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

            {/* Модальное окно добавления/редактирования записи (V3: с типом операции) */}
            {
                showAddValueModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
                        <div className="bg-white rounded-lg shadow-xl w-[500px]">
                            <div className="p-4 border-b flex justify-between items-center">
                                <h3 className="text-lg font-semibold">{editingValueId ? 'Редактировать запись' : 'Добавить операцию'}</h3>
                                <button onClick={() => {
                                    setShowAddValueModal(false);
                                    setEditingValueId(null);
                                    setNewValueAmount('');
                                    setSelectedOpType('PRODUCTION');
                                    setOpReasonText('');
                                    setOpPhotoUrl(null);
                                    setOpPhotoMeta(null);
                                }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                            </div>
                            <div className="p-4 space-y-4">
                                {/* V3: Operation Type Selection */}
                                {!editingValueId && (
                                    <div>
                                        <label className="text-sm text-gray-500 block mb-2">Быстрые действия</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {/* Выработка ручн */}
                                            <button
                                                type="button"
                                                onClick={() => setSelectedOpType('PRODUCTION')}
                                                className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${selectedOpType === 'PRODUCTION'
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                            >
                                                ✅ Выработка
                                            </button>
                                            {/* Фото для любого типа */}
                                            <label
                                                className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-center ${opPhotoUrl
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                                    }`}
                                            >
                                                📷 Фото
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    {...(isMobile ? { capture: 'environment' as const } : {})}
                                                    onChange={handlePhotoUpload}
                                                    className="hidden"
                                                />
                                            </label>
                                            {/* Списание */}
                                            <button
                                                type="button"
                                                onClick={() => setSelectedOpType('WRITEOFF')}
                                                className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${selectedOpType === 'WRITEOFF'
                                                    ? 'bg-red-600 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                            >
                                                ❌ Списание
                                            </button>
                                            {/* Корректировка */}
                                            <button
                                                type="button"
                                                onClick={() => setSelectedOpType('ADJUSTMENT')}
                                                className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${selectedOpType === 'ADJUSTMENT'
                                                    ? 'bg-orange-600 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                            >
                                                ⚖️ Коррект.
                                            </button>
                                        </div>
                                        <div className="mt-1 text-xs text-gray-400">
                                            {selectedOpType === 'PRODUCTION' && 'Выработка — готовая продукция'}
                                            {selectedOpType === 'WRITEOFF' && 'Списание — отходы, брак'}
                                            {selectedOpType === 'ADJUSTMENT' && 'Корректировка — расхождение веса'}
                                        </div>
                                    </div>
                                )}

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

                                {/* V3: Reason text for WRITEOFF/ADJUSTMENT */}
                                {(selectedOpType === 'WRITEOFF' || selectedOpType === 'ADJUSTMENT') && !editingValueId && (
                                    <div>
                                        <label className="text-sm text-gray-500 block mb-1">
                                            Причина <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full border rounded px-3 py-2"
                                            placeholder={selectedOpType === 'WRITEOFF' ? 'Причина списания...' : 'Причина корректировки...'}
                                            value={opReasonText}
                                            onChange={e => setOpReasonText(e.target.value)}
                                        />
                                    </div>
                                )}

                                {/* V3: Photo upload section (shown in both add and edit modes) */}
                                <div>
                                    <label className="text-sm text-gray-500 block mb-1">Фото весов (опционально)</label>
                                    <div className="flex items-center gap-3">
                                        {/* Photo preview or upload button */}
                                        {opPhotoUrl ? (
                                            <div className="relative flex items-center gap-2">
                                                <img
                                                    src={`${API_URL}${opPhotoUrl}`}
                                                    alt="Фото весов"
                                                    className="w-20 h-20 object-cover rounded-lg border"
                                                />
                                                {/* Перефото button */}
                                                <label className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg cursor-pointer hover:bg-indigo-200 text-xs font-medium">
                                                    📷 Перефото
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        {...(isMobile ? { capture: 'environment' as const } : {})}
                                                        onChange={handlePhotoUpload}
                                                        className="hidden"
                                                    />
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => { setOpPhotoUrl(null); setOpPhotoMeta(null); setOcrResult(null); }}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                                    title="Удалить фото"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className={`flex items-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${opPhotoLoading ? 'bg-gray-100 cursor-wait' : 'hover:bg-gray-50 hover:border-indigo-400'}`}>
                                                {opPhotoLoading ? (
                                                    <span className="animate-spin inline-block w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full"></span>
                                                ) : (
                                                    <Camera size={20} className="text-indigo-600" />
                                                )}
                                                <span className="text-sm text-gray-600">
                                                    {opPhotoLoading ? 'Загрузка...' : 'Сделать фото'}
                                                </span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    {...(isMobile ? { capture: 'environment' as const } : {})}
                                                    onChange={handlePhotoUpload}
                                                    disabled={opPhotoLoading}
                                                    className="hidden"
                                                />
                                            </label>
                                        )}

                                        {/* V3: OCR Result with Apply button - B1: color by confidence */}
                                        {ocrResult && (
                                            <div className={`p-3 border rounded-lg ${ocrResult.value > 0 && ocrResult.confidence >= 0.5
                                                ? 'bg-green-50 border-green-200'
                                                : ocrResult.value > 0
                                                    ? 'bg-yellow-50 border-yellow-300'
                                                    : 'bg-red-50 border-red-200'
                                                }`}>
                                                <div className="flex items-center justify-between gap-2">
                                                    <div>
                                                        {ocrResult.value > 0 ? (
                                                            <>
                                                                <div className={`text-xs ${ocrResult.confidence >= 0.5 ? 'text-gray-500' : 'text-yellow-700'}`}>
                                                                    {ocrResult.confidence >= 0.5 ? 'OCR распознал:' : '⚠️ Низкая уверенность:'}
                                                                </div>
                                                                <div className={`text-lg font-bold ${ocrResult.confidence >= 0.5 ? 'text-green-700' : 'text-yellow-700'}`}>
                                                                    {ocrResult.value} кг
                                                                </div>
                                                                <div className="text-xs text-gray-400">
                                                                    Уверенность: {Math.round(ocrResult.confidence * 100)}%
                                                                    {ocrResult.confidence < 0.5 && ' — проверьте вручную'}
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="text-xs text-red-600">❌ Не распознано</div>
                                                                <div className="text-sm text-gray-600">Введите вручную</div>
                                                            </>
                                                        )}
                                                        {/* Show raw for debugging */}
                                                        {ocrResult.raw && (
                                                            <details className="mt-1">
                                                                <summary className="text-xs text-gray-400 cursor-pointer">Raw: {ocrResult.raw.slice(0, 20)}...</summary>
                                                                <pre className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{ocrResult.raw}</pre>
                                                            </details>
                                                        )}
                                                    </div>
                                                    {ocrResult.value > 0 && (
                                                        <button
                                                            onClick={() => {
                                                                setNewValueAmount(String(ocrResult.value));
                                                                setOcrResult(null);
                                                            }}
                                                            className={`px-3 py-2 text-white rounded-lg text-sm font-medium ${ocrResult.confidence >= 0.5
                                                                ? 'bg-green-600 hover:bg-green-700'
                                                                : 'bg-yellow-600 hover:bg-yellow-700'
                                                                }`}
                                                        >
                                                            {ocrResult.confidence >= 0.5 ? '✓ Применить' : '⚠ Применить'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 border-t flex justify-end gap-2">
                                <Button variant="outline" onClick={() => {
                                    setShowAddValueModal(false);
                                    setEditingValueId(null);
                                    setNewValueAmount('');
                                    setSelectedOpType('PRODUCTION');
                                    setOpReasonText('');
                                    setOpPhotoUrl(null);
                                    setOpPhotoMeta(null);
                                    setOcrResult(null);
                                }} disabled={isSubmitting}>Отмена</Button>
                                <Button
                                    onClick={editingValueId ? updateValueEntry : addValueEntry}
                                    className={
                                        selectedOpType === 'PRODUCTION' ? 'bg-green-600 hover:bg-green-700' :
                                            selectedOpType === 'WRITEOFF' ? 'bg-red-600 hover:bg-red-700' :
                                                'bg-orange-600 hover:bg-orange-700'
                                    }
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Загрузка...</>
                                    ) : (
                                        editingValueId ? 'Сохранить' :
                                            selectedOpType === 'PRODUCTION' ? 'Добавить выработку' :
                                                selectedOpType === 'WRITEOFF' ? 'Списать' : 'Корректировать'
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
