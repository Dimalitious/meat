import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useSocket, useProductionRun, useProductionList } from '../context/SocketContext';
import { formatNumber } from '../utils/formatters';
import {
    Search, Plus, Trash2, Save, Check, Edit2, Copy, X, User, Calendar,
    Package, FileText, AlertCircle, ChevronRight, ChevronDown, FolderTree, Wifi, WifiOff, Users
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

// MML Node (узел дерева)
interface MmlNode {
    id: number;
    mmlId: number;
    parentNodeId: number | null;
    productId: number;
    sortOrder: number;
    product: Product;
    children: MmlNode[];
}

// MML (техкарта)
interface Mml {
    id: number;
    productId: number;
    product: Product;
    creator: { id: number; name: string; username: string };
    isLocked: boolean;
    createdAt: string;
    rootNodes: MmlNode[];
}

// Production Run Value (значение выработки по узлу)
interface RunValue {
    id: number;
    mmlNodeId: number;
    value: number | null;
    node?: MmlNode;
}

// Production Run (выработка)
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
    product: Product;
    mml: Mml;
    user: { id: number; name: string; username: string };
    values: RunValue[];
    // Дерево MML с значениями (собранное на клиенте)
    mmlTree?: MmlNode[];
}

type ProductionTab = 'journal' | 'mml';

export default function ProductionV2Page() {
    useAuth(); // Проверка авторизации
    const token = localStorage.getItem('token');

    // Tab state
    const [activeTab, setActiveTab] = useState<ProductionTab>('journal');

    // Common state
    const [products, setProducts] = useState<Product[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [showProductModal, setShowProductModal] = useState(false);
    const [modalSearch, setModalSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [warning, setWarning] = useState<string | null>(null);

    // MML state
    const [mmls, setMmls] = useState<Mml[]>([]);
    const [selectedMml, setSelectedMml] = useState<Mml | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

    // Modal mode for adding
    type ModalMode = 'create-mml' | 'add-root' | 'add-child' | 'create-run';
    const [modalMode, setModalMode] = useState<ModalMode>('create-mml');

    // Production Runs (выработка/журнал)
    const [runs, setRuns] = useState<ProductionRun[]>([]);
    const [selectedRun, setSelectedRun] = useState<ProductionRun | null>(null);
    const [runValues, setRunValues] = useState<Map<number, number>>(new Map()); // nodeId -> value

    // Фильтрация журнала по датам
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');

    // Массовое выделение записей
    const [selectedRunIds, setSelectedRunIds] = useState<Set<number>>(new Set());

    // Редактируемые поля выработки
    const [editPlannedWeight, setEditPlannedWeight] = useState<string>('');
    const [editProductionDate, setEditProductionDate] = useState<string>('');

    // ============================================
    // REAL-TIME SOCKET.IO
    // ============================================

    const { isConnected, emitValueUpdate, emitFieldFocus, emitFieldBlur, emitRunSaved, emitRunLocked, emitRunCreated, emitRunDeleted } = useSocket();

    // Real-time обновление значений от других пользователей
    const handleValueChanged = useCallback((nodeId: number, value: number, _user: { id: number; username: string; name: string }) => {
        setRunValues(prev => new Map(prev).set(nodeId, value));
        // Можно показать toast: `${_user.name} изменил значение`
    }, []);

    // Real-time обновление статуса карточки
    const handleLockChanged = useCallback((isLocked: boolean, user: { id: number; username: string; name: string }) => {
        if (selectedRun) {
            setSelectedRun(prev => prev ? { ...prev, isLocked } : null);
            setRuns(prev => prev.map(r => r.id === selectedRun.id ? { ...r, isLocked } : r));
            setWarning(`${user.name} ${isLocked ? 'зафиксировал' : 'разблокировал'} карточку`);
            setTimeout(() => setWarning(null), 3000);
        }
    }, [selectedRun]);

    // Real-time удаление карточки
    const handleRunRemoved = useCallback(() => {
        setSelectedRun(null);
        setWarning('Карточка была удалена другим пользователем');
        setTimeout(() => setWarning(null), 3000);
    }, []);

    // Подключение к комнате выбранной карточки
    const { roomUsers, editingFields } = useProductionRun(
        selectedRun?.id ?? null,
        {
            onValueChanged: handleValueChanged,
            onLockChanged: handleLockChanged,
            onRunRemoved: handleRunRemoved,
        }
    );

    // Real-time обновление списка карточек
    const handleListUpdated = useCallback((event: { action: string; runId: number; productName?: string; isLocked?: boolean }) => {
        if (event.action === 'created') {
            // Перезагружаем список для получения новой карточки
            fetchRuns();
        } else if (event.action === 'deleted') {
            setRuns(prev => prev.filter(r => r.id !== event.runId));
        } else if (event.action === 'lock-changed' && event.isLocked !== undefined) {
            setRuns(prev => prev.map(r => r.id === event.runId ? { ...r, isLocked: event.isLocked! } : r));
        }
    }, []);

    useProductionList({ onListUpdated: handleListUpdated });

    // ============================================
    // ЗАГРУЗКА ДАННЫХ
    // ============================================

    useEffect(() => {
        fetchProducts();
    }, []);

    useEffect(() => {
        if (activeTab === 'mml') {
            fetchMmls();
        } else if (activeTab === 'journal') {
            fetchRuns();
        }
    }, [activeTab]);

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

    // ============================================
    // MML ФУНКЦИИ (API v2)
    // ============================================

    const fetchMmls = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/production-v2/mml`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMmls(res.data);
        } catch (err) {
            console.error('Failed to fetch MMLs:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadMmlDetails = async (mmlId: number) => {
        try {
            const res = await axios.get(`${API_URL}/api/production-v2/mml/${mmlId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSelectedMml(res.data);
            setSelectedNodeId(null);
        } catch (err) {
            console.error('Failed to load MML details:', err);
        }
    };

    const createMml = async (productId: number) => {
        try {
            const res = await axios.post(`${API_URL}/api/production-v2/mml`,
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

    const addRootNode = async (productId: number) => {
        if (!selectedMml) return;
        try {
            await axios.post(`${API_URL}/api/production-v2/mml/${selectedMml.id}/node`,
                { productId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await loadMmlDetails(selectedMml.id);
            setShowProductModal(false);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка добавления позиции');
        }
    };

    const addChildNode = async (productId: number) => {
        if (!selectedMml || !selectedNodeId) return;
        try {
            await axios.post(`${API_URL}/api/production-v2/mml/${selectedMml.id}/node/${selectedNodeId}/child`,
                { productId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await loadMmlDetails(selectedMml.id);
            setShowProductModal(false);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка добавления подпозиции');
        }
    };

    const deleteNode = async (nodeId: number) => {
        if (!confirm('Удалить позицию и все подпозиции?')) return;
        try {
            await axios.delete(`${API_URL}/api/production-v2/mml/node/${nodeId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (selectedMml) {
                await loadMmlDetails(selectedMml.id);
            }
            if (selectedNodeId === nodeId) {
                setSelectedNodeId(null);
            }
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка удаления');
        }
    };

    const toggleMmlLock = async (mmlId: number) => {
        try {
            const res = await axios.patch(`${API_URL}/api/production-v2/mml/${mmlId}/lock`, {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSelectedMml(res.data);
            setMmls(mmls.map(m => m.id === mmlId ? res.data : m));
        } catch (err) {
            console.error('Failed to toggle MML lock:', err);
        }
    };

    const deleteMml = async (mmlId: number) => {
        if (!confirm('Удалить MML?')) return;
        try {
            await axios.delete(`${API_URL}/api/production-v2/mml/${mmlId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMmls(mmls.filter(m => m.id !== mmlId));
            if (selectedMml?.id === mmlId) setSelectedMml(null);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка удаления');
        }
    };

    // ============================================
    // PRODUCTION RUN ФУНКЦИИ (выработка/журнал)
    // ============================================

    const fetchRuns = async (fromDate?: string, toDate?: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (fromDate) params.append('dateFrom', fromDate);
            if (toDate) params.append('dateTo', toDate);

            const res = await axios.get(`${API_URL}/api/production-v2/runs?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRuns(res.data);
            setSelectedRunIds(new Set()); // Сбросить выделение при обновлении списка
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

            // Заполняем значения из run.values
            const valuesMap = new Map<number, number>();
            run.values.forEach(v => {
                if (v.value !== null) {
                    valuesMap.set(v.mmlNodeId, Number(v.value));
                }
            });
            setRunValues(valuesMap);

            // Инициализация редактируемых полей
            setEditPlannedWeight(run.plannedWeight !== null ? String(run.plannedWeight) : '');
            setEditProductionDate(run.productionDate ? run.productionDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
        } catch (err) {
            console.error('Failed to load run details:', err);
        }
    };

    const createRun = async (productId: number) => {
        try {
            const res = await axios.post(`${API_URL}/api/production-v2/runs`,
                { productId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.warning) {
                setWarning(res.data.warning);
                setTimeout(() => setWarning(null), 5000);
            }
            if (res.data.run) {
                setRuns([res.data.run, ...runs]);
                setSelectedRun(res.data.run);
                // Инициализируем пустые значения
                setRunValues(new Map());
            } else {
                setRuns([res.data, ...runs]);
                setSelectedRun(res.data);
                setRunValues(new Map());
            }
            setShowProductModal(false);
            // Real-time уведомление о создании
            const createdRun = res.data.run || res.data;
            emitRunCreated(createdRun.id, createdRun.product?.name || 'Карточка');
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка создания выработки');
        }
    };

    const saveRunValues = async () => {
        if (!selectedRun) return;
        try {
            const values = Array.from(runValues.entries()).map(([nodeId, value]) => ({
                mmlNodeId: nodeId,
                value
            }));
            const res = await axios.put(`${API_URL}/api/production-v2/runs/${selectedRun.id}/values`,
                {
                    values,
                    productionDate: editProductionDate || undefined,
                    plannedWeight: editPlannedWeight ? Number(editPlannedWeight) : null
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSelectedRun(res.data);
            // Обновить в списке
            setRuns(runs.map(r => r.id === selectedRun.id ? { ...r, ...res.data } : r));
            // Real-time уведомление о сохранении
            emitRunSaved(selectedRun.id);
            alert('Значения сохранены!');
        } catch (err) {
            console.error('Failed to save run values:', err);
            alert('Ошибка сохранения');
        }
    };

    const toggleRunLock = async (runId: number) => {
        try {
            const res = await axios.patch(`${API_URL}/api/production-v2/runs/${runId}/lock`, {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSelectedRun(res.data);
            setRuns(runs.map(r => r.id === runId ? res.data : r));
            // Real-time уведомление о блокировке/разблокировке
            emitRunLocked(runId, res.data.isLocked);
        } catch (err) {
            console.error('Failed to toggle run lock:', err);
        }
    };

    const cloneRun = async (runId: number) => {
        try {
            const res = await axios.post(`${API_URL}/api/production-v2/runs/${runId}/clone`, {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setRuns([res.data, ...runs]);
            setSelectedRun(res.data);
        } catch (err) {
            console.error('Failed to clone run:', err);
        }
    };

    const deleteRun = async (runId: number) => {
        if (!confirm('Удалить выработку?')) return;
        try {
            await axios.delete(`${API_URL}/api/production-v2/runs/${runId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRuns(runs.filter(r => r.id !== runId));
            if (selectedRun?.id === runId) setSelectedRun(null);
            // Real-time уведомление об удалении
            emitRunDeleted(runId);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка удаления');
        }
    };

    const updateRunValue = (nodeId: number, value: number) => {
        const newValues = new Map(runValues);
        newValues.set(nodeId, value);
        setRunValues(newValues);

        // Real-time broadcast to other users
        if (selectedRun) {
            emitValueUpdate(selectedRun.id, nodeId, value);
        }
    };

    // Обработчик фокуса для real-time индикации
    const handleFieldFocusLocal = (nodeId: number) => {
        if (selectedRun) {
            emitFieldFocus(selectedRun.id, nodeId);
        }
    };

    const handleFieldBlurLocal = (nodeId: number) => {
        if (selectedRun) {
            emitFieldBlur(selectedRun.id, nodeId);
        }
    };

    // Массовое скрытие выбранных записей
    const hideSelectedRuns = async () => {
        if (selectedRunIds.size === 0) {
            alert('Выберите записи для скрытия');
            return;
        }
        if (!confirm(`Скрыть ${selectedRunIds.size} записей?`)) return;

        try {
            await axios.post(`${API_URL}/api/production-v2/runs/hide`,
                { ids: Array.from(selectedRunIds) },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Обновить список после скрытия
            fetchRuns(dateFrom || undefined, dateTo || undefined);
            alert(`Скрыто ${selectedRunIds.size} записей`);
        } catch (err) {
            console.error('Failed to hide runs:', err);
            alert('Ошибка скрытия записей');
        }
    };

    // Переключение выделения записи
    const toggleRunSelection = (runId: number) => {
        const newSet = new Set(selectedRunIds);
        if (newSet.has(runId)) {
            newSet.delete(runId);
        } else {
            newSet.add(runId);
        }
        setSelectedRunIds(newSet);
    };

    // Выделить/снять все записи
    const toggleSelectAll = () => {
        if (selectedRunIds.size === filteredRuns.length) {
            setSelectedRunIds(new Set());
        } else {
            setSelectedRunIds(new Set(filteredRuns.map(r => r.id)));
        }
    };

    // Расчёт фактического веса в реальном времени
    // Логика: суммируем ВСЕ узлы - и корневые, и дочерние
    const calculateActualWeight = (): number => {
        if (!selectedRun?.mml?.rootNodes) return 0;

        let total = 0;

        // Рекурсивная функция для суммирования всех узлов
        const sumAllNodes = (nodes: MmlNode[]) => {
            for (const node of nodes) {
                // Добавляем значение узла
                const val = runValues.get(node.id);
                if (val !== undefined && !isNaN(val)) {
                    total += val;
                }
                // Рекурсивно обходим детей
                if (node.children && node.children.length > 0) {
                    sumAllNodes(node.children);
                }
            }
        };

        sumAllNodes(selectedRun.mml.rootNodes);
        return total;
    };

    // ============================================
    // ОБРАБОТЧИКИ МОДАЛЬНОГО ОКНА
    // ============================================

    const openProductModal = (mode: ModalMode) => {
        setModalMode(mode);
        setModalSearch('');
        setShowProductModal(true);
    };

    const handleProductSelect = (product: Product) => {
        switch (modalMode) {
            case 'create-mml':
                createMml(product.id);
                break;
            case 'add-root':
                addRootNode(product.id);
                break;
            case 'add-child':
                addChildNode(product.id);
                break;
            case 'create-run':
                createRun(product.id);
                break;
        }
    };

    // ============================================
    // ФИЛЬТРЫ
    // ============================================

    const filteredModalProducts = products.filter(p =>
        p.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
        p.code.toLowerCase().includes(modalSearch.toLowerCase())
    );

    const filteredMmls = mmls.filter(m =>
        m.product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        m.product.code.toLowerCase().includes(productSearch.toLowerCase())
    );

    const filteredRuns = runs.filter(r =>
        r.product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        r.product.code.toLowerCase().includes(productSearch.toLowerCase())
    );

    // ============================================
    // РЕНДЕР ДЕРЕВА MML
    // ============================================

    const renderMmlNode = (node: MmlNode, level: number = 0, isEditable: boolean = true) => {
        const isSelected = selectedNodeId === node.id;
        const indent = level * 24;

        return (
            <div key={node.id}>
                <div
                    className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-purple-100 border-l-4 border-purple-500' : 'hover:bg-gray-50'
                        }`}
                    style={{ paddingLeft: `${indent + 12}px` }}
                    onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                >
                    {node.children && node.children.length > 0 ? (
                        <ChevronDown size={16} className="text-gray-400" />
                    ) : (
                        <ChevronRight size={16} className="text-gray-300" />
                    )}
                    <Package size={16} className={level === 0 ? 'text-purple-600' : 'text-gray-400'} />
                    <span className={`flex-1 text-sm ${level === 0 ? 'font-medium' : ''}`}>
                        {node.product.name}
                    </span>
                    {isEditable && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                deleteNode(node.id);
                            }}
                            className="text-red-400 hover:text-red-600 p-1"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
                {node.children && node.children.map(child => renderMmlNode(child, level + 1, isEditable))}
            </div>
        );
    };

    // Рендер дерева MML с полями ввода (для выработки)
    const renderRunNode = (node: MmlNode, level: number = 0, isEditable: boolean = true) => {
        const indent = level * 24;
        const editingUser = editingFields.get(node.id);

        // Значение из state (все поля редактируемые)
        const val = runValues.get(node.id);
        const displayValue = val === 0 || val === undefined ? '' : val;

        return (
            <div key={node.id}>
                <div
                    className={`flex items-center gap-2 px-3 py-2 border-b ${editingUser ? 'bg-yellow-50' : ''}`}
                    style={{ paddingLeft: `${indent + 12}px` }}
                >
                    {node.children && node.children.length > 0 ? (
                        <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                    ) : (
                        <div className="w-4 flex-shrink-0" />
                    )}
                    <Package size={16} className={level === 0 ? 'text-indigo-600 flex-shrink-0' : 'text-gray-400 flex-shrink-0'} />
                    <span className={`flex-1 text-sm ${level === 0 ? 'font-medium' : ''}`}>
                        {node.product.name}
                        {editingUser && (
                            <span className="ml-2 text-xs text-yellow-600 animate-pulse">
                                ✏️ {editingUser.name}
                            </span>
                        )}
                    </span>
                    <input
                        type="number"
                        value={displayValue}
                        onChange={(e) => updateRunValue(node.id, parseFloat(e.target.value) || 0)}
                        onFocus={() => handleFieldFocusLocal(node.id)}
                        onBlur={() => handleFieldBlurLocal(node.id)}
                        disabled={!isEditable}
                        className={`w-24 text-right border rounded px-2 py-1 text-sm disabled:bg-gray-100 ${level === 0 ? 'font-medium' : ''} ${editingUser ? 'border-yellow-400 ring-1 ring-yellow-300' : ''}`}
                        placeholder="—"
                        step="0.001"
                    />
                </div>
                {node.children && node.children.map(child => renderRunNode(child, level + 1, isEditable))}
            </div>
        );
    };


    // ============================================
    // РЕНДЕР
    // ============================================

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
                            <Calendar size={16} /> Журнал (Выработка)
                        </button>
                        <button
                            onClick={() => setActiveTab('mml')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'mml'
                                ? 'bg-white shadow text-purple-700'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <FolderTree size={16} /> MML
                        </button>
                    </div>
                </div>
            </div>

            {/* ЖУРНАЛ (ВЫРАБОТКА) TAB */}
            {activeTab === 'journal' && (
                <div className="flex gap-4 flex-1 overflow-hidden">
                    {/* Левая панель - Список выработок */}
                    <div className="w-96 bg-white rounded-lg shadow flex flex-col">
                        <div className="p-4 border-b">
                            <h2 className="font-semibold mb-2">Журнал выработки</h2>

                            {/* Фильтры по датам */}
                            <div className="flex gap-2 mb-3">
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500 block mb-1">Дата С</label>
                                    <input
                                        type="date"
                                        className="w-full border rounded px-2 py-1 text-sm"
                                        value={dateFrom}
                                        onChange={e => setDateFrom(e.target.value)}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500 block mb-1">Дата По</label>
                                    <input
                                        type="date"
                                        className="w-full border rounded px-2 py-1 text-sm"
                                        value={dateTo}
                                        onChange={e => setDateTo(e.target.value)}
                                    />
                                </div>
                            </div>
                            <Button
                                onClick={() => fetchRuns(dateFrom || undefined, dateTo || undefined)}
                                variant="outline"
                                className="w-full mb-3"
                                size="sm"
                            >
                                Сформировать
                            </Button>

                            {/* Поиск */}
                            <div className="relative mb-3">
                                <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Поиск по названию..."
                                    className="w-full border rounded pl-8 pr-3 py-2 text-sm"
                                    value={productSearch}
                                    onChange={e => setProductSearch(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    onClick={() => openProductModal('create-run')}
                                    className="flex-1"
                                    size="sm"
                                >
                                    <Plus size={16} className="mr-1" /> Новая
                                </Button>
                                {selectedRunIds.size > 0 && (
                                    <Button
                                        onClick={hideSelectedRuns}
                                        variant="outline"
                                        size="sm"
                                        className="text-orange-600 hover:bg-orange-50"
                                    >
                                        Скрыть ({selectedRunIds.size})
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Заголовок таблицы с чекбоксом "выбрать все" */}
                        <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-2 text-xs font-medium text-gray-600">
                            <input
                                type="checkbox"
                                checked={selectedRunIds.size === filteredRuns.length && filteredRuns.length > 0}
                                onChange={toggleSelectAll}
                                className="rounded"
                            />
                            <span className="flex-1">Продукт</span>
                            <span className="w-16 text-right">Вес</span>
                            <span className="w-20 text-right">Дата</span>
                        </div>

                        <div className="flex-1 overflow-auto">
                            {loading ? (
                                <div className="text-center text-gray-400 py-8">Загрузка...</div>
                            ) : filteredRuns.length === 0 ? (
                                <div className="text-center text-gray-400 py-8">
                                    Нет выработок
                                </div>
                            ) : (
                                filteredRuns.map(run => (
                                    <div
                                        key={run.id}
                                        className={`flex items-center gap-2 px-4 py-2 border-b cursor-pointer transition-colors ${selectedRun?.id === run.id
                                            ? 'bg-indigo-50 border-l-4 border-indigo-500'
                                            : 'hover:bg-gray-50'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedRunIds.has(run.id)}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                toggleRunSelection(run.id);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="rounded"
                                        />
                                        <div
                                            className="flex-1 min-w-0 flex items-center gap-2"
                                            onClick={() => loadRunDetails(run.id)}
                                        >
                                            <Package size={14} className="text-indigo-600 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm truncate">
                                                    {run.product.name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {run.isLocked ? '🔒' : '✏️'} {run.user?.name || 'N/A'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="w-16 text-right text-sm text-gray-600" onClick={() => loadRunDetails(run.id)}>
                                            {formatNumber(run.actualWeight !== null ? Number(run.actualWeight) : null, 2)}
                                        </div>
                                        <div className="w-20 text-right text-xs text-gray-500" onClick={() => loadRunDetails(run.id)}>
                                            {run.productionDate ? new Date(run.productionDate).toLocaleDateString('ru-RU') : '-'}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Правая область - Карточка выработки с MML */}
                    <div className="flex-1 bg-white rounded-lg shadow flex flex-col overflow-hidden">
                        {!selectedRun ? (
                            <div className="flex-1 flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                    <Package size={48} className="mx-auto mb-4 text-gray-300" />
                                    <p>Выберите или создайте карточку выработки</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Шапка карточки */}
                                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-lg">{selectedRun.product.name}</h3>
                                            {/* Индикатор подключения */}
                                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                                                {isConnected ? 'Online' : 'Offline'}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-500 flex items-center gap-4 mt-1">
                                            <span className="flex items-center gap-1">
                                                <User size={14} /> {selectedRun.user?.name || 'N/A'}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar size={14} /> {new Date(selectedRun.createdAt).toLocaleDateString('ru-RU')}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedRun.isLocked ? 'bg-gray-200 text-gray-700' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {selectedRun.isLocked ? 'Зафиксировано' : 'Редактирование'}
                                            </span>
                                            {/* Онлайн пользователи */}
                                            {roomUsers.length > 0 && (
                                                <span className="flex items-center gap-1 text-indigo-600">
                                                    <Users size={14} />
                                                    <span className="text-xs font-medium">{roomUsers.length} онлайн</span>
                                                    <div className="flex -space-x-2">
                                                        {roomUsers.slice(0, 3).map((u, i) => (
                                                            <div key={i} className="w-6 h-6 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center border-2 border-white" title={u.name}>
                                                                {u.name?.charAt(0).toUpperCase()}
                                                            </div>
                                                        ))}
                                                        {roomUsers.length > 3 && (
                                                            <div className="w-6 h-6 rounded-full bg-gray-400 text-white text-xs flex items-center justify-center border-2 border-white">
                                                                +{roomUsers.length - 3}
                                                            </div>
                                                        )}
                                                    </div>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => cloneRun(selectedRun.id)}>
                                            <Copy size={14} className="mr-1" /> Клонировать
                                        </Button>
                                        {selectedRun.isLocked ? (
                                            <Button variant="outline" size="sm" onClick={() => toggleRunLock(selectedRun.id)}>
                                                <Edit2 size={14} className="mr-1" /> Редактировать
                                            </Button>
                                        ) : (
                                            <>
                                                <Button variant="outline" size="sm" onClick={saveRunValues}>
                                                    <Save size={14} className="mr-1" /> Сохранить
                                                </Button>
                                                <Button size="sm" onClick={() => toggleRunLock(selectedRun.id)}>
                                                    <Check size={14} className="mr-1" /> Зафиксировать
                                                </Button>
                                            </>
                                        )}
                                        <Button variant="outline" size="sm" onClick={() => deleteRun(selectedRun.id)} className="text-red-600 hover:bg-red-50">
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                </div>

                                {/* Поля весов и даты */}
                                <div className="p-4 border-b bg-white">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">Дата выработки</label>
                                            <input
                                                type="date"
                                                className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-100"
                                                value={editProductionDate}
                                                onChange={e => setEditProductionDate(e.target.value)}
                                                disabled={selectedRun.isLocked}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">Плановый вес (кг)</label>
                                            <input
                                                type="number"
                                                className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-100"
                                                value={editPlannedWeight}
                                                onChange={e => setEditPlannedWeight(e.target.value)}
                                                disabled={selectedRun.isLocked}
                                                placeholder="0.00"
                                                step="0.01"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">Фактический вес (кг)</label>
                                            <div className="w-full border rounded px-3 py-2 text-sm bg-gray-50 font-semibold text-indigo-700">
                                                {formatNumber(calculateActualWeight(), 3)}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Дерево MML с полями ввода */}
                                <div className="flex-1 overflow-auto p-4">
                                    <div className="mb-4">
                                        <h4 className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                                            <FolderTree size={16} /> Структура MML
                                        </h4>
                                    </div>
                                    {selectedRun.mml?.rootNodes && selectedRun.mml.rootNodes.length > 0 ? (
                                        <div className="border rounded-lg overflow-hidden">
                                            <div className="bg-gray-50 px-3 py-2 flex justify-between text-xs font-medium text-gray-600 border-b">
                                                <span>Позиция</span>
                                                <span>Значение</span>
                                            </div>
                                            {selectedRun.mml.rootNodes.map(node =>
                                                renderRunNode(node, 0, !selectedRun.isLocked)
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center text-gray-400 py-8 border-2 border-dashed rounded-lg">
                                            <AlertCircle size={32} className="mx-auto mb-2" />
                                            <p>MML не содержит позиций</p>
                                            <p className="text-sm">Добавьте позиции в MML для товара "{selectedRun.product.name}"</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* MML TAB */}
            {activeTab === 'mml' && (
                <div className="flex gap-4 flex-1 overflow-hidden">
                    {/* Левая панель - Список MML */}
                    <div className="w-80 bg-white rounded-lg shadow flex flex-col">
                        <div className="p-4 border-b">
                            <h2 className="font-semibold mb-2">Калькуляции MML</h2>
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
                                onClick={() => openProductModal('create-mml')}
                                className="w-full"
                            >
                                <Plus size={16} className="mr-1" /> Создать MML
                            </Button>
                        </div>

                        <div className="flex-1 overflow-auto p-2">
                            {loading ? (
                                <div className="text-center text-gray-400 py-8">Загрузка...</div>
                            ) : filteredMmls.length === 0 ? (
                                <div className="text-center text-gray-400 py-8">
                                    Нет MML
                                </div>
                            ) : (
                                filteredMmls.map(mml => (
                                    <div
                                        key={mml.id}
                                        onClick={() => loadMmlDetails(mml.id)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded mb-1 cursor-pointer transition-colors ${selectedMml?.id === mml.id
                                            ? 'bg-purple-100 border-l-4 border-purple-500'
                                            : 'hover:bg-gray-50'
                                            }`}
                                    >
                                        <FileText size={16} className="text-purple-600 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm truncate">
                                                {mml.product.name}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {mml.isLocked ? '🔒 Зафиксирован' : '✏️ Черновик'}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Правая область - Дерево MML */}
                    <div className="flex-1 bg-white rounded-lg shadow flex flex-col overflow-hidden">
                        {!selectedMml ? (
                            <div className="flex-1 flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                    <FolderTree size={48} className="mx-auto mb-4 text-gray-300" />
                                    <p>Выберите или создайте MML</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Шапка MML */}
                                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                                    <div>
                                        <h3 className="font-semibold text-lg">{selectedMml.product.name}</h3>
                                        <div className="text-sm text-gray-500 flex items-center gap-4">
                                            <span className="flex items-center gap-1">
                                                <User size={14} /> {selectedMml.creator?.name || 'N/A'}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedMml.isLocked ? 'bg-gray-200 text-gray-700' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {selectedMml.isLocked ? 'Зафиксирован' : 'Черновик'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {selectedMml.isLocked ? (
                                            <Button variant="outline" size="sm" onClick={() => toggleMmlLock(selectedMml.id)}>
                                                <Edit2 size={14} className="mr-1" /> Разблокировать
                                            </Button>
                                        ) : (
                                            <Button size="sm" onClick={() => toggleMmlLock(selectedMml.id)}>
                                                <Check size={14} className="mr-1" /> Зафиксировать
                                            </Button>
                                        )}
                                        <Button variant="outline" size="sm" onClick={() => deleteMml(selectedMml.id)} className="text-red-600 hover:bg-red-50">
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                </div>

                                {/* Кнопки добавления */}
                                {!selectedMml.isLocked && (
                                    <div className="p-4 border-b flex gap-2 bg-purple-50">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openProductModal('add-root')}
                                        >
                                            <Plus size={14} className="mr-1" /> Добавить корневую позицию
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                if (!selectedNodeId) {
                                                    alert('Выберите корневую позицию, чтобы добавить подпозицию');
                                                    return;
                                                }
                                                openProductModal('add-child');
                                            }}
                                            disabled={!selectedNodeId}
                                        >
                                            <ChevronRight size={14} className="mr-1" /> Добавить подпозицию
                                        </Button>
                                    </div>
                                )}

                                {/* Дерево узлов */}
                                <div className="flex-1 overflow-auto p-4">
                                    {selectedMml.rootNodes && selectedMml.rootNodes.length > 0 ? (
                                        <div className="border rounded-lg overflow-hidden">
                                            {selectedMml.rootNodes.map(node =>
                                                renderMmlNode(node, 0, !selectedMml.isLocked)
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center text-gray-400 py-8 border-2 border-dashed rounded-lg">
                                            <FolderTree size={32} className="mx-auto mb-2" />
                                            <p>Нет позиций</p>
                                            <p className="text-sm">Нажмите "Добавить корневую позицию" чтобы начать</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Modal: Выбор товара */}
            {showProductModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-semibold">
                                {modalMode === 'create-mml' && 'Создать MML для товара'}
                                {modalMode === 'add-root' && 'Добавить корневую позицию'}
                                {modalMode === 'add-child' && 'Добавить подпозицию'}
                                {modalMode === 'create-run' && 'Создать выработку для товара'}
                            </h3>
                            <button
                                onClick={() => setShowProductModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Поиск товара..."
                                    className="w-full border rounded pl-10 pr-4 py-2"
                                    value={modalSearch}
                                    onChange={e => setModalSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-2">
                            {filteredModalProducts.length === 0 ? (
                                <div className="text-center text-gray-400 py-8">
                                    Товары не найдены
                                </div>
                            ) : (
                                filteredModalProducts.map(product => (
                                    <div
                                        key={product.id}
                                        onClick={() => handleProductSelect(product)}
                                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded cursor-pointer"
                                    >
                                        <Package size={16} className="text-gray-400 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm">{product.name}</div>
                                            <div className="text-xs text-gray-500">{product.code}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-4 border-t flex justify-end">
                            <Button variant="outline" onClick={() => setShowProductModal(false)}>
                                Отмена
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
