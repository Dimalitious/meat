import { useEffect, useState } from 'react';
import api from '../config/axios';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/Table';
import { Plus, Edit, Save, X, Trash2, Eye, EyeOff } from 'lucide-react';
import { Card } from '../components/ui/Card';

interface Country {
    id: number;
    name: string;
    isActive: boolean;
}

const CountriesPage = () => {
    const [items, setItems] = useState<Country[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Country | null>(null);
    const [formData, setFormData] = useState({ name: '', isActive: true });
    const [showArchived, setShowArchived] = useState(false);

    useEffect(() => { fetchItems(); }, [showArchived]);

    const fetchItems = async () => {
        try {
            const res = await api.get(`/api/countries?active=${showArchived ? 'all' : 'true'}`);
            setItems(res.data.items);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditing(null);
        setFormData({ name: '', isActive: true });
        setIsModalOpen(true);
    };

    const handleEdit = (item: Country) => {
        setEditing(item);
        setFormData({ name: item.name, isActive: item.isActive });
        setIsModalOpen(true);
    };

    const handleSoftDelete = async (item: Country) => {
        if (!confirm(`Вы уверены, что хотите ${item.isActive ? 'архивировать' : 'восстановить'} "${item.name}"?`)) return;
        try {
            await api.patch(`/api/countries/${item.id}`, { isActive: !item.isActive });
            fetchItems();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Ошибка');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editing) {
                await api.patch(`/api/countries/${editing.id}`, formData);
            } else {
                await api.post('/api/countries', formData);
            }
            setIsModalOpen(false);
            fetchItems();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Ошибка сохранения');
        }
    };

    if (loading) return <div>Загрузка...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900">Страны</h1>
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
                    <Button onClick={handleCreate} className="flex items-center gap-2">
                        <Plus size={16} /> Добавить
                    </Button>
                </div>
            </div>

            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[60px]">ID</TableHead>
                            <TableHead>Название</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                                    Нет данных
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item) => (
                                <TableRow key={item.id} className={!item.isActive ? 'opacity-50' : ''}>
                                    <TableCell className="text-xs text-slate-400 font-mono">{item.id}</TableCell>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {item.isActive ? 'Активна' : 'Архив'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800">
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleSoftDelete(item)}
                                                className={item.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}
                                                title={item.isActive ? 'Архивировать' : 'Восстановить'}
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
                                {editing ? 'Редактировать страну' : 'Новая страна'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Название</label>
                                <Input
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            {editing && (
                                <div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.isActive}
                                            onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-slate-700">Активна</span>
                                    </label>
                                </div>
                            )}
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

export default CountriesPage;
