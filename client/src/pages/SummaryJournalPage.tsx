import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';
import { Edit2, EyeOff, Search } from 'lucide-react';

interface JournalEntry {
    id: number;
    summaryDate: string;
    createdAt: string;
    createdBy: string;
    isHidden: boolean;
    data: any;
}

export default function SummaryJournalPage() {
    const navigate = useNavigate();
    const [journals, setJournals] = useState<JournalEntry[]>([]);
    const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [showHidden, setShowHidden] = useState(false);
    const [loading, setLoading] = useState(false);

    const fetchJournals = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/journals/summary`, {
                params: { dateFrom, dateTo, showHidden },
                headers: { Authorization: `Bearer ${token}` }
            });
            setJournals(res.data);
            setSelectedIds(new Set());
        } catch (err) {
            console.error('Failed to fetch journals:', err);
            alert('Ошибка загрузки журнала');
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === journals.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(journals.map(j => j.id)));
        }
    };

    const editJournal = () => {
        if (selectedIds.size !== 1) {
            alert('Выберите одну запись для редактирования');
            return;
        }
        const id = Array.from(selectedIds)[0];
        navigate(`/summary-orders?journalId=${id}`);
    };

    const hideJournals = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Скрыть ${selectedIds.size} записей?`)) return;

        try {
            const token = localStorage.getItem('token');
            await Promise.all(
                Array.from(selectedIds).map(id =>
                    axios.put(`${API_URL}/api/journals/summary/${id}`,
                        { isHidden: true },
                        { headers: { Authorization: `Bearer ${token}` } }
                    )
                )
            );
            fetchJournals();
        } catch (err) {
            alert('Ошибка при скрытии');
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ru-RU');
    };

    const formatDateTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('ru-RU');
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Журнал сводок заказов</h1>

            {/* Filter Section */}
            <div className="bg-white rounded-lg shadow p-4">
                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Дата с</label>
                        <input
                            type="date"
                            className="border rounded px-3 py-2"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Дата по</label>
                        <input
                            type="date"
                            className="border rounded px-3 py-2"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                        />
                    </div>
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={showHidden}
                            onChange={e => setShowHidden(e.target.checked)}
                        />
                        <span className="text-sm">Показать скрытые</span>
                    </label>
                    <button
                        onClick={fetchJournals}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                    >
                        <Search size={18} /> Сформировать
                    </button>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <button
                    onClick={editJournal}
                    disabled={selectedIds.size !== 1}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <Edit2 size={18} /> Редактировать сводку
                </button>
                <button
                    onClick={hideJournals}
                    disabled={selectedIds.size === 0}
                    className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <EyeOff size={18} /> Скрыть ({selectedIds.size})
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-800 text-white">
                        <tr>
                            <th className="w-10 p-3">
                                <input
                                    type="checkbox"
                                    checked={journals.length > 0 && selectedIds.size === journals.length}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th className="text-left p-3">Дата сводки</th>
                            <th className="text-left p-3">Сохранено</th>
                            <th className="text-left p-3">Пользователь</th>
                            <th className="text-left p-3">Статус</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="text-center py-8 text-gray-500">
                                    Загрузка...
                                </td>
                            </tr>
                        ) : journals.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center py-8 text-gray-500">
                                    Нет данных. Выберите период и нажмите «Сформировать»
                                </td>
                            </tr>
                        ) : (
                            journals.map(j => (
                                <tr
                                    key={j.id}
                                    className={`border-b hover:bg-gray-50 ${j.isHidden ? 'opacity-50 bg-gray-100' : ''}`}
                                >
                                    <td className="p-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(j.id)}
                                            onChange={() => toggleSelect(j.id)}
                                        />
                                    </td>
                                    <td className="p-3 font-medium">{formatDate(j.summaryDate)}</td>
                                    <td className="p-3 text-sm text-gray-600">{formatDateTime(j.createdAt)}</td>
                                    <td className="p-3">{j.createdBy}</td>
                                    <td className="p-3">
                                        {j.isHidden ? (
                                            <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded text-xs">
                                                Скрыт
                                            </span>
                                        ) : (
                                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                                                Активен
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
