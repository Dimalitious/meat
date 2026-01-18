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
import { Trash2, Plus, X, Save, Settings } from 'lucide-react';

interface District {
    id: number;
    code: string;
    name: string;
}

interface Manager {
    id: number;
    code: string;
    name: string;
}

interface Customer {
    id: number;
    code: string;
    name: string;
    legalName?: string;
    districtId?: number;
    managerId?: number;
    district?: District;
    manager?: Manager;
}

const CustomersPage = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [districts, setDistricts] = useState<District[]>([]);
    const [managers, setManagers] = useState<Manager[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [formData, setFormData] = useState<Partial<Customer>>({
        code: '',
        name: '',
        legalName: '',
        districtId: undefined,
        managerId: undefined
    });

    // Filters
    const [filterCode, setFilterCode] = useState('');
    const [filterName, setFilterName] = useState('');
    const [filterDistrict, setFilterDistrict] = useState('');
    const [filterManager, setFilterManager] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        Promise.all([
            fetchCustomers(),
            fetchDistricts(),
            fetchManagers()
        ]).finally(() => setLoading(false));
    }, []);

    const fetchCustomers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/customers`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCustomers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchDistricts = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/districts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDistricts(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchManagers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/managers`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setManagers(res.data);
        } catch (err) { console.error(err); }
    };

    const handleEdit = (customer: Customer) => {
        setEditingCustomer(customer);
        setFormData({
            code: customer.code,
            name: customer.name,
            legalName: customer.legalName || '',
            districtId: customer.districtId,
            managerId: customer.managerId
        });
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingCustomer(null);
        setFormData({
            code: '',
            name: '',
            legalName: '',
            districtId: undefined,
            managerId: undefined
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (code: string) => {
        if (!confirm('Вы уверены, что хотите удалить этого клиента?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/api/customers/${code}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchCustomers();
        } catch (err) {
            alert('Не удалось удалить клиента');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const payload = {
                ...formData,
                districtId: formData.districtId ? Number(formData.districtId) : null,
                managerId: formData.managerId ? Number(formData.managerId) : null
            };

            if (editingCustomer) {
                await axios.put(`${API_URL}/api/customers/${editingCustomer.code}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(`${API_URL}/api/customers`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            setIsModalOpen(false);
            fetchCustomers();
        } catch (err) {
            console.error(err);
            alert('Ошибка при сохранении');
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

                const token = localStorage.getItem('token');
                let imported = 0;

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

                console.log('Excel data:', jsonData);
                console.log('First row keys:', jsonData.length > 0 ? Object.keys(jsonData[0]) : 'no data');

                for (const row of jsonData as any[]) {
                    const code = getVal(row, 'код', 'code');
                    const name = getVal(row, 'название', 'name');
                    console.log('Row:', { code, name, row });
                    if (!code || !name) continue;

                    // Find district and manager by name
                    const districtName = getVal(row, 'район', 'district');
                    const managerName = getVal(row, 'менеджер', 'manager');

                    const district = districts.find(d =>
                        d.name.toLowerCase() === districtName.toLowerCase()
                    );
                    const manager = managers.find(m =>
                        m.name.toLowerCase() === managerName.toLowerCase()
                    );

                    try {
                        await axios.post(`${API_URL}/api/customers`, {
                            code,
                            name,
                            legalName: getVal(row, 'юр. название', 'legalname', 'юр название'),
                            districtId: district?.code || null,
                            managerId: manager?.code || null
                        }, { headers: { Authorization: `Bearer ${token}` } });
                        imported++;
                    } catch (err) {
                        console.warn('Skip duplicate:', code);
                    }
                }

                alert(`Импортировано ${imported} клиентов`);
                fetchCustomers();
            } catch (err) {
                console.error('Excel import error:', err);
                alert('Ошибка импорта Excel');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const filteredCustomers = useMemo(() => {
        return customers.filter(c => {
            const matchCode = c.code.toLowerCase().includes(filterCode.toLowerCase());
            const matchName = c.name.toLowerCase().includes(filterName.toLowerCase());
            const matchDistrict = (c.district?.name || '').toLowerCase().includes(filterDistrict.toLowerCase());
            const matchManager = (c.manager?.name || '').toLowerCase().includes(filterManager.toLowerCase());
            return matchCode && matchName && matchDistrict && matchManager;
        });
    }, [customers, filterCode, filterName, filterDistrict, filterManager]);

    if (loading) return <div className="p-8 text-center text-slate-500">Загрузка...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900">Клиенты</h1>
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
                    <Button onClick={handleCreate} className="flex items-center gap-2">
                        <Plus size={16} /> Новый клиент
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-900 text-slate-200">
                            <TableRow className="border-b border-slate-700 hover:bg-slate-900">
                                <TableHead className="text-slate-200 font-semibold">Код</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Название</TableHead>
                                <TableHead className="text-slate-400 font-normal">Юр. Название</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Район</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Менеджер</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                            {/* Filter Row */}
                            <TableRow className="bg-slate-800 border-none hover:bg-slate-800">
                                <TableHead className="p-2">
                                    <input
                                        className="w-full bg-slate-700 border-none text-white text-xs rounded px-2 py-1 placeholder-slate-400 focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="Код..."
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
                                <TableHead className="p-2"></TableHead>
                                <TableHead className="p-2">
                                    <input
                                        className="w-full bg-slate-700 border-none text-white text-xs rounded px-2 py-1 placeholder-slate-400 focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="Район..."
                                        value={filterDistrict}
                                        onChange={e => setFilterDistrict(e.target.value)}
                                    />
                                </TableHead>
                                <TableHead className="p-2">
                                    <input
                                        className="w-full bg-slate-700 border-none text-white text-xs rounded px-2 py-1 placeholder-slate-400 focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="Менеджер..."
                                        value={filterManager}
                                        onChange={e => setFilterManager(e.target.value)}
                                    />
                                </TableHead>
                                <TableHead className="p-2"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCustomers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                                        Нет данных
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredCustomers.map((c) => (
                                    <TableRow key={c.code} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                        <TableCell className="font-medium text-slate-700">{c.code}</TableCell>
                                        <TableCell className="font-medium text-slate-900">{c.name}</TableCell>
                                        <TableCell className="text-slate-500 text-xs">{c.legalName || '-'}</TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                                                {c.district?.name || '-'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                {c.manager?.name || '-'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <button
                                                onClick={() => handleEdit(c)}
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
                                {editingCustomer ? 'Редактировать клиента' : 'Новый клиент'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Код</label>
                                <Input
                                    required
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                                    disabled={!!editingCustomer}
                                    className={editingCustomer ? 'bg-slate-100' : ''}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Название</label>
                                <Input
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Юридическое Название</label>
                                <Input
                                    value={formData.legalName}
                                    onChange={e => setFormData({ ...formData, legalName: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Район</label>
                                    <select
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.districtId || ''}
                                        onChange={e => setFormData({ ...formData, districtId: Number(e.target.value) })}
                                    >
                                        <option value="">Не выбран</option>
                                        {districts.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Менеджер</label>
                                    <select
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.managerId || ''}
                                        onChange={e => setFormData({ ...formData, managerId: Number(e.target.value) })}
                                    >
                                        <option value="">Не выбран</option>
                                        {managers.map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-2">
                                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Отмена</Button>
                                <Button type="submit" className="flex items-center gap-2">
                                    <Save size={16} /> Сохранить
                                </Button>
                                {editingCustomer && (
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(editingCustomer.code)}
                                        className="ml-auto text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                                    >
                                        <Trash2 size={16} /> Удалить
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

export default CustomersPage;
