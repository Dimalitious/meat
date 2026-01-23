import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { RefreshCw, Save, Edit3, Search, ChevronDown, ChevronRight, Layers, X, Package } from 'lucide-react';

// ============================================
// ИНТЕРФЕЙСЫ
// ============================================

interface Product {
    id: number;
    name: string;
    code: string | null;
    priceListName: string | null;
    category: string | null;
    coefficient: number;
}

interface SvodLine {
    id?: number;
    productId: number;
    shortName: string | null;
    category: string | null;
    coefficient: number | null;
    orderQty: number;
    productionInQty: number;
    openingStock: number;
    openingStockIsManual: boolean;
    afterPurchaseStock: number | null;
    availableQty?: number;
    qtyToShip: number | null;
    factMinusWaste: number | null;
    weightToShip: number | null;
    planFactDiff: number | null;
    underOver: number | null;
    // Маркировка распределения
    isDistributionSource?: boolean;
    distributedFromLineId?: number | null;
    distributedFromName?: string | null;
    product?: Product;
}

interface SvodSupplierCol {
    id?: number;
    colIndex: number;
    supplierId: number;
    supplierName: string;
    totalPurchase: number;
}

interface SvodSupplierValue {
    productId: number;
    supplierId: number;
    purchaseQty: number;
}

interface SvodData {
    id: number | null;
    svodDate: string;
    status: string;
    ordersCount?: number;
    totalOrderKg?: number;
    lines: SvodLine[];
    supplierCols: SvodSupplierCol[];
    supplierValues: SvodSupplierValue[];
}

interface SvodTabProps {
    selectedDate: string;
}

// Интерфейсы для распределения веса
interface DistributionItem {
    productId: number;
    productName: string;
    productCode: string | null;
    qty: number;
}

interface DistributionModalData {
    lineId: number;
    productId: number;
    productName: string;
    category: string | null;
    factMinusWaste: number;
    weightToShip: number | null;
    selectedItems: DistributionItem[];
}
// Фиксированный порядок категорий
const CATEGORY_ORDER = ['Баранина', 'Говядина', 'Курица'];

// ============================================
// КОМПОНЕНТ ВКЛАДКИ СВОД
// ============================================

export default function SvodTab({ selectedDate }: SvodTabProps) {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'preview' | 'saved' | 'editing'>('preview');
    const [svod, setSvod] = useState<SvodData | null>(null);
    const [editedLines, setEditedLines] = useState<Map<number, Partial<SvodLine>>>(new Map());

    // Фильтры
    const [searchTerm, setSearchTerm] = useState('');

    // НОВОЕ: Активный таб категории (null = все категории "СВОД")
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    // Состояния модального окна распределения
    const [showDistributionModal, setShowDistributionModal] = useState(false);
    const [distributionData, setDistributionData] = useState<DistributionModalData | null>(null);
    const [distributionLoading, setDistributionLoading] = useState(false);
    const [plannedWeight, setPlannedWeight] = useState<string>('');
    const [showProductSelector, setShowProductSelector] = useState(false);

    // Загрузка данных
    const fetchSvod = useCallback(async () => {
        if (!selectedDate) return;
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/svod`, {
                params: { date: selectedDate },
                headers: { Authorization: `Bearer ${token}` }
            });
            setSvod(res.data.svod);
            setMode(res.data.mode);
            // Раскрываем все категории по умолчанию
            if (res.data.svod?.lines) {
                const categories = new Set(res.data.svod.lines.map((l: SvodLine) => l.category || 'Без категории'));
                setExpandedCategories(categories as Set<string>);
            }
            // Сбрасываем активный таб при смене даты
            setActiveCategory(null);
        } catch (err) {
            console.error('Failed to fetch svod:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedDate, token]);

    useEffect(() => {
        fetchSvod();
    }, [fetchSvod]);

    // ============================================
    // ДИНАМИЧЕСКИЕ ТАБЫ ПО КАТЕГОРИЯМ
    // ============================================

    // Получаем список категорий с заказами (orderQty > 0)
    const categoriesWithOrders = useMemo(() => {
        if (!svod?.lines) return [];

        // Группируем по категориям и считаем сумму заказов
        const categoryTotals = new Map<string, { orderQty: number; count: number }>();

        for (const line of svod.lines) {
            const cat = line.category || 'Без категории';
            const existing = categoryTotals.get(cat) || { orderQty: 0, count: 0 };
            categoryTotals.set(cat, {
                orderQty: existing.orderQty + (line.orderQty || 0),
                count: existing.count + 1
            });
        }

        // Фильтруем только категории с заказами
        const categoriesWithData = Array.from(categoryTotals.entries())
            .filter(([_, data]) => data.orderQty > 0 || data.count > 0)
            .map(([name, data]) => ({ name, ...data }));

        // Сортируем: сначала по фиксированному порядку, затем по алфавиту
        categoriesWithData.sort((a, b) => {
            const indexA = CATEGORY_ORDER.indexOf(a.name);
            const indexB = CATEGORY_ORDER.indexOf(b.name);
            if (indexA >= 0 && indexB >= 0) return indexA - indexB;
            if (indexA >= 0) return -1;
            if (indexB >= 0) return 1;
            return a.name.localeCompare(b.name, 'ru');
        });

        return categoriesWithData;
    }, [svod?.lines]);

    // Сохранить свод
    const handleSave = async () => {
        if (!svod) return;
        setLoading(true);
        try {
            // Применяем редактированные значения к строкам
            const updatedLines = svod.lines.map(line => {
                const edits = editedLines.get(line.productId);
                if (edits) {
                    return { ...line, ...edits };
                }
                return line;
            });

            const res = await axios.post(`${API_URL}/api/svod`, {
                svodDate: selectedDate,
                lines: updatedLines,
                supplierCols: svod.supplierCols,
                supplierValues: svod.supplierValues
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSvod(res.data.svod);
            setMode('saved');
            setEditedLines(new Map());
            alert('Свод сохранён!');
        } catch (err) {
            console.error('Failed to save svod:', err);
            alert('Ошибка сохранения свода');
        } finally {
            setLoading(false);
        }
    };

    // Обновить свод из источников
    const handleRefresh = async () => {
        if (!svod?.id) {
            await fetchSvod();
            return;
        }
        setLoading(true);
        try {
            const res = await axios.put(`${API_URL}/api/svod/${svod.id}/refresh`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSvod(res.data.svod);
            setEditedLines(new Map());
            alert('Свод обновлён из источников!');
        } catch (err) {
            console.error('Failed to refresh svod:', err);
            alert('Ошибка обновления свода');
        } finally {
            setLoading(false);
        }
    };

    // Редактирование строки
    const handleLineEdit = (productId: number, field: string, value: string) => {
        const numValue = value === '' ? null : parseFloat(value);
        setEditedLines(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(productId) || {};
            newMap.set(productId, { ...existing, [field]: numValue });
            return newMap;
        });
    };

    // Получить значение числового поля с учётом редактирования
    const getNumericLineValue = (line: SvodLine, field: 'openingStock' | 'afterPurchaseStock'): number | null => {
        const edits = editedLines.get(line.productId);
        if (edits && field in edits) {
            return edits[field] as number | null ?? null;
        }
        return line[field];
    };

    // Получить сумму закупок по всем поставщикам для товара
    const getTotalPurchaseForProduct = (productId: number): number => {
        if (!svod?.supplierValues) return 0;
        return svod.supplierValues
            .filter(v => v.productId === productId)
            .reduce((sum, v) => sum + (Number(v.purchaseQty) || 0), 0);
    };

    // Расчёт "Имеется в наличии" = Остаток на начало + Закупки + Приход с производства
    const calculateAvailableQty = (line: SvodLine): number => {
        const openingStock = Number(getNumericLineValue(line, 'openingStock')) || 0;
        const productionInQty = Number(line.productionInQty) || 0;
        const totalPurchases = getTotalPurchaseForProduct(line.productId);
        return openingStock + totalPurchases + productionInQty;
    };

    // Расчёт "Факт (− отходы)" = Имеется в наличии × Коэффициент
    const calculateFactMinusWaste = (line: SvodLine): number => {
        const availableQty = calculateAvailableQty(line);
        const coefficient = Number(line.coefficient) || 1;
        return availableQty * coefficient;
    };

    // Переключение категории (для группировки в режиме "СВОД")
    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(category)) {
                newSet.delete(category);
            } else {
                newSet.add(category);
            }
            return newSet;
        });
    };

    // Получение значения закупки по поставщику для товара
    const getSupplierValue = (productId: number, supplierId: number) => {
        const value = svod?.supplierValues.find(v => v.productId === productId && v.supplierId === supplierId);
        return value?.purchaseQty || 0;
    };

    // ============================================
    // ФУНКЦИИ РАСПРЕДЕЛЕНИЯ ВЕСА
    // ============================================

    // Открыть модальное окно распределения
    const openDistributionModal = (line: SvodLine) => {
        if (!line.id) {
            alert('Сначала сохраните свод');
            return;
        }

        setDistributionData({
            lineId: line.id,
            productId: line.productId,
            productName: line.product?.name || line.shortName || 'Товар',
            category: line.category,
            factMinusWaste: calculateFactMinusWaste(line),
            weightToShip: line.weightToShip,
            selectedItems: []
        });

        setPlannedWeight(line.weightToShip?.toString() || '');
        setShowDistributionModal(true);
    };

    // Закрыть модальное окно
    const closeDistributionModal = () => {
        setShowDistributionModal(false);
        setDistributionData(null);
        setShowProductSelector(false);
        setPlannedWeight('');
    };

    // Добавить товар в список распределения
    const addProductToDistribution = (product: SvodLine) => {
        if (!distributionData) return;
        if (distributionData.selectedItems.some(item => item.productId === product.productId)) {
            alert('Этот товар уже добавлен');
            return;
        }
        setDistributionData({
            ...distributionData,
            selectedItems: [...distributionData.selectedItems, {
                productId: product.productId,
                productName: product.product?.name || product.shortName || 'Товар',
                productCode: product.product?.code || null,
                qty: 0
            }]
        });
        setShowProductSelector(false);
    };

    // Удалить товар из списка распределения
    const removeProductFromDistribution = (productId: number) => {
        if (!distributionData) return;
        setDistributionData({
            ...distributionData,
            selectedItems: distributionData.selectedItems.filter(item => item.productId !== productId)
        });
    };

    // Обновить количество для товара
    const updateDistributionQty = (productId: number, value: string) => {
        if (!distributionData) return;
        const numValue = value === '' ? 0 : parseFloat(value);
        setDistributionData({
            ...distributionData,
            selectedItems: distributionData.selectedItems.map(item =>
                item.productId === productId ? { ...item, qty: numValue } : item
            )
        });
    };

    // Рассчитать сумму распределённых значений
    const getTotalDistributed = (): number => {
        if (!distributionData) return 0;
        return distributionData.selectedItems.reduce((sum, item) => sum + (item.qty || 0), 0);
    };

    // Получить товары той же категории для выбора
    const getCategoryProducts = (): SvodLine[] => {
        if (!distributionData || !svod) return [];
        return svod.lines.filter(line => line.category === distributionData.category);
    };

    // Сохранить распределение
    const saveDistribution = async () => {
        if (!distributionData || !svod) return;

        const distributions = distributionData.selectedItems
            .filter(item => item.qty > 0)
            .map(item => ({
                productId: item.productId,
                productName: item.productName,
                qty: item.qty
            }));

        if (distributions.length === 0) {
            alert('Добавьте товары для распределения');
            return;
        }

        // Проверяем, есть ли позиции не в своде
        const missingProducts: { productId: number; productName: string; qty: number }[] = [];
        for (const dist of distributions) {
            const existsInSvod = svod.lines.some(line => line.productId === dist.productId);
            if (!existsInSvod) {
                missingProducts.push({
                    productId: dist.productId,
                    productName: dist.productName,
                    qty: dist.qty
                });
            }
        }

        setDistributionLoading(true);
        try {
            const response = await axios.post(`${API_URL}/api/svod/lines/${distributionData.lineId}/distribution`, {
                plannedWeight: plannedWeight ? parseFloat(plannedWeight) : null,
                distributions,
                addMissingProducts: missingProducts.length > 0,
                sourceProductId: distributionData.productId,
                sourceProductName: distributionData.productName
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Обновляем локальный state свода
            let updatedLines = [...svod.lines];
            const sourceName = distributionData.productName;

            // 1. Помечаем родительскую позицию как источник
            updatedLines = updatedLines.map(line => {
                if (line.id === distributionData.lineId) {
                    return { ...line, weightToShip: null, isDistributionSource: true };
                }
                return line;
            });

            // 2. Обновляем дочерние позиции
            for (const dist of distributions) {
                const existingIndex = updatedLines.findIndex(l => l.productId === dist.productId);
                if (existingIndex >= 0) {
                    updatedLines[existingIndex] = {
                        ...updatedLines[existingIndex],
                        weightToShip: (updatedLines[existingIndex].weightToShip || 0) + dist.qty,
                        distributedFromLineId: distributionData.lineId,
                        distributedFromName: sourceName
                    };
                } else if (response.data.addedLines) {
                    const addedLine = response.data.addedLines.find((l: any) => l.productId === dist.productId);
                    if (addedLine) {
                        updatedLines.push({
                            ...addedLine,
                            weightToShip: dist.qty,
                            distributedFromLineId: distributionData.lineId,
                            distributedFromName: sourceName
                        });
                    }
                }
            }

            setSvod({ ...svod, lines: updatedLines });
            alert('Распределение сохранено!');
            closeDistributionModal();
        } catch (error: any) {
            console.error('Save distribution error:', error);
            alert(error.response?.data?.error || 'Ошибка сохранения');
        } finally {
            setDistributionLoading(false);
        }
    };

    // ============================================
    // ФИЛЬТРАЦИЯ СТРОК
    // ============================================

    // Фильтруем строки по активной категории и поиску
    const filteredLines = useMemo(() => {
        if (!svod?.lines) return [];

        return svod.lines.filter(line => {
            // Фильтр по категории (если выбран таб)
            if (activeCategory !== null) {
                const lineCategory = line.category || 'Без категории';
                if (lineCategory !== activeCategory) return false;
            }

            // Фильтр по поиску
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const matchesName = line.shortName?.toLowerCase().includes(searchLower) ||
                    line.product?.name?.toLowerCase().includes(searchLower);
                if (!matchesName) return false;
            }

            return true;
        });
    }, [svod?.lines, activeCategory, searchTerm]);

    // Группировка строк по категориям (для режима "СВОД" - все категории)
    const groupedLines = useMemo(() => {
        const result: Record<string, SvodLine[]> = {};

        for (const line of filteredLines) {
            const category = line.category || 'Без категории';
            if (!result[category]) result[category] = [];
            result[category].push(line);
        }

        return result;
    }, [filteredLines]);

    // Сортированные категории для отображения
    const sortedCategories = useMemo(() => {
        return Object.keys(groupedLines).sort((a, b) => {
            const indexA = CATEGORY_ORDER.indexOf(a);
            const indexB = CATEGORY_ORDER.indexOf(b);
            if (indexA >= 0 && indexB >= 0) return indexA - indexB;
            if (indexA >= 0) return -1;
            if (indexB >= 0) return 1;
            return a.localeCompare(b, 'ru');
        });
    }, [groupedLines]);

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="svod-tab">
            {/* Верхняя панель */}
            <div className="svod-toolbar" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                backgroundColor: '#f8f9fa',
                borderBottom: '1px solid #e0e0e0',
                flexWrap: 'wrap'
            }}>
                {/* Дата */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 500, color: '#666' }}>Дата:</span>
                    <span style={{ fontWeight: 600 }}>{new Date(selectedDate).toLocaleDateString('ru-RU')}</span>
                </div>

                {/* Режим */}
                <div style={{
                    padding: '4px 12px',
                    borderRadius: '16px',
                    fontSize: '13px',
                    fontWeight: 500,
                    backgroundColor: mode === 'saved' ? '#d4edda' : mode === 'editing' ? '#fff3cd' : '#e2e3e5',
                    color: mode === 'saved' ? '#155724' : mode === 'editing' ? '#856404' : '#383d41'
                }}>
                    {mode === 'saved' ? '✓ Сохранён' : mode === 'editing' ? '✎ Редактирование' : '○ Предпросмотр'}
                </div>

                {/* KPI - Количество заказов */}
                {svod && (
                    <>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            backgroundColor: '#e3f2fd',
                            borderRadius: '8px',
                            marginLeft: '12px'
                        }}>
                            <span style={{ fontSize: '20px' }}>📋</span>
                            <div>
                                <div style={{ fontSize: '11px', color: '#666', lineHeight: 1 }}>Заказов</div>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: '#1565c0' }}>
                                    {svod.ordersCount ?? 0}
                                </div>
                            </div>
                        </div>

                        {/* KPI - Общий вес */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            backgroundColor: '#e8f5e9',
                            borderRadius: '8px'
                        }}>
                            <span style={{ fontSize: '20px' }}>⚖️</span>
                            <div>
                                <div style={{ fontSize: '11px', color: '#666', lineHeight: 1 }}>Общий вес</div>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: '#2e7d32' }}>
                                    {(svod.totalOrderKg ?? 0).toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} кг
                                </div>
                            </div>
                        </div>
                    </>
                )}

                <div style={{ flex: 1 }} />

                {/* Поиск */}
                <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                    <input
                        type="text"
                        placeholder="Поиск товара..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            padding: '8px 12px 8px 32px',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            width: '200px'
                        }}
                    />
                </div>

                {/* Кнопки действий */}
                <button
                    onClick={handleRefresh}
                    disabled={loading}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        border: 'none',
                        borderRadius: '6px',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.7 : 1
                    }}
                >
                    <RefreshCw size={16} className={loading ? 'spin' : ''} />
                    Обновить свод
                </button>

                {mode === 'saved' && (
                    <button
                        onClick={() => setMode('editing')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            border: 'none',
                            borderRadius: '6px',
                            backgroundColor: '#ffc107',
                            color: '#212529',
                            cursor: 'pointer'
                        }}
                    >
                        <Edit3 size={16} />
                        Редактировать
                    </button>
                )}

                <button
                    onClick={handleSave}
                    disabled={loading}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        border: 'none',
                        borderRadius: '6px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.7 : 1
                    }}
                >
                    <Save size={16} />
                    Сохранить свод
                </button>
            </div>

            {/* ============================================
                ДИНАМИЧЕСКИЕ ТАБЫ ПО КАТЕГОРИЯМ
               ============================================ */}
            {svod && categoriesWithOrders.length > 0 && (
                <div style={{
                    display: 'flex',
                    gap: '4px',
                    padding: '12px 16px',
                    backgroundColor: '#fff',
                    borderBottom: '1px solid #e0e0e0',
                    overflowX: 'auto'
                }}>
                    {/* Таб "СВОД" (все категории) */}
                    <button
                        onClick={() => setActiveCategory(null)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            border: 'none',
                            borderRadius: '8px',
                            backgroundColor: activeCategory === null ? '#1976d2' : '#f0f0f0',
                            color: activeCategory === null ? 'white' : '#333',
                            fontWeight: activeCategory === null ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <Layers size={16} />
                        СВОД
                        <span style={{
                            backgroundColor: activeCategory === null ? 'rgba(255,255,255,0.3)' : '#ddd',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '12px'
                        }}>
                            {svod.lines.length}
                        </span>
                    </button>

                    {/* Табы по категориям */}
                    {categoriesWithOrders.map((cat) => (
                        <button
                            key={cat.name}
                            onClick={() => setActiveCategory(cat.name)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 16px',
                                border: 'none',
                                borderRadius: '8px',
                                backgroundColor: activeCategory === cat.name ? getCategoryColor(cat.name) : '#f0f0f0',
                                color: activeCategory === cat.name ? 'white' : '#333',
                                fontWeight: activeCategory === cat.name ? 600 : 400,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {getCategoryEmoji(cat.name)} {cat.name}
                            <span style={{
                                backgroundColor: activeCategory === cat.name ? 'rgba(255,255,255,0.3)' : '#ddd',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '12px'
                            }}>
                                {cat.count}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* Загрузка */}
            {loading && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                    Загрузка...
                </div>
            )}

            {/* Таблица */}
            {!loading && svod && (
                <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 350px)' }}>
                    <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '13px'
                    }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f5f5f5', zIndex: 10 }}>
                            <tr>
                                <th style={thStyle}>Название товара</th>
                                <th style={{ ...thStyle, width: '80px' }}>Код</th>
                                <th style={thStyle}>Категория</th>
                                <th style={{ ...thStyle, backgroundColor: '#e3f2fd' }}>Заказ</th>
                                <th style={{ ...thStyle, backgroundColor: '#fff3e0' }}>Остаток на начало</th>
                                <th style={{ ...thStyle, backgroundColor: '#e8f5e9' }}>Приход с произв.</th>

                                {/* Динамические колонки поставщиков */}
                                {svod.supplierCols.map(col => (
                                    <th key={col.supplierId} style={{ ...thStyle, backgroundColor: '#e0f7fa', minWidth: '80px' }}>
                                        {col.supplierName}
                                    </th>
                                ))}

                                {/* Имеется в наличии = Остаток + Закупки + Производство */}
                                <th style={{ ...thStyle, backgroundColor: '#c8e6c9' }}>Имеется в наличии</th>
                                {/* Факт (− отходы) = Имеется в наличии × Коэффициент - КЛИКАБЕЛЬНЫЙ */}
                                <th style={{ ...thStyle, backgroundColor: '#ff9800', color: 'white' }}>Факт (− отходы) ➡</th>
                                {/* Расчётные колонки */}
                                <th style={{ ...thStyle, backgroundColor: '#eeeeee' }}>Вес к отгр.</th>
                                <th style={{ ...thStyle, backgroundColor: '#eeeeee' }}>Недоб/Переб</th>
                                <th style={thStyle}>Коэф.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* РЕЖИМ: Если выбрана конкретная категория - показываем без группировки */}
                            {activeCategory !== null ? (
                                filteredLines.map(line => (
                                    <tr
                                        key={line.productId}
                                        style={{
                                            borderBottom: '1px solid #eee',
                                            backgroundColor: line.distributedFromLineId ? '#f0fff4' : undefined,
                                            borderLeft: line.isDistributionSource ? '4px solid #1976d2' :
                                                line.distributedFromLineId ? '4px solid #4caf50' : undefined
                                        }}
                                    >
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {line.isDistributionSource && (
                                                    <span style={{
                                                        backgroundColor: '#1976d2',
                                                        color: 'white',
                                                        fontSize: '10px',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        fontWeight: 600
                                                    }}>Источник</span>
                                                )}
                                                {line.distributedFromLineId && (
                                                    <span style={{ color: '#4caf50', fontSize: '14px' }}>↳</span>
                                                )}
                                                <span>{line.product?.name || line.shortName}</span>
                                                {line.distributedFromName && (
                                                    <span style={{
                                                        backgroundColor: '#e8f5e9',
                                                        color: '#2e7d32',
                                                        fontSize: '10px',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        marginLeft: '4px'
                                                    }}>← из: {line.distributedFromName}</span>
                                                )}
                                            </div>
                                        </td>
                                        {/* Код товара */}
                                        <td style={{ ...tdStyle, fontSize: '11px', color: '#666' }}>
                                            {line.product?.code || '—'}
                                        </td>
                                        {/* Категория */}
                                        <td style={{ ...tdStyle, color: getCategoryColor(line.category || 'Без категории'), fontWeight: 500 }}>
                                            {line.category || 'Без категории'}
                                        </td>
                                        <td style={{ ...tdStyle, backgroundColor: '#e3f2fd', fontWeight: 500 }}>
                                            {formatNumber(line.orderQty)}
                                        </td>
                                        <td style={{ ...tdStyle, backgroundColor: '#fff3e0' }}>
                                            {(mode === 'editing' || mode === 'preview') ? (
                                                <input
                                                    type="number"
                                                    step="0.001"
                                                    value={getNumericLineValue(line, 'openingStock') ?? ''}
                                                    onChange={(e) => handleLineEdit(line.productId, 'openingStock', e.target.value)}
                                                    style={inputStyle}
                                                />
                                            ) : (
                                                formatNumber(line.openingStock)
                                            )}
                                        </td>
                                        <td style={{ ...tdStyle, backgroundColor: '#e8f5e9' }}>
                                            {formatNumber(line.productionInQty)}
                                        </td>

                                        {/* Значения по поставщикам */}
                                        {svod.supplierCols.map(col => (
                                            <td key={col.supplierId} style={{ ...tdStyle, backgroundColor: '#e0f7fa', textAlign: 'center' }}>
                                                {formatNumber(getSupplierValue(line.productId, col.supplierId))}
                                            </td>
                                        ))}

                                        {/* Имеется в наличии */}
                                        <td style={{ ...tdStyle, backgroundColor: '#c8e6c9', fontWeight: 600, textAlign: 'right' }}>
                                            {formatNumber(calculateAvailableQty(line))}
                                        </td>
                                        {/* Факт (− отходы) - КЛИКАБЕЛЬНАЯ ячейка */}
                                        <td
                                            style={{
                                                ...tdStyle,
                                                backgroundColor: '#ff9800',
                                                color: 'white',
                                                fontWeight: 600,
                                                textAlign: 'right',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                borderRadius: '4px',
                                                boxShadow: '0 2px 4px rgba(255,152,0,0.3)'
                                            }}
                                            onClick={() => openDistributionModal(line)}
                                            title="Нажмите для распределения веса"
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#f57c00';
                                                e.currentTarget.style.transform = 'scale(1.02)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = '#ff9800';
                                                e.currentTarget.style.transform = 'scale(1)';
                                            }}
                                        >
                                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                                {formatNumber(calculateFactMinusWaste(line))}
                                                <span style={{ fontSize: '12px' }}>➡</span>
                                            </span>
                                        </td>
                                        {/* Вес к отгрузке */}
                                        <td style={{
                                            ...tdStyle,
                                            backgroundColor: line.weightToShip ? '#c8e6c9' : '#eeeeee',
                                            textAlign: 'right',
                                            fontWeight: line.weightToShip ? 600 : 400
                                        }}>
                                            {line.weightToShip ? formatNumber(line.weightToShip) : '—'}
                                        </td>
                                        <td style={{ ...tdStyle, backgroundColor: '#eeeeee', color: '#999' }}>—</td>
                                        <td style={tdStyle}>{line.coefficient ?? 1}</td>
                                    </tr>
                                ))
                            ) : (
                                /* РЕЖИМ: СВОД - все категории с группировкой */
                                sortedCategories.map(category => (
                                    <>
                                        {/* Заголовок категории */}
                                        <tr
                                            key={`cat-${category}`}
                                            onClick={() => toggleCategory(category)}
                                            style={{
                                                cursor: 'pointer',
                                                backgroundColor: getCategoryBgColor(category)
                                            }}
                                        >
                                            <td colSpan={6 + svod.supplierCols.length + 5} style={{ padding: '10px 16px', fontWeight: 600 }}>
                                                {expandedCategories.has(category) ? <ChevronDown size={16} style={{ marginRight: '8px' }} /> : <ChevronRight size={16} style={{ marginRight: '8px' }} />}
                                                {getCategoryEmoji(category)} {category} ({groupedLines[category]?.length || 0})
                                            </td>
                                        </tr>

                                        {/* Строки товаров */}
                                        {expandedCategories.has(category) && groupedLines[category]?.map(line => (
                                            <tr
                                                key={line.productId}
                                                style={{
                                                    borderBottom: '1px solid #eee',
                                                    backgroundColor: line.distributedFromLineId ? '#f0fff4' : undefined,
                                                    borderLeft: line.isDistributionSource ? '4px solid #1976d2' :
                                                        line.distributedFromLineId ? '4px solid #4caf50' : undefined
                                                }}
                                            >
                                                <td style={tdStyle}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {line.isDistributionSource && (
                                                            <span style={{
                                                                backgroundColor: '#1976d2',
                                                                color: 'white',
                                                                fontSize: '10px',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                fontWeight: 600
                                                            }}>Источник</span>
                                                        )}
                                                        {line.distributedFromLineId && (
                                                            <span style={{ color: '#4caf50', fontSize: '14px' }}>↳</span>
                                                        )}
                                                        <span>{line.product?.name || line.shortName}</span>
                                                        {line.distributedFromName && (
                                                            <span style={{
                                                                backgroundColor: '#e8f5e9',
                                                                color: '#2e7d32',
                                                                fontSize: '10px',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                marginLeft: '4px'
                                                            }}>← из: {line.distributedFromName}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                {/* Код товара */}
                                                <td style={{ ...tdStyle, fontSize: '11px', color: '#666' }}>
                                                    {line.product?.code || '—'}
                                                </td>
                                                {/* Категория */}
                                                <td style={{ ...tdStyle, color: getCategoryColor(category), fontWeight: 500 }}>
                                                    {category}
                                                </td>
                                                <td style={{ ...tdStyle, backgroundColor: '#e3f2fd', fontWeight: 500 }}>
                                                    {formatNumber(line.orderQty)}
                                                </td>
                                                <td style={{ ...tdStyle, backgroundColor: '#fff3e0' }}>
                                                    {(mode === 'editing' || mode === 'preview') ? (
                                                        <input
                                                            type="number"
                                                            step="0.001"
                                                            value={getNumericLineValue(line, 'openingStock') ?? ''}
                                                            onChange={(e) => handleLineEdit(line.productId, 'openingStock', e.target.value)}
                                                            style={inputStyle}
                                                        />
                                                    ) : (
                                                        formatNumber(line.openingStock)
                                                    )}
                                                </td>
                                                <td style={{ ...tdStyle, backgroundColor: '#e8f5e9' }}>
                                                    {formatNumber(line.productionInQty)}
                                                </td>

                                                {/* Значения по поставщикам */}
                                                {svod.supplierCols.map(col => (
                                                    <td key={col.supplierId} style={{ ...tdStyle, backgroundColor: '#e0f7fa', textAlign: 'center' }}>
                                                        {formatNumber(getSupplierValue(line.productId, col.supplierId))}
                                                    </td>
                                                ))}

                                                {/* Имеется в наличии */}
                                                <td style={{ ...tdStyle, backgroundColor: '#c8e6c9', fontWeight: 600, textAlign: 'right' }}>
                                                    {formatNumber(calculateAvailableQty(line))}
                                                </td>
                                                {/* Факт (− отходы) - КЛИКАБЕЛЬНАЯ ячейка */}
                                                <td
                                                    style={{
                                                        ...tdStyle,
                                                        backgroundColor: '#ff9800',
                                                        color: 'white',
                                                        fontWeight: 600,
                                                        textAlign: 'right',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        borderRadius: '4px',
                                                        boxShadow: '0 2px 4px rgba(255,152,0,0.3)'
                                                    }}
                                                    onClick={() => openDistributionModal(line)}
                                                    title="Нажмите для распределения веса"
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.backgroundColor = '#f57c00';
                                                        e.currentTarget.style.transform = 'scale(1.02)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.backgroundColor = '#ff9800';
                                                        e.currentTarget.style.transform = 'scale(1)';
                                                    }}
                                                >
                                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                                        {formatNumber(calculateFactMinusWaste(line))}
                                                        <span style={{ fontSize: '12px' }}>➡</span>
                                                    </span>
                                                </td>
                                                {/* Вес к отгрузке */}
                                                <td style={{
                                                    ...tdStyle,
                                                    backgroundColor: line.weightToShip ? '#c8e6c9' : '#eeeeee',
                                                    textAlign: 'right',
                                                    fontWeight: line.weightToShip ? 600 : 400
                                                }}>
                                                    {line.weightToShip ? formatNumber(line.weightToShip) : '—'}
                                                </td>
                                                <td style={{ ...tdStyle, backgroundColor: '#eeeeee', color: '#999' }}>—</td>
                                                <td style={tdStyle}>{line.coefficient ?? 1}</td>
                                            </tr>
                                        ))}
                                    </>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Пустой свод */}
            {!loading && (!svod || svod.lines.length === 0) && (
                <div style={{ padding: '60px', textAlign: 'center', color: '#999' }}>
                    <p style={{ fontSize: '18px', marginBottom: '12px' }}>Нет данных для формирования свода</p>
                    <p>Убедитесь, что на выбранную дату есть заказы, закупки или остатки</p>
                </div>
            )}

            {/* ============================================ */}
            {/* МОДАЛЬНОЕ ОКНО РАСПРЕДЕЛЕНИЯ ВЕСА */}
            {/* ============================================ */}
            {showDistributionModal && distributionData && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}
                    onClick={closeDistributionModal}
                >
                    <div
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            width: '600px',
                            maxHeight: '80vh',
                            overflow: 'hidden',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Заголовок */}
                        <div style={{
                            padding: '20px 24px',
                            borderBottom: '1px solid #eee',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: '#ff9800',
                            color: 'white'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                                    Распределение веса
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '14px', opacity: 0.9 }}>
                                    {distributionData.productName}
                                </p>
                            </div>
                            <button
                                onClick={closeDistributionModal}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'white',
                                    cursor: 'pointer',
                                    padding: '8px'
                                }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Информация источника */}
                        <div style={{ padding: '16px 24px', backgroundColor: '#fff8e1', borderBottom: '1px solid #eee' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <span>Факт (− отходы):</span>
                                <strong>{formatNumber(distributionData.factMinusWaste)} кг</strong>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span>Вес для распределения:</span>
                                <input
                                    type="number"
                                    step="0.001"
                                    value={plannedWeight}
                                    onChange={(e) => setPlannedWeight(e.target.value)}
                                    placeholder="Введите вес"
                                    style={{
                                        padding: '8px 12px',
                                        border: '1px solid #ddd',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        width: '120px'
                                    }}
                                />
                                <span>кг</span>
                            </div>
                        </div>

                        {/* Кнопка добавить товар */}
                        <div style={{ padding: '12px 24px', borderBottom: '1px solid #eee' }}>
                            <button
                                onClick={() => setShowProductSelector(!showProductSelector)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 16px',
                                    border: '1px dashed #1976d2',
                                    borderRadius: '8px',
                                    backgroundColor: showProductSelector ? '#e3f2fd' : 'white',
                                    color: '#1976d2',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    width: '100%',
                                    justifyContent: 'center'
                                }}
                            >
                                <Package size={18} />
                                {showProductSelector ? 'Скрыть список' : `➕ Добавить товар из категории "${distributionData.category || 'Все'}"`}
                            </button>
                        </div>

                        {/* Список товаров для выбора */}
                        {showProductSelector && (
                            <div style={{
                                maxHeight: '200px',
                                overflowY: 'auto',
                                padding: '0 24px',
                                backgroundColor: '#f8f9fa',
                                borderBottom: '1px solid #eee'
                            }}>
                                {getCategoryProducts().length > 0 ? (
                                    getCategoryProducts().map(product => (
                                        <div
                                            key={product.productId}
                                            onClick={() => addProductToDistribution(product)}
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '10px 12px',
                                                margin: '4px 0',
                                                backgroundColor: 'white',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                transition: 'background-color 0.2s',
                                                border: '1px solid #eee'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e3f2fd'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{product.product?.name || product.shortName}</div>
                                                <div style={{ fontSize: '12px', color: '#666' }}>
                                                    Код: {product.product?.code || '—'}
                                                </div>
                                            </div>
                                            <span style={{ color: '#1976d2', fontSize: '20px' }}>+</span>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                                        Нет других товаров в этой категории
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Выбранные товары */}
                        <div style={{ maxHeight: '250px', overflowY: 'auto', padding: '0 24px' }}>
                            {distributionData.selectedItems.length > 0 ? (
                                <>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        borderBottom: '2px solid #e0e0e0',
                                        fontWeight: 600,
                                        backgroundColor: '#e8f5e9',
                                        margin: '0 -24px',
                                        padding: '12px 24px'
                                    }}>
                                        <span>Распределить на</span>
                                        <span>Количество, кг</span>
                                    </div>
                                    {distributionData.selectedItems.map(item => (
                                        <div
                                            key={item.productId}
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '12px 0',
                                                borderBottom: '1px solid #f0f0f0'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                                                <button
                                                    onClick={() => removeProductFromDistribution(item.productId)}
                                                    style={{
                                                        border: 'none',
                                                        background: 'none',
                                                        color: '#dc3545',
                                                        cursor: 'pointer',
                                                        padding: '4px',
                                                        fontSize: '16px'
                                                    }}
                                                    title="Удалить"
                                                >
                                                    ✕
                                                </button>
                                                <div>
                                                    <div>{item.productName}</div>
                                                    <div style={{ fontSize: '11px', color: '#888' }}>
                                                        {item.productCode || '—'}
                                                    </div>
                                                </div>
                                            </div>
                                            <input
                                                type="number"
                                                step="0.001"
                                                value={item.qty || ''}
                                                onChange={(e) => updateDistributionQty(item.productId, e.target.value)}
                                                placeholder="0"
                                                style={{
                                                    width: '100px',
                                                    padding: '8px',
                                                    border: '1px solid #ddd',
                                                    borderRadius: '6px',
                                                    textAlign: 'right'
                                                }}
                                            />
                                        </div>
                                    ))}
                                </>
                            ) : (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                                    Нажмите кнопку выше, чтобы добавить товары для распределения
                                </div>
                            )}
                        </div>

                        {/* Итого и кнопки */}
                        <div style={{
                            padding: '16px 24px',
                            borderTop: '1px solid #eee',
                            backgroundColor: '#f5f5f5'
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '16px',
                                fontSize: '15px'
                            }}>
                                <span>Распределено:</span>
                                <strong style={{ color: getTotalDistributed() > 0 ? '#2e7d32' : '#999' }}>
                                    {formatNumber(getTotalDistributed())} кг
                                    {plannedWeight && parseFloat(plannedWeight) > 0 && (
                                        <span style={{ marginLeft: '8px', color: '#666', fontWeight: 400 }}>
                                            / {plannedWeight} кг
                                        </span>
                                    )}
                                </strong>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={closeDistributionModal}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        border: '1px solid #ddd',
                                        borderRadius: '8px',
                                        backgroundColor: 'white',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={saveDistribution}
                                    disabled={distributionLoading || distributionData.selectedItems.length === 0}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        backgroundColor: distributionData.selectedItems.length === 0 ? '#ccc' : '#4caf50',
                                        color: 'white',
                                        cursor: distributionData.selectedItems.length === 0 ? 'not-allowed' : 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 600
                                    }}
                                >
                                    {distributionLoading ? 'Сохранение...' : '✓ Сохранить распределение'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

// Стили
const thStyle: React.CSSProperties = {
    padding: '10px 8px',
    textAlign: 'left',
    fontWeight: 600,
    borderBottom: '2px solid #dee2e6',
    whiteSpace: 'nowrap'
};

const tdStyle: React.CSSProperties = {
    padding: '8px',
    verticalAlign: 'middle'
};

const inputStyle: React.CSSProperties = {
    width: '80px',
    padding: '4px 6px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px'
};

// Форматирование чисел
function formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) return '';
    if (value === 0) return '0';
    return value.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

// Цвет для категории (для табов и текста)
function getCategoryColor(category: string): string {
    switch (category) {
        case 'Баранина': return '#8B4513';
        case 'Говядина': return '#B22222';
        case 'Курица': return '#DAA520';
        default: return '#666';
    }
}

// Фоновый цвет для заголовка категории
function getCategoryBgColor(category: string): string {
    switch (category) {
        case 'Баранина': return '#FFF8DC';
        case 'Говядина': return '#FFE4E1';
        case 'Курица': return '#FFFACD';
        default: return '#e9ecef';
    }
}

// Эмодзи для категории
function getCategoryEmoji(category: string): string {
    switch (category) {
        case 'Баранина': return '🐑';
        case 'Говядина': return '🐄';
        case 'Курица': return '🐔';
        default: return '📦';
    }
}
