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

interface Product {
    id: number;
    code: string;
    name: string;
    altName?: string;
    shortNameFsa?: string;
    shortNamePl?: string;
    shortNameMorning?: string;
    priceMorning?: number;
    category?: string;
    status: string;
    coefficient?: number;
    lossNorm?: number;
}

const ProductsPage = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const [filterCode, setFilterCode] = useState('');
    const [filterName, setFilterName] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

    const [formData, setFormData] = useState<Partial<Product>>({
        code: '',
        name: '',
        altName: '',
        shortNameFsa: '',
        shortNamePl: '',
        shortNameMorning: '',
        priceMorning: 0,
        category: '',
        status: 'active',
        coefficient: 1.0,
        lossNorm: 0.0,
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/products`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProducts(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setFormData({ ...product });
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingProduct(null);
        setFormData({
            code: '',
            name: '',
            altName: '',
            shortNameFsa: '',
            shortNamePl: '',
            shortNameMorning: '',
            priceMorning: 0,
            category: '',
            status: 'active',
            coefficient: 1.0,
            lossNorm: 0.0,
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (code: string) => {
        if (!confirm('Вы уверены, что хотите удалить этот товар?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/api/products/${code}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchProducts();
        } catch (err) {
            alert('Не удалось удалить товар');
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
        if (selectedCodes.size === filteredProducts.length) {
            setSelectedCodes(new Set());
        } else {
            setSelectedCodes(new Set(filteredProducts.map(p => p.code)));
        }
    };

    const deleteSelected = async () => {
        if (selectedCodes.size === 0) return;
        if (!confirm(`Удалить ${selectedCodes.size} выбранных товаров?`)) return;

        try {
            const token = localStorage.getItem('token');
            await Promise.all(
                Array.from(selectedCodes).map(code =>
                    axios.delete(`${API_URL}/api/products/${code}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                )
            );
            setSelectedCodes(new Set());
            fetchProducts();
        } catch (err) {
            alert('Ошибка при удалении');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            // Ensure numeric values are numbers
            const payload = {
                ...formData,
                priceMorning: Number(formData.priceMorning),
                coefficient: Number(formData.coefficient),
                lossNorm: Number(formData.lossNorm)
            };

            if (editingProduct) {
                await axios.put(`${API_URL}/api/products/${editingProduct.code}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(`${API_URL}/api/products`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            setIsModalOpen(false);
            fetchProducts();
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
                        const found = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
                        if (found && row[found]) return row[found];
                    }
                    return '';
                };

                for (const row of jsonData as any[]) {
                    const code = getVal(row, 'код', 'code');
                    const name = getVal(row, 'название', 'name');
                    if (!code || !name) continue;

                    try {
                        await axios.post(`${API_URL}/api/products`, {
                            code,
                            name,
                            altName: getVal(row, 'альт. название', 'altname', 'альт название'),
                            shortNameFsa: getVal(row, 'фса', 'shortnamefsa'),
                            shortNamePl: getVal(row, 'пл', 'shortnamepl'),
                            shortNameMorning: getVal(row, 'утро', 'shortnamemorning'),
                            priceMorning: Number(getVal(row, 'прайс утро', 'pricemorning', 'цена') || 0),
                            category: getVal(row, 'категория', 'category'),
                            status: getVal(row, 'статус', 'status') || 'active',
                            coefficient: Number(getVal(row, 'коэфф.', 'коэфф', 'coefficient') || 1),
                            lossNorm: Number(getVal(row, 'потери%', 'потери', 'lossnorm') || 0)
                        }, { headers: { Authorization: `Bearer ${token}` } });
                        imported++;
                    } catch (err) {
                        console.warn('Skip duplicate:', code);
                    }
                }

                alert(`Импортировано ${imported} товаров`);
                fetchProducts();
            } catch (err) {
                console.error('Excel import error:', err);
                alert('Ошибка импорта Excel');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchCode = p.code.toLowerCase().includes(filterCode.toLowerCase());
            const matchName = p.name.toLowerCase().includes(filterName.toLowerCase());
            const matchCategory = (p.category || '').toLowerCase().includes(filterCategory.toLowerCase());
            return matchCode && matchName && matchCategory;
        });
    }, [products, filterCode, filterName, filterCategory]);

    if (loading) return <div className="p-8 text-center text-slate-500">Загрузка...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900">Товары</h1>
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
                        <Button onClick={deleteSelected} variant="outline" className="flex items-center gap-2 text-red-600 border-red-300 hover:bg-red-50">
                            <Trash2 size={16} /> Удалить ({selectedCodes.size})
                        </Button>
                    )}
                    <Button onClick={handleCreate} className="flex items-center gap-2">
                        <Plus size={16} /> Новый товар
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
                                        checked={selectedCodes.size === filteredProducts.length && filteredProducts.length > 0}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4"
                                    />
                                </TableHead>
                                <TableHead className="text-slate-200 font-semibold">Код</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Название</TableHead>
                                <TableHead className="text-slate-400 font-normal">Альт.</TableHead>
                                <TableHead className="text-slate-400 font-normal">ФСА</TableHead>
                                <TableHead className="text-slate-400 font-normal">ПЛ</TableHead>
                                <TableHead className="text-slate-400 font-normal">Утро</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Прайс Утро</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Категория</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Статус</TableHead>
                                <TableHead className="text-slate-400 font-normal">Коэфф.</TableHead>
                                <TableHead className="text-slate-400 font-normal">Потери%</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                            {/* Filter Row */}
                            <TableRow className="bg-slate-800 border-none hover:bg-slate-800">
                                <TableHead></TableHead>
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
                                <TableHead colSpan={5}></TableHead>
                                <TableHead className="p-2">
                                    <input
                                        className="w-full bg-slate-700 border-none text-white text-xs rounded px-2 py-1 placeholder-slate-400 focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="Кат..."
                                        value={filterCategory}
                                        onChange={e => setFilterCategory(e.target.value)}
                                    />
                                </TableHead>
                                <TableHead colSpan={4}></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredProducts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={12} className="h-24 text-center text-slate-500">
                                        Нет данных
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredProducts.map((p) => (
                                    <TableRow key={p.code} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                        <TableCell>
                                            <input
                                                type="checkbox"
                                                checked={selectedCodes.has(p.code)}
                                                onChange={() => toggleSelect(p.code)}
                                                className="w-4 h-4"
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium text-slate-700">{p.code}</TableCell>
                                        <TableCell className="font-medium text-slate-900">{p.name}</TableCell>
                                        <TableCell className="text-slate-500 text-xs">{p.altName || '-'}</TableCell>
                                        <TableCell className="text-slate-500 text-xs">{p.shortNameFsa || '-'}</TableCell>
                                        <TableCell className="text-slate-500 text-xs">{p.shortNamePl || '-'}</TableCell>
                                        <TableCell className="text-slate-500 text-xs">{p.shortNameMorning || '-'}</TableCell>
                                        <TableCell className="font-medium">{p.priceMorning?.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                                                {p.category}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {p.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-slate-600 text-xs">{p.coefficient}</TableCell>
                                        <TableCell className="text-slate-600 text-xs">{p.lossNorm}%</TableCell>
                                        <TableCell>
                                            <button
                                                onClick={() => handleEdit(p)}
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
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800">
                                {editingProduct ? 'Редактировать товар' : 'Новый товар'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Код</label>
                                    <Input
                                        required
                                        value={formData.code}
                                        onChange={e => setFormData({ ...formData, code: e.target.value })}
                                        disabled={!!editingProduct} // Cannot change code on edit
                                        className={editingProduct ? 'bg-slate-100' : ''}
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
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Категория</label>
                                    <Input
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Статус (active/inactive)</label>
                                    <select
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 pt-4">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Детали</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Цена (Утро)</label>
                                        <Input
                                            type="number"
                                            value={formData.priceMorning}
                                            onChange={e => setFormData({ ...formData, priceMorning: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Коэффициент</label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={formData.coefficient}
                                            onChange={e => setFormData({ ...formData, coefficient: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Потери (%)</label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            value={formData.lossNorm}
                                            onChange={e => setFormData({ ...formData, lossNorm: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 pt-4">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Альтернативные названия (для парсинга)</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Альт. название</label>
                                        <Input
                                            value={formData.altName || ''}
                                            onChange={e => setFormData({ ...formData, altName: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Сокр. ФСА</label>
                                        <Input
                                            value={formData.shortNameFsa || ''}
                                            onChange={e => setFormData({ ...formData, shortNameFsa: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Сокр. ПЛ</label>
                                        <Input
                                            value={formData.shortNamePl || ''}
                                            onChange={e => setFormData({ ...formData, shortNamePl: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Сокр. Утро</label>
                                        <Input
                                            value={formData.shortNameMorning || ''}
                                            onChange={e => setFormData({ ...formData, shortNameMorning: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-2">
                                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Отмена</Button>
                                <Button type="submit" className="flex items-center gap-2">
                                    <Save size={16} /> Сохранить
                                </Button>
                                {editingProduct && (
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(editingProduct.code)}
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

export default ProductsPage;
