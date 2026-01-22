import { useEffect, useState, useCallback } from 'react';
import api from '../config/axios';
import { Button } from '../components/ui/Button';
import {
    Package, Upload, Scissors, Check, X, RefreshCw, AlertCircle,
    Calendar, Plus, Trash2, FileText
} from 'lucide-react';

// ============================================
// ИНТЕРФЕЙСЫ
// ============================================

interface Product {
    id: number;
    code: string;
    name: string;
    category?: string;
}

interface Warehouse {
    id: number;
    code: string;
    name: string;
}

interface ProductionInput {
    id: number;
    productId: number;
    qtyIn: number;
    qtyUsed: number;
    priceIn: number | null;
    loadedAt: string;
    product: Product;
    purchase: {
        id: number;
        purchaseDate: string;
    };
    purchaseItem: {
        supplier: { name: string };
    };
}

interface ProductionOutput {
    id: number;
    productId: number;
    qtyOut: number;
    uom: string;
    product: Product;
}

interface ProductionDoc {
    id: number;
    date: string;
    warehouseId: number;
    status: 'draft' | 'loaded' | 'cutting' | 'done' | 'canceled';
    warehouse: Warehouse;
    createdBy: { id: number; name: string };
    inputs: ProductionInput[];
    outputs: ProductionOutput[];
    _count?: { inputs: number; outputs: number };
}

interface MmlNode {
    id: number;
    productId: number;
    product: Product;
    children: MmlNode[];
}

interface Mml {
    id: number;
    productId: number;
    product: Product;
    nodes: MmlNode[];
}

interface AvailablePurchaseItem {
    id: number;
    product: Product;
    supplier: { id: number; name: string };
    qty: number;
    qtyLoaded: number;
    qtyAvailable: number;
    price: number;
}

interface AvailablePurchase {
    id: number;
    date: string;
    items: AvailablePurchaseItem[];
}

// Статус-бейджи
const statusLabels: Record<string, { label: string; color: string }> = {
    draft: { label: 'Черновик', color: 'bg-gray-500' },
    loaded: { label: 'Загружено', color: 'bg-blue-500' },
    cutting: { label: 'В разделке', color: 'bg-yellow-500' },
    done: { label: 'Проведён', color: 'bg-green-500' },
    canceled: { label: 'Отменён', color: 'bg-red-500' },
};

// ============================================
// ОСНОВНОЙ КОМПОНЕНТ
// ============================================
export default function ProductionDocPage() {

    // Состояния
    const [docs, setDocs] = useState<ProductionDoc[]>([]);
    const [selectedDoc, setSelectedDoc] = useState<ProductionDoc | null>(null);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [mmls, setMmls] = useState<Mml[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Фильтры для списка документов
    const [filterDateFrom, setFilterDateFrom] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });
    const [filterDateTo, setFilterDateTo] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });

    // Форма создания документа
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newDocDate, setNewDocDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [newDocWarehouseId, setNewDocWarehouseId] = useState<number | null>(null);

    // Модалка загрузки из закупа
    const [showLoadModal, setShowLoadModal] = useState(false);
    const [availablePurchases, setAvailablePurchases] = useState<AvailablePurchase[]>([]);
    const [loadDateFrom, setLoadDateFrom] = useState('');
    const [loadDateTo, setLoadDateTo] = useState('');

    // Модалка разделки
    const [showCuttingModal, setShowCuttingModal] = useState(false);
    const [selectedInput, setSelectedInput] = useState<ProductionInput | null>(null);
    const [selectedMmlId, setSelectedMmlId] = useState<number | null>(null);
    const [cuttingOutputs, setCuttingOutputs] = useState<Array<{ productId: number; qtyOut: number }>>([]);

    // ============================================
    // ЗАГРУЗКА ДАННЫХ
    // ============================================

    const fetchDocs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterDateFrom) params.append('dateFrom', filterDateFrom);
            if (filterDateTo) params.append('dateTo', filterDateTo);

            const res = await api.get(`/api/production-docs?${params.toString()}`);
            setDocs(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Ошибка загрузки документов');
        } finally {
            setLoading(false);
        }
    }, [filterDateFrom, filterDateTo]);

    const fetchWarehouses = async () => {
        try {
            const res = await api.get('/api/warehouses');
            setWarehouses(res.data.filter((w: any) => !w.isDisabled));
        } catch (err) {
            console.error('Error fetching warehouses:', err);
        }
    };

    const fetchMmls = async () => {
        try {
            const res = await api.get('/api/production-v2/mml');
            setMmls(res.data);
        } catch (err) {
            console.error('Error fetching MMLs:', err);
        }
    };

    const fetchDocDetails = async (docId: number) => {
        setLoading(true);
        try {
            const res = await api.get(`/api/production-docs/${docId}`);
            setSelectedDoc(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Ошибка загрузки документа');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocs();
        fetchWarehouses();
        fetchMmls();
    }, [fetchDocs]);

    // ============================================
    // ДЕЙСТВИЯ
    // ============================================

    const createDoc = async () => {
        if (!newDocDate || !newDocWarehouseId) {
            setError('Укажите дату и склад');
            return;
        }

        setLoading(true);
        try {
            const res = await api.post('/api/production-docs', {
                date: newDocDate,
                warehouseId: newDocWarehouseId,
            });
            setSuccessMessage('Документ создан');
            setShowCreateForm(false);
            setSelectedDoc(res.data);
            fetchDocs();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Ошибка создания документа');
        } finally {
            setLoading(false);
        }
    };

    const loadFromPurchase = async () => {
        if (!selectedDoc) return;

        setLoading(true);
        try {
            const res = await api.post(`/api/production-docs/${selectedDoc.id}/load-from-purchase`, {
                dateFrom: loadDateFrom || undefined,
                dateTo: loadDateTo || undefined,
            });
            setSuccessMessage(res.data.message);
            setShowLoadModal(false);
            fetchDocDetails(selectedDoc.id);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Ошибка загрузки из закупа');
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailablePurchases = async () => {
        if (!selectedDoc) return;

        setLoading(true);
        try {
            const dateFrom = loadDateFrom || selectedDoc.date.split('T')[0];
            const dateTo = loadDateTo || selectedDoc.date.split('T')[0];

            const res = await api.get(`/api/production-docs/available-purchases?dateFrom=${dateFrom}&dateTo=${dateTo}`);
            setAvailablePurchases(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Ошибка получения закупок');
        } finally {
            setLoading(false);
        }
    };

    const openLoadModal = () => {
        if (!selectedDoc) return;
        setLoadDateFrom(selectedDoc.date.split('T')[0]);
        setLoadDateTo(selectedDoc.date.split('T')[0]);
        setShowLoadModal(true);
        // Загрузим доступные закупки
        setTimeout(() => fetchAvailablePurchases(), 100);
    };

    const clearInputs = async () => {
        if (!selectedDoc) return;
        if (!confirm('Очистить все загруженные позиции?')) return;

        setLoading(true);
        try {
            await api.post(`/api/production-docs/${selectedDoc.id}/clear-inputs`);
            setSuccessMessage('Загруженное сырьё очищено');
            fetchDocDetails(selectedDoc.id);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Ошибка очистки');
        } finally {
            setLoading(false);
        }
    };

    const openCuttingModal = (input: ProductionInput) => {
        setSelectedInput(input);
        setSelectedMmlId(null);
        setCuttingOutputs([]);
        setShowCuttingModal(true);
    };

    const applyCutting = async () => {
        if (!selectedDoc || !selectedInput || !selectedMmlId || cuttingOutputs.length === 0) {
            setError('Выберите MML и укажите выходные позиции');
            return;
        }

        setLoading(true);
        try {
            const res = await api.post(`/api/production-docs/${selectedDoc.id}/apply-cutting`, {
                inputId: selectedInput.id,
                mmlId: selectedMmlId,
                outputs: cuttingOutputs,
            });
            setSuccessMessage(res.data.message);
            setShowCuttingModal(false);
            fetchDocDetails(selectedDoc.id);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Ошибка применения разделки');
        } finally {
            setLoading(false);
        }
    };

    const finalizeDoc = async () => {
        if (!selectedDoc) return;
        if (!confirm('Провести документ? После проведения редактирование будет невозможно.')) return;

        setLoading(true);
        try {
            await api.post(`/api/production-docs/${selectedDoc.id}/finalize`);
            setSuccessMessage('Документ проведён');
            fetchDocDetails(selectedDoc.id);
            fetchDocs();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Ошибка проведения');
        } finally {
            setLoading(false);
        }
    };

    const cancelDoc = async () => {
        if (!selectedDoc) return;
        if (!confirm('Отменить документ?')) return;

        setLoading(true);
        try {
            await api.post(`/api/production-docs/${selectedDoc.id}/cancel`);
            setSuccessMessage('Документ отменён');
            fetchDocDetails(selectedDoc.id);
            fetchDocs();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Ошибка отмены');
        } finally {
            setLoading(false);
        }
    };

    const deleteDoc = async (docId: number) => {
        if (!confirm('Удалить черновик?')) return;

        setLoading(true);
        try {
            await api.delete(`/api/production-docs/${docId}`);
            setSuccessMessage('Документ удалён');
            if (selectedDoc?.id === docId) {
                setSelectedDoc(null);
            }
            fetchDocs();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Ошибка удаления');
        } finally {
            setLoading(false);
        }
    };

    // Очистка сообщений
    useEffect(() => {
        if (error || successMessage) {
            const timer = setTimeout(() => {
                setError(null);
                setSuccessMessage(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error, successMessage]);

    // ============================================
    // РЕНДЕР
    // ============================================

    const qtyAvailable = (input: ProductionInput) => Number(input.qtyIn) - Number(input.qtyUsed);

    return (
        <div className="p-4 space-y-4">
            {/* Заголовок */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Scissors className="w-6 h-6" />
                    Производство (из закупа)
                </h1>
                <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Новый документ
                </Button>
            </div>

            {/* Сообщения */}
            {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}
            {successMessage && (
                <div className="bg-green-500/20 border border-green-500 text-green-300 p-3 rounded flex items-center gap-2">
                    <Check className="w-5 h-5" />
                    {successMessage}
                </div>
            )}

            {/* Фильтры */}
            <div className="bg-zinc-800 p-4 rounded-lg flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-zinc-400" />
                    <input
                        type="date"
                        value={filterDateFrom}
                        onChange={e => setFilterDateFrom(e.target.value)}
                        className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                    />
                    <span className="text-zinc-400">—</span>
                    <input
                        type="date"
                        value={filterDateTo}
                        onChange={e => setFilterDateTo(e.target.value)}
                        className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                    />
                </div>
                <Button onClick={fetchDocs} variant="outline" size="sm" className="flex items-center gap-1">
                    <RefreshCw className="w-4 h-4" />
                    Обновить
                </Button>
            </div>

            {/* Основной контент: список + детали */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Левая колонка: Список документов */}
                <div className="bg-zinc-800 rounded-lg p-4">
                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Документы
                    </h2>
                    {loading && docs.length === 0 ? (
                        <div className="text-zinc-400 text-center py-8">Загрузка...</div>
                    ) : docs.length === 0 ? (
                        <div className="text-zinc-400 text-center py-8">Нет документов за период</div>
                    ) : (
                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                            {docs.map(doc => (
                                <div
                                    key={doc.id}
                                    onClick={() => fetchDocDetails(doc.id)}
                                    className={`p-3 rounded cursor-pointer transition ${selectedDoc?.id === doc.id
                                        ? 'bg-blue-600/30 border border-blue-500'
                                        : 'bg-zinc-700 hover:bg-zinc-600'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium">
                                            {new Date(doc.date).toLocaleDateString('ru-RU')}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${statusLabels[doc.status]?.color || 'bg-gray-500'}`}>
                                            {statusLabels[doc.status]?.label || doc.status}
                                        </span>
                                    </div>
                                    <div className="text-sm text-zinc-400 mt-1">
                                        {doc.warehouse?.name}
                                    </div>
                                    <div className="text-xs text-zinc-500 mt-1">
                                        Сырьё: {doc._count?.inputs || 0} | Выход: {doc._count?.outputs || 0}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Центральная колонка: Сырьё */}
                <div className="bg-zinc-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Package className="w-5 h-5" />
                            Сырьё из закупа
                        </h2>
                        {selectedDoc && selectedDoc.status !== 'done' && selectedDoc.status !== 'canceled' && (
                            <div className="flex gap-2">
                                <Button onClick={openLoadModal} size="sm" className="flex items-center gap-1">
                                    <Upload className="w-4 h-4" />
                                    Загрузить
                                </Button>
                                {selectedDoc.inputs.length > 0 && (
                                    <Button onClick={clearInputs} variant="outline" size="sm" className="flex items-center gap-1">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>

                    {!selectedDoc ? (
                        <div className="text-zinc-400 text-center py-8">Выберите документ</div>
                    ) : selectedDoc.inputs.length === 0 ? (
                        <div className="text-zinc-400 text-center py-8">
                            Нет загруженного сырья.
                            <br />
                            Нажмите "Загрузить из закупа"
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                            {selectedDoc.inputs.map(input => (
                                <div
                                    key={input.id}
                                    className="p-3 bg-zinc-700 rounded"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="font-medium">{input.product.name}</div>
                                            <div className="text-sm text-zinc-400">
                                                {input.purchaseItem?.supplier?.name} |
                                                Закупка #{input.purchase.id}
                                            </div>
                                        </div>
                                        {selectedDoc.status !== 'done' && selectedDoc.status !== 'canceled' && qtyAvailable(input) > 0 && (
                                            <Button
                                                onClick={() => openCuttingModal(input)}
                                                size="sm"
                                                variant="outline"
                                                className="flex items-center gap-1"
                                            >
                                                <Scissors className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                                        <div>
                                            <span className="text-zinc-500">Загружено:</span>
                                            <br />
                                            <span className="font-medium">{Number(input.qtyIn).toFixed(2)} кг</span>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500">Использовано:</span>
                                            <br />
                                            <span className="font-medium">{Number(input.qtyUsed).toFixed(2)} кг</span>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500">Доступно:</span>
                                            <br />
                                            <span className={`font-medium ${qtyAvailable(input) > 0 ? 'text-green-400' : 'text-zinc-500'}`}>
                                                {qtyAvailable(input).toFixed(2)} кг
                                            </span>
                                        </div>
                                    </div>
                                    {input.priceIn && (
                                        <div className="text-xs text-zinc-500 mt-1">
                                            Цена: {Number(input.priceIn).toFixed(2)} ₸/кг
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Правая колонка: Выход */}
                <div className="bg-zinc-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Check className="w-5 h-5" />
                            Выход производства
                        </h2>
                        {selectedDoc && selectedDoc.status !== 'done' && selectedDoc.status !== 'canceled' && selectedDoc.outputs.length > 0 && (
                            <Button onClick={finalizeDoc} size="sm" className="flex items-center gap-1 bg-green-600 hover:bg-green-700">
                                <Check className="w-4 h-4" />
                                Провести
                            </Button>
                        )}
                    </div>

                    {!selectedDoc ? (
                        <div className="text-zinc-400 text-center py-8">Выберите документ</div>
                    ) : selectedDoc.outputs.length === 0 ? (
                        <div className="text-zinc-400 text-center py-8">
                            Нет выходных позиций.
                            <br />
                            Выполните разделку сырья
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {selectedDoc.outputs.map(output => (
                                <div key={output.id} className="p-3 bg-zinc-700 rounded flex items-center justify-between">
                                    <div>
                                        <div className="font-medium">{output.product.name}</div>
                                        <div className="text-xs text-zinc-500">{output.product.code}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-green-400">
                                            {Number(output.qtyOut).toFixed(2)} {output.uom}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Кнопки действий */}
                    {selectedDoc && selectedDoc.status !== 'canceled' && (
                        <div className="mt-4 pt-4 border-t border-zinc-700 flex gap-2">
                            {selectedDoc.status === 'done' && (
                                <Button onClick={cancelDoc} variant="outline" size="sm" className="flex items-center gap-1 text-red-400">
                                    <X className="w-4 h-4" />
                                    Отменить
                                </Button>
                            )}
                            {selectedDoc.status === 'draft' && (
                                <Button onClick={() => deleteDoc(selectedDoc.id)} variant="outline" size="sm" className="flex items-center gap-1 text-red-400">
                                    <Trash2 className="w-4 h-4" />
                                    Удалить
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ============================================
                МОДАЛКА СОЗДАНИЯ ДОКУМЕНТА
            ============================================ */}
            {showCreateForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-zinc-800 rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">Новый документ производства</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Дата производства</label>
                                <input
                                    type="date"
                                    value={newDocDate}
                                    onChange={e => setNewDocDate(e.target.value)}
                                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Склад</label>
                                <select
                                    value={newDocWarehouseId || ''}
                                    onChange={e => setNewDocWarehouseId(Number(e.target.value))}
                                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2"
                                >
                                    <option value="">Выберите склад...</option>
                                    {warehouses.map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowCreateForm(false)}>Отмена</Button>
                            <Button onClick={createDoc} disabled={loading}>Создать</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================
                МОДАЛКА ЗАГРУЗКИ ИЗ ЗАКУПА
            ============================================ */}
            {showLoadModal && selectedDoc && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-zinc-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Upload className="w-5 h-5" />
                            Загрузить из закупа
                        </h3>

                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Дата с</label>
                                    <input
                                        type="date"
                                        value={loadDateFrom}
                                        onChange={e => setLoadDateFrom(e.target.value)}
                                        className="bg-zinc-700 border border-zinc-600 rounded px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Дата по</label>
                                    <input
                                        type="date"
                                        value={loadDateTo}
                                        onChange={e => setLoadDateTo(e.target.value)}
                                        className="bg-zinc-700 border border-zinc-600 rounded px-3 py-2"
                                    />
                                </div>
                                <Button onClick={fetchAvailablePurchases} variant="outline" className="mt-6">
                                    <RefreshCw className="w-4 h-4" />
                                </Button>
                            </div>

                            {/* Предпросмотр закупок */}
                            <div className="bg-zinc-700/50 rounded p-3">
                                <h4 className="font-medium mb-2">Доступные позиции ({availablePurchases.reduce((sum, p) => sum + p.items.length, 0)})</h4>
                                {availablePurchases.length === 0 ? (
                                    <div className="text-zinc-400 text-sm">Нет доступных закупок за период</div>
                                ) : (
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {availablePurchases.map(purchase => (
                                            <div key={purchase.id} className="text-sm">
                                                <div className="font-medium text-zinc-300">
                                                    Закупка #{purchase.id} от {new Date(purchase.date).toLocaleDateString('ru-RU')}
                                                </div>
                                                {purchase.items.map(item => (
                                                    <div key={item.id} className="ml-4 text-zinc-400 flex justify-between">
                                                        <span>{item.product.name} ({item.supplier.name})</span>
                                                        <span className="text-green-400">{item.qtyAvailable.toFixed(2)} кг</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowLoadModal(false)}>Отмена</Button>
                            <Button
                                onClick={loadFromPurchase}
                                disabled={loading || availablePurchases.length === 0}
                            >
                                Загрузить всё
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================
                МОДАЛКА РАЗДЕЛКИ ПО MML
            ============================================ */}
            {showCuttingModal && selectedInput && selectedDoc && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-zinc-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Scissors className="w-5 h-5" />
                            Разделка: {selectedInput.product.name}
                        </h3>

                        <div className="bg-zinc-700/50 rounded p-3 mb-4">
                            <div className="flex justify-between">
                                <span>Доступно для разделки:</span>
                                <span className="font-bold text-green-400">{qtyAvailable(selectedInput).toFixed(2)} кг</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Выберите MML (техкарту)</label>
                                <select
                                    value={selectedMmlId || ''}
                                    onChange={e => {
                                        const mmlId = Number(e.target.value);
                                        setSelectedMmlId(mmlId);
                                        // Предзаполнить выходные позиции из MML
                                        const mml = mmls.find(m => m.id === mmlId);
                                        if (mml) {
                                            setCuttingOutputs(
                                                mml.nodes.map(node => ({
                                                    productId: node.productId,
                                                    qtyOut: 0,
                                                }))
                                            );
                                        }
                                    }}
                                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2"
                                >
                                    <option value="">Выберите техкарту...</option>
                                    {mmls.map(mml => (
                                        <option key={mml.id} value={mml.id}>
                                            {mml.product.name} ({mml.nodes.length} позиций)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedMmlId && (
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-2">Выходные позиции</label>
                                    <div className="space-y-2">
                                        {cuttingOutputs.map((output, idx) => {
                                            const mml = mmls.find(m => m.id === selectedMmlId);
                                            const node = mml?.nodes.find(n => n.productId === output.productId);
                                            return (
                                                <div key={idx} className="flex items-center gap-4 bg-zinc-700 p-2 rounded">
                                                    <div className="flex-1">
                                                        {node?.product.name || `Товар #${output.productId}`}
                                                    </div>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={output.qtyOut}
                                                        onChange={e => {
                                                            const newOutputs = [...cuttingOutputs];
                                                            newOutputs[idx].qtyOut = parseFloat(e.target.value) || 0;
                                                            setCuttingOutputs(newOutputs);
                                                        }}
                                                        className="w-24 bg-zinc-600 border border-zinc-500 rounded px-2 py-1 text-right"
                                                    />
                                                    <span className="text-zinc-400">кг</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-2 text-right">
                                        <span className="text-zinc-400">Итого выход: </span>
                                        <span className={`font-bold ${cuttingOutputs.reduce((s, o) => s + o.qtyOut, 0) <= qtyAvailable(selectedInput)
                                            ? 'text-green-400'
                                            : 'text-red-400'
                                            }`}>
                                            {cuttingOutputs.reduce((s, o) => s + o.qtyOut, 0).toFixed(2)} кг
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowCuttingModal(false)}>Отмена</Button>
                            <Button
                                onClick={applyCutting}
                                disabled={loading || !selectedMmlId || cuttingOutputs.every(o => o.qtyOut === 0)}
                            >
                                Применить разделку
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
