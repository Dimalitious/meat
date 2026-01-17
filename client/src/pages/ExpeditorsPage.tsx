import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

interface Expeditor {
    id: number;
    name: string;
    phone?: string;
    isActive: boolean;
}

const ExpeditorsPage = () => {
    const [expeditors, setExpeditors] = useState<Expeditor[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({ name: '', phone: '' });

    useEffect(() => {
        fetchExpeditors();
    }, []);

    const fetchExpeditors = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/expeditors`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setExpeditors(res.data);
        } catch (err) {
            console.error('Failed to fetch expeditors');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            if (editingId) {
                await axios.put(`${API_URL}/api/expeditors/${editingId}`, formData, { headers });
            } else {
                await axios.post(`${API_URL}/api/expeditors`, formData, { headers });
            }

            fetchExpeditors();
            closeModal();
        } catch (err) {
            alert('Ошибка при сохранении');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Вы уверены, что хотите деактивировать этого водителя?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/api/expeditors/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchExpeditors();
        } catch (err) {
            alert('Ошибка при удалении');
        }
    };

    const openModal = (expeditor?: Expeditor) => {
        if (expeditor) {
            setEditingId(expeditor.id);
            setFormData({ name: expeditor.name, phone: expeditor.phone || '' });
        } else {
            setEditingId(null);
            setFormData({ name: '', phone: '' });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        setFormData({ name: '', phone: '' });
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Загрузка...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900">Экспедиторы (Drivers)</h1>
                <Button onClick={() => openModal()}>
                    + Добавить водителя
                </Button>
            </div>

            <div className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead>Имя</TableHead>
                            <TableHead>Телефон</TableHead>
                            <TableHead className="text-right">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {expeditors.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center text-slate-500">
                                    Нет данных
                                </TableCell>
                            </TableRow>
                        ) : (
                            expeditors.map((exp) => (
                                <TableRow key={exp.id}>
                                    <TableCell className="font-medium text-slate-900">{exp.name}</TableCell>
                                    <TableCell className="text-slate-500">{exp.phone || '-'}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="ghost" size="sm" onClick={() => openModal(exp)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                            Изменить
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(exp.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                            Удалить
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
                        <h2 className="text-xl font-bold mb-4 text-slate-900">{editingId ? 'Редактировать водителя' : 'Новый водитель'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Имя</label>
                                <Input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="Введите имя водителя"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Телефон</label>
                                <Input
                                    type="text"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="+998..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <Button type="button" variant="outline" onClick={closeModal}>Отмена</Button>
                                <Button type="submit">Сохранить</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpeditorsPage;
