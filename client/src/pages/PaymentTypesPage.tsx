import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';

interface PaymentType {
    id: number;
    name: string;
    paymentId: string | null;
    isBase: boolean;
    isDisabled: boolean;
    createdAt: string;
    updatedAt: string;
}

const PaymentTypesPage: React.FC = () => {
    const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);
    const [loading, setLoading] = useState(false);
    const [showDisabled, setShowDisabled] = useState(false);

    // Модальное окно
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingType, setEditingType] = useState<PaymentType | null>(null);
    const [formName, setFormName] = useState('');
    const [formPaymentId, setFormPaymentId] = useState('');
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);

    // Seed result/error
    const [seedMessage, setSeedMessage] = useState<string | null>(null);
    const [seedError, setSeedError] = useState<string | null>(null);

    const getHeaders = () => ({
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });

    // Загрузка списка
    const fetchPaymentTypes = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (showDisabled) params.set('includeDisabled', 'true');

            const res = await axios.get(`${API_URL}/api/payment-types?${params}`, getHeaders());
            setPaymentTypes(res.data);
        } catch (error) {
            console.error('Error fetching payment types:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPaymentTypes();
    }, [showDisabled]);

    // Открыть модалку для создания
    const handleCreate = () => {
        setEditingType(null);
        setFormName('');
        setFormPaymentId('');
        setFormError('');
        setIsModalOpen(true);
    };

    // Открыть модалку для редактирования
    const handleEdit = (pt: PaymentType) => {
        setEditingType(pt);
        setFormName(pt.name);
        setFormPaymentId(pt.paymentId || '');
        setFormError('');
        setIsModalOpen(true);
    };

    // Сохранить
    const handleSave = async () => {
        if (!formName.trim()) {
            setFormError('Название обязательно');
            return;
        }

        setSaving(true);
        setFormError('');

        try {
            const payload: any = { name: formName.trim() };
            if (formPaymentId.trim()) {
                payload.paymentId = formPaymentId.trim();
            } else {
                payload.paymentId = null;
            }

            if (editingType) {
                await axios.put(
                    `${API_URL}/api/payment-types/${editingType.id}`,
                    payload,
                    getHeaders()
                );
            } else {
                await axios.post(
                    `${API_URL}/api/payment-types`,
                    payload,
                    getHeaders()
                );
            }
            setIsModalOpen(false);
            fetchPaymentTypes();
        } catch (error: any) {
            setFormError(error.response?.data?.error || 'Ошибка при сохранении');
        } finally {
            setSaving(false);
        }
    };

    // Переключить статус
    const handleToggle = async (pt: PaymentType) => {
        try {
            await axios.patch(`${API_URL}/api/payment-types/${pt.id}/toggle`, {}, getHeaders());
            fetchPaymentTypes();
        } catch (error) {
            console.error('Error toggling payment type:', error);
        }
    };

    // Засеять базовые типы
    const handleSeed = async () => {
        setSeedMessage(null);
        setSeedError(null);
        try {
            const res = await axios.post(`${API_URL}/api/payment-types/seed`, {}, getHeaders());
            setSeedMessage(res.data.message);
            fetchPaymentTypes();
            setTimeout(() => setSeedMessage(null), 5000);
        } catch (error: any) {
            const msg = error.response?.data?.error || 'Ошибка создания базовых типов';
            setSeedError(msg);
            setTimeout(() => setSeedError(null), 10000);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900">Типы оплат</h1>
                <div className="flex gap-2">
                    <button
                        onClick={handleSeed}
                        className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                        🌱 Создать базовые
                    </button>
                    <button
                        onClick={handleCreate}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                    >
                        ➕ Добавить тип
                    </button>
                </div>
            </div>

            {seedMessage && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
                    {seedMessage}
                </div>
            )}

            {seedError && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm whitespace-pre-line">
                    {seedError}
                </div>
            )}

            <div className="flex items-center gap-2 mb-4">
                <input
                    type="checkbox"
                    id="showDisabled"
                    checked={showDisabled}
                    onChange={(e) => setShowDisabled(e.target.checked)}
                    className="w-4 h-4"
                />
                <label htmlFor="showDisabled" className="text-sm text-slate-600">
                    Показать отключённые
                </label>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Загрузка...</div>
                ) : paymentTypes.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        Нет типов оплат. Нажмите "Создать базовые" для добавления стандартных типов.
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-900 text-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Название</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">ID оплаты</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Статус</th>
                                <th className="px-4 py-3 text-right text-sm font-semibold">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paymentTypes.map(pt => (
                                <tr key={pt.id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="px-4 py-3">
                                        <span style={{
                                            color: pt.isDisabled ? '#94a3b8' : '#0f172a',
                                            textDecoration: pt.isDisabled ? 'line-through' : 'none'
                                        }}>
                                            {pt.name}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {pt.paymentId ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                                {pt.paymentId}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 text-xs">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${pt.isDisabled
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-green-100 text-green-700'
                                            }`}>
                                            {pt.isDisabled ? 'Отключён' : 'Активен'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleEdit(pt)}
                                            className="px-3 py-1 text-xs text-blue-600 hover:text-blue-800 mr-2"
                                        >
                                            ✏️ Редактировать
                                        </button>
                                        <button
                                            onClick={() => handleToggle(pt)}
                                            className={`px-3 py-1 text-xs ${pt.isDisabled
                                                ? 'text-green-600 hover:text-green-800'
                                                : 'text-orange-600 hover:text-orange-800'
                                                }`}
                                        >
                                            {pt.isDisabled ? '✅ Включить' : '🚫 Отключить'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Модальное окно */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800">
                                {editingType ? 'Редактировать тип оплаты' : 'Новый тип оплаты'}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Название
                                </label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="Например: Наличные"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    ID оплаты
                                </label>
                                <input
                                    type="text"
                                    value={formPaymentId}
                                    onChange={(e) => setFormPaymentId(e.target.value)}
                                    placeholder="Например: ID4"
                                    maxLength={32}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="mt-1 text-xs text-slate-400">
                                    ID1, ID2, ID3 зарезервированы для базовых типов
                                </p>
                            </div>
                            {formError && (
                                <p className="mb-4 text-sm text-red-600">{formError}</p>
                            )}
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {saving ? 'Сохранение...' : (editingType ? 'Сохранить' : 'Создать')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentTypesPage;

