import { useEffect, useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
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
import { Plus, X, Save, Settings, Warehouse as WarehouseIcon } from 'lucide-react';

interface User {
    id: number;
    name: string;
    username: string;
}

interface Warehouse {
    id: number;
    code: string;
    name: string;
    address: string;
    phone?: string;
    responsibleUserId?: number | null;
    responsibleUser?: User | null;
    comment?: string;
    isDisabled: boolean;
}

const WarehousesPage = () => {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

    // Users list for dropdown
    const [users, setUsers] = useState<User[]>([]);

    // Filters
    const [filterCode, setFilterCode] = useState('');
    const [filterName, setFilterName] = useState('');
    const [filterAddress, setFilterAddress] = useState('');

    // Selection
    const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

    // Form data
    const [formData, setFormData] = useState<Partial<Warehouse> & { responsibleUserId?: number | null }>({
        code: '',
        name: '',
        address: '',
        phone: '',
        responsibleUserId: null,
        comment: '',
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchWarehouses();
        fetchUsers();
    }, []);

    const fetchWarehouses = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/warehouses`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setWarehouses(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(res.data);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        }
    };

    const handleEdit = (warehouse: Warehouse) => {
        setEditingWarehouse(warehouse);
        setFormData({
            code: warehouse.code,
            name: warehouse.name,
            address: warehouse.address,
            phone: warehouse.phone || '',
            responsibleUserId: warehouse.responsibleUserId || null,
            comment: warehouse.comment || '',
        });
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingWarehouse(null);
        setFormData({
            code: '',
            name: '',
            address: '',
            phone: '',
            responsibleUserId: null,
            comment: '',
        });
        setIsModalOpen(true);
    };

    // Toggle warehouse status
    const handleToggleStatus = async (code: string, currentStatus: boolean) => {
        const action = currentStatus ? 'активировать' : 'отключить';
        if (!confirm(`Вы уверены, что хотите ${action} этот склад?`)) return;
        try {
            const token = localStorage.getItem('token');
            const res = await axios.put(`${API_URL}/api/warehouses/toggle/${code}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(res.data.message);
            setIsModalOpen(false);
            fetchWarehouses();
        } catch (err: any) {
            const errorMessage = err.response?.data?.error || 'Не удалось изменить статус';
            alert(errorMessage);
        }
    };

    // Checkbox handlers
    const toggleSelect = (code: string) => {
        const newSelected = new Set(selectedCodes);
        if (newSelected.has(code)) {
            newSelected.delete(code);
        } else {
            newSelected.add(code);
        }
        setSelectedCodes(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedCodes.size === filteredWarehouses.length) {
            setSelectedCodes(new Set());
        } else {
            setSelectedCodes(new Set(filteredWarehouses.map(w => w.code)));
        }
    };

    // Deactivate selected warehouses
    const deactivateSelected = async () => {
        if (selectedCodes.size === 0) return;
        if (!confirm(`Отключить ${selectedCodes.size} выбранных складов?`)) return;

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/api/warehouses/deactivate`, {
                codes: Array.from(selectedCodes)
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert(res.data.message);
            setSelectedCodes(new Set());
            fetchWarehouses();
        } catch (err: any) {
            console.error('Deactivate error:', err);
            alert(err.response?.data?.error || 'Ошибка при отключении');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const payload = {
                code: formData.code,
                name: formData.name,
                address: formData.address,
                phone: formData.phone || null,
                responsibleUserId: formData.responsibleUserId || null,
                comment: formData.comment || null,
            };

            if (editingWarehouse) {
                await axios.put(`${API_URL}/api/warehouses/${editingWarehouse.code}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(`${API_URL}/api/warehouses`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            setIsModalOpen(false);
            fetchWarehouses();
        } catch (err: any) {
            console.error(err);
            alert(err.response?.data?.error || 'Ошибка при сохранении');
        }
    };

    // Excel import
    const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = evt.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);

                if (jsonData.length === 0) {
                    alert('Файл Excel пуст или не содержит данных');
                    return;
                }

                // Refresh warehouses list before import
                const token = localStorage.getItem('token');
                let currentWarehouses: Warehouse[] = [];
                try {
                    const res = await axios.get(`${API_URL}/api/warehouses?includeDisabled=true`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    currentWarehouses = res.data;
                } catch (err) {
                    console.error('Failed to fetch current warehouses:', err);
                }

                let imported = 0;
                let updated = 0;
                let errors: string[] = [];

                // Helper function to get value case-insensitively
                const getVal = (row: any, ...keys: string[]) => {
                    for (const key of keys) {
                        const found = Object.keys(row).find(k => k.toLowerCase().trim() === key.toLowerCase().trim());
                        if (found && row[found] !== undefined && row[found] !== null && row[found] !== '') {
                            return String(row[found]);
                        }
                    }
                    return '';
                };

                for (let i = 0; i < jsonData.length; i++) {
                    const row = jsonData[i] as any;
                    const rowNum = i + 2;

                    const code = getVal(row, 'id склада', 'код склада', 'код', 'code', 'id');
                    const name = getVal(row, 'название склада', 'название', 'name');
                    const address = getVal(row, 'адрес склада', 'адрес', 'address');

                    if (!code) {
                        errors.push(`Строка ${rowNum}: отсутствует ID/код склада`);
                        continue;
                    }
                    if (!name) {
                        errors.push(`Строка ${rowNum}: отсутствует название склада`);
                        continue;
                    }
                    if (!address) {
                        errors.push(`Строка ${rowNum}: отсутствует адрес склада`);
                        continue;
                    }

                    const payload = {
                        code,
                        name,
                        address,
                        phone: getVal(row, 'телефон склада', 'телефон', 'phone') || null,
                        comment: getVal(row, 'комментарий', 'comment', 'примечание') || null,
                    };

                    try {
                        const existing = currentWarehouses.find(w => w.code === code);
                        if (existing) {
                            await axios.put(`${API_URL}/api/warehouses/${code}`, payload, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            updated++;
                        } else {
                            await axios.post(`${API_URL}/api/warehouses`, payload, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            imported++;
                        }
                    } catch (err: any) {
                        errors.push(`Строка ${rowNum} (${code}): ${err.response?.data?.error || 'ошибка сохранения'}`);
                    }
                }

                let message = `Добавлено: ${imported}, Обновлено: ${updated}`;
                if (errors.length > 0) {
                    message += `\n\nОшибки:\n${errors.slice(0, 10).join('\n')}`;
                    if (errors.length > 10) {
                        message += `\n... и ещё ${errors.length - 10} ошибок`;
                    }
                }

                alert(message);
                fetchWarehouses();
            } catch (err) {
                console.error('Excel import error:', err);
                alert('Ошибка импорта Excel');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const filteredWarehouses = useMemo(() => {
        return warehouses.filter(w => {
            const matchCode = w.code.toLowerCase().includes(filterCode.toLowerCase());
            const matchName = w.name.toLowerCase().includes(filterName.toLowerCase());
            const matchAddress = w.address.toLowerCase().includes(filterAddress.toLowerCase());
            return matchCode && matchName && matchAddress;
        });
    }, [warehouses, filterCode, filterName, filterAddress]);

    if (loading) return <div className="p-8 text-center text-slate-500">Загрузка...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500 rounded-lg">
                        <WarehouseIcon className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Склады</h1>
                </div>
                <div className="flex gap-2">
                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        ref={fileInputRef}
                        onChange={handleExcelImport}
                        className="hidden"
                    />
                    <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex items-center gap-2">
                        📥 Загрузить Excel
                    </Button>
                    {selectedCodes.size > 0 && (
                        <Button onClick={deactivateSelected} variant="outline" className="flex items-center gap-2 text-orange-600 border-orange-300 hover:bg-orange-50">
                            ⏸ Отключить ({selectedCodes.size})
                        </Button>
                    )}
                    <Button onClick={handleCreate} className="flex items-center gap-2">
                        <Plus size={16} /> Добавить склад
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-900 text-slate-200">
                            <TableRow className="border-b border-slate-700 hover:bg-slate-900">
                                <TableHead className="w-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedCodes.size === filteredWarehouses.length && filteredWarehouses.length > 0}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4"
                                    />
                                </TableHead>
                                <TableHead className="text-slate-200 font-semibold">ID</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Название</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Адрес</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Телефон</TableHead>
                                <TableHead className="text-slate-400 font-normal">Ответственный</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Статус</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                            {/* Filter Row */}
                            <TableRow className="bg-slate-800 border-none hover:bg-slate-800">
                                <TableHead></TableHead>
                                <TableHead className="p-2">
                                    <input
                                        className="w-full bg-slate-700 border-none text-white text-xs rounded px-2 py-1 placeholder-slate-400 focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="ID..."
                                        value={filterCode}
                                        onChange={e => setFilterCode(e.target.value)}
                                    />
                                </TableHead>
                                <TableHead className="p-2">
                                    <input
                                        className="w-full bg-slate-700 border-none text-white text-xs rounded px-2 py-1 placeholder-slate-400 focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="Название..."
                                        value={filterName}
                                        onChange={e => setFilterName(e.target.value)}
                                    />
                                </TableHead>
                                <TableHead className="p-2">
                                    <input
                                        className="w-full bg-slate-700 border-none text-white text-xs rounded px-2 py-1 placeholder-slate-400 focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="Адрес..."
                                        value={filterAddress}
                                        onChange={e => setFilterAddress(e.target.value)}
                                    />
                                </TableHead>
                                <TableHead colSpan={4}></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredWarehouses.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center text-slate-500">
                                        Нет данных
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredWarehouses.map((w) => (
                                    <TableRow
                                        key={w.code}
                                        className={`hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 ${w.isDisabled ? 'opacity-50 bg-slate-50' : ''}`}
                                    >
                                        <TableCell>
                                            <input
                                                type="checkbox"
                                                checked={selectedCodes.has(w.code)}
                                                onChange={() => toggleSelect(w.code)}
                                                className="w-4 h-4"
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium text-slate-700">{w.code}</TableCell>
                                        <TableCell className="font-medium text-slate-900">{w.name}</TableCell>
                                        <TableCell className="text-slate-600">{w.address}</TableCell>
                                        <TableCell className="text-slate-600">{w.phone || '-'}</TableCell>
                                        <TableCell className="text-slate-500 text-sm">
                                            {w.responsibleUser?.name || '-'}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${w.isDisabled ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'
                                                }`}>
                                                {w.isDisabled ? 'Отключён' : 'Активен'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <button
                                                onClick={() => handleEdit(w)}
                                                className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                                title="Редактировать"
                                            >
                                                <Settings size={16} />
                                            </button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800">
                                {editingWarehouse ? 'Редактировать склад' : 'Новый склад'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">ID склада (код) *</label>
                                <Input
                                    required
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                                    disabled={!!editingWarehouse}
                                    className={editingWarehouse ? 'bg-slate-100' : ''}
                                    placeholder="WH01"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Название склада *</label>
                                <Input
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Основной склад"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Адрес склада *</label>
                                <Input
                                    required
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="ул. Складская, 1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Телефон</label>
                                <Input
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="+7 (___) ___-__-__"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Ответственный</label>
                                <select
                                    value={formData.responsibleUserId || ''}
                                    onChange={e => setFormData({
                                        ...formData,
                                        responsibleUserId: e.target.value ? Number(e.target.value) : null
                                    })}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">— Не назначен —</option>
                                    {users.map(user => (
                                        <option key={user.id} value={user.id}>
                                            {user.name} ({user.username})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Комментарий</label>
                                <textarea
                                    value={formData.comment || ''}
                                    onChange={e => setFormData({ ...formData, comment: e.target.value })}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    rows={2}
                                    placeholder="Дополнительная информация..."
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-2">
                                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Отмена</Button>
                                <Button type="submit" className="flex items-center gap-2">
                                    <Save size={16} /> Сохранить
                                </Button>
                                {editingWarehouse && (
                                    <button
                                        type="button"
                                        onClick={() => handleToggleStatus(editingWarehouse.code, editingWarehouse.isDisabled)}
                                        className={`ml-auto text-sm font-medium flex items-center gap-1 ${editingWarehouse.isDisabled ? 'text-green-500 hover:text-green-700' : 'text-orange-500 hover:text-orange-700'}`}
                                    >
                                        {editingWarehouse.isDisabled ? '▶ Активировать' : '⏸ Отключить'}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WarehousesPage;
