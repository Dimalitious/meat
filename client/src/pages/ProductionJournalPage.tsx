import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Button } from '../components/ui/Button';
import { Edit, Calendar, Filter } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../components/ui/Table";

interface ProductionJournalEntry {
    id: number;
    productionDate: string;
    staffId: number;
    status: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    staff: {
        id: number;
        fullName: string;
        user?: { name: string };
    };
    _count: {
        items: number;
    };
}

export default function ProductionJournalPage() {
    const navigate = useNavigate();
    const [journals, setJournals] = useState<ProductionJournalEntry[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const today = new Date().toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const [dateFrom, setDateFrom] = useState(monthAgo);
    const [dateTo, setDateTo] = useState(today);

    useEffect(() => {
        fetchJournals();
    }, []);

    const fetchJournals = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            if (dateFrom) params.append('dateFrom', dateFrom);
            if (dateTo) params.append('dateTo', dateTo);

            const res = await axios.get(`${API_URL}/api/production/journals?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setJournals(res.data);
        } catch (err) {
            console.error('Failed to fetch journals:', err);
        } finally {
            setLoading(false);
        }
    };

    const openProductionForm = (date: string) => {
        navigate('/production', { state: { date } });
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
                    Журнал производства
                </h1>
                <Button onClick={() => navigate('/production')}>
                    <Calendar size={16} className="mr-2" />
                    Новая форма
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
                <Button onClick={fetchJournals} variant="outline" size="sm">
                    Сформировать
                </Button>
            </div>

            {/* Table */}
            <div className="rounded-md border border-slate-200 overflow-hidden bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                            <TableHead className="w-[140px]">Дата производства</TableHead>
                            <TableHead>Мясник (ФИО)</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead className="w-[100px] text-center">Карточек</TableHead>
                            <TableHead>Создано</TableHead>
                            <TableHead>Последнее изменение</TableHead>
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
                        ) : journals.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                                    Нет записей за выбранный период
                                </TableCell>
                            </TableRow>
                        ) : (
                            journals.map(j => (
                                <TableRow key={j.id}>
                                    <TableCell className="font-medium">
                                        {formatDate(j.productionDate)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">{j.staff?.fullName || '-'}</div>
                                        {j.staff?.user?.name && (
                                            <div className="text-xs text-gray-500">{j.staff.user.name}</div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${j.status === 'saved' ? 'bg-green-100 text-green-800' :
                                                j.status === 'archived' ? 'bg-gray-100 text-gray-800' :
                                                    'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {j.status === 'saved' ? 'Сохранено' :
                                                j.status === 'archived' ? 'В архиве' : 'Черновик'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {j._count.items}
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-500">
                                        {formatDateTime(j.createdAt)}
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-500">
                                        {formatDateTime(j.updatedAt)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openProductionForm(j.productionDate.split('T')[0])}
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
