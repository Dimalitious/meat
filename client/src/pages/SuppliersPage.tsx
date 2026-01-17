import { useEffect, useState } from 'react';
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

interface Supplier {
    code: string;
    name: string;
    legalName?: string;
}

const SuppliersPage = () => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${API_URL}/api/suppliers`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setSuppliers(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchSuppliers();
    }, []);

    if (loading) return <div className="p-8 text-center text-slate-500">Загрузка...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">Поставщики</h1>
            <div className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead>Код</TableHead>
                            <TableHead>Название</TableHead>
                            <TableHead>Юр. Название</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {suppliers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center text-slate-500">
                                    Нет данных
                                </TableCell>
                            </TableRow>
                        ) : (
                            suppliers.map((s) => (
                                <TableRow key={s.code}>
                                    <TableCell className="font-medium text-slate-700">{s.code}</TableCell>
                                    <TableCell>{s.name}</TableCell>
                                    <TableCell className="text-slate-500">{s.legalName || '-'}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default SuppliersPage;
