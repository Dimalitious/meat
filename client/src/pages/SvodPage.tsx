import { useState, useEffect } from 'react';
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

interface SvodItem {
    productId: number;
    productName: string;
    productCode: string;
    totalQuantity: number;
    totalAmount: number;
    averagePrice: number;
}

interface SvodData {
    date: string;
    items: SvodItem[];
    totalSum: number;
}

const SvodPage = () => {
    // Default to tomorrow or today? Usually production is for tomorrow.
    // Let's default to today for simplicity, user can switch.
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [data, setData] = useState<SvodData | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchReport();
    }, [date]);

    const fetchReport = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/api/reports/svod`, {
                params: { date },
                headers: { Authorization: `Bearer ${token}` }
            });
            setData(response.data);
        } catch (err) {
            console.error('Failed to fetch svod:', err);
            setError('Не удалось загрузить данные (Failed to load data)');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const exportToExcel = () => {
        // Simple CSV export for now
        if (!data) return;

        const headers = ['Код', 'Товар', 'Кол-во', 'Цена', 'Сумма'];
        const csvContent = [
            headers.join(','),
            ...data.items.map(item => [
                item.productCode,
                `"${item.productName.replace(/"/g, '""')}"`, // Escape quotes
                item.totalQuantity,
                item.averagePrice,
                item.totalAmount
            ].join(','))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `svod_${date}.csv`;
        link.click();
    };

    return (
        <div className="space-y-6">
            {/* Header / Controls - Hidden on Print */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex items-center gap-4">
                    <label className="text-sm font-medium text-slate-700">Дата свода:</label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={exportToExcel}
                        disabled={!data || data.items.length === 0}
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Excel
                    </Button>
                    <Button
                        onClick={handlePrint}
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Печать (Print)
                    </Button>
                </div>
            </div>

            {/* Content Actions */}
            <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-none">
                <div className="p-6 print:p-0">
                    <div className="mb-6 print:mb-4 text-center sm:text-left print:text-center">
                        <h2 className="text-2xl font-bold text-slate-900">Свод заказа (Production Summary)</h2>
                        <p className="text-slate-500 mt-1">
                            На дату: <span className="font-semibold text-slate-900">{new Date(date).toLocaleDateString()}</span>
                        </p>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center py-12">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : error ? (
                        <div className="text-center text-red-600 py-8 bg-red-50 rounded-lg mx-4">
                            {error}
                        </div>
                    ) : (data && data.items.length > 0) ? (
                        <Table>
                            <TableHeader className="bg-slate-50/50 print:bg-transparent border-slate-100">
                                <TableRow>
                                    <TableHead className="print:text-black">Товар (Product)</TableHead>
                                    <TableHead className="text-right print:text-black">Кол-во (Qty)</TableHead>
                                    <TableHead className="text-right print:text-black">Цена (Price)</TableHead>
                                    <TableHead className="text-right print:text-black">Сумма (Total)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data!.items.map((item) => (
                                    <TableRow key={item.productId} className="print:border-slate-200">
                                        <TableCell className="font-medium text-slate-900 py-2">
                                            {item.productName}
                                            <div className="text-xs text-slate-400 font-normal print:hidden">{item.productCode}</div>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-slate-900 py-2">
                                            {item.totalQuantity}
                                        </TableCell>
                                        <TableCell className="text-right text-slate-600 py-2">
                                            {Number(item.averagePrice).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold text-slate-900 py-2">
                                            {Number(item.totalAmount).toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {/* Total Row */}
                                <TableRow className="bg-slate-50 font-bold border-t-2 border-slate-200 print:bg-transparent">
                                    <TableCell className="text-right text-slate-900">ИТОГО:</TableCell>
                                    <TableCell className="text-right text-slate-900">
                                        {data!.items.reduce((acc, curr) => acc + curr.totalQuantity, 0)}
                                    </TableCell>
                                    <TableCell></TableCell>
                                    <TableCell className="text-right text-slate-900">
                                        {data!.totalSum.toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                            Нет данных на выбранную дату
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @media print {
                    @page { margin: 1cm; }
                    body { -webkit-print-color-adjust: exact; }
                }
            `}</style>
        </div>
    );
};

export default SvodPage;
