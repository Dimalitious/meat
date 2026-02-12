import { useEffect, useState } from 'react';
import api from '../config/axios';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/Table';
import { Plus, Edit, Save, X, Trash2, Eye, EyeOff } from 'lucide-react';
import { Card } from '../components/ui/Card';

interface Subcategory {
    id: number;
    name: string;
    isActive: boolean;
    deletedAt?: string | null;
}

interface ParamValue {
    id: number;
    paramType: string;
    valueNum?: string | null;
    valueInt?: number | null;
    valueText?: string | null;
    valueNumMin?: string | null;
    valueNumMax?: string | null;
    valueIntMin?: number | null;
    valueIntMax?: number | null;
    label: string | null;
    sortOrder: number;
    isActive: boolean;
}

interface ParamsByType {
    processings: ParamValue[];
    weights: ParamValue[];
    lengths: ParamValue[];
    widths: ParamValue[];
    heights: ParamValue[];
    thicknesses: ParamValue[];
}

type ParamCategory = 'processings' | 'weights' | 'lengths' | 'widths' | 'heights' | 'thicknesses';

const SECTION_ORDER: { key: ParamCategory; label: string }[] = [
    { key: 'processings', label: 'Обработка' },
    { key: 'weights', label: 'Вес (г)' },
    { key: 'lengths', label: 'Длина (см)' },
    { key: 'widths', label: 'Ширина (см)' },
    { key: 'heights', label: 'Высота (см)' },
    { key: 'thicknesses', label: 'Толщина (см)' },
];

const SubcategoriesPage = () => {
    const [items, setItems] = useState<Subcategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Subcategory | null>(null);
    const [formData, setFormData] = useState({ name: '', isActive: true });

    // Param values management
    const [selectedSubcat, setSelectedSubcat] = useState<Subcategory | null>(null);
    const [params, setParams] = useState<ParamsByType | null>(null);
    const [paramModalOpen, setParamModalOpen] = useState(false);
    const [paramFormType, setParamFormType] = useState<ParamCategory>('lengths');
    const [paramEditId, setParamEditId] = useState<number | null>(null);
    const [paramForm, setParamForm] = useState({ min: '', max: '', value: '', label: '', sortOrder: '0', isActive: true });
    const [typeSelectOpen, setTypeSelectOpen] = useState(false);

    useEffect(() => { fetchItems(); }, []);

    const fetchItems = async () => {
        try {
            const res = await api.get('/api/subcategories?active=all');
            setItems(res.data.items);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (item: Subcategory) => {
        if (!confirm(`Вы уверены, что хотите удалить подкатегорию "${item.name}"? Это действие нельзя отменить.`)) return;
        try {
            await api.patch(`/api/subcategories/${item.id}`, { deletedAt: true });
            fetchItems();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Ошибка');
        }
    };

    const fetchParams = async (subcatId: number) => {
        try {
            const res = await api.get(`/api/param-values/subcategory/${subcatId}?active=all`);
            setParams(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleCreate = () => {
        setEditing(null);
        setFormData({ name: '', isActive: true });
        setIsModalOpen(true);
    };

    const handleEdit = (item: Subcategory) => {
        setEditing(item);
        setFormData({ name: item.name, isActive: item.isActive });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editing) {
                await api.patch(`/api/subcategories/${editing.id}`, formData);
            } else {
                await api.post('/api/subcategories', formData);
            }
            setIsModalOpen(false);
            fetchItems();
        } catch (error: any) {
            const msg = error.response?.data?.message || error.response?.data?.error || 'Ошибка сохранения';
            alert(msg);
        }
    };

    const handleSelectSubcat = (item: Subcategory) => {
        if (selectedSubcat?.id === item.id) {
            setSelectedSubcat(null);
            setParams(null);
        } else {
            setSelectedSubcat(item);
            fetchParams(item.id);
        }
    };

    const paramTypeForCategory = (cat: ParamCategory) => {
        switch (cat) {
            case 'processings': return 'PROCESSING';
            case 'weights': return 'WEIGHT_G';
            case 'lengths': return 'LENGTH_CM';
            case 'widths': return 'WIDTH_CM';
            case 'heights': return 'HEIGHT_CM';
            case 'thicknesses': return 'THICKNESS_CM';
        }
    };

    const handleDeleteParam = async (pv: ParamValue) => {
        if (!confirm(`Удалить значение "${renderParamValue(pv)}"? Это действие нельзя отменить.`)) return;
        try {
            await api.patch(`/api/param-values/${pv.id}`, { deletedAt: true });
            if (selectedSubcat) fetchParams(selectedSubcat.id);
        } catch (error: any) {
            alert(error.response?.data?.message || 'Ошибка');
        }
    };

    const handleToggleParam = async (pv: ParamValue) => {
        try {
            await api.patch(`/api/param-values/${pv.id}`, { isActive: !pv.isActive });
            if (selectedSubcat) fetchParams(selectedSubcat.id);
        } catch (error: any) {
            alert(error.response?.data?.message || 'Ошибка');
        }
    };

    const openAddParam = (cat: ParamCategory) => {
        setParamFormType(cat);
        setParamEditId(null);
        setParamForm({ min: '', max: '', value: '', label: '', sortOrder: '0', isActive: true });
        setParamModalOpen(true);
    };

    const openEditParam = (cat: ParamCategory, pv: ParamValue) => {
        setParamFormType(cat);
        setParamEditId(pv.id);
        // Populate range fields for editing
        const minVal = pv.valueNumMin ?? pv.valueIntMin?.toString() ?? '';
        const maxVal = pv.valueNumMax ?? pv.valueIntMax?.toString() ?? '';
        const textVal = pv.valueText ?? '';
        setParamForm({
            min: String(minVal || pv.valueNum || ''),
            max: String(maxVal || pv.valueNum || ''),
            value: textVal,
            label: pv.label || '',
            sortOrder: String(pv.sortOrder),
            isActive: pv.isActive,
        });
        setParamModalOpen(true);
    };

    const openTypeSelect = () => {
        setTypeSelectOpen(true);
    };

    const selectTypeAndAdd = (cat: ParamCategory) => {
        setTypeSelectOpen(false);
        openAddParam(cat);
    };

    const handleParamSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSubcat) return;

        try {
            const pt = paramTypeForCategory(paramFormType);
            const isProcessing = pt === 'PROCESSING';

            if (paramEditId) {
                // Edit: range + label + sortOrder + isActive
                const patchBody: any = {
                    label: paramForm.label || undefined,
                    sortOrder: Number(paramForm.sortOrder),
                    isActive: paramForm.isActive,
                };
                if (!isProcessing) {
                    patchBody.min = Number(paramForm.min);
                    patchBody.max = Number(paramForm.max);
                } else {
                    patchBody.valueText = paramForm.value;
                }
                await api.patch(`/api/param-values/${paramEditId}`, patchBody);
            } else {
                // Create
                const body: any = {
                    paramType: pt,
                    label: paramForm.label || undefined,
                    sortOrder: Number(paramForm.sortOrder),
                };
                if (!isProcessing) {
                    body.min = Number(paramForm.min);
                    body.max = Number(paramForm.max);
                } else {
                    body.valueText = paramForm.value;
                }
                await api.post(`/api/param-values/subcategory/${selectedSubcat.id}`, body);
            }
            setParamModalOpen(false);
            fetchParams(selectedSubcat.id);
        } catch (error: any) {
            alert(error.response?.data?.message || 'Ошибка сохранения');
        }
    };

    const renderParamValue = (pv: ParamValue) => {
        // Range display for dimensions
        if (pv.valueNumMin != null && pv.valueNumMax != null) {
            return pv.valueNumMin === pv.valueNumMax
                ? `${pv.valueNumMin} см`
                : `${pv.valueNumMin}–${pv.valueNumMax} см`;
        }
        // Range display for weight
        if (pv.valueIntMin != null && pv.valueIntMax != null) {
            if (pv.valueIntMin === pv.valueIntMax) {
                const g = pv.valueIntMin;
                return g >= 1000 && g % 1000 === 0 ? `${g / 1000} кг` : `${g} г`;
            }
            return `${pv.valueIntMin}–${pv.valueIntMax} г`;
        }
        // Fallback to legacy single values
        if (pv.valueNum != null) return `${pv.valueNum} см`;
        if (pv.valueInt != null) return pv.valueInt >= 1000 && pv.valueInt % 1000 === 0 ? `${pv.valueInt / 1000} кг` : `${pv.valueInt} г`;
        return pv.valueText || '';
    };



    if (loading) return <div>Загрузка...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900">Подкатегории товаров</h1>
                <Button onClick={handleCreate} className="flex items-center gap-2">
                    <Plus size={16} /> Добавить
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Subcategories list */}
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60px]">ID</TableHead>
                                <TableHead>Название</TableHead>
                                <TableHead>Статус</TableHead>
                                <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-slate-500 py-8">Нет данных</TableCell>
                                </TableRow>
                            ) : (
                                items.map((item) => (
                                    <TableRow
                                        key={item.id}
                                        className={`cursor-pointer ${!item.isActive ? 'opacity-50' : ''} ${selectedSubcat?.id === item.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                                        onClick={() => handleSelectSubcat(item)}
                                    >
                                        <TableCell className="text-xs text-slate-400 font-mono">{item.id}</TableCell>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.isActive
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                {item.isActive ? 'Активна' : 'Архив'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(item); }} className="text-blue-600 hover:text-blue-800" title="Редактировать">
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                                                    className="text-red-400 hover:text-red-600"
                                                    title="Удалить"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>

                {/* Right: Param values for selected subcategory */}
                <Card className="p-4">
                    {!selectedSubcat ? (
                        <div className="text-center text-slate-400 py-12">Выберите подкатегорию для просмотра параметров</div>
                    ) : !params ? (
                        <div className="text-center text-slate-400 py-12">Загрузка параметров...</div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-slate-800">{selectedSubcat.name} — параметры</h3>
                                <Button variant="outline" size="sm" onClick={openTypeSelect} className="flex items-center gap-1 text-xs">
                                    <Plus size={14} /> Добавить параметр
                                </Button>
                            </div>
                            {SECTION_ORDER.map(({ key: cat, label }) => {
                                const sectionParams = params[cat];
                                const activeParams = sectionParams.filter(p => p.isActive);
                                const inactiveParams = sectionParams.filter(p => !p.isActive);
                                if (sectionParams.length === 0) return null;
                                return (
                                    <div key={cat} className="border rounded-lg overflow-hidden">
                                        <div className="px-4 py-2 bg-slate-50 border-b">
                                            <span className="font-medium text-sm text-slate-700">
                                                {label} ({activeParams.length})
                                            </span>
                                        </div>
                                        <div className="px-4 py-2 space-y-1">
                                            {/* Active rows first */}
                                            {activeParams.map((pv) => (
                                                <div key={pv.id} className="flex items-center justify-between py-1 px-2 rounded text-sm">
                                                    <span>
                                                        <span className="font-medium">{renderParamValue(pv)}</span>
                                                        {pv.label && <span className="text-slate-500 ml-2">({pv.label})</span>}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => handleToggleParam(pv)} className="text-amber-500 hover:text-amber-700" title="Выключить">
                                                            <EyeOff size={14} />
                                                        </button>
                                                        <button onClick={() => openEditParam(cat, pv)} className="text-blue-600 hover:text-blue-800" title="Редактировать">
                                                            <Edit size={14} />
                                                        </button>
                                                        <button onClick={() => handleDeleteParam(pv)} className="text-red-400 hover:text-red-600" title="Удалить">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {/* + button under last active row */}
                                            <button
                                                onClick={() => openAddParam(cat)}
                                                className="mt-1 w-full flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded py-1.5 border border-dashed border-slate-200 hover:border-blue-300 transition-colors"
                                            >
                                                <Plus size={14} />
                                            </button>
                                            {/* Inactive rows after + */}
                                            {inactiveParams.length > 0 && (
                                                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                                                    {inactiveParams.map((pv) => (
                                                        <div key={pv.id} className="flex items-center justify-between py-1 px-2 rounded text-sm opacity-50">
                                                            <span className="flex items-center gap-2">
                                                                <span className="font-medium text-slate-500">{renderParamValue(pv)}</span>
                                                                {pv.label && <span className="text-slate-400">({pv.label})</span>}
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">Выключена</span>
                                                            </span>
                                                            <div className="flex items-center gap-1">
                                                                <button onClick={() => handleToggleParam(pv)} className="text-green-500 hover:text-green-700" title="Включить">
                                                                    <Eye size={14} />
                                                                </button>
                                                                <button onClick={() => openEditParam(cat, pv)} className="text-blue-600 hover:text-blue-800" title="Редактировать">
                                                                    <Edit size={14} />
                                                                </button>
                                                                <button onClick={() => handleDeleteParam(pv)} className="text-red-400 hover:text-red-600" title="Удалить">
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            </div>

            {/* Subcategory modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800">
                                {editing ? 'Редактировать подкатегорию' : 'Новая подкатегория'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Название</label>
                                <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            {editing && (
                                <div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                        <span className="text-sm font-medium text-slate-700">Активна</span>
                                    </label>
                                </div>
                            )}
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-2">
                                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Отмена</Button>
                                <Button type="submit" className="flex items-center gap-2"><Save size={16} /> Сохранить</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Param value modal */}
            {paramModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800">
                                {paramEditId ? 'Редактировать значение' : `Новое значение — ${SECTION_ORDER.find(s => s.key === paramFormType)?.label || ''}`}
                            </h2>
                            <button onClick={() => setParamModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleParamSubmit} className="p-6 space-y-4">
                            {paramFormType !== 'processings' ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">От (min)</label>
                                        <Input
                                            required
                                            type="number"
                                            step={paramFormType === 'weights' ? '1' : '0.01'}
                                            min="0.01"
                                            value={paramForm.min}
                                            onChange={e => setParamForm({ ...paramForm, min: e.target.value })}
                                            placeholder={paramFormType === 'weights' ? 'напр. 400' : 'напр. 20'}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">До (max)</label>
                                        <Input
                                            required
                                            type="number"
                                            step={paramFormType === 'weights' ? '1' : '0.01'}
                                            min="0.01"
                                            value={paramForm.max}
                                            onChange={e => setParamForm({ ...paramForm, max: e.target.value })}
                                            placeholder={paramFormType === 'weights' ? 'напр. 500' : 'напр. 23'}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Текст обработки</label>
                                    <Input
                                        required
                                        type="text"
                                        value={paramForm.value}
                                        onChange={e => setParamForm({ ...paramForm, value: e.target.value })}
                                        placeholder="напр. chiw"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Метка (label)</label>
                                <Input
                                    value={paramForm.label}
                                    onChange={e => setParamForm({ ...paramForm, label: e.target.value })}
                                    placeholder="Авто-генерируется если пусто"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Порядок сортировки</label>
                                <Input
                                    type="number"
                                    value={paramForm.sortOrder}
                                    onChange={e => setParamForm({ ...paramForm, sortOrder: e.target.value })}
                                />
                            </div>
                            {paramEditId && (
                                <div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={paramForm.isActive} onChange={e => setParamForm({ ...paramForm, isActive: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                        <span className="text-sm font-medium text-slate-700">Активно</span>
                                    </label>
                                </div>
                            )}
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-2">
                                <Button type="button" variant="outline" onClick={() => setParamModalOpen(false)}>Отмена</Button>
                                <Button type="submit" className="flex items-center gap-2"><Save size={16} /> Сохранить</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Type selector modal */}
            {typeSelectOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xs overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800">Выберите тип параметра</h2>
                            <button onClick={() => setTypeSelectOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 space-y-1">
                            {SECTION_ORDER.map(({ key: cat, label }) => (
                                <button
                                    key={cat}
                                    onClick={() => selectTypeAndAdd(cat)}
                                    className="w-full text-left px-4 py-2 rounded-lg text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors"
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubcategoriesPage;
