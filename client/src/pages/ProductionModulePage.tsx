import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import {
    Search, Plus, Check, Copy, Trash2, X, Package, AlertCircle,
    Factory, FileText, ChevronRight
} from 'lucide-react';

interface Product {
    id: number;
    code: string;
    name: string;
}

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

type TabType = 'batch' | 'mml';

export default function ProductionModulePage() {
    const [activeTab, setActiveTab] = useState<TabType>('batch');
    const [search, setSearch] = useState('');

    // MML state
    const [mmls, setMmls] = useState<Mml[]>([]);
    const [selectedMml, setSelectedMml] = useState<Mml | null>(null);

    // Batch state
    const [batches, setBatches] = useState<Batch[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);

    // Products for modal
    const [products, setProducts] = useState<Product[]>([]);
    const [showProductModal, setShowProductModal] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [productModalType, setProductModalType] = useState<'mml' | 'batch' | 'component'>('mml');
    const [editingLine, setEditingLine] = useState<{ type: 'mml' | 'batch', id: number, lineNo: number } | null>(null);

    const [warning, setWarning] = useState<string | null>(null);

    const token = localStorage.getItem('token');

    useEffect(() => {
        fetchProducts();
        fetchMmls();
        fetchBatches();
    }, []);

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

    // MML Functions
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
            // Refresh MML
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

    // Batch Functions
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
            // Refresh batch
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
    const filteredMmls = mmls.filter(m =>
        m.product.name.toLowerCase().includes(search.toLowerCase()) ||
        m.product.code.toLowerCase().includes(search.toLowerCase())
    );

    const filteredBatches = batches.filter(b =>
        b.product.name.toLowerCase().includes(search.toLowerCase()) ||
        b.product.code.toLowerCase().includes(search.toLowerCase())
    );

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.code.toLowerCase().includes(productSearch.toLowerCase())
    );

    // Open product modal for adding
    const openAddProductModal = (type: 'mml' | 'batch') => {
        setProductModalType(type);
        setProductSearch('');
        setShowProductModal(true);
    };

    // Open product modal for component selection
    const openComponentModal = (type: 'mml' | 'batch', id: number, lineNo: number) => {
        setProductModalType('component');
        setEditingLine({ type, id, lineNo });
        setProductSearch('');
        setShowProductModal(true);
    };

    const handleProductSelect = (product: Product) => {
        if (productModalType === 'mml') {
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

            {/* Header */}
            <div className="bg-white rounded-lg shadow p-4 mb-4">
                <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Factory size={24} className="text-indigo-600" />
                        Производство
                    </h1>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex gap-4 flex-1 overflow-hidden">
                {/* Left Panel */}
                <div className="w-80 bg-white rounded-lg shadow flex flex-col overflow-hidden">
                    {/* Tabs */}
                    <div className="p-2 border-b flex gap-1">
                        <button
                            onClick={() => { setActiveTab('batch'); setSelectedBatch(null); }}
                            className={`flex-1 px-3 py-2 rounded text-sm font-medium flex items-center justify-center gap-1 transition-colors ${activeTab === 'batch'
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'hover:bg-gray-100'
                                }`}
                        >
                            <Package size={16} /> Выработка
                        </button>
                        <button
                            onClick={() => { setActiveTab('mml'); setSelectedMml(null); }}
                            className={`flex-1 px-3 py-2 rounded text-sm font-medium flex items-center justify-center gap-1 transition-colors ${activeTab === 'mml'
                                ? 'bg-purple-100 text-purple-700'
                                : 'hover:bg-gray-100'
                                }`}
                        >
                            <FileText size={16} /> MML
                        </button>
                    </div>

                    {/* Search */}
                    <div className="p-3 border-b">
                        <div className="relative mb-3">
                            <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Поиск позиций..."
                                className="w-full border rounded pl-8 pr-3 py-2 text-sm"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => openAddProductModal(activeTab === 'mml' ? 'mml' : 'batch')}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded text-sm font-medium flex items-center justify-center gap-1"
                        >
                            <Plus size={16} /> Добавить позицию
                        </button>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-auto p-2">
                        {activeTab === 'mml' ? (
                            filteredMmls.length === 0 ? (
                                <div className="text-center text-gray-500 py-8 text-sm">
                                    Нет MML
                                </div>
                            ) : (
                                filteredMmls.map(mml => (
                                    <div
                                        key={mml.id}
                                        onClick={() => setSelectedMml(mml)}
                                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors cursor-pointer mb-1 flex items-center justify-between ${selectedMml?.id === mml.id
                                            ? 'bg-purple-100 text-purple-700'
                                            : 'hover:bg-gray-100'
                                            }`}
                                    >
                                        <div>
                                            <div className="font-medium">{mml.product.name}</div>
                                            <div className="text-xs text-gray-500">{mml.product.code}</div>
                                        </div>
                                        {mml.isLocked && (
                                            <span className="text-green-600"><Check size={16} /></span>
                                        )}
                                    </div>
                                ))
                            )
                        ) : (
                            filteredBatches.length === 0 ? (
                                <div className="text-center text-gray-500 py-8 text-sm">
                                    Нет выработок
                                </div>
                            ) : (
                                filteredBatches.map(batch => (
                                    <div
                                        key={batch.id}
                                        onClick={() => setSelectedBatch(batch)}
                                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors cursor-pointer mb-1 flex items-center justify-between ${selectedBatch?.id === batch.id
                                            ? 'bg-indigo-100 text-indigo-700'
                                            : 'hover:bg-gray-100'
                                            }`}
                                    >
                                        <div>
                                            <div className="font-medium">{batch.product.name}</div>
                                            <div className="text-xs text-gray-500">
                                                {batch.product.code} • {batch.user.name}
                                            </div>
                                        </div>
                                        {batch.isLocked && (
                                            <span className="text-green-600"><Check size={16} /></span>
                                        )}
                                    </div>
                                ))
                            )
                        )}
                    </div>
                </div>

                {/* Right Panel - Card */}
                <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
                    {activeTab === 'mml' && selectedMml ? (
                        // MML Card
                        <>
                            <div className="p-4 border-b flex justify-between items-start">
                                <div>
                                    <h2 className="text-lg font-semibold">MML: {selectedMml.product.name}</h2>
                                    <div className="text-sm text-gray-500">
                                        Код: {selectedMml.product.code} • Создал: {selectedMml.creator.name}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        {selectedMml.isLocked ? (
                                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded font-medium">
                                                ✓ Зафиксирован
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded font-medium">
                                                Редактирование
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {!selectedMml.isLocked && (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => lockMml(selectedMml.id)}
                                                className="text-green-600 border-green-600 hover:bg-green-50"
                                            >
                                                <Check size={16} className="mr-1" /> Зафиксировать
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => deleteMml(selectedMml.id)}
                                                className="text-red-600 border-red-600 hover:bg-red-50"
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex-1 p-4 overflow-auto">
                                <h3 className="font-medium mb-3">Состав калькуляции (5 строк)</h3>
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
                                                        item.componentProduct ? (
                                                            <span>{item.componentProduct.name}</span>
                                                        ) : (
                                                            <span className="text-gray-400">—</span>
                                                        )
                                                    ) : (
                                                        <button
                                                            onClick={() => openComponentModal('mml', selectedMml.id, item.lineNo)}
                                                            className="text-left w-full px-3 py-1 border rounded hover:bg-gray-50 text-sm"
                                                        >
                                                            {item.componentProduct ? (
                                                                <span>{item.componentProduct.name}</span>
                                                            ) : (
                                                                <span className="text-gray-400">Выбрать товар...</span>
                                                            )}
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
                        // Batch Card
                        <>
                            <div className="p-4 border-b flex justify-between items-start">
                                <div>
                                    <h2 className="text-lg font-semibold">Выработка: {selectedBatch.product.name}</h2>
                                    <div className="text-sm text-gray-500">
                                        Код: {selectedBatch.product.code}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-medium">
                                            Пользователь: {selectedBatch.user.name}
                                        </span>
                                        {selectedBatch.isLocked ? (
                                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded font-medium">
                                                ✓ Зафиксирована
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded font-medium">
                                                Редактирование
                                            </span>
                                        )}
                                        {!selectedBatch.mmlId && (
                                            <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded font-medium">
                                                ⚠ Нет MML
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => cloneBatch(selectedBatch.id)}
                                    >
                                        <Copy size={16} className="mr-1" /> Клонировать
                                    </Button>
                                    {!selectedBatch.isLocked && (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => lockBatch(selectedBatch.id)}
                                                className="text-green-600 border-green-600 hover:bg-green-50"
                                            >
                                                <Check size={16} className="mr-1" /> Зафиксировать
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => deleteBatch(selectedBatch.id)}
                                                className="text-red-600 border-red-600 hover:bg-red-50"
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex-1 p-4 overflow-auto">
                                {/* Quantity field */}
                                <div className="mb-6 flex items-center gap-4">
                                    <label className="font-medium">Количество выработки:</label>
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

                                <h3 className="font-medium mb-3">Состав выработки (5 строк)</h3>
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
                                                        item.componentProduct ? (
                                                            <span>{item.componentProduct.name}</span>
                                                        ) : (
                                                            <span className="text-gray-400">—</span>
                                                        )
                                                    ) : (
                                                        <button
                                                            onClick={() => openComponentModal('batch', selectedBatch.id, item.lineNo)}
                                                            className="text-left w-full px-3 py-1 border rounded hover:bg-gray-50 text-sm"
                                                        >
                                                            {item.componentProduct ? (
                                                                <span>{item.componentProduct.name}</span>
                                                            ) : (
                                                                <span className="text-gray-400">Выбрать товар...</span>
                                                            )}
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
                        // No selection
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

            {/* Product Selection Modal */}
            {showProductModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-semibold">
                                {productModalType === 'component' ? 'Выбор компонента' : 'Выбор позиции'}
                            </h3>
                            <button
                                onClick={() => { setShowProductModal(false); setEditingLine(null); }}
                                className="text-gray-500 hover:text-gray-700"
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
                                    className="w-full border rounded pl-9 pr-3 py-2"
                                    value={productSearch}
                                    onChange={e => setProductSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-2 max-h-[400px]">
                            {filteredProducts.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    Товары не найдены
                                </div>
                            ) : (
                                filteredProducts.slice(0, 50).map(product => (
                                    <button
                                        key={product.id}
                                        onClick={() => handleProductSelect(product)}
                                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 rounded flex justify-between items-center group"
                                    >
                                        <div>
                                            <div className="font-medium group-hover:text-indigo-700">{product.name}</div>
                                            <div className="text-xs text-gray-500">{product.code}</div>
                                        </div>
                                        <ChevronRight size={16} className="text-gray-400 group-hover:text-indigo-600" />
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
