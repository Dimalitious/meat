import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { RefreshCw, Save, Search, ExternalLink, AlertCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

// ============================================
// ИНТЕРФЕЙСЫ
// ============================================

interface Product {
    id: number;
    code: string;
    name: string;
    category: string | null;
}

interface MaterialReportLine {
    id?: number;
    productId: number;
    productCode: string | null;
    productName: string | null;
    category?: string | null;
    openingBalance: number;
    inPurchase: number;
    inProduction: number;
    outSale: number;
    outWaste: number;
    outBundle: number;
    outDefectWriteoff: number;
    outProductionWriteoff: number;  // Списано в производство
    outWeightLoss: number;
    outSupplierReturn: number;
    closingBalanceCalc: number;
    closingBalanceFact: number | null;
    product?: Product;
}

interface MaterialReportData {
    id: number | null;
    reportDate: string;
    status: string;
    lines: MaterialReportLine[];
}

interface MaterialReportTabProps {
    selectedDate: string;
}

// ============================================
// УТИЛИТЫ
// ============================================

// Форматирование чисел
const formatNumber = (value: number | null | undefined, decimals = 2): string => {
    if (value === null || value === undefined) return '—';
    if (value === 0) return '—';
    return value.toLocaleString('ru-RU', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
};

// ============================================
// КОМПОНЕНТ ВКЛАДКИ ОТЧЕТ
// ============================================

export default function MaterialReportTab({ selectedDate }: MaterialReportTabProps) {
    const [report, setReport] = useState<MaterialReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isPreview, setIsPreview] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editedFacts, setEditedFacts] = useState<Map<number, number | null>>(new Map());
    const [error, setError] = useState<string | null>(null);
    const [hasDataChanges, setHasDataChanges] = useState(false); // Отслеживание изменений данных после сохранения

    // Загрузка данных отчёта
    const fetchReport = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('token');
            // Всегда запрашиваем пересчёт данных
            const res = await axios.get(`${API_URL}/api/material-report`, {
                params: { date: selectedDate, refresh: 'true' },
                headers: { Authorization: `Bearer ${token}` }
            });

            setReport(res.data.report);
            setIsPreview(res.data.isPreview);
            setHasDataChanges(res.data.hasChanges || false); // Если данные изменились после сохранения
            setEditedFacts(new Map());
        } catch (err: any) {
            console.error('Failed to fetch material report:', err);
            setError(err.response?.data?.error || 'Ошибка загрузки отчёта');
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);



    // Сохранить отчёт (кнопка "Сохранить отчет")
    const handleSave = async () => {
        if (!report) return;

        try {
            setSaving(true);
            setError(null);

            // Применяем редактированные факты к строкам
            const linesToSave = report.lines.map(line => {
                const editedFact = editedFacts.get(line.productId);
                return {
                    ...line,
                    closingBalanceFact: editedFact !== undefined ? editedFact : line.closingBalanceFact
                };
            });

            // Валидация
            for (const line of linesToSave) {
                if (line.closingBalanceFact !== null && line.closingBalanceFact < 0) {
                    setError(`Фактический остаток не может быть отрицательным для товара ${line.productCode}`);
                    setSaving(false);
                    return;
                }
            }

            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/api/material-report/save`,
                { date: selectedDate, lines: linesToSave },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setReport(res.data.report);
            setIsPreview(false);
            setEditedFacts(new Map());
            setHasDataChanges(false); // Сбрасываем флаг изменений после сохранения
            alert('Отчёт сохранён успешно!');
        } catch (err: any) {
            console.error('Failed to save material report:', err);
            setError(err.response?.data?.error || 'Ошибка сохранения отчёта');
        } finally {
            setSaving(false);
        }
    };

    // Обновить фактический остаток
    const handleFactChange = (productId: number, value: string) => {
        const numValue = value === '' ? null : parseFloat(value);
        setEditedFacts(prev => {
            const newMap = new Map(prev);
            newMap.set(productId, numValue);
            return newMap;
        });
    };

    // Получить значение факта (с учётом редактирования)
    const getFactValue = (line: MaterialReportLine): number | null => {
        if (editedFacts.has(line.productId)) {
            return editedFacts.get(line.productId) ?? null;
        }
        return line.closingBalanceFact;
    };

    // Фильтрация по поиску
    const filteredLines = useMemo(() => {
        if (!report?.lines) return [];
        if (!searchTerm) return report.lines;

        const term = searchTerm.toLowerCase();
        return report.lines.filter(line =>
            (line.productCode?.toLowerCase().includes(term)) ||
            (line.productName?.toLowerCase().includes(term)) ||
            (line.product?.name?.toLowerCase().includes(term))
        );
    }, [report?.lines, searchTerm]);

    // Группировка по категориям
    const groupedLines = useMemo(() => {
        const groups = new Map<string, MaterialReportLine[]>();

        filteredLines.forEach(line => {
            const category = line.category || line.product?.category || 'Без категории';
            if (!groups.has(category)) {
                groups.set(category, []);
            }
            groups.get(category)!.push(line);
        });

        return groups;
    }, [filteredLines]);

    // ============================================
    // ЭКСПОРТ В EXCEL (ОТЧЁТ)
    // ============================================
    const handleExportToExcel = () => {
        if (!report?.lines || report.lines.length === 0) {
            alert('Нет данных для экспорта');
            return;
        }

        const exportData = filteredLines.map(line => ({
            'Код': line.productCode || '',
            'Наименование': line.productName || line.product?.name || '',
            'Категория': line.category || line.product?.category || '',
            'На начало': line.openingBalance || 0,
            'Закупка': line.inPurchase || 0,
            'Производство': line.inProduction || 0,
            'Продано': line.outSale || 0,
            'Отход': line.outWaste || 0,
            'Пучок': line.outBundle || 0,
            'Брак': line.outDefectWriteoff || 0,
            'Спис. в пр-во': line.outProductionWriteoff || 0,
            'Списали': line.outWeightLoss || 0,
            'Возврат пост.': line.outSupplierReturn || 0,
            'Расч. остаток': line.closingBalanceCalc || 0,
            'Факт. остаток': getFactValue(line) ?? ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Отчёт');
        XLSX.writeFile(wb, `Материальный_отчёт_${selectedDate}.xlsx`);
    };

    // Статус отчёта
    const getStatusBadge = () => {
        if (isPreview) {
            return <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-sm font-medium">○ Предпросмотр</span>;
        }
        if (report?.status === 'saved') {
            return <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">✓ Сохранён</span>;
        }
        if (editedFacts.size > 0) {
            return <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-sm font-medium animate-pulse">✎ Редактирование ({editedFacts.size})</span>;
        }
        return <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">○ Черновик</span>;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <RefreshCw className="animate-spin mr-2" size={20} />
                <span className="text-gray-500">Загрузка отчёта...</span>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow">
            {/* Заголовок и кнопки */}
            <div className="p-4 border-b">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-gray-800">📊 Материальный отчёт</h2>
                        {getStatusBadge()}
                        <div className="flex items-center gap-2 text-gray-600">
                            <span className="text-sm">Дата отчёта:</span>
                            <span className="font-medium bg-gray-100 px-3 py-1 rounded">
                                {new Date(selectedDate).toLocaleDateString('ru-RU')}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Поиск */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Поиск товара..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 border rounded-lg text-sm w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>



                        {/* Кнопка Сохранить отчёт */}
                        <button
                            onClick={handleSave}
                            disabled={saving || (editedFacts.size === 0 && !isPreview && !hasDataChanges)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${saving
                                ? 'bg-gray-300 cursor-not-allowed'
                                : editedFacts.size > 0 || isPreview || hasDataChanges
                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                        >
                            <Save size={16} />
                            {saving ? 'Сохранение...' : 'Сохранить отчёт'}
                        </button>

                        {/* Кнопка Экспорт в Excel */}
                        <button
                            onClick={handleExportToExcel}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            <Download size={16} />
                            Экспорт
                        </button>
                    </div>
                </div>

                {/* Сообщение об ошибке */}
                {error && (
                    <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">×</button>
                    </div>
                )}
            </div>

            {/* Таблица */}
            <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                            <th className="border px-3 py-2 text-left w-20" rowSpan={2}>Код</th>
                            <th className="border px-3 py-2 text-left" rowSpan={2}>Наименование товара</th>
                            <th className="border px-3 py-2 text-center w-16" rowSpan={2}>МЕМ</th>
                            <th className="border px-3 py-2 text-center bg-blue-50" colSpan={4}>Поступления</th>
                            <th className="border px-3 py-2 text-center bg-red-50" colSpan={4}>Расход</th>
                            <th className="border px-3 py-2 text-center bg-green-50" colSpan={2}>Остатки</th>
                        </tr>
                        <tr>
                            <th className="border px-2 py-1 text-center bg-blue-50 w-20 whitespace-normal">На начало</th>
                            <th className="border px-2 py-1 text-center bg-blue-50 w-20">Закупка</th>
                            <th className="border px-2 py-1 text-center bg-blue-50 w-20">Пр-во</th>
                            <th className="border px-2 py-1 text-center bg-blue-50 w-24 whitespace-normal">Возврат от покупателя</th>
                            <th className="border px-2 py-1 text-center bg-red-50 w-20">Продано</th>
                            <th className="border px-2 py-1 text-center bg-red-50 w-24 whitespace-normal">Спис. в пр-во</th>
                            <th className="border px-2 py-1 text-center bg-red-50 w-20">Списали</th>
                            <th className="border px-2 py-1 text-center bg-red-50 w-24 whitespace-normal">Возврат поставщику</th>
                            <th className="border px-2 py-1 text-center bg-green-50 w-24">Расч. остаток</th>
                            <th className="border px-2 py-1 text-center bg-yellow-50 w-28">Факт. остаток</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from(groupedLines.entries()).map(([category, lines]) => (
                            <React.Fragment key={`group-${category}`}>
                                {/* Заголовок категории */}
                                <tr className="bg-gray-200">
                                    <td colSpan={12} className="px-3 py-2 font-bold text-gray-700">
                                        📦 {category} ({lines.length})
                                    </td>
                                </tr>
                                {/* Строки товаров */}
                                {lines.map(line => {
                                    const factValue = getFactValue(line);
                                    const hasEdit = editedFacts.has(line.productId);

                                    return (
                                        <tr
                                            key={line.productId}
                                            className={`hover:bg-gray-50 ${hasEdit ? 'bg-yellow-50' : ''}`}
                                        >
                                            <td className="border px-2 py-1 font-mono text-xs text-gray-600">
                                                {line.productCode || '—'}
                                            </td>
                                            <td className="border px-2 py-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="truncate max-w-[300px]" title={line.productName || line.product?.name || ''}>
                                                        {line.productName || line.product?.name || '—'}
                                                    </span>
                                                    {line.productId && (
                                                        <a
                                                            href={`/products?id=${line.productId}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-gray-400 hover:text-blue-600"
                                                            title="Открыть карточку товара"
                                                        >
                                                            <ExternalLink size={14} />
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="border px-2 py-1 text-center">
                                                <a
                                                    href={`/mml?productId=${line.productId}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-500 hover:text-blue-700 text-xs"
                                                >
                                                    🔗
                                                </a>
                                            </td>
                                            <td className="border px-2 py-1 text-right bg-blue-50/30">
                                                {formatNumber(line.openingBalance)}
                                            </td>
                                            <td className="border px-2 py-1 text-right bg-blue-50/30">
                                                {formatNumber(line.inPurchase)}
                                            </td>
                                            <td className="border px-2 py-1 text-right bg-blue-50/30">
                                                {formatNumber(line.inProduction)}
                                            </td>
                                            <td className="border px-2 py-1 text-right bg-blue-50/30">
                                                {formatNumber(0)}{/* Возврат от покупателя - TODO */}
                                            </td>
                                            <td className="border px-2 py-1 text-right bg-red-50/30">
                                                {formatNumber(line.outSale)}
                                            </td>
                                            <td className="border px-2 py-1 text-right bg-red-50/30">
                                                {formatNumber(line.outProductionWriteoff)}
                                            </td>
                                            <td className="border px-2 py-1 text-right bg-red-50/30">
                                                {formatNumber(line.outWeightLoss)}
                                            </td>
                                            <td className="border px-2 py-1 text-right bg-red-50/30">
                                                {formatNumber(line.outSupplierReturn)}
                                            </td>
                                            <td className="border px-2 py-1 text-right bg-green-50/50 font-medium">
                                                {formatNumber(line.closingBalanceCalc)}
                                            </td>
                                            <td className="border px-1 py-1 bg-yellow-50">
                                                <input
                                                    type="number"
                                                    step="0.001"
                                                    min="0"
                                                    value={factValue !== null ? factValue : ''}
                                                    onChange={(e) => handleFactChange(line.productId, e.target.value)}
                                                    placeholder="—"
                                                    className={`w-full px-2 py-1 text-right border rounded text-sm ${hasEdit
                                                        ? 'border-yellow-400 bg-yellow-100'
                                                        : 'border-gray-200 bg-white'
                                                        } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                        {filteredLines.length === 0 && (
                            <tr>
                                <td colSpan={12} className="text-center py-8 text-gray-500">
                                    {searchTerm ? 'Товары не найдены' : 'Нет данных для отображения'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Подвал с итогами */}
            <div className="p-4 border-t bg-gray-50">
                <div className="flex justify-between items-center text-sm text-gray-600">
                    <span>
                        Всего позиций: <strong>{filteredLines.length}</strong>
                        {searchTerm && report?.lines && ` из ${report.lines.length}`}
                    </span>
                    <span>
                        {editedFacts.size > 0 && (
                            <span className="text-orange-600 mr-4">
                                Изменено: <strong>{editedFacts.size}</strong> позиций
                            </span>
                        )}
                        Дата: <strong>{new Date(selectedDate).toLocaleDateString('ru-RU')}</strong>
                    </span>
                </div>
            </div>
        </div>
    );
}
