import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';

// ============================================
// Types
// ============================================

interface Supplier { id: number; name: string; code: string; }
interface Product { id: number; code: string; name: string; }
interface User { id: number; name: string; username: string; }

interface SupplierReturn {
    id: number;
    supplierId: number;
    returnDate: string;
    totalAmount: number;
    isDisabled: boolean;
    createdByUser: User | null;
    supplier: Supplier;
    items?: ReturnItem[];
    _count?: { items: number };
}

interface ReturnItem {
    id?: number;
    productId: number;
    price: number;
    qty: number;
    amount: number;
    product?: Product;
}

interface SupplierPayment {
    id: number;
    supplierId: number;
    paymentDate: string;
    amount: number;
    method: string;
    reference: string | null;
    comment: string | null;
    createdByUser: User | null;
    supplier: Supplier;
    deletedAt: string | null;
}

interface StatementEntry {
    id: number;
    sourceType: string;
    sourceId: number;
    operationName: string;
    opDate: string;
    debit: number;
    credit: number;
    saldoAfter: number;
}

interface StatementData {
    supplierId: number;
    openingBalance: number;
    entries: StatementEntry[];
    totals: { debit: number; credit: number; balance: number; };
}

// ============================================
// Main Page
// ============================================

const SupplierAccountPage: React.FC = () => {
    const [tab, setTab] = useState<'returns' | 'payments' | 'statement'>('returns');
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);

    const getHeaders = () => ({
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });

    useEffect(() => {
        axios.get(`${API_URL}/api/suppliers`, getHeaders())
            .then(res => {
                const data = Array.isArray(res.data) ? res.data : res.data.data || [];
                setSuppliers(data);
            })
            .catch(err => console.error('Error fetching suppliers:', err));
    }, []);

    // ============================================
    // Shared Styles
    // ============================================
    const styles = {
        page: { padding: '24px', maxWidth: '1400px', margin: '0 auto' } as React.CSSProperties,
        header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' as const, gap: '12px' },
        title: { fontSize: '24px', fontWeight: 700, color: '#1a1a2e' },
        select: { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', minWidth: '250px', background: '#fff' },
        tabs: { display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb', paddingBottom: '0' },
        tab: (active: boolean) => ({
            padding: '10px 20px', cursor: 'pointer', fontWeight: active ? 600 : 400,
            color: active ? '#4f46e5' : '#6b7280', borderBottom: active ? '2px solid #4f46e5' : '2px solid transparent',
            marginBottom: '-2px', background: 'none', border: 'none', fontSize: '14px', transition: 'all 0.2s'
        } as React.CSSProperties),
        card: { background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '16px' },
        table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '14px' },
        th: { textAlign: 'left' as const, padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' as const },
        td: { padding: '10px 12px', borderBottom: '1px solid #f3f4f6' },
        btn: (variant: 'primary' | 'danger' | 'secondary') => ({
            padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '14px',
            color: variant === 'secondary' ? '#374151' : '#fff',
            background: variant === 'primary' ? '#4f46e5' : variant === 'danger' ? '#ef4444' : '#f3f4f6',
            transition: 'opacity 0.2s'
        } as React.CSSProperties),
        filterRow: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: '16px' },
        input: { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' },
        modal: {
            position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        },
        modalContent: { background: '#fff', borderRadius: '16px', padding: '24px', width: '600px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' as const },
        disabled: { opacity: 0.5, textDecoration: 'line-through' },
        badge: (color: string) => ({
            display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
            background: color === 'red' ? '#fef2f2' : color === 'green' ? '#f0fdf4' : '#f5f3ff',
            color: color === 'red' ? '#dc2626' : color === 'green' ? '#16a34a' : '#7c3aed'
        }),
        amount: (v: number) => ({ fontWeight: 600, color: v > 0 ? '#16a34a' : v < 0 ? '#dc2626' : '#374151' }),
    };

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <h1 style={styles.title}>Расчёты с поставщиками</h1>
                </div>
                <select
                    style={styles.select}
                    value={selectedSupplierId ?? ''}
                    onChange={(e) => setSelectedSupplierId(e.target.value ? Number(e.target.value) : null)}
                >
                    <option value="">— Все поставщики —</option>
                    {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                </select>
            </div>

            <div style={styles.tabs}>
                <button style={styles.tab(tab === 'returns')} onClick={() => setTab('returns')}>Возвраты</button>
                <button style={styles.tab(tab === 'payments')} onClick={() => setTab('payments')}>Оплаты</button>
                <button style={styles.tab(tab === 'statement')} onClick={() => setTab('statement')}>Акт сверки</button>
            </div>

            {tab === 'returns' && <ReturnsTab supplierId={selectedSupplierId} suppliers={suppliers} styles={styles} getHeaders={getHeaders} />}
            {tab === 'payments' && <PaymentsTab supplierId={selectedSupplierId} suppliers={suppliers} styles={styles} getHeaders={getHeaders} />}
            {tab === 'statement' && <StatementTab supplierId={selectedSupplierId} styles={styles} getHeaders={getHeaders} />}
        </div>
    );
};

// ============================================
// RETURNS TAB
// ============================================

interface TabProps {
    supplierId: number | null;
    suppliers?: Supplier[];
    styles: any;
    getHeaders: () => any;
}

const ReturnsTab: React.FC<TabProps> = ({ supplierId, suppliers = [], styles, getHeaders }) => {
    const [returns, setReturns] = useState<SupplierReturn[]>([]);
    const [loading, setLoading] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingReturn, setEditingReturn] = useState<SupplierReturn | null>(null);
    const [products, setProducts] = useState<Product[]>([]);

    // Form
    const [formSupplierId, setFormSupplierId] = useState<number | ''>('');
    const [formDate, setFormDate] = useState('');
    const [formItems, setFormItems] = useState<ReturnItem[]>([]);

    const fetchReturns = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (supplierId) params.set('supplierId', String(supplierId));
            if (dateFrom) params.set('dateFrom', dateFrom);
            if (dateTo) params.set('dateTo', dateTo);
            const res = await axios.get(`${API_URL}/api/suppliers/returns?${params}`, getHeaders());
            setReturns(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [supplierId, dateFrom, dateTo]);

    useEffect(() => { fetchReturns(); }, [fetchReturns]);

    useEffect(() => {
        axios.get(`${API_URL}/api/products`, getHeaders())
            .then(res => setProducts(Array.isArray(res.data) ? res.data : res.data.data || []))
            .catch(() => { });
    }, []);

    const openCreate = () => {
        setEditingReturn(null);
        setFormSupplierId(supplierId || '');
        setFormDate(new Date().toISOString().split('T')[0]);
        setFormItems([{ productId: 0, price: 0, qty: 0, amount: 0 }]);
        setShowModal(true);
    };

    const openEdit = async (r: SupplierReturn) => {
        try {
            const res = await axios.get(`${API_URL}/api/suppliers/returns/${r.id}`, getHeaders());
            const full = res.data;
            setEditingReturn(full);
            setFormSupplierId(full.supplierId);
            setFormDate(full.returnDate.split('T')[0]);
            setFormItems(full.items.map((i: any) => ({
                productId: i.productId, price: Number(i.price), qty: Number(i.qty), amount: Number(i.amount)
            })));
            setShowModal(true);
        } catch (err) { console.error(err); }
    };

    const handleSave = async () => {
        const validItems = formItems.filter(i => i.productId > 0 && i.qty > 0);
        if (!formSupplierId || !formDate || validItems.length === 0) return alert('Заполните все поля');

        const data = { supplierId: formSupplierId, returnDate: formDate, items: validItems };
        try {
            if (editingReturn) {
                await axios.put(`${API_URL}/api/suppliers/returns/${editingReturn.id}`, data, getHeaders());
            } else {
                await axios.post(`${API_URL}/api/suppliers/returns`, data, getHeaders());
            }
            setShowModal(false);
            fetchReturns();
        } catch (err) { console.error(err); alert('Ошибка сохранения'); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Отключить этот возврат?')) return;
        try {
            await axios.delete(`${API_URL}/api/suppliers/returns/${id}`, getHeaders());
            fetchReturns();
        } catch (err) { console.error(err); }
    };

    const updateItem = (idx: number, field: string, value: any) => {
        setFormItems(prev => {
            const updated = [...prev];
            (updated[idx] as any)[field] = value;
            if (field === 'price' || field === 'qty') {
                updated[idx].amount = Number(updated[idx].price) * Number(updated[idx].qty);
            }
            return updated;
        });
    };

    const addItem = () => setFormItems(prev => [...prev, { productId: 0, price: 0, qty: 0, amount: 0 }]);
    const removeItem = (idx: number) => setFormItems(prev => prev.filter((_, i) => i !== idx));

    return (
        <div>
            <div style={styles.filterRow}>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={styles.input} />
                <span>—</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={styles.input} />
                <button style={styles.btn('secondary')} onClick={fetchReturns}>Применить</button>
                <div style={{ flex: 1 }} />
                <button style={styles.btn('primary')} onClick={openCreate}>+ Новый возврат</button>
            </div>

            <div style={styles.card}>
                {loading ? <p>Загрузка...</p> : (
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>#</th>
                                <th style={styles.th}>Дата</th>
                                <th style={styles.th}>Поставщик</th>
                                <th style={styles.th}>Сумма</th>
                                <th style={styles.th}>Позиций</th>
                                <th style={styles.th}>Создал</th>
                                <th style={styles.th}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {returns.length === 0 && (
                                <tr><td style={styles.td} colSpan={7}>Нет данных</td></tr>
                            )}
                            {returns.map(r => (
                                <tr key={r.id} style={r.isDisabled ? styles.disabled : {}}>
                                    <td style={styles.td}>{r.id}</td>
                                    <td style={styles.td}>{new Date(r.returnDate).toLocaleDateString('ru-RU')}</td>
                                    <td style={styles.td}>{r.supplier?.name}</td>
                                    <td style={styles.td}><b>{Number(r.totalAmount).toLocaleString('ru-RU', { minimumFractionDigits: 2 })}</b></td>
                                    <td style={styles.td}>{r._count?.items ?? '—'}</td>
                                    <td style={styles.td}>{r.createdByUser?.name || '—'}</td>
                                    <td style={styles.td}>
                                        {!r.isDisabled && (
                                            <>
                                                <button style={{ ...styles.btn('secondary'), marginRight: '8px', padding: '4px 10px' }} onClick={() => openEdit(r)}>✏️</button>
                                                <button style={{ ...styles.btn('danger'), padding: '4px 10px' }} onClick={() => handleDelete(r.id)}>🗑</button>
                                            </>
                                        )}
                                        {r.isDisabled && <span style={styles.badge('red')}>Отключён</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div style={styles.modal} onClick={() => setShowModal(false)}>
                    <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>{editingReturn ? 'Редактирование возврата' : 'Новый возврат'}</h2>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ fontSize: '12px', color: '#6b7280' }}>Поставщик</label>
                                <select style={{ ...styles.select, width: '100%' }} value={formSupplierId} onChange={e => setFormSupplierId(Number(e.target.value))} disabled={!!editingReturn}>
                                    <option value="">Выберите...</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: '#6b7280' }}>Дата</label>
                                <input type="date" style={{ ...styles.input, width: '100%' }} value={formDate} onChange={e => setFormDate(e.target.value)} />
                            </div>
                        </div>

                        <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>Товары</h3>
                        <table style={{ ...styles.table, marginBottom: '12px' }}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Товар</th>
                                    <th style={{ ...styles.th, width: '100px' }}>Цена</th>
                                    <th style={{ ...styles.th, width: '80px' }}>Кол-во</th>
                                    <th style={{ ...styles.th, width: '100px' }}>Сумма</th>
                                    <th style={{ ...styles.th, width: '40px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {formItems.map((item, idx) => (
                                    <tr key={idx}>
                                        <td style={styles.td}>
                                            <select style={{ ...styles.select, width: '100%', minWidth: '120px' }} value={item.productId} onChange={e => updateItem(idx, 'productId', Number(e.target.value))}>
                                                <option value={0}>Выберите...</option>
                                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </td>
                                        <td style={styles.td}><input type="number" style={{ ...styles.input, width: '80px' }} value={item.price || ''} onChange={e => updateItem(idx, 'price', Number(e.target.value))} /></td>
                                        <td style={styles.td}><input type="number" style={{ ...styles.input, width: '60px' }} value={item.qty || ''} onChange={e => updateItem(idx, 'qty', Number(e.target.value))} /></td>
                                        <td style={styles.td}><b>{item.amount.toFixed(2)}</b></td>
                                        <td style={styles.td}><button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>✕</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button style={{ ...styles.btn('secondary'), marginBottom: '16px' }} onClick={addItem}>+ Добавить товар</button>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <b>Итого: {formItems.reduce((s, i) => s + i.amount, 0).toFixed(2)}</b>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button style={styles.btn('secondary')} onClick={() => setShowModal(false)}>Отмена</button>
                                <button style={styles.btn('primary')} onClick={handleSave}>Сохранить</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// PAYMENTS TAB
// ============================================

const PaymentsTab: React.FC<TabProps> = ({ supplierId, suppliers = [], styles, getHeaders }) => {
    const [payments, setPayments] = useState<SupplierPayment[]>([]);
    const [loading, setLoading] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingPayment, setEditingPayment] = useState<SupplierPayment | null>(null);

    const [formSupplierId, setFormSupplierId] = useState<number | ''>('');
    const [formDate, setFormDate] = useState('');
    const [formAmount, setFormAmount] = useState<number>(0);
    const [formMethod, setFormMethod] = useState('CASH');
    const [formReference, setFormReference] = useState('');
    const [formComment, setFormComment] = useState('');

    const fetchPayments = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (supplierId) params.set('supplierId', String(supplierId));
            if (dateFrom) params.set('dateFrom', dateFrom);
            if (dateTo) params.set('dateTo', dateTo);
            const res = await axios.get(`${API_URL}/api/suppliers/payments?${params}`, getHeaders());
            setPayments(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [supplierId, dateFrom, dateTo]);

    useEffect(() => { fetchPayments(); }, [fetchPayments]);

    const methodLabels: Record<string, string> = { CASH: 'Наличные', BANK: 'Банк', CARD: 'Карта', OTHER: 'Другое' };

    const openCreate = () => {
        setEditingPayment(null);
        setFormSupplierId(supplierId || '');
        setFormDate(new Date().toISOString().split('T')[0]);
        setFormAmount(0);
        setFormMethod('CASH');
        setFormReference('');
        setFormComment('');
        setShowModal(true);
    };

    const openEdit = (p: SupplierPayment) => {
        setEditingPayment(p);
        setFormSupplierId(p.supplierId);
        setFormDate(p.paymentDate.split('T')[0]);
        setFormAmount(Number(p.amount));
        setFormMethod(p.method);
        setFormReference(p.reference || '');
        setFormComment(p.comment || '');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formSupplierId || !formDate || formAmount <= 0) return alert('Заполните все поля');
        const data = { supplierId: formSupplierId, paymentDate: formDate, amount: formAmount, method: formMethod, reference: formReference || null, comment: formComment || null };
        try {
            if (editingPayment) {
                await axios.put(`${API_URL}/api/suppliers/payments/${editingPayment.id}`, data, getHeaders());
            } else {
                await axios.post(`${API_URL}/api/suppliers/payments`, data, getHeaders());
            }
            setShowModal(false);
            fetchPayments();
        } catch (err) { console.error(err); alert('Ошибка сохранения'); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Удалить эту оплату?')) return;
        try {
            await axios.delete(`${API_URL}/api/suppliers/payments/${id}`, getHeaders());
            fetchPayments();
        } catch (err) { console.error(err); }
    };

    return (
        <div>
            <div style={styles.filterRow}>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={styles.input} />
                <span>—</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={styles.input} />
                <button style={styles.btn('secondary')} onClick={fetchPayments}>Применить</button>
                <div style={{ flex: 1 }} />
                <button style={styles.btn('primary')} onClick={openCreate}>+ Новая оплата</button>
            </div>

            <div style={styles.card}>
                {loading ? <p>Загрузка...</p> : (
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>#</th>
                                <th style={styles.th}>Дата</th>
                                <th style={styles.th}>Поставщик</th>
                                <th style={styles.th}>Сумма</th>
                                <th style={styles.th}>Способ</th>
                                <th style={styles.th}>Реф.</th>
                                <th style={styles.th}>Комментарий</th>
                                <th style={styles.th}>Создал</th>
                                <th style={styles.th}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.length === 0 && (
                                <tr><td style={styles.td} colSpan={9}>Нет данных</td></tr>
                            )}
                            {payments.map(p => (
                                <tr key={p.id} style={p.deletedAt ? styles.disabled : {}}>
                                    <td style={styles.td}>{p.id}</td>
                                    <td style={styles.td}>{new Date(p.paymentDate).toLocaleDateString('ru-RU')}</td>
                                    <td style={styles.td}>{p.supplier?.name}</td>
                                    <td style={styles.td}><b>{Number(p.amount).toLocaleString('ru-RU', { minimumFractionDigits: 2 })}</b></td>
                                    <td style={styles.td}><span style={styles.badge('purple')}>{methodLabels[p.method] || p.method}</span></td>
                                    <td style={styles.td}>{p.reference || '—'}</td>
                                    <td style={styles.td}>{p.comment || '—'}</td>
                                    <td style={styles.td}>{p.createdByUser?.name || '—'}</td>
                                    <td style={styles.td}>
                                        {!p.deletedAt && (
                                            <>
                                                <button style={{ ...styles.btn('secondary'), marginRight: '8px', padding: '4px 10px' }} onClick={() => openEdit(p)}>✏️</button>
                                                <button style={{ ...styles.btn('danger'), padding: '4px 10px' }} onClick={() => handleDelete(p.id)}>🗑</button>
                                            </>
                                        )}
                                        {p.deletedAt && <span style={styles.badge('red')}>Удалён</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div style={styles.modal} onClick={() => setShowModal(false)}>
                    <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>{editingPayment ? 'Редактирование оплаты' : 'Новая оплата'}</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ fontSize: '12px', color: '#6b7280' }}>Поставщик</label>
                                <select style={{ ...styles.select, width: '100%' }} value={formSupplierId} onChange={e => setFormSupplierId(Number(e.target.value))} disabled={!!editingPayment}>
                                    <option value="">Выберите...</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: '#6b7280' }}>Дата</label>
                                <input type="date" style={{ ...styles.input, width: '100%' }} value={formDate} onChange={e => setFormDate(e.target.value)} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: '#6b7280' }}>Сумма</label>
                                <input type="number" style={{ ...styles.input, width: '100%' }} value={formAmount || ''} onChange={e => setFormAmount(Number(e.target.value))} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: '#6b7280' }}>Способ оплаты</label>
                                <select style={{ ...styles.select, width: '100%' }} value={formMethod} onChange={e => setFormMethod(e.target.value)}>
                                    <option value="CASH">Наличные</option>
                                    <option value="BANK">Банк</option>
                                    <option value="CARD">Карта</option>
                                    <option value="OTHER">Другое</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: '#6b7280' }}>Номер документа</label>
                                <input style={{ ...styles.input, width: '100%' }} value={formReference} onChange={e => setFormReference(e.target.value)} placeholder="Необязательно" />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: '#6b7280' }}>Комментарий</label>
                                <input style={{ ...styles.input, width: '100%' }} value={formComment} onChange={e => setFormComment(e.target.value)} placeholder="Необязательно" />
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button style={styles.btn('secondary')} onClick={() => setShowModal(false)}>Отмена</button>
                            <button style={styles.btn('primary')} onClick={handleSave}>Сохранить</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// STATEMENT TAB
// ============================================

const StatementTab: React.FC<TabProps> = ({ supplierId, styles, getHeaders }) => {
    const [statement, setStatement] = useState<StatementData | null>(null);
    const [loading, setLoading] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const fetchStatement = useCallback(async () => {
        if (!supplierId) { setStatement(null); return; }
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (dateFrom) params.set('dateFrom', dateFrom);
            if (dateTo) params.set('dateTo', dateTo);
            const res = await axios.get(`${API_URL}/api/suppliers/${supplierId}/statement?${params}`, getHeaders());
            setStatement(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [supplierId, dateFrom, dateTo]);

    useEffect(() => { fetchStatement(); }, [fetchStatement]);

    const sourceTypeLabels: Record<string, string> = {
        PURCHASE: 'Закупка',
        SUPPLIER_RETURN: 'Возврат',
        SUPPLIER_PAYMENT: 'Оплата',
        OPENING_BALANCE: 'Нач. сальдо',
    };

    const sourceTypeColors: Record<string, string> = {
        PURCHASE: 'green',
        SUPPLIER_RETURN: 'purple',
        SUPPLIER_PAYMENT: 'purple',
        OPENING_BALANCE: 'red',
    };

    if (!supplierId) {
        return (
            <div style={styles.card}>
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>
                    Выберите поставщика для просмотра акта сверки
                </p>
            </div>
        );
    }

    return (
        <div>
            <div style={styles.filterRow}>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={styles.input} />
                <span>—</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={styles.input} />
                <button style={styles.btn('secondary')} onClick={fetchStatement}>Применить</button>
            </div>

            <div style={styles.card}>
                {loading ? <p>Загрузка...</p> : !statement ? <p>Нет данных</p> : (
                    <>
                        {statement.openingBalance !== 0 && (
                            <div style={{ padding: '10px 16px', background: '#f5f3ff', borderRadius: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Входящее сальдо</span>
                                <b style={styles.amount(statement.openingBalance)}>{statement.openingBalance.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}</b>
                            </div>
                        )}

                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Дата</th>
                                    <th style={styles.th}>Тип</th>
                                    <th style={styles.th}>Операция</th>
                                    <th style={{ ...styles.th, textAlign: 'right' }}>Дебет</th>
                                    <th style={{ ...styles.th, textAlign: 'right' }}>Кредит</th>
                                    <th style={{ ...styles.th, textAlign: 'right' }}>Сальдо</th>
                                </tr>
                            </thead>
                            <tbody>
                                {statement.entries.length === 0 && (
                                    <tr><td style={styles.td} colSpan={6}>Нет операций за период</td></tr>
                                )}
                                {statement.entries.map(e => (
                                    <tr key={e.id}>
                                        <td style={styles.td}>{new Date(e.opDate).toLocaleDateString('ru-RU')}</td>
                                        <td style={styles.td}>
                                            <span style={styles.badge(sourceTypeColors[e.sourceType] || 'purple')}>
                                                {sourceTypeLabels[e.sourceType] || e.sourceType}
                                            </span>
                                        </td>
                                        <td style={styles.td}>{e.operationName}</td>
                                        <td style={{ ...styles.td, textAlign: 'right', color: e.debit > 0 ? '#16a34a' : '#d1d5db' }}>
                                            {e.debit > 0 ? e.debit.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) : '—'}
                                        </td>
                                        <td style={{ ...styles.td, textAlign: 'right', color: e.credit > 0 ? '#dc2626' : '#d1d5db' }}>
                                            {e.credit > 0 ? e.credit.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) : '—'}
                                        </td>
                                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                                            <span style={styles.amount(e.saldoAfter)}>
                                                {e.saldoAfter.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Totals */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '32px', padding: '16px 0', borderTop: '2px solid #e5e7eb', marginTop: '8px' }}>
                            <div>Итого дебет: <b style={{ color: '#16a34a' }}>{statement.totals.debit.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}</b></div>
                            <div>Итого кредит: <b style={{ color: '#dc2626' }}>{statement.totals.credit.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}</b></div>
                            <div>Баланс: <b style={styles.amount(statement.totals.balance)}>{statement.totals.balance.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}</b></div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default SupplierAccountPage;
