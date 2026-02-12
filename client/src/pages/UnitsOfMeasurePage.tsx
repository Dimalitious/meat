import { useEffect, useState } from 'react';
import api from '../config/axios';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/Table';
import { Plus, Trash2, Edit, Save, X, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Card } from '../components/ui/Card';

interface UnitOfMeasure {
    id: number;
    name: string;
    isDefault: boolean;
    isActive: boolean;
}

const UnitsOfMeasurePage = () => {
    const [units, setUnits] = useState<UnitOfMeasure[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState<UnitOfMeasure | null>(null);
    const [formData, setFormData] = useState({ name: '', isDefault: false });
    const [showArchived, setShowArchived] = useState(false);
    const [fillResult, setFillResult] = useState<string | null>(null);

    useEffect(() => {
        fetchUnits();
    }, [showArchived]);

    const fetchUnits = async () => {
        try {
            const res = await api.get(`/api/uom?active=${showArchived ? 'all' : 'true'}`);
            setUnits(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingUnit(null);
        setFormData({ name: '', isDefault: false });
        setIsModalOpen(true);
    };

    const handleEdit = (unit: UnitOfMeasure) => {
        setEditingUnit(unit);
        setFormData({ name: unit.name, isDefault: unit.isDefault });
        setIsModalOpen(true);
    };

    const handleSoftDelete = async (unit: UnitOfMeasure) => {
        if (!confirm(`Вы уверены, что хотите ${unit.isActive ? 'архивировать' : 'восстановить'} "${unit.name}"?`)) return;
        try {
            if (unit.isActive) {
                await api.delete(`/api/uom/${unit.id}`);
            } else {
                await api.put(`/api/uom/${unit.id}`, { isActive: true });
            }
            fetchUnits();
        } catch (error: any) {
            alert(error.response?.data?.error || 'Ошибка');
        }
    };

    const handleFillDefaults = async () => {
        try {
            const res = await api.post('/api/uom/fill-defaults');
            setFillResult(res.data.message);
            fetchUnits();
            setTimeout(() => setFillResult(null), 5000);
        } catch (error: any) {
            alert(error.response?.data?.error || 'Ошибка заполнения');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingUnit) {
                await api.put(`/api/uom/${editingUnit.id}`, formData);
            } else {
                await api.post('/api/uom', formData);
            }
            setIsModalOpen(false);
            fetchUnits();
        } catch (error: any) {
            alert(error.response?.data?.error || 'Ошибка сохранения');
        }
    };

    if (loading) return <div>Загрузка...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900">Единицы измерения</h1>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowArchived(!showArchived)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showArchived
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        {showArchived ? <Eye size={16} /> : <EyeOff size={16} />}
                        {showArchived ? 'Показаны все' : 'Показать архив'}
                    </button>
                    <Button onClick={handleFillDefaults} variant="outline" className="flex items-center gap-2">
                        <RefreshCw size={16} /> Заполнить базовые
                    </Button>
                    <Button onClick={handleCreate} className="flex items-center gap-2">
                        <Plus size={16} /> Добавить
                    </Button>
                </div>
            </div>

            {fillResult && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
                    {fillResult}
                </div>
            )}

            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[60px]">ID</TableHead>
                            <TableHead>Название</TableHead>
                            <TableHead>По умолчанию</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {units.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                                    Нет данных
                                </TableCell>
                            </TableRow>
                        ) : (
                            units.map((u) => (
                                <TableRow key={u.id} className={!u.isActive ? 'opacity-50' : ''}>
                                    <TableCell className="text-xs text-slate-400 font-mono">{u.id}</TableCell>
                                    <TableCell className="font-medium">{u.name}</TableCell>
                                    <TableCell>
                                        {u.isDefault && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                По умолчанию
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {u.isActive ? 'Активна' : 'Архив'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => handleEdit(u)} className="text-blue-600 hover:text-blue-800">
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleSoftDelete(u)}
                                                className={u.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}
                                                title={u.isActive ? 'Архивировать' : 'Восстановить'}
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

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800">
                                {editingUnit ? 'Редактировать' : 'Новая единица изм.'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Название (кг, шт, и т.д.)</label>
                                <Input
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.isDefault}
                                        onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">Использовать по умолчанию</span>
                                </label>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-2">
                                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Отмена</Button>
                                <Button type="submit" className="flex items-center gap-2">
                                    <Save size={16} /> Сохранить
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UnitsOfMeasurePage;
