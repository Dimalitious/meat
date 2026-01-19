import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import { Edit, Filter, Plus } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../components/ui/Table";

interface PurchasePriceListEntry {
    id: number;
    supplierId: number;
    title: string | null;
    status: string;
    isCurrent: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    supplier: { id: number; name: string; code: string };
    _count: { items: number };
}

export default function PurchasePriceJournalPage() {
    const navigate = useNavigate();
    const [priceLists, setPriceLists] = useState<PurchasePriceListEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const today = new Date().toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const [dateFrom, setDateFrom] = useState(monthAgo);
    const [dateTo, setDateTo] = useState(today);

    useEffect(() => {
        fetchPriceLists();
    }, []);

    const fetchPriceLists = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            if (dateFrom) params.append('dateFrom', dateFrom);
            if (dateTo) params.append('dateTo', dateTo);

            const res = await axios.get(`${API_URL}/api/prices/purchase?${params}`, {
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

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    Журнал закупочных прайсов
                </h1>
                <Button onClick={() => navigate('/prices/purchase')}>
                    <Plus size={16} className="mr-2" />
                    Новый прайс
                </Button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4 mb-4 flex items-center gap-4">
                <Filter size={18} className="text-gray-500" />
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">С:</label>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="border rounded px-2 py-1"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">По:</label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="border rounded px-2 py-1"
                    />
                </div>
                <Button onClick={fetchPriceLists} variant="outline" size="sm">
                    Сформировать
                </Button>
            </div>

            {/* Table */}
            <div className="rounded-md border border-slate-200 overflow-hidden bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                            <TableHead>Поставщик</TableHead>
                            <TableHead>Название</TableHead>
                            <TableHead className="w-[80px]">Статус</TableHead>
                            <TableHead className="w-[80px] text-center">Позиций</TableHead>
                            <TableHead>Создан</TableHead>
                            <TableHead>Пользователь</TableHead>
                            <TableHead className="text-right w-[120px]">Действие</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                                    Загрузка...
                                </TableCell>
                            </TableRow>
                        ) : priceLists.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                                    Нет записей за выбранный период
                                </TableCell>
                            </TableRow>
                        ) : (
                            priceLists.map(pl => (
                                <TableRow key={pl.id}>
                                    <TableCell className="font-medium">
                                        {pl.supplier?.name}
                                        <div className="text-xs text-gray-500">{pl.supplier?.code}</div>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {pl.title || '-'}
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
                                            onClick={() => navigate(`/prices/purchase?id=${pl.id}`)}
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
        </div>
    );
}
