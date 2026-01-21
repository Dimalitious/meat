import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || '';

interface PriceList {
    id: number;
    date: string;
    name: string | null;
    isActive: boolean;
    createdAt: string;
    createdBy: string;
    suppliersCount: number;
    itemsCount: number;
    supplierNames: string;
}

export default function PurchasePriceListsPage() {
    const [priceLists, setPriceLists] = useState<PriceList[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const navigate = useNavigate();

    useEffect(() => {
        fetchPriceLists();
    }, []);

    const fetchPriceLists = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('No auth token');
                setPriceLists([]);
                return;
            }
            const params = new URLSearchParams();
            if (dateFrom) params.append('dateFrom', dateFrom);
            if (dateTo) params.append('dateTo', dateTo);

            const res = await axios.get(`${API_URL}/api/purchase-price-lists?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Ensure we always have an array
            setPriceLists(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Fetch error:', err);
            setPriceLists([]);
        } finally {
            setLoading(false);
        }
    };

    const handleFilter = () => {
        fetchPriceLists();
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(priceLists.map(p => p.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectOne = (id: number, checked: boolean) => {
        const newSet = new Set(selectedIds);
        if (checked) {
            newSet.add(id);
        } else {
            newSet.delete(id);
        }
        setSelectedIds(newSet);
    };

    const handleDeactivate = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Отключить ${selectedIds.size} выбранных прайс-листов?`)) return;

        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/purchase-price-lists/deactivate`, {
                ids: Array.from(selectedIds)
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert('Прайс-листы отключены');
            setSelectedIds(new Set());
            fetchPriceLists();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка при отключении');
        }
    };

    const handleCreate = () => {
        navigate('/purchase-price-list/new');
    };

    const handleEdit = (id: number) => {
        navigate(`/purchase-price-list/${id}`);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ru-RU');
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white">Закупочный прайс</h1>
                <button
                    onClick={handleCreate}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                    <span>+</span> Добавить закупочный прайс
                </button>
            </div>

            {/* Фильтры */}
            <div className="bg-slate-800 rounded-lg p-4 mb-6">
                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Дата с</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Дата по</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                        />
                    </div>
                    <button
                        onClick={handleFilter}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                    >
                        Сформировать
                    </button>

                    {selectedIds.size > 0 && (
                        <button
                            onClick={handleDeactivate}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg ml-auto"
                        >
                            Отключить прайс ({selectedIds.size})
                        </button>
                    )}
                </div>
            </div>

            {/* Таблица */}
            <div className="bg-slate-800 rounded-lg overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-700">
                        <tr>
                            <th className="w-10 p-3">
                                <input
                                    type="checkbox"
                                    checked={priceLists.length > 0 && selectedIds.size === priceLists.length}
                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                    className="w-4 h-4"
                                />
                            </th>
                            <th className="text-left p-3 text-gray-300">Дата</th>
                            <th className="text-left p-3 text-gray-300">Название</th>
                            <th className="text-left p-3 text-gray-300">Поставщики</th>
                            <th className="text-center p-3 text-gray-300">Товаров</th>
                            <th className="text-center p-3 text-gray-300">Статус</th>
                            <th className="text-left p-3 text-gray-300">Создан</th>
                            <th className="w-16"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="text-center p-8 text-gray-400">
                                    Загрузка...
                                </td>
                            </tr>
                        ) : priceLists.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center p-8 text-gray-400">
                                    Нет данных
                                </td>
                            </tr>
                        ) : (
                            priceLists.map((pl) => (
                                <tr
                                    key={pl.id}
                                    className="border-t border-slate-700 hover:bg-slate-700/50 cursor-pointer"
                                    onClick={() => handleEdit(pl.id)}
                                >
                                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(pl.id)}
                                            onChange={(e) => handleSelectOne(pl.id, e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                    </td>
                                    <td className="p-3 text-white font-medium">
                                        {formatDate(pl.date)}
                                    </td>
                                    <td className="p-3 text-gray-300">
                                        {pl.name || '-'}
                                    </td>
                                    <td className="p-3 text-gray-300 max-w-xs truncate">
                                        {pl.supplierNames || '-'}
                                    </td>
                                    <td className="p-3 text-center text-gray-300">
                                        {pl.itemsCount}
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${pl.isActive
                                            ? 'bg-green-600/20 text-green-400'
                                            : 'bg-red-600/20 text-red-400'
                                            }`}>
                                            {pl.isActive ? 'Активный' : 'Отключён'}
                                        </span>
                                    </td>
                                    <td className="p-3 text-gray-400 text-sm">
                                        {formatDate(pl.createdAt)}
                                    </td>
                                    <td className="p-3">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEdit(pl.id);
                                            }}
                                            className="text-blue-400 hover:text-blue-300"
                                        >
                                            ✎
                                        </button>
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
