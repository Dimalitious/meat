import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import { Edit, Filter, Plus, Globe, Users, EyeOff, Check, RefreshCw, Calendar } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../components/ui/Table";

interface SalesPriceListEntry {
    id: number;
    listType: 'GENERAL' | 'CUSTOMER';
    customerId: number | null;
    title: string | null;
    effectiveDate: string;
    status: string;
    isCurrent: boolean;
    isHidden: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    customer: { id: number; name: string; code: string } | null;
    _count: { items: number };
}

export default function SalesPriceJournalPage() {
    const navigate = useNavigate();
    const [priceLists, setPriceLists] = useState<SalesPriceListEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [hiding, setHiding] = useState(false);

    // Date filters - default: last month
    const today = new Date().toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const [dateFrom, setDateFrom] = useState(monthAgo);
    const [dateTo, setDateTo] = useState(today);
    const [filterType, setFilterType] = useState<'all' | 'GENERAL' | 'CUSTOMER'>('all');

    useEffect(() => {
        fetchPriceLists();
    }, []);

    const fetchPriceLists = async () => {
        setLoading(true);
        setSelectedIds(new Set());
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            if (dateFrom) params.append('dateFrom', dateFrom);
            if (dateTo) params.append('dateTo', dateTo);
            if (filterType !== 'all') params.append('listType', filterType);

            const res = await axios.get(`${API_URL}/api/prices/sales?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPriceLists(res.data);
        } catch (err) {
            console.error('Failed to fetch price lists:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ru-RU');
    };

    const formatDateTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('ru-RU');
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === priceLists.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(priceLists.map(pl => pl.id)));
        }
    };

    const toggleSelect = (id: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleHideSelected = async () => {
        if (selectedIds.size === 0) {
            alert('Выберите прайс-листы для скрытия');
            return;
        }

        if (!window.confirm(`Скрыть ${selectedIds.size} прайс-лист(ов) из журнала?`)) {
            return;
        }

        setHiding(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/prices/sales/hide`,
                { ids: Array.from(selectedIds) },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Refresh the list
            await fetchPriceLists();
            alert(`${selectedIds.size} прайс-лист(ов) скрыто`);
        } catch (err) {
            console.error('Failed to hide price lists:', err);
            alert('Ошибка при скрытии прайс-листов');
        } finally {
            setHiding(false);
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    Журнал продажных прайсов
                </h1>
                <Button onClick={() => navigate('/prices/sales')}>
                    <Plus size={16} className="mr-2" />
                    Добавить прайс-лист
                </Button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4 mb-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <Filter size={18} className="text-gray-500" />
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">С:</label>
                        <div className="relative">
                            <Calendar size={16} className="absolute left-2 top-2.5 text-gray-400" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="border rounded pl-8 pr-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">По:</label>
                        <div className="relative">
                            <Calendar size={16} className="absolute left-2 top-2.5 text-gray-400" />
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="border rounded pl-8 pr-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Тип:</label>
                        <select
                            value={filterType}
                            onChange={e => setFilterType(e.target.value as any)}
                            className="border rounded px-3 py-2 text-sm"
                        >
                            <option value="all">Все</option>
                            <option value="GENERAL">Общие</option>
                            <option value="CUSTOMER">По заказчикам</option>
                        </select>
                    </div>
                    <Button onClick={fetchPriceLists} variant="outline">
                        <RefreshCw size={16} className="mr-2" />
                        Сформировать
                    </Button>
                </div>
            </div>

            {/* Action Bar */}
            <div className="bg-white rounded-lg shadow p-3 mb-4 flex items-center gap-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleHideSelected}
                    disabled={selectedIds.size === 0 || hiding}
                    className={selectedIds.size > 0 ? 'border-orange-300 text-orange-700 hover:bg-orange-50' : ''}
                >
                    <EyeOff size={16} className="mr-2" />
                    Скрыть прайсы {selectedIds.size > 0 && `(${selectedIds.size})`}
                </Button>

                {selectedIds.size > 0 && (
                    <span className="text-sm text-gray-500">
                        Выбрано: {selectedIds.size} из {priceLists.length}
                    </span>
                )}
            </div>

            {/* Table */}
            <div className="rounded-md border border-slate-200 overflow-hidden bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                            <TableHead className="w-[50px]">
                                <button
                                    onClick={toggleSelectAll}
                                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.size === priceLists.length && priceLists.length > 0
                                            ? 'bg-blue-600 border-blue-600 text-white'
                                            : 'border-gray-300 hover:border-gray-400'
                                        }`}
                                >
                                    {selectedIds.size === priceLists.length && priceLists.length > 0 && (
                                        <Check size={14} />
                                    )}
                                </button>
                            </TableHead>
                            <TableHead className="w-[100px]">Тип</TableHead>
                            <TableHead>Заказчик</TableHead>
                            <TableHead>Название</TableHead>
                            <TableHead className="w-[130px]">Дата вступления</TableHead>
                            <TableHead className="w-[80px]">Статус</TableHead>
                            <TableHead className="w-[80px] text-center">Позиций</TableHead>
                            <TableHead className="w-[150px]">Создан</TableHead>
                            <TableHead>Пользователь</TableHead>
                            <TableHead className="text-right w-[120px]">Действие</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center text-slate-500">
                                    <RefreshCw size={20} className="animate-spin inline mr-2" />
                                    Загрузка...
                                </TableCell>
                            </TableRow>
                        ) : priceLists.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center text-slate-500">
                                    Нет записей за выбранный период
                                </TableCell>
                            </TableRow>
                        ) : (
                            priceLists.map(pl => (
                                <TableRow
                                    key={pl.id}
                                    className={selectedIds.has(pl.id) ? 'bg-blue-50' : ''}
                                >
                                    <TableCell>
                                        <button
                                            onClick={() => toggleSelect(pl.id)}
                                            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.has(pl.id)
                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                    : 'border-gray-300 hover:border-gray-400'
                                                }`}
                                        >
                                            {selectedIds.has(pl.id) && <Check size={14} />}
                                        </button>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${pl.listType === 'GENERAL'
                                            ? 'bg-purple-100 text-purple-800'
                                            : 'bg-blue-100 text-blue-800'
                                            }`}>
                                            {pl.listType === 'GENERAL'
                                                ? <><Globe size={12} /> Общий</>
                                                : <><Users size={12} /> Заказчик</>}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {pl.customer ? (
                                            <>
                                                <div className="font-medium">{pl.customer.name}</div>
                                                <div className="text-xs text-gray-500">{pl.customer.code}</div>
                                            </>
                                        ) : (
                                            <span className="text-gray-400">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {pl.title || '-'}
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-medium text-sm">
                                            {formatDate(pl.effectiveDate)}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${pl.isCurrent ? 'bg-green-100 text-green-800' :
                                            pl.status === 'saved' ? 'bg-blue-100 text-blue-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {pl.isCurrent ? 'Текущий' :
                                                pl.status === 'saved' ? 'Сохранён' : 'Черновик'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {pl._count.items}
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-500">
                                        {formatDateTime(pl.createdAt)}
                                    </TableCell>
                                    <TableCell>
                                        {pl.createdBy}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => navigate(`/prices/sales?id=${pl.id}`)}
                                        >
                                            <Edit size={14} className="mr-1" />
                                            Редактировать
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Footer info */}
            {priceLists.length > 0 && (
                <div className="mt-4 text-sm text-gray-500 text-right">
                    Всего записей: {priceLists.length}
                </div>
            )}
        </div>
    );
}
