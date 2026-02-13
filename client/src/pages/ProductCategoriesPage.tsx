import { useEffect, useState } from 'react';
import api from '../config/axios';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/Table';
import { Plus, Edit, Save, X, Trash2, Eye, EyeOff, Search } from 'lucide-react';
import { Card } from '../components/ui/Card';

interface Category {
    id: number;
    name: string;
    nameNormalized: string;
    isActive: boolean;
    deletedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

const ProductCategoriesPage = () => {
    const [items, setItems] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Category | null>(null);
    const [formData, setFormData] = useState({ name: '' });
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => { fetchItems(); }, []);

    const fetchItems = async () => {
        try {
            const res = await api.get('/api/product-categories?includeDeleted=false&includeInactive=true');
            setItems(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditing(null);
        setFormData({ name: '' });
        setIsModalOpen(true);
    };

    const handleEdit = (item: Category) => {
        setEditing(item);
        setFormData({ name: item.name });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editing) {
                await api.put(`/api/product-categories/${editing.id}`, formData);
            } else {
                await api.post('/api/product-categories', formData);
            }
            setIsModalOpen(false);
            fetchItems();
        } catch (error: any) {
            const msg = error.response?.data?.message || error.response?.data?.error || 'Ошибка сохранения';
            alert(msg);
        }
    };

    const handleToggle = async (item: Category) => {
        try {
            await api.patch(`/api/product-categories/${item.id}/toggle`, { isActive: !item.isActive });
            fetchItems();
        } catch (error: any) {
            alert(error.response?.data?.message || error.response?.data?.error || 'Ошибка');
        }
    };

    const handleDelete = async (item: Category) => {
        if (!confirm(`Удалить категорию "${item.name}"? Это действие нельзя отменить.`)) return;
        try {
            await api.delete(`/api/product-categories/${item.id}`);
            fetchItems();
        } catch (error: any) {
            alert(error.response?.data?.message || error.response?.data?.error || 'Ошибка');
        }
    };

    const filtered = items.filter((item) => {
        if (!searchQuery) return true;
        return item.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">Категории товаров</h1>
                <Button onClick={handleCreate} className="flex items-center gap-1">
                    <Plus size={16} /> Добавить
                </Button>
            </div>

            <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                            placeholder="Поиск по названию..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-16">ID</TableHead>
                            <TableHead>Название</TableHead>
                            <TableHead className="w-24">Статус</TableHead>
                            <TableHead className="w-32">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-slate-400 py-8">Загрузка...</TableCell>
                            </TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-slate-400 py-8">
                                    {searchQuery ? 'Ничего не найдено' : 'Нет категорий. Нажмите «Добавить».'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((item) => (
                                <TableRow
                                    key={item.id}
                                    className={!item.isActive ? 'opacity-50' : 'hover:bg-slate-50'}
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
                                            <button
                                                onClick={() => handleToggle(item)}
                                                className={item.isActive ? 'text-amber-500 hover:text-amber-700' : 'text-green-500 hover:text-green-700'}
                                                title={item.isActive ? 'Выключить' : 'Включить'}
                                            >
                                                {item.isActive ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                            <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800" title="Редакт.">
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item)}
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

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-800">
                                {editing ? 'Редактировать категорию' : 'Новая категория'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-1 block">Название *</label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Введите название категории"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button type="submit" className="flex-1 flex items-center justify-center gap-1">
                                    <Save size={16} /> {editing ? 'Сохранить' : 'Создать'}
                                </Button>
                                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex items-center gap-1">
                                    <X size={16} /> Отмена
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductCategoriesPage;
