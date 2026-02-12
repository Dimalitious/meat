import { useEffect, useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../config/axios';
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

interface Product {
    id: number;
    code: string;
    name: string;           // Полное название
    altName?: string;       // Альтернативное название
    priceListName?: string; // Название прайс-листа (было shortNameMorning)
    category?: string;
    status: string;
    coefficient?: number;
    lossNorm?: number;
    participatesInProduction?: boolean; // Участие в производстве
    uomId?: number | null;
    uom?: { id: number; name: string } | null;
    countryId?: number | null;
    country?: { id: number; name: string; isActive: boolean } | null;
    subcategoryId?: number | null;
    subcategory?: { id: number; name: string; isActive: boolean } | null;
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
        priceListName: '',
        category: '',
        status: 'active',
        coefficient: 1.0,
        lossNorm: 0.0,
        participatesInProduction: false,
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchProducts();
    }, []);

    const [uoms, setUoms] = useState<{ id: number; name: string; isDefault: boolean }[]>([]);
    const [countries, setCountries] = useState<{ id: number; name: string; isActive: boolean }[]>([]);
    const [subcategories, setSubcategories] = useState<{ id: number; name: string; isActive: boolean }[]>([]);

    useEffect(() => {
        fetchProducts();
        fetchUoms();
        fetchCountries();
        fetchSubcategories();
    }, []);

    const fetchUoms = async () => {
        try {
            const res = await api.get('/api/uom?active=true');
            setUoms(res.data);
        } catch (error) {
            console.error('Failed to fetch UoMs', error);
        }
    };

    const fetchCountries = async () => {
        try {
            const res = await api.get('/api/countries?active=true');
            setCountries(res.data.items);
        } catch (error) {
            console.error('Failed to fetch countries', error);
        }
    };

    const fetchSubcategories = async () => {
        try {
            const res = await api.get('/api/subcategories?active=true');
            setSubcategories(res.data.items);
        } catch (error) {
            console.error('Failed to fetch subcategories', error);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await api.get('/api/products');
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
        // Find default UoM
        const defaultUom = uoms.find(u => u.isDefault);
        setFormData({
            code: '',
            name: '',
            altName: '',
            priceListName: '',
            category: '',
            status: 'active',
            coefficient: 1.0,
            lossNorm: 0.0,
            participatesInProduction: false,
            uomId: defaultUom ? defaultUom.id : undefined,
            countryId: undefined,
            subcategoryId: undefined,
        });
        setIsModalOpen(true);
    };

    // Переключить статус товара (active <-> inactive)
    const handleToggleStatus = async (code: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        const action = currentStatus === 'active' ? 'отключить' : 'активировать';
        if (!confirm(`Вы уверены, что хотите ${action} этот товар?`)) return;
        try {
            await api.put(`/api/products/${code}`, { status: newStatus });
            alert(newStatus === 'inactive' ? 'Товар отключён' : 'Товар активирован');
            setIsModalOpen(false);
            fetchProducts();
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
        if (selectedCodes.size === filteredProducts.length) {
            setSelectedCodes(new Set());
        } else {
            setSelectedCodes(new Set(filteredProducts.map(p => p.code)));
        }
    };

    // Отключить выбранные товары
    const deactivateSelected = async () => {
        if (selectedCodes.size === 0) return;
        if (!confirm(`Отключить ${selectedCodes.size} выбранных товаров?`)) return;

        let deactivatedCount = 0;
        let errorCount = 0;

        for (const code of Array.from(selectedCodes)) {
            try {
                await api.put(`/api/products/${code}`, { status: 'inactive' });
                deactivatedCount++;
            } catch (err: any) {
                console.error('Toggle status error for', code, ':', err.response?.data || err.message);
                errorCount++;
            }
        }

        let message = `Отключено: ${deactivatedCount}.`;
        if (errorCount > 0) message += ` Ошибок: ${errorCount}.`;

        alert(message);
        setSelectedCodes(new Set());
        fetchProducts();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                coefficient: Number(formData.coefficient),
                lossNorm: Number(formData.lossNorm),
                participatesInProduction: Boolean(formData.participatesInProduction),
                uomId: formData.uomId ? Number(formData.uomId) : null,
                countryId: formData.countryId ? Number(formData.countryId) : null,
                subcategoryId: formData.subcategoryId ? Number(formData.subcategoryId) : null,
            };

            if (editingProduct) {
                await api.put(`/api/products/${editingProduct.code}`, payload);
            } else {
                await api.post('/api/products', payload);
            }
            setIsModalOpen(false);
            fetchProducts();
        } catch (err) {
            console.error(err);
            alert('Ошибка при сохранении');
        }
    };

    // Excel import - BATCH VERSION (fast)
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

                // DEBUG: Show parsed headers
                const headers = Object.keys(jsonData[0] as object);
                console.log('Excel Headers:', headers);
                console.log('Total rows:', jsonData.length);

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

                // Collect all products for batch import
                const products: Array<{
                    code: string;
                    name: string;
                    altName?: string;
                    priceListName?: string;
                    category?: string;
                    status?: string;
                    coefficient?: number;
                    lossNorm?: number;
                }> = [];

                let skipped = 0;

                for (let i = 0; i < jsonData.length; i++) {
                    const row = jsonData[i] as any;
                    const rowNum = i + 2;

                    const code = getVal(row, 'код', 'code');
                    const name = getVal(row, 'название', 'полное название', 'name');

                    if (!code || !name) {
                        console.log(`Row ${rowNum}: missing code or name`);
                        skipped++;
                        continue;
                    }

                    products.push({
                        code,
                        name,
                        altName: getVal(row, 'альт. название', 'альтернативное название', 'altname') || undefined,
                        priceListName: getVal(row, 'название прайс-листа', 'прайс-лист', 'прайс', 'pricelistname') || undefined,
                        category: getVal(row, 'категория', 'category') || undefined,
                        // Преобразуем русский статус в английский
                        status: (() => {
                            const s = getVal(row, 'статус', 'status').toLowerCase();
                            if (s === 'активный' || s === 'активен' || s === 'active' || s === '') return 'active';
                            return 'inactive';
                        })(),
                        coefficient: Number(getVal(row, 'коэфф.', 'коэфф', 'coefficient') || 1),
                        lossNorm: Number(getVal(row, 'потери%', 'потери', 'lossnorm') || 0)
                    });
                }

                if (products.length === 0) {
                    alert(`Не найдено записей для импорта.\nПропущено: ${skipped}\n\nКолонки в файле: ${headers.join(', ')}\n\nУбедитесь что есть колонки "Код" и "Полное название" (или "Название")`);
                    return;
                }

                console.log(`Sending batch import for ${products.length} products...`);

                const response = await api.post('/api/products/batch-upsert', { products });

                const result = response.data;
                let message = `✅ Импорт завершён!\n\nДобавлено: ${result.imported}\nОбновлено: ${result.updated}`;
                if (skipped > 0) message += `\nПропущено: ${skipped}`;
                if (result.totalErrors > 0) {
                    message += `\n\nОшибки (${result.totalErrors}):\n${result.errors.join('\n')}`;
                }

                alert(message);
                fetchProducts();
            } catch (err: any) {
                console.error('Excel import error:', err);
                alert('Ошибка импорта Excel: ' + (err.response?.data?.error || err.message));
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
                        <Button onClick={deactivateSelected} variant="outline" className="flex items-center gap-2 text-orange-600 border-orange-300 hover:bg-orange-50">
                            ⏸ Отключить ({selectedCodes.size})
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
                                <TableHead className="text-slate-200 font-semibold">Полное название</TableHead>
                                <TableHead className="text-slate-400 font-normal">Альт. название</TableHead>
                                <TableHead className="text-slate-400 font-normal">Название прайс-листа</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Категория</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Страна</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Подкатегория</TableHead>
                                <TableHead className="text-slate-200 font-semibold" title="Единица измерения">Ед.</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Статус</TableHead>
                                <TableHead className="text-slate-200 font-semibold text-center" title="Участие в производстве">Пр-во</TableHead>
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
                                <TableHead colSpan={2}></TableHead>
                                <TableHead className="p-2">
                                    <input
                                        className="w-full bg-slate-700 border-none text-white text-xs rounded px-2 py-1 placeholder-slate-400 focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="Кат..."
                                        value={filterCategory}
                                        onChange={e => setFilterCategory(e.target.value)}
                                    />
                                </TableHead>
                                <TableHead colSpan={8}></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredProducts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={14} className="h-24 text-center text-slate-500">
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
                                        <TableCell className="text-slate-500 text-xs">{p.priceListName || '-'}</TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                                                {p.category || '-'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-600">{p.country?.name || '-'}</TableCell>
                                        <TableCell className="text-xs text-slate-600">{p.subcategory?.name || '-'}</TableCell>
                                        <TableCell className="text-xs text-slate-600">
                                            {p.uom?.name || '-'}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {p.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {p.participatesInProduction ? (
                                                <span className="inline-block w-4 h-4 bg-green-500 rounded text-white text-xs font-bold leading-4">✓</span>
                                            ) : (
                                                <span className="inline-block w-4 h-4 bg-slate-200 rounded"></span>
                                            )}
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
                                        disabled={!!editingProduct}
                                        className={editingProduct ? 'bg-slate-100' : ''}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Полное название</label>
                                    <Input
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Альтернативное название</label>
                                    <Input
                                        value={formData.altName || ''}
                                        onChange={e => setFormData({ ...formData, altName: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Название прайс-листа</label>
                                    <Input
                                        value={formData.priceListName || ''}
                                        onChange={e => setFormData({ ...formData, priceListName: e.target.value })}
                                        placeholder="Основной, Опт, Розница..."
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
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Статус</label>
                                    <select
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="active">Активен</option>
                                        <option value="inactive">Неактивен</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Единица измерения</label>
                                    <select
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.uomId || ''}
                                        onChange={e => setFormData({ ...formData, uomId: Number(e.target.value) || undefined })}
                                    >
                                        <option value="">Не выбрано</option>
                                        {uoms.map(u => (
                                            <option key={u.id} value={u.id}>
                                                {u.name} {u.isDefault ? '(по умолч.)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Страна *</label>
                                    <select
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.countryId || ''}
                                        onChange={e => setFormData({ ...formData, countryId: Number(e.target.value) || undefined })}
                                        required
                                    >
                                        <option value="">Выберите страну</option>
                                        {countries.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Подкатегория *</label>
                                    <select
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.subcategoryId || ''}
                                        onChange={e => setFormData({ ...formData, subcategoryId: Number(e.target.value) || undefined })}
                                        required
                                    >
                                        <option value="">Выберите подкатегорию</option>
                                        {subcategories.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 pt-4">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Параметры</h3>
                                <div className="grid grid-cols-2 gap-4">
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
                                <div className="mt-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.participatesInProduction || false}
                                            onChange={e => setFormData({ ...formData, participatesInProduction: e.target.checked })}
                                            className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                                        />
                                        <span className="text-sm font-medium text-slate-700">Участие в производстве</span>
                                        <span className="text-xs text-slate-400">(загружается в производство при закупе)</span>
                                    </label>
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
                                        onClick={() => handleToggleStatus(editingProduct.code, editingProduct.status)}
                                        className={`ml-auto text-sm font-medium flex items-center gap-1 ${editingProduct.status === 'active' ? 'text-orange-500 hover:text-orange-700' : 'text-green-500 hover:text-green-700'}`}
                                    >
                                        {editingProduct.status === 'active' ? '⏸ Отключить' : '▶ Активировать'}
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
