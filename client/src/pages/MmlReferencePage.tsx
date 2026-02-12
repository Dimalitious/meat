import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import {
    Search, Plus, Trash2, Lock, Unlock, Package,
    ChevronRight, ChevronDown, FolderTree, Edit2, RotateCcw, Eye, EyeOff,
    Copy, Power, PowerOff
} from 'lucide-react';

// ============================================
// ИНТЕРФЕЙСЫ
// ============================================

interface UnitOfMeasure {
    id: number;
    name: string;
    code: string;
}

interface Product {
    id: number;
    code: string;
    name: string;
    category: string | null;
    uom?: UnitOfMeasure | null;
}

interface MmlNode {
    id: number;
    mmlId: number;
    parentNodeId: number | null;
    productId: number;
    sortOrder: number;
    isActive: boolean;
    sourceNodeId?: number | null;
    isWaste?: boolean;
    product: Product;
    children: MmlNode[];
}

interface Mml {
    id: number;
    productId: number;
    product: Product;
    creator: { id: number; name: string; username: string };
    isLocked: boolean;
    isActive: boolean;
    isDeleted?: boolean;
    version: number;
    parentMmlId?: number | null;
    createdAt: string;
    rootNodes: MmlNode[];
    _count?: { nodes: number; runs: number };
}

// ============================================
// КОМПОНЕНТ
// ============================================

export default function MmlReferencePage() {
    useAuth();
    const token = localStorage.getItem('token');

    // State
    const [mmls, setMmls] = useState<Mml[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedMml, setSelectedMml] = useState<Mml | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [modalSearch, setModalSearch] = useState('');
    const [showProductModal, setShowProductModal] = useState(false);
    const [modalMode, setModalMode] = useState<'create-mml' | 'add-root' | 'add-child'>('create-mml');
    const [addedProductIds, setAddedProductIds] = useState<Set<number>>(new Set());
    // Soft delete & checkboxes
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [showDeleted, setShowDeleted] = useState(false);
    const [showInactive, setShowInactive] = useState(false);

    // ============================================
    // ЗАГРУЗКА ДАННЫХ
    // ============================================

    useEffect(() => {
        fetchMmls();
        fetchProducts();
    }, []);

    // Перезагрузка при изменении фильтров
    useEffect(() => {
        fetchMmls();
    }, [showDeleted, showInactive]);

    const fetchMmls = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/production-v2/mml`, {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    showDeleted: showDeleted ? 'true' : undefined,
                    showInactive: showInactive ? 'true' : undefined
                }
            });
            setMmls(res.data);
        } catch (err) {
            console.error('Failed to fetch MMLs:', err);
        } finally {
            setLoading(false);
        }
    };

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

    // ============================================
    // MML ОПЕРАЦИИ
    // ============================================

    const createMml = async (productId: number) => {
        try {
            const res = await axios.post(`${API_URL}/api/production-v2/mml`,
                { productId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMmls([res.data, ...mmls]);
            setSelectedMml(res.data);
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
            setMmls(mmls.map(m => m.id === mmlId ? { ...m, isLocked: res.data.isLocked } : m));
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка переключения блокировки');
        }
    };

    const toggleMmlActive = async (mmlId: number) => {
        try {
            const res = await axios.patch(`${API_URL}/api/production-v2/mml/${mmlId}/toggle-active`, {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMmls(mmls.map(m => m.id === mmlId ? { ...m, isActive: res.data.isActive } : m));
            if (selectedMml?.id === mmlId) {
                setSelectedMml({ ...selectedMml, isActive: res.data.isActive });
            }
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка переключения статуса');
        }
    };

    const toggleNodeActive = async (nodeId: number) => {
        try {
            await axios.patch(`${API_URL}/api/production-v2/mml/node/${nodeId}/toggle-active`, {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (selectedMml) {
                await loadMmlDetails(selectedMml.id);
            }
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка переключения статуса узла');
        }
    };

    const cloneMmlVersion = async (mmlId: number) => {
        try {
            const res = await axios.post(`${API_URL}/api/production-v2/mml/${mmlId}/clone-version`, {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await fetchMmls();
            setSelectedMml(res.data);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка клонирования версии');
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

    // Мягкое удаление выбранных MML
    const softDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Пометить на удаление ${selectedIds.size} техкарт?`)) return;

        try {
            for (const id of selectedIds) {
                await axios.patch(`${API_URL}/api/production-v2/mml/${id}/soft-delete`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            setSelectedIds(new Set());
            await fetchMmls();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка удаления');
        }
    };

    // Восстановить выбранные MML
    const restoreSelected = async () => {
        if (selectedIds.size === 0) return;

        try {
            for (const id of selectedIds) {
                await axios.patch(`${API_URL}/api/production-v2/mml/${id}/restore`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            setSelectedIds(new Set());
            await fetchMmls();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка восстановления');
        }
    };

    // Переключить чекбокс
    const toggleMmlSelection = (mmlId: number) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(mmlId)) {
                newSet.delete(mmlId);
            } else {
                newSet.add(mmlId);
            }
            return newSet;
        });
    };

    // ============================================
    // МОДАЛЬНОЕ ОКНО
    // ============================================

    const openProductModal = (mode: 'create-mml' | 'add-root' | 'add-child') => {
        setModalMode(mode);
        setModalSearch('');
        if (mode === 'create-mml') {
            const existingProductIds = new Set(mmls.map(m => m.productId));
            setAddedProductIds(existingProductIds);
        } else {
            setAddedProductIds(new Set());
        }
        setShowProductModal(true);
    };

    const handleProductSelect = async (product: Product) => {
        setAddedProductIds(prev => new Set(prev).add(product.id));

        switch (modalMode) {
            case 'create-mml':
                await createMml(product.id);
                break;
            case 'add-root':
                await addRootNode(product.id);
                break;
            case 'add-child':
                await addChildNode(product.id);
                break;
        }
    };

    // ============================================
    // ФИЛЬТРЫ
    // ============================================

    const filteredMmls = mmls.filter(m =>
        m.product.name.toLowerCase().includes(search.toLowerCase()) ||
        m.product.code.toLowerCase().includes(search.toLowerCase())
    );

    const filteredModalProducts = products.filter(p =>
        p.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
        p.code.toLowerCase().includes(modalSearch.toLowerCase())
    );

    // ============================================
    // РЕНДЕР ДЕРЕВА MML
    // ============================================

    const renderMmlNode = (node: MmlNode, level: number = 0) => {
        const isSelected = selectedNodeId === node.id;
        const indent = level * 24;
        const isEditable = selectedMml && !selectedMml.isLocked;
        const isInactive = !node.isActive;

        return (
            <div key={node.id}>
                <div
                    className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-purple-100 border-l-4 border-purple-500' : 'hover:bg-gray-50'
                        } ${isInactive ? 'opacity-50' : ''}`}
                    style={{ paddingLeft: `${indent + 12}px` }}
                    onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                >
                    {node.children && node.children.length > 0 ? (
                        <ChevronDown size={16} className="text-gray-400" />
                    ) : (
                        <ChevronRight size={16} className="text-gray-300" />
                    )}
                    <Package size={16} className={`${level === 0 ? 'text-purple-600' : node.isWaste ? 'text-orange-400' : 'text-gray-400'} ${isInactive ? 'opacity-50' : ''}`} />
                    <span className={`flex-1 text-sm ${level === 0 ? 'font-medium' : ''} ${node.isWaste ? 'text-orange-600' : ''} ${isInactive ? 'line-through text-gray-400' : ''}`}>
                        {node.product.name}
                        {node.isWaste && <span className="ml-2 text-xs bg-orange-100 text-orange-600 px-1 rounded">отходы</span>}
                        {isInactive && <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1 rounded">выкл</span>}
                    </span>
                    {/* ЕИ (единица измерения) */}
                    {node.product.uom && (
                        <span className="text-xs text-gray-400 flex-shrink-0" title="Единица измерения">
                            {node.product.uom.code || node.product.uom.name}
                        </span>
                    )}
                    {isEditable && (
                        <div className="flex items-center gap-1">
                            {/* Toggle active */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleNodeActive(node.id);
                                }}
                                className={`p-1 ${node.isActive ? 'text-green-500 hover:text-orange-500' : 'text-gray-400 hover:text-green-500'}`}
                                title={node.isActive ? 'Выключить позицию' : 'Включить позицию'}
                            >
                                {node.isActive ? <Power size={14} /> : <PowerOff size={14} />}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNode(node.id);
                                }}
                                className="text-red-400 hover:text-red-600 p-1"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    )}
                </div>
                {node.children && node.children.map(child => renderMmlNode(child, level + 1))}
            </div>
        );
    };

    // Подсчёт позиций в MML
    const countNodes = (nodes: MmlNode[]): number => {
        let count = 0;
        for (const node of nodes) {
            count++;
            if (node.children) {
                count += countNodes(node.children);
            }
        }
        return count;
    };

    // ============================================
    // РЕНДЕР
    // ============================================

    return (
        <div className="flex flex-col h-[calc(100vh-120px)]">
            {/* Header */}
            <div className="bg-white rounded-lg shadow p-4 mb-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <FolderTree size={24} className="text-purple-600" />
                        <h1 className="text-xl font-bold">Справочник техкарт (MML)</h1>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>Всего техкарт: <strong>{mmls.length}</strong></span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex gap-4 flex-1 overflow-hidden">
                {/* Левая панель - Список MML */}
                <div className="w-96 bg-white rounded-lg shadow flex flex-col">
                    <div className="p-4 border-b">
                        <div className="relative mb-3">
                            <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Поиск техкарты..."
                                className="w-full border rounded pl-8 pr-3 py-2 text-sm"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <Button
                            onClick={() => openProductModal('create-mml')}
                            className="w-full"
                            size="sm"
                        >
                            <Plus size={16} className="mr-1" /> Создать техкарту
                        </Button>

                        {/* Toolbar для управления */}
                        <div className="mt-3 flex gap-2 flex-wrap">
                            <button
                                onClick={softDeleteSelected}
                                disabled={selectedIds.size === 0}
                                className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Trash2 size={12} className="inline mr-1" />
                                Удалить ({selectedIds.size})
                            </button>
                            {showDeleted && (
                                <button
                                    onClick={restoreSelected}
                                    disabled={selectedIds.size === 0}
                                    className="px-2 py-1 text-xs bg-green-100 text-green-600 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <RotateCcw size={12} className="inline mr-1" />
                                    Вернуть
                                </button>
                            )}
                            <button
                                onClick={() => setShowDeleted(!showDeleted)}
                                className={`px-2 py-1 text-xs rounded ${showDeleted ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'} hover:opacity-80`}
                            >
                                {showDeleted ? <Eye size={12} className="inline mr-1" /> : <EyeOff size={12} className="inline mr-1" />}
                                {showDeleted ? 'Скрыть удал.' : 'Показать удал.'}
                            </button>
                            <button
                                onClick={() => setShowInactive(!showInactive)}
                                className={`px-2 py-1 text-xs rounded ${showInactive ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'} hover:opacity-80`}
                            >
                                {showInactive ? <Power size={12} className="inline mr-1" /> : <PowerOff size={12} className="inline mr-1" />}
                                {showInactive ? 'Скрыть выкл.' : 'Показать выкл.'}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="p-4 text-center text-gray-500">Загрузка...</div>
                        ) : filteredMmls.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                {search ? 'Ничего не найдено' : 'Нет техкарт'}
                            </div>
                        ) : (
                            filteredMmls.map(mml => (
                                <div
                                    key={mml.id}
                                    className={`p-3 border-b cursor-pointer hover:bg-gray-50 transition-colors ${selectedMml?.id === mml.id ? 'bg-purple-50 border-l-4 border-purple-500' : ''
                                        } ${mml.isDeleted ? 'opacity-50 bg-red-50' : ''} ${!mml.isActive ? 'opacity-60' : ''}`}
                                >
                                    <div className="flex items-start gap-2">
                                        {/* Чекбокс */}
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(mml.id)}
                                            onChange={() => toggleMmlSelection(mml.id)}
                                            onClick={e => e.stopPropagation()}
                                            className="mt-1 cursor-pointer"
                                        />
                                        <div
                                            className="flex-1 min-w-0"
                                            onClick={() => loadMmlDetails(mml.id)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Package size={18} className={`${mml.isDeleted ? 'text-red-400' : !mml.isActive ? 'text-gray-400' : 'text-purple-600'} flex-shrink-0`} />
                                                <div className="font-medium text-sm truncate">
                                                    {mml.product.name}
                                                </div>
                                                {/* Version badge */}
                                                <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded flex-shrink-0">
                                                    v{mml.version}
                                                </span>
                                                {/* isActive indicator */}
                                                {!mml.isActive && (
                                                    <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded flex-shrink-0">
                                                        выкл
                                                    </span>
                                                )}
                                                <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                                    <span>{mml.product.code}</span>
                                                    <span>•</span>
                                                    <span>{mml._count?.nodes ?? countNodes(mml.rootNodes || [])} поз.</span>
                                                </div>
                                            </div>
                                            {mml.isLocked ? (
                                                <Lock size={14} className="text-green-500 flex-shrink-0" />
                                            ) : (
                                                <Edit2 size={14} className="text-gray-400 flex-shrink-0" />
                                            )}
                                        </div>
                                        {/* Toggle active button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleMmlActive(mml.id);
                                            }}
                                            className={`p-1 text-xs ${mml.isActive ? 'text-green-500 hover:text-orange-500' : 'text-gray-400 hover:text-green-500'}`}
                                            title={mml.isActive ? 'Выключить техкарту' : 'Включить техкарту'}
                                        >
                                            {mml.isActive ? <Power size={14} /> : <PowerOff size={14} />}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Правая панель - Детали MML */}
                <div className="flex-1 bg-white rounded-lg shadow flex flex-col">
                    {selectedMml ? (
                        <>
                            {/* Шапка MML */}
                            <div className="p-4 border-b">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h2 className="text-lg font-semibold flex items-center gap-2">
                                            <Package className="text-purple-600" size={20} />
                                            {selectedMml.product.name}
                                            <span className="text-sm font-normal bg-blue-100 text-blue-600 px-2 py-0.5 rounded">
                                                Версия {selectedMml.version}
                                            </span>
                                            {!selectedMml.isActive && (
                                                <span className="text-sm font-normal bg-gray-200 text-gray-500 px-2 py-0.5 rounded">
                                                    Выключена
                                                </span>
                                            )}
                                        </h2>
                                        <div className="text-sm text-gray-500 mt-1">
                                            Код: {selectedMml.product.code} •
                                            Создал: {selectedMml.creator.name} •
                                            {new Date(selectedMml.createdAt).toLocaleDateString('ru-RU')}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => toggleMmlActive(selectedMml.id)}
                                        >
                                            {selectedMml.isActive ? (
                                                <><PowerOff size={16} className="mr-1" /> Выключить</>
                                            ) : (
                                                <><Power size={16} className="mr-1" /> Включить</>
                                            )}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => toggleMmlLock(selectedMml.id)}
                                        >
                                            {selectedMml.isLocked ? (
                                                <><Unlock size={16} className="mr-1" /> Разблокировать</>
                                            ) : (
                                                <><Lock size={16} className="mr-1" /> Зафиксировать</>
                                            )}
                                        </Button>
                                        {!selectedMml.isLocked && (
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => deleteMml(selectedMml.id)}
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Frozen banner */}
                                {selectedMml.isLocked && (
                                    <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm text-amber-700 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Lock size={14} />
                                            Версия заморожена. Структурные изменения заблокированы.
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => cloneMmlVersion(selectedMml.id)}
                                        >
                                            <Copy size={14} className="mr-1" /> Создать новую версию
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Toolbar */}
                            {!selectedMml.isLocked && (
                                <div className="p-3 border-b bg-gray-50 flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openProductModal('add-root')}
                                    >
                                        <Plus size={16} className="mr-1" /> Добавить позицию
                                    </Button>
                                    {selectedNodeId && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => openProductModal('add-child')}
                                        >
                                            <Plus size={16} className="mr-1" /> Добавить подпозицию
                                        </Button>
                                    )}
                                </div>
                            )}

                            {/* Дерево узлов */}
                            <div className="flex-1 overflow-y-auto p-4">
                                <h3 className="text-sm font-medium text-gray-600 mb-3">
                                    Структура техкарты (выходные продукты):
                                </h3>
                                {selectedMml.rootNodes && selectedMml.rootNodes.length > 0 ? (
                                    <div className="border rounded-lg overflow-hidden">
                                        {selectedMml.rootNodes.map(node => renderMmlNode(node))}
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-500 py-8">
                                        <FolderTree size={48} className="mx-auto mb-2 text-gray-300" />
                                        <p>Нет позиций. Добавьте первую позицию.</p>
                                    </div>
                                )}
                            </div>

                            {/* Info footer */}
                            <div className="p-3 border-t bg-gray-50 text-xs text-gray-500">
                                <div className="flex justify-between">
                                    <span>ID: {selectedMml.id} • Версия: {selectedMml.version}{selectedMml.parentMmlId ? ` (клон от #${selectedMml.parentMmlId})` : ''}</span>
                                    <span>Всего позиций: {countNodes(selectedMml.rootNodes || [])}</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400">
                            <div className="text-center">
                                <FolderTree size={64} className="mx-auto mb-4 text-gray-300" />
                                <p className="text-lg">Выберите техкарту из списка</p>
                                <p className="text-sm mt-1">или создайте новую</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Модальное окно выбора товара */}
            {showProductModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b">
                            <h3 className="font-semibold">
                                {modalMode === 'create-mml' && 'Выберите входной продукт для техкарты'}
                                {modalMode === 'add-root' && 'Добавить выходной продукт'}
                                {modalMode === 'add-child' && 'Добавить подпозицию'}
                            </h3>
                            <div className="relative mt-3">
                                <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Поиск товара..."
                                    className="w-full border rounded pl-8 pr-3 py-2 text-sm"
                                    value={modalSearch}
                                    onChange={e => setModalSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto max-h-96">
                            {filteredModalProducts.length === 0 ? (
                                <div className="p-4 text-center text-gray-500">Товары не найдены</div>
                            ) : (
                                filteredModalProducts.slice(0, 50).map(product => {
                                    const isAdded = addedProductIds.has(product.id);
                                    return (
                                        <div
                                            key={product.id}
                                            className="p-3 border-b hover:bg-purple-50 flex items-center gap-2"
                                        >
                                            <Package size={16} className="text-gray-400" />
                                            <div className="flex-1">
                                                <div className="text-sm font-medium">{product.name}</div>
                                                <div className="text-xs text-gray-500">{product.code}</div>
                                            </div>
                                            <button
                                                onClick={() => !isAdded && handleProductSelect(product)}
                                                disabled={isAdded}
                                                className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${isAdded
                                                    ? 'bg-green-100 text-green-700 cursor-default'
                                                    : 'bg-purple-600 text-white hover:bg-purple-700'
                                                    }`}
                                            >
                                                {isAdded ? '✓ Добавлен' : 'Добавить'}
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <div className="p-3 border-t">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowProductModal(false);
                                    setModalSearch('');
                                    setAddedProductIds(new Set());
                                }}
                                className="w-full"
                            >
                                Закрыть
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
