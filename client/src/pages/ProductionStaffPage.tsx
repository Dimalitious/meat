import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import { Plus, Edit2, X, User } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../components/ui/Table";

interface ProductionStaff {
    id: number;
    fullName: string;
    phone: string | null;
    userId: number;
    isActive: boolean;
    user?: { id: number; name: string; username: string };
}

interface UserOption {
    id: number;
    username: string;
    name: string;
}

export default function ProductionStaffPage() {
    const [staff, setStaff] = useState<ProductionStaff[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editingStaff, setEditingStaff] = useState<ProductionStaff | null>(null);
    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        userId: 0
    });

    useEffect(() => {
        fetchStaff();
        fetchUsers();
    }, []);

    const fetchStaff = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/production/staff`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStaff(res.data);
        } catch (err) {
            console.error('Failed to fetch staff:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            // Assuming there's an endpoint for users
            const res = await axios.get(`${API_URL}/api/auth/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(res.data);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        }
    };

    const openCreateModal = () => {
        setEditingStaff(null);
        setFormData({ fullName: '', phone: '', userId: 0 });
        setShowModal(true);
    };

    const openEditModal = (s: ProductionStaff) => {
        setEditingStaff(s);
        setFormData({
            fullName: s.fullName,
            phone: s.phone || '',
            userId: s.userId
        });
        setShowModal(true);
    };

    const saveStaff = async () => {
        try {
            const token = localStorage.getItem('token');
            if (editingStaff) {
                await axios.put(`${API_URL}/api/production/staff/${editingStaff.id}`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(`${API_URL}/api/production/staff`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            fetchStaff();
            setShowModal(false);
        } catch (err) {
            console.error('Failed to save staff:', err);
            alert('Ошибка сохранения');
        }
    };

    const toggleActive = async (s: ProductionStaff) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_URL}/api/production/staff/${s.id}`, {
                isActive: !s.isActive
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchStaff();
        } catch (err) {
            console.error('Failed to toggle active:', err);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    Производственный персонал
                </h1>
                <Button onClick={openCreateModal}>
                    <Plus size={16} className="mr-2" />
                    Добавить сотрудника
                </Button>
            </div>

            <div className="rounded-md border border-slate-200 overflow-hidden bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-[50px]">ID</TableHead>
                            <TableHead>ФИО</TableHead>
                            <TableHead>Телефон</TableHead>
                            <TableHead>Пользователь</TableHead>
                            <TableHead className="w-[100px]">Статус</TableHead>
                            <TableHead className="text-right w-[150px]">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                                    Загрузка...
                                </TableCell>
                            </TableRow>
                        ) : staff.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                                    Нет сотрудников
                                </TableCell>
                            </TableRow>
                        ) : (
                            staff.map(s => (
                                <TableRow key={s.id}>
                                    <TableCell>{s.id}</TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <User size={16} className="text-gray-400" />
                                            {s.fullName}
                                        </div>
                                    </TableCell>
                                    <TableCell>{s.phone || '-'}</TableCell>
                                    <TableCell>
                                        <div>{s.user?.name || '-'}</div>
                                        <div className="text-xs text-gray-500">{s.user?.username}</div>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                            }`}>
                                            {s.isActive ? 'Активен' : 'Неактивен'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" size="sm" onClick={() => openEditModal(s)}>
                                                <Edit2 size={14} />
                                            </Button>
                                            <Button
                                                variant={s.isActive ? "outline" : "default"}
                                                size="sm"
                                                onClick={() => toggleActive(s)}
                                            >
                                                {s.isActive ? 'Откл.' : 'Вкл.'}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[450px]">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-semibold">
                                {editingStaff ? 'Редактировать сотрудника' : 'Новый сотрудник'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">ФИО</label>
                                <input
                                    type="text"
                                    value={formData.fullName}
                                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                    className="w-full border rounded px-3 py-2"
                                    placeholder="Иванов Иван Иванович"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Телефон</label>
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full border rounded px-3 py-2"
                                    placeholder="+7 XXX XXX XX XX"
                                />
                            </div>
                            {!editingStaff && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Пользователь системы</label>
                                    <select
                                        value={formData.userId}
                                        onChange={e => setFormData({ ...formData, userId: Number(e.target.value) })}
                                        className="w-full border rounded px-3 py-2"
                                    >
                                        <option value={0}>Выберите пользователя...</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>
                                                {u.name} ({u.username})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowModal(false)}>
                                Отмена
                            </Button>
                            <Button onClick={saveStaff} disabled={!formData.fullName || (!editingStaff && !formData.userId)}>
                                Сохранить
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
