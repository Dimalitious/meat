// client/src/pages/ImportPage.tsx
import React, { useState } from 'react';
import { Upload, FileUp, AlertCircle, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config/api';

export const ImportPage: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [stats, setStats] = useState<any>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setStatus(null);
            setStats(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setLoading(true);
        setStatus(null);
        setStats(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = localStorage.getItem('token');
            // Ensure we hit /api/import/excel
            const res = await axios.post(`${API_URL}/api/import/excel`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`,
                },
            });

            if (res.data.success) {
                setStatus({ type: 'success', message: 'Файл успешно обработан' });
                setStats(res.data.stats);
                setFile(null);
            }
        } catch (error: any) {
            console.error(error);
            setStatus({ type: 'error', message: error.response?.data?.error || 'Ошибка при загрузке файла' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-slate-800">Импорт данных</h1>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                <div className="mb-8">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Выберите Excel файл (.xlsx)
                    </label>
                    <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                {file ? (
                                    <div className="text-center">
                                        <FileUp className="w-12 h-12 text-blue-500 mb-3 mx-auto" />
                                        <p className="text-lg font-medium text-slate-900">{file.name}</p>
                                        <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                ) : (
                                    <>
                                        <Upload className="w-10 h-10 text-slate-400 mb-3" />
                                        <p className="mb-2 text-sm text-slate-500">
                                            <span className="font-semibold">Нажмите для выбора</span> или перетащите файл
                                        </p>
                                        <p className="text-xs text-slate-500">XLSX, XLS</p>
                                    </>
                                )}
                            </div>
                            <input
                                type="file"
                                className="hidden"
                                accept=".xlsx, .xls"
                                onChange={handleFileChange}
                            />
                        </label>
                    </div>
                </div>

                {status && (
                    <div className={`mb-6 p-4 rounded-lg flex items-center ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {status.type === 'success' ? <CheckCircle className="w-5 h-5 mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
                        {status.message}
                    </div>
                )}

                {stats && (
                    <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <h3 className="text-sm font-semibold text-blue-800">Товары</h3>
                            <p className="text-2xl font-bold text-blue-900">{stats.products?.total || 0}</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                            <h3 className="text-sm font-semibold text-purple-800">Клиенты</h3>
                            <p className="text-2xl font-bold text-purple-900">{stats.customers?.total || 0}</p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                            <h3 className="text-sm font-semibold text-orange-800">Поставщики</h3>
                            <p className="text-2xl font-bold text-orange-900">{stats.suppliers?.total || 0}</p>
                        </div>
                    </div>
                )}

                <div className="flex justify-end">
                    <button
                        onClick={handleUpload}
                        disabled={!file || loading}
                        className={`px-6 py-2.5 rounded-lg font-medium text-white transition-all 
                            ${!file || loading
                                ? 'bg-slate-300 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'}`}
                    >
                        {loading ? 'Обработка...' : 'Загрузить файл'}
                    </button>
                </div>
            </div>

            <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-6">
                <h3 className="font-semibold text-blue-900 mb-2">Инструкция по файлу</h3>
                <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                    <li>Файл должен содержать листы: <strong>справочник</strong>, <strong>sup</strong> (или VIP клиенты).</li>
                    <li><strong>справочник</strong>: Колонки 'Код', 'Название', 'Категория', 'поставщики'.</li>
                    <li><strong>sup</strong>: Колонка 'торговые точки'.</li>
                </ul>
            </div>
        </div>
    );
};
