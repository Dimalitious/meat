import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';

interface PurchaseJournalItem {
    id: number;
    purchaseDate: string;
    totalAmount: number;
    createdByUser: { id: number; name: string; username: string };
    isDisabled: boolean;
    supplierSummary: string;
    supplierNames: string[];
    paymentTypeSummary: string;
    suppliersCount: number;
    itemsCount: number;
    createdAt: string;
}

const PurchasesPage: React.FC = () => {
    const navigate = useNavigate();
    const [purchases, setPurchases] = useState<PurchaseJournalItem[]>([]);
    const [loading, setLoading] = useState(false);

    // Фильтры
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [includeDisabled, setIncludeDisabled] = useState(false);

    // Выделенные записи
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const getHeaders = () => ({
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });

    // Загрузка списка
    const fetchPurchases = async () => {
        setLoading(true);
        setSelectedIds(new Set());
        try {
            const params = new URLSearchParams();
            if (dateFrom) params.set('dateFrom', dateFrom);
            if (dateTo) params.set('dateTo', dateTo);
            if (includeDisabled) params.set('includeDisabled', 'true');

            const res = await axios.get(`${API_URL}/api/purchases?${params}`, getHeaders());
            setPurchases(res.data);
        } catch (error) {
            console.error('Error fetching purchases:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPurchases();
    }, []);

    // Применить фильтр
    const handleApplyFilter = () => {
        fetchPurchases();
    };

    // Переключение выделения
    const toggleSelection = (id: number) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    // Выделить/снять все
    const toggleSelectAll = () => {
        if (selectedIds.size === purchases.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(purchases.map(p => p.id)));
        }
    };

    // Отключить выделенные
    const handleDisableSelected = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Отключить ${selectedIds.size} выбранных закупок?`)) return;

        try {
            await axios.post(
                `${API_URL}/api/purchases/disable`,
                { ids: Array.from(selectedIds) },
                getHeaders()
            );
            fetchPurchases();
        } catch (error) {
            console.error('Error disabling purchases:', error);
        }
    };

    // Форматирование даты
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    // Форматирование суммы
    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'KZT',
            minimumFractionDigits: 0
        }).format(amount);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900">Журнал закупок</h1>
                <button
                    onClick={() => navigate('/purchases/new')}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                    ➕ Добавить закупку
                </button>
            </div>

            {/* Фильтры */}
            <div className="bg-slate-100 rounded-lg p-4">
                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Дата С</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Дата По</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                    </div>
                    <button
                        onClick={handleApplyFilter}
                        className="px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-800"
                    >
                        📊 Сформировать
                    </button>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="includeDisabled"
                            checked={includeDisabled}
                            onChange={(e) => setIncludeDisabled(e.target.checked)}
                            className="w-4 h-4"
                        />
                        <label htmlFor="includeDisabled" className="text-sm text-slate-600">
                            Показать отключённые
                        </label>
                    </div>
                </div>
            </div>

            {/* Кнопка отключения */}
            {selectedIds.size > 0 && (
                <div className="flex gap-2">
                    <button
                        onClick={handleDisableSelected}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                    >
                        🚫 Выключить выделенные ({selectedIds.size})
                    </button>
                </div>
            )}

            {/* Таблица */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Загрузка...</div>
                ) : purchases.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        Нет закупок. Нажмите "Добавить закупку" для создания.
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-900 text-slate-200">
                            <tr>
                                <th className="w-10 px-4 py-3">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size === purchases.length && purchases.length > 0}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4"
                                    />
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Дата закупки</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Поставщик</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Сумма закупки</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Тип оплаты</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Кто создал</th>
                                <th className="px-4 py-3 text-right text-sm font-semibold">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {purchases.map(p => (
                                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(p.id)}
                                            onChange={() => toggleSelection(p.id)}
                                            className="w-4 h-4"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <span style={{
                                            color: p.isDisabled ? '#94a3b8' : '#0f172a',
                                            textDecoration: p.isDisabled ? 'line-through' : 'none'
                                        }}>
                                            {formatDate(p.purchaseDate)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3" title={p.supplierNames.join(', ')}>
                                        {p.supplierSummary}
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-blue-600">
                                        {formatAmount(p.totalAmount || 0)}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {p.paymentTypeSummary}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {p.createdByUser?.name || p.createdByUser?.username || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => navigate(`/purchases/${p.id}`)}
                                            className="px-3 py-1 text-xs text-blue-600 hover:text-blue-800"
                                        >
                                            ✏️ Редактировать
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default PurchasesPage;
