import { useEffect, useState } from 'react';
import api from '../config/axios';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/Table';
import { Plus, Edit, Save, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Card } from '../components/ui/Card';

interface Subcategory {
    id: number;
    name: string;
    isActive: boolean;
}

interface ParamValue {
    id: number;
    paramType: string;
    valueNum?: string | null;
    valueInt?: number | null;
    valueText?: string | null;
    label: string | null;
    sortOrder: number;
    isActive: boolean;
}

interface ParamsByType {
    lengths: ParamValue[];
    widths: ParamValue[];
    weights: ParamValue[];
    processings: ParamValue[];
}

type ParamCategory = 'lengths' | 'widths' | 'weights' | 'processings';

const PARAM_LABELS: Record<ParamCategory, string> = {
    lengths: 'Длина (см)',
    widths: 'Ширина (см)',
    weights: 'Вес (г)',
    processings: 'Обработка',
};

const SubcategoriesPage = () => {
    const [items, setItems] = useState<Subcategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Subcategory | null>(null);
    const [formData, setFormData] = useState({ name: '', isActive: true });

    // Param values management
    const [selectedSubcat, setSelectedSubcat] = useState<Subcategory | null>(null);
    const [params, setParams] = useState<ParamsByType | null>(null);
    const [expandedSections, setExpandedSections] = useState<ParamCategory[]>(['lengths', 'widths', 'weights', 'processings']);
    const [paramModalOpen, setParamModalOpen] = useState(false);
    const [paramFormType, setParamFormType] = useState<ParamCategory>('lengths');
    const [paramEditId, setParamEditId] = useState<number | null>(null);
    const [paramForm, setParamForm] = useState({ value: '', label: '', sortOrder: '0', isActive: true });

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
            alert(error.response?.data?.message || 'Ошибка сохранения');
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

    const toggleSection = (section: ParamCategory) => {
        setExpandedSections(prev =>
            prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
        );
    };

    const paramTypeForCategory = (cat: ParamCategory) => {
        switch (cat) {
            case 'lengths': return 'LENGTH_CM';
            case 'widths': return 'WIDTH_CM';
            case 'weights': return 'WEIGHT_G';
            case 'processings': return 'PROCESSING';
        }
    };

    const openAddParam = (cat: ParamCategory) => {
        setParamFormType(cat);
        setParamEditId(null);
        setParamForm({ value: '', label: '', sortOrder: '0', isActive: true });
        setParamModalOpen(true);
    };

    const openEditParam = (cat: ParamCategory, pv: ParamValue) => {
        setParamFormType(cat);
        setParamEditId(pv.id);
        const val = pv.valueNum ?? pv.valueInt?.toString() ?? pv.valueText ?? '';
        setParamForm({ value: String(val), label: pv.label || '', sortOrder: String(pv.sortOrder), isActive: pv.isActive });
        setParamModalOpen(true);
    };

    const handleParamSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSubcat) return;

        try {
            if (paramEditId) {
                // Only label, sortOrder, isActive editable
                await api.patch(`/api/param-values/${paramEditId}`, {
                    label: paramForm.label || undefined,
                    sortOrder: Number(paramForm.sortOrder),
                    isActive: paramForm.isActive,
                });
            } else {
                const pt = paramTypeForCategory(paramFormType);
                const body: any = {
                    paramType: pt,
                    label: paramForm.label || undefined,
                    sortOrder: Number(paramForm.sortOrder),
                };
                if (pt === 'LENGTH_CM' || pt === 'WIDTH_CM') {
                    body.valueNum = Number(paramForm.value);
                } else if (pt === 'WEIGHT_G') {
                    body.valueInt = Number(paramForm.value);
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
                                <TableHead>Название</TableHead>
                                <TableHead>Статус</TableHead>
                                <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-slate-500 py-8">Нет данных</TableCell>
                                </TableRow>
                            ) : (
                                items.map((item) => (
                                    <TableRow
                                        key={item.id}
                                        className={`cursor-pointer ${!item.isActive ? 'opacity-50' : ''} ${selectedSubcat?.id === item.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                                        onClick={() => handleSelectSubcat(item)}
                                    >
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {item.isActive ? 'Активна' : 'Архив'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <button onClick={(e) => { e.stopPropagation(); handleEdit(item); }} className="text-blue-600 hover:text-blue-800">
                                                <Edit size={16} />
                                            </button>
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
                            <h3 className="text-lg font-semibold text-slate-800">{selectedSubcat.name} — параметры</h3>
                            {(['lengths', 'widths', 'weights', 'processings'] as ParamCategory[]).map((cat) => (
                                <div key={cat} className="border rounded-lg overflow-hidden">
                                    <button
                                        className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
                                        onClick={() => toggleSection(cat)}
                                    >
                                        <span className="font-medium text-sm text-slate-700">
                                            {PARAM_LABELS[cat]} ({params[cat].length})
                                        </span>
                                        {expandedSections.includes(cat) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </button>
                                    {expandedSections.includes(cat) && (
                                        <div className="px-4 py-2 space-y-1">
                                            {params[cat].length === 0 ? (
                                                <div className="text-xs text-slate-400 py-2">Нет значений</div>
                                            ) : (
                                                params[cat].map((pv) => (
                                                    <div
                                                        key={pv.id}
                                                        className={`flex items-center justify-between py-1 px-2 rounded text-sm ${!pv.isActive ? 'opacity-40 line-through' : ''}`}
                                                    >
                                                        <span>
                                                            <span className="font-medium">{renderParamValue(pv)}</span>
                                                            {pv.label && <span className="text-slate-500 ml-2">({pv.label})</span>}
                                                        </span>
                                                        <button onClick={() => openEditParam(cat, pv)} className="text-blue-600 hover:text-blue-800">
                                                            <Edit size={14} />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                            <Button size="sm" variant="outline" onClick={() => openAddParam(cat)} className="mt-2 w-full flex items-center justify-center gap-1 text-xs">
                                                <Plus size={14} /> Добавить
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
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
                                {paramEditId ? 'Редактировать значение' : `Новое значение — ${PARAM_LABELS[paramFormType]}`}
                            </h2>
                            <button onClick={() => setParamModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleParamSubmit} className="p-6 space-y-4">
                            {!paramEditId && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        {paramFormType === 'processings' ? 'Текст обработки' : 'Числовое значение'}
                                    </label>
                                    <Input
                                        required
                                        type={paramFormType === 'processings' ? 'text' : 'number'}
                                        step={paramFormType === 'weights' ? '1' : '0.01'}
                                        min={paramFormType === 'processings' ? undefined : '0.01'}
                                        value={paramForm.value}
                                        onChange={e => setParamForm({ ...paramForm, value: e.target.value })}
                                        placeholder={paramFormType === 'weights' ? 'Граммы, напр. 1000' : paramFormType === 'processings' ? 'напр. chiw' : 'напр. 12.5'}
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
        </div>
    );
};

export default SubcategoriesPage;
