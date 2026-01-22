import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { RotateCcw, EyeOff, Search } from 'lucide-react';

interface JournalEntry {
    id: number;
    summaryDate: string;
    createdAt: string;
    createdBy: string;
    isHidden: boolean;
    data: any;
}

export default function SummaryJournalPage() {
    const [journals, setJournals] = useState<JournalEntry[]>([]);
    const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [showHidden, setShowHidden] = useState(false);
    const [loading, setLoading] = useState(false);
    const [reworking, setReworking] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

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

    // Открыть диалог подтверждения
    const confirmSendToRework = () => {
        if (selectedIds.size !== 1) {
            alert('Выберите одну запись для отправки на доработку');
            return;
        }
        setShowConfirmDialog(true);
    };

    // Отправить на доработку
    const sendToRework = async () => {
        if (selectedIds.size !== 1) return;

        const id = Array.from(selectedIds)[0];

        setReworking(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(
                `${API_URL}/api/journals/summary/${id}/rework`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            alert(`✅ ${res.data.message}\nВозвращено записей: ${res.data.entriesReturned}\n\nЗаписи доступны в форме "Сводка заказов" со статусом "Начать сборку"`);
            setShowConfirmDialog(false);
            fetchJournals();
        } catch (err: any) {
            console.error('Send to rework error:', err);
            alert(err.response?.data?.error || 'Ошибка отправки на доработку');
        } finally {
            setReworking(false);
        }
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

    const selectedJournal = selectedIds.size === 1
        ? journals.find(j => j.id === Array.from(selectedIds)[0])
        : null;

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
                    onClick={confirmSendToRework}
                    disabled={selectedIds.size !== 1 || selectedJournal?.isHidden}
                    className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <RotateCcw size={18} /> Отправить на доработку
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

            {/* Confirmation Dialog */}
            {showConfirmDialog && selectedJournal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-lg shadow-xl w-[450px] p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-orange-100 p-2 rounded-full">
                                <RotateCcw size={24} className="text-orange-600" />
                            </div>
                            <h3 className="text-lg font-semibold">Отправить на доработку?</h3>
                        </div>

                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                            <p className="text-sm text-gray-700 mb-2">
                                <strong>Журнал #{selectedJournal.id}</strong> от {formatDate(selectedJournal.summaryDate)}
                            </p>
                            <p className="text-sm text-gray-600">
                                Все записи журнала вернутся в форму <strong>"Сводка заказов"</strong> со статусом <strong>"Начать сборку"</strong>.
                            </p>
                        </div>

                        <p className="text-sm text-gray-500 mb-6">
                            После возврата вы сможете отредактировать записи и повторно пройти процесс сборки.
                        </p>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowConfirmDialog(false)}
                                disabled={reworking}
                                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={sendToRework}
                                disabled={reworking}
                                className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {reworking ? (
                                    <>Отправка...</>
                                ) : (
                                    <>
                                        <RotateCcw size={16} /> Отправить
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
