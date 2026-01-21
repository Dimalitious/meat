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
import { Plus, X, Save, Settings } from 'lucide-react';

interface Mml {
    id: number;
    productId: number;
    product: {
        id: number;
        name: string;
        code: string;
    };
}

interface Supplier {
    id: number;
    code: string;
    name: string;
    legalName?: string;
    altName?: string;
    phone?: string;
    telegram?: string;
    isActive: boolean;
    primaryMmlId?: number | null;
    primaryMml?: Mml | null;
}

const SuppliersPage = () => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

    // MML list for dropdown
    const [mmlList, setMmlList] = useState<Mml[]>([]);

    // Filters
    const [filterCode, setFilterCode] = useState('');
    const [filterName, setFilterName] = useState('');
    const [filterPhone, setFilterPhone] = useState('');

    // Selection
    const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

    // Form data
    const [formData, setFormData] = useState<Partial<Supplier> & { primaryMmlId?: number | null }>({
        code: '',
        name: '',
        legalName: '',
        altName: '',
        phone: '',
        telegram: '',
        primaryMmlId: null,
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchSuppliers();
        fetchMmlList();
    }, []);

    const fetchSuppliers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/suppliers`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSuppliers(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMmlList = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/production-v2/mml`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMmlList(res.data);
        } catch (err) {
            console.error('Failed to fetch MML list:', err);
        }
    };

    const handleEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setFormData({
            code: supplier.code,
            name: supplier.name,
            legalName: supplier.legalName || '',
            altName: supplier.altName || '',
            phone: supplier.phone || '',
            telegram: supplier.telegram || '',
            primaryMmlId: supplier.primaryMmlId || null,
        });
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingSupplier(null);
        setFormData({
            code: '',
            name: '',
            legalName: '',
            altName: '',
            phone: '',
            telegram: '',
            primaryMmlId: null,
        });
        setIsModalOpen(true);
    };

    // Переключить статус поставщика
    const handleToggleStatus = async (code: string, currentStatus: boolean) => {
        const action = currentStatus ? 'отключить' : 'активировать';
        if (!confirm(`Вы уверены, что хотите ${action} этого поставщика?`)) return;
        try {
            const token = localStorage.getItem('token');
            const res = await axios.put(`${API_URL}/api/suppliers/toggle/${code}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(res.data.message);
            setIsModalOpen(false);
            fetchSuppliers();
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
        if (selectedCodes.size === filteredSuppliers.length) {
            setSelectedCodes(new Set());
        } else {
            setSelectedCodes(new Set(filteredSuppliers.map(s => s.code)));
        }
    };

    // Отключить выбранных поставщиков
    const deactivateSelected = async () => {
        if (selectedCodes.size === 0) return;
        if (!confirm(`Отключить ${selectedCodes.size} выбранных поставщиков?`)) return;

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/api/suppliers/deactivate`, {
                codes: Array.from(selectedCodes)
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert(res.data.message);
            setSelectedCodes(new Set());
            fetchSuppliers();
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
                legalName: formData.legalName || null,
                altName: formData.altName || null,
                phone: formData.phone || null,
                telegram: formData.telegram || null,
                primaryMmlId: formData.primaryMmlId || null,
            };

            if (editingSupplier) {
                await axios.put(`${API_URL}/api/suppliers/${editingSupplier.code}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(`${API_URL}/api/suppliers`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            setIsModalOpen(false);
            fetchSuppliers();
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

                // Refresh suppliers list before import
                const token = localStorage.getItem('token');
                let currentSuppliers: Supplier[] = [];
                try {
                    const res = await axios.get(`${API_URL}/api/suppliers`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    currentSuppliers = res.data;
                } catch (err) {
                    console.error('Failed to fetch current suppliers:', err);
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

                console.log('Excel data:', jsonData);
                console.log('First row keys:', jsonData.length > 0 ? Object.keys(jsonData[0] as object) : 'no data');

                for (let i = 0; i < jsonData.length; i++) {
                    const row = jsonData[i] as any;
                    const rowNum = i + 2; // Excel row number (header is row 1)

                    const code = getVal(row, 'id поставщика', 'код', 'code', 'id');
                    const name = getVal(row, 'название поставщика', 'название', 'name');

                    if (!code) {
                        errors.push(`Строка ${rowNum}: отсутствует ID поставщика`);
                        continue;
                    }
                    if (!name) {
                        errors.push(`Строка ${rowNum}: отсутствует название поставщика`);
                        continue;
                    }

                    const payload = {
                        code,
                        name,
                        legalName: getVal(row, 'юридическое название поставщика', 'юр. название', 'legalname', 'юр название') || null,
                        altName: getVal(row, 'альтернативное название поставщика', 'альт. название', 'altname', 'альт название') || null,
                        phone: getVal(row, 'телефон поставщика', 'телефон', 'phone') || null,
                        telegram: getVal(row, 'telegram поставщика', 'telegram', 'телеграм') || null,
                    };

                    try {
                        // Check if exists using refreshed list
                        const existing = currentSuppliers.find(s => s.code === code);
                        if (existing) {
                            await axios.put(`${API_URL}/api/suppliers/${code}`, payload, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            updated++;
                        } else {
                            await axios.post(`${API_URL}/api/suppliers`, payload, {
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
                fetchSuppliers();
            } catch (err) {
                console.error('Excel import error:', err);
                alert('Ошибка импорта Excel');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const filteredSuppliers = useMemo(() => {
        return suppliers.filter(s => {
            const matchCode = s.code.toLowerCase().includes(filterCode.toLowerCase());
            const matchName = s.name.toLowerCase().includes(filterName.toLowerCase());
            const matchPhone = (s.phone || '').toLowerCase().includes(filterPhone.toLowerCase());
            return matchCode && matchName && matchPhone;
        });
    }, [suppliers, filterCode, filterName, filterPhone]);

    if (loading) return <div className="p-8 text-center text-slate-500">Загрузка...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900">Поставщики</h1>
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
                        <Plus size={16} /> Добавить поставщика
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
                                        checked={selectedCodes.size === filteredSuppliers.length && filteredSuppliers.length > 0}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4"
                                    />
                                </TableHead>
                                <TableHead className="text-slate-200 font-semibold">ID</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Название</TableHead>
                                <TableHead className="text-slate-400 font-normal">Юр. Название</TableHead>
                                <TableHead className="text-slate-400 font-normal">Альт. Название</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Телефон</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Telegram</TableHead>
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
                                <TableHead colSpan={2}></TableHead>
                                <TableHead className="p-2">
                                    <input
                                        className="w-full bg-slate-700 border-none text-white text-xs rounded px-2 py-1 placeholder-slate-400 focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="Телефон..."
                                        value={filterPhone}
                                        onChange={e => setFilterPhone(e.target.value)}
                                    />
                                </TableHead>
                                <TableHead colSpan={3}></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSuppliers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center text-slate-500">
                                        Нет данных
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredSuppliers.map((s) => (
                                    <TableRow
                                        key={s.code}
                                        className={`hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 ${!s.isActive ? 'opacity-50 bg-slate-50' : ''}`}
                                    >
                                        <TableCell>
                                            <input
                                                type="checkbox"
                                                checked={selectedCodes.has(s.code)}
                                                onChange={() => toggleSelect(s.code)}
                                                className="w-4 h-4"
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium text-slate-700">{s.code}</TableCell>
                                        <TableCell className="font-medium text-slate-900">{s.name}</TableCell>
                                        <TableCell className="text-slate-500 text-xs">{s.legalName || '-'}</TableCell>
                                        <TableCell className="text-slate-500 text-xs">{s.altName || '-'}</TableCell>
                                        <TableCell className="text-slate-600">{s.phone || '-'}</TableCell>
                                        <TableCell className="text-slate-600">{s.telegram || '-'}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${s.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {s.isActive ? 'Активен' : 'Отключён'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <button
                                                onClick={() => handleEdit(s)}
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
                                {editingSupplier ? 'Редактировать поставщика' : 'Новый поставщик'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">ID поставщика</label>
                                <Input
                                    required
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                                    disabled={!!editingSupplier}
                                    className={editingSupplier ? 'bg-slate-100' : ''}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Название поставщика *</label>
                                <Input
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Юридическое название</label>
                                <Input
                                    value={formData.legalName}
                                    onChange={e => setFormData({ ...formData, legalName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Альтернативное название</label>
                                <Input
                                    value={formData.altName}
                                    onChange={e => setFormData({ ...formData, altName: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Телефон</label>
                                    <Input
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+7 (___) ___-__-__"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Telegram</label>
                                    <Input
                                        value={formData.telegram}
                                        onChange={e => setFormData({ ...formData, telegram: e.target.value })}
                                        placeholder="@username"
                                    />
                                </div>
                            </div>

                            {/* Первичный MML */}
                            <div className="border-t border-slate-100 pt-4 mt-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Первичный MML (калькуляция)
                                </label>
                                <select
                                    value={formData.primaryMmlId || ''}
                                    onChange={e => setFormData({
                                        ...formData,
                                        primaryMmlId: e.target.value ? Number(e.target.value) : null
                                    })}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">— Не назначен —</option>
                                    {mmlList.map(mml => (
                                        <option key={mml.id} value={mml.id}>
                                            {mml.product.name} ({mml.product.code})
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">
                                    MML фиксируется в закупочном прайсе на момент создания
                                </p>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-2">
                                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Отмена</Button>
                                <Button type="submit" className="flex items-center gap-2">
                                    <Save size={16} /> Сохранить
                                </Button>
                                {editingSupplier && (
                                    <button
                                        type="button"
                                        onClick={() => handleToggleStatus(editingSupplier.code, editingSupplier.isActive)}
                                        className={`ml-auto text-sm font-medium flex items-center gap-1 ${editingSupplier.isActive ? 'text-orange-500 hover:text-orange-700' : 'text-green-500 hover:text-green-700'}`}
                                    >
                                        {editingSupplier.isActive ? '⏸ Отключить' : '▶ Активировать'}
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

export default SuppliersPage;
