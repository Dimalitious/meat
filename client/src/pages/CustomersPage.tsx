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
import { Plus, X, Save, Settings, FileText, Trash2, Upload, Image } from 'lucide-react';

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
    inn?: string;  // ИНН (до 9 символов)
    telegramGroupName?: string;  // Название группы ТГ
    telegramGroupUsername?: string;  // Никнейм группы (@username)
    districtId?: number;
    managerId?: number;
    district?: District;
    manager?: Manager;
}

interface Product {
    id: number;
    code: string;
    name: string;
    category?: string;
}

interface CardItemPhoto {
    id: number;
    url: string;
    sortOrder: number;
}

interface CardItem {
    id: number;
    productId: number;
    product: Product;
    description: string | null;
    sortOrder: number;
    photos: CardItemPhoto[];
}

interface CustomerCard {
    id: number;
    customerId: number;
    name: string;
    isActive: boolean;
    items: CardItem[];
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
        inn: '',
        telegramGroupName: '',
        telegramGroupUsername: '',
        districtId: undefined,
        managerId: undefined
    });

    // Filters
    const [filterCode, setFilterCode] = useState('');
    const [filterName, setFilterName] = useState('');
    const [filterDistrict, setFilterDistrict] = useState('');
    const [filterManager, setFilterManager] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Customer Card Modal state
    const [isCardModalOpen, setIsCardModalOpen] = useState(false);
    const [selectedCustomerForCard, setSelectedCustomerForCard] = useState<Customer | null>(null);
    const [customerCard, setCustomerCard] = useState<CustomerCard | null>(null);
    const [cardLoading, setCardLoading] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [showProductPicker, setShowProductPicker] = useState(false);

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
            inn: customer.inn || '',
            telegramGroupName: customer.telegramGroupName || '',
            telegramGroupUsername: customer.telegramGroupUsername || '',
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
            inn: '',
            telegramGroupName: '',
            telegramGroupUsername: '',
            districtId: undefined,
            managerId: undefined
        });
        setIsModalOpen(true);
    };

    // Клиенты не удаляются - только редактируются

    // === CUSTOMER CARD FUNCTIONS ===
    const fetchProducts = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/products`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProducts(res.data);
        } catch (err) { console.error(err); }
    };

    const openCardModal = async (customer: Customer) => {
        setSelectedCustomerForCard(customer);
        setIsCardModalOpen(true);
        setCardLoading(true);
        setProductSearch('');

        // Загружаем справочник товаров если ещё не загружен
        if (products.length === 0) {
            await fetchProducts();
        }

        try {
            const token = localStorage.getItem('token');
            // Пробуем получить существующую карточку
            const res = await axios.get(`${API_URL}/api/customer-cards/customer/${customer.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.length > 0) {
                setCustomerCard(res.data[0]); // Берём первую карточку
            } else {
                // Создаём новую карточку
                const createRes = await axios.post(`${API_URL}/api/customer-cards`, {
                    customerId: customer.id,
                    name: 'Основной ассортимент'
                }, { headers: { Authorization: `Bearer ${token}` } });
                setCustomerCard(createRes.data);
            }
        } catch (err) {
            console.error('Failed to load customer card:', err);
        } finally {
            setCardLoading(false);
        }
    };

    const addCardItem = async (productId: number) => {
        if (!customerCard) return;
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/api/customer-cards/${customerCard.id}/items`, {
                productId,
                description: '',
                sortOrder: customerCard.items.length
            }, { headers: { Authorization: `Bearer ${token}` } });

            setCustomerCard({
                ...customerCard,
                items: [...customerCard.items, res.data]
            });
            setShowProductPicker(false);
            setProductSearch('');
        } catch (err) {
            console.error('Failed to add card item:', err);
        }
    };

    const updateCardItemDescription = async (itemId: number, description: string) => {
        if (!customerCard) return;
        try {
            const token = localStorage.getItem('token');
            await axios.patch(`${API_URL}/api/customer-cards/items/${itemId}`, {
                description
            }, { headers: { Authorization: `Bearer ${token}` } });

            setCustomerCard({
                ...customerCard,
                items: customerCard.items.map(item =>
                    item.id === itemId ? { ...item, description } : item
                )
            });
        } catch (err) {
            console.error('Failed to update card item:', err);
        }
    };

    const deleteCardItem = async (itemId: number) => {
        if (!customerCard) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/api/customer-cards/items/${itemId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setCustomerCard({
                ...customerCard,
                items: customerCard.items.filter(item => item.id !== itemId)
            });
        } catch (err) {
            console.error('Failed to delete card item:', err);
        }
    };

    const addItemPhoto = async (itemId: number, url: string) => {
        if (!customerCard) return;
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/api/customer-cards/items/${itemId}/photos`, {
                url
            }, { headers: { Authorization: `Bearer ${token}` } });

            setCustomerCard({
                ...customerCard,
                items: customerCard.items.map(item =>
                    item.id === itemId
                        ? { ...item, photos: [...item.photos, res.data] }
                        : item
                )
            });
        } catch (err) {
            console.error('Failed to add photo:', err);
        }
    };

    const deleteItemPhoto = async (itemId: number, photoId: number) => {
        if (!customerCard) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/api/customer-cards/photos/${photoId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setCustomerCard({
                ...customerCard,
                items: customerCard.items.map(item =>
                    item.id === itemId
                        ? { ...item, photos: item.photos.filter(p => p.id !== photoId) }
                        : item
                )
            });
        } catch (err) {
            console.error('Failed to delete photo:', err);
        }
    };

    // Фильтр товаров для добавления (исключаем уже добавленные)
    const filteredProducts = useMemo(() => {
        if (!customerCard) return [];
        const addedProductIds = new Set(customerCard.items.map(item => item.productId));
        return products
            .filter(p => !addedProductIds.has(p.id))
            .filter(p =>
                p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                p.code.toLowerCase().includes(productSearch.toLowerCase())
            )
            .slice(0, 20);
    }, [products, customerCard, productSearch]);
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
                console.log('First row keys:', jsonData.length > 0 ? Object.keys(jsonData[0] as object) : 'no data');

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
                                <TableHead className="text-slate-200 font-semibold">ИНН</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Группа ТГ</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Район</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Менеджер</TableHead>
                                <TableHead className="w-[100px]">Действия</TableHead>
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
                                <TableHead className="p-2"></TableHead>
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
                                <TableHead className="p-2"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCustomers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center text-slate-500">
                                        Нет данных
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredCustomers.map((c) => (
                                    <TableRow key={c.code} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                        <TableCell className="font-medium text-slate-700">{c.code}</TableCell>
                                        <TableCell className="font-medium text-slate-900">{c.name}</TableCell>
                                        <TableCell className="text-slate-500 text-xs">{c.legalName || '-'}</TableCell>
                                        <TableCell className="text-slate-600 text-sm font-mono">{c.inn || '-'}</TableCell>
                                        <TableCell className="text-xs">
                                            {c.telegramGroupName ? (
                                                <div>
                                                    <div className="font-medium text-slate-700">{c.telegramGroupName}</div>
                                                    {c.telegramGroupUsername && <div className="text-slate-400">@{c.telegramGroupUsername}</div>}
                                                </div>
                                            ) : '-'}
                                        </TableCell>
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
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleEdit(c)}
                                                    className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                                    title="Редактировать"
                                                >
                                                    <Settings size={16} />
                                                </button>
                                                <button
                                                    onClick={() => openCardModal(c)}
                                                    className="p-1 text-slate-400 hover:text-green-600 transition-colors"
                                                    title="Карточка клиента"
                                                >
                                                    <FileText size={16} />
                                                </button>
                                            </div>
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
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">ИНН (до 9 символов)</label>
                                <Input
                                    value={formData.inn}
                                    onChange={e => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 9);
                                        setFormData({ ...formData, inn: val });
                                    }}
                                    placeholder="123456789"
                                    maxLength={9}
                                    className="font-mono"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Группа ТГ (название)</label>
                                    <Input
                                        value={formData.telegramGroupName}
                                        onChange={e => setFormData({ ...formData, telegramGroupName: e.target.value })}
                                        placeholder="Название группы"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Группа ТГ (никнейм)</label>
                                    <Input
                                        value={formData.telegramGroupUsername}
                                        onChange={e => setFormData({ ...formData, telegramGroupUsername: e.target.value })}
                                        placeholder="@username"
                                    />
                                </div>
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
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Customer Card Modal */}
            {isCardModalOpen && selectedCustomerForCard && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-green-50 to-emerald-50">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">
                                    Карточка клиента: {selectedCustomerForCard.name}
                                </h2>
                                {selectedCustomerForCard.inn && (
                                    <div className="text-sm text-slate-500">ИНН: {selectedCustomerForCard.inn}</div>
                                )}
                            </div>
                            <button onClick={() => { setIsCardModalOpen(false); setCustomerCard(null); }} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-auto p-6">
                            {cardLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full"></div>
                                    <span className="ml-3 text-slate-500">Загрузка...</span>
                                </div>
                            ) : customerCard ? (
                                <div className="space-y-4">
                                    {/* Add Product Button */}
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-semibold text-slate-700">Позиции ({customerCard.items.length})</h3>
                                        <Button
                                            size="sm"
                                            onClick={() => setShowProductPicker(true)}
                                            className="bg-green-600 hover:bg-green-700"
                                        >
                                            <Plus size={14} className="mr-1" /> Добавить товар
                                        </Button>
                                    </div>

                                    {/* Product Picker Dropdown */}
                                    {showProductPicker && (
                                        <div className="border rounded-lg p-4 bg-slate-50">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Input
                                                    placeholder="Поиск товара..."
                                                    value={productSearch}
                                                    onChange={e => setProductSearch(e.target.value)}
                                                    className="flex-1"
                                                    autoFocus
                                                />
                                                <button onClick={() => setShowProductPicker(false)} className="text-slate-400 hover:text-slate-600">
                                                    <X size={20} />
                                                </button>
                                            </div>
                                            <div className="max-h-48 overflow-auto">
                                                {filteredProducts.length === 0 ? (
                                                    <div className="text-center py-4 text-slate-400">Нет товаров</div>
                                                ) : (
                                                    filteredProducts.map(product => (
                                                        <div
                                                            key={product.id}
                                                            onClick={() => addCardItem(product.id)}
                                                            className="px-3 py-2 hover:bg-white rounded cursor-pointer flex items-center gap-2"
                                                        >
                                                            <span className="text-xs text-slate-400">{product.code}</span>
                                                            <span className="font-medium">{product.name}</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Items List */}
                                    {customerCard.items.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400">
                                            <Image size={48} className="mx-auto mb-4 text-slate-300" />
                                            <p>Нет позиций в карточке</p>
                                            <p className="text-sm">Добавьте товары из справочника</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {customerCard.items.map(item => (
                                                <div key={item.id} className="border rounded-lg p-4 bg-white shadow-sm">
                                                    {/* Title row */}
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div>
                                                            <span className="text-xs text-slate-400 mr-2">{item.product.code}</span>
                                                            <span className="font-semibold text-lg text-slate-800">{item.product.name}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => deleteCardItem(item.id)}
                                                            className="text-red-400 hover:text-red-600"
                                                            title="Удалить позицию"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>

                                                    {/* Photos row */}
                                                    <div className="flex gap-3 mb-4">
                                                        {[0, 1, 2].map(idx => {
                                                            const photo = item.photos[idx];
                                                            return (
                                                                <div key={idx} className="w-64 h-64 border-2 border-dashed rounded-lg flex items-center justify-center bg-slate-50 relative group">
                                                                    {photo ? (
                                                                        <>
                                                                            <img src={photo.url} alt="" className="w-full h-full object-cover rounded-lg" />
                                                                            <button
                                                                                onClick={() => deleteItemPhoto(item.id, photo.id)}
                                                                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                            >
                                                                                <X size={12} />
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <label className="cursor-pointer flex flex-col items-center text-slate-400 hover:text-green-600">
                                                                            <Upload size={32} />
                                                                            <span className="text-sm mt-2">Фото {idx + 1}</span>
                                                                            <input
                                                                                type="file"
                                                                                accept="image/*"
                                                                                className="hidden"
                                                                                onChange={async (e) => {
                                                                                    const file = e.target.files?.[0];
                                                                                    if (!file) return;
                                                                                    const reader = new FileReader();
                                                                                    reader.onload = () => {
                                                                                        addItemPhoto(item.id, reader.result as string);
                                                                                    };
                                                                                    reader.readAsDataURL(file);
                                                                                }}
                                                                            />
                                                                        </label>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Description */}
                                                    <textarea
                                                        className="w-full border rounded px-3 py-2 text-sm resize-none"
                                                        rows={3}
                                                        placeholder="Детальное описание разделки..."
                                                        value={item.description || ''}
                                                        onChange={e => {
                                                            setCustomerCard({
                                                                ...customerCard,
                                                                items: customerCard.items.map(i =>
                                                                    i.id === item.id ? { ...i, description: e.target.value } : i
                                                                )
                                                            });
                                                        }}
                                                        onBlur={e => updateCardItemDescription(item.id, e.target.value)}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-red-500">Ошибка загрузки карточки</div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                            <Button variant="outline" onClick={() => { setIsCardModalOpen(false); setCustomerCard(null); }}>
                                Закрыть
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomersPage;
