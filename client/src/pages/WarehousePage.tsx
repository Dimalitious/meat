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
import { Input } from '../components/ui/Input';

interface ProductStock {
    id: number;
    code: string;
    name: string;
    category: string;
    quantity: number;
    updatedAt: string | null;
}

const WarehousePage = () => {
    const [stock, setStock] = useState<ProductStock[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Arrival Form
    const [selectedProduct, setSelectedProduct] = useState<number | ''>('');
    const [arrivalQty, setArrivalQty] = useState('');
    const [note, setNote] = useState('');

    useEffect(() => {
        fetchStock();
    }, []);

    const fetchStock = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/warehouse/stock`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStock(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleArrival = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct) return;

        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/warehouse/arrival`,
                { productId: selectedProduct, quantity: Number(arrivalQty), note },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            fetchStock();
            closeModal();
            alert('Приход успешно сохранен');
        } catch (err) {
            alert('Ошибка при сохранении');
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedProduct('');
        setArrivalQty('');
        setNote('');
    };

    const filteredStock = stock.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="p-8 text-center text-slate-500">Загрузка...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900">Склад (Warehouse)</h1>
                <Button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    + Приход товара
                </Button>
            </div>

            <div className="flex items-center gap-4 bg-white p-4 rounded-md border border-slate-200">
                <Input
                    placeholder="Поиск по названию или коду..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                />
            </div>

            <div className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead>Код</TableHead>
                            <TableHead>Товар</TableHead>
                            <TableHead>Категория</TableHead>
                            <TableHead className="text-right">Остаток (кг)</TableHead>
                            <TableHead>Обновлено</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredStock.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="font-mono text-xs">{item.code}</TableCell>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell>{item.category}</TableCell>
                                <TableCell className={`text-right font-bold ${item.quantity < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                                    {item.quantity.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-slate-500 text-sm">
                                    {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Arrival Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
                        <h2 className="text-xl font-bold mb-4">Приход товара</h2>
                        <form onSubmit={handleArrival} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Товар</label>
                                <select
                                    className="w-full rounded-md border border-slate-300 p-2"
                                    value={selectedProduct}
                                    onChange={e => setSelectedProduct(Number(e.target.value))}
                                    required
                                >
                                    <option value="">-- Выберите товар --</option>
                                    {stock.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Количество (кг)</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={arrivalQty}
                                    onChange={e => setArrivalQty(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Примечание</label>
                                <Input
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    placeholder="Поставщик, № накладной..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <Button type="button" variant="outline" onClick={closeModal}>Отмена</Button>
                                <Button type="submit">Сохранить</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WarehousePage;
