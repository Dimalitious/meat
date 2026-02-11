import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';

// ============================================
// Types
// ============================================

interface Customer {
    id: number;
    code: string;
    name: string;
    legalName: string | null;
    district: { code: string; name: string } | null;
    manager: { code: string; name: string } | null;
    _salesManagers?: { user: { id: number; name: string; username: string }; assignedAt: string }[];
}

interface DraftItem {
    id: number;
    productId: number | null;
    rawText: string;
    title: string | null;
    quantity: number | null;
    unit: string | null;
}

interface Draft {
    id: number;
    customerId: number;
    status: string;
    note: string | null;
    createdAt: string;
    updatedAt: string;
    managerDecisionNote: string | null;
    rejectedAt: string | null;
    acceptedAt: string | null;
    customer: { id: number; name: string; code: string };
    items: DraftItem[];
    _count?: { items: number };
}

interface StatementEntry {
    sourceType: string;
    sourceId: number;
    operationName: string;
    opDate: string;
    debit: number;
    credit: number;
    saldoAfter: number;
}

interface StatementData {
    customerId: number;
    openingBalance: number;
    entries: StatementEntry[];
    totals: { debit: number; credit: number; balance: number };
}

interface Refund {
    id: number;
    customerId: number;
    refundDate: string;
    amount: number;
    paymentTypeId: number | null;
    reference: string | null;
    comment: string | null;
    proofUrl: string | null;
    deletedAt: string | null;
    createdByUser: { name: string } | null;
    paymentType: { name: string } | null;
}

interface PaymentType {
    id: number;
    name: string;
}

// ============================================
// Main Page
// ============================================

const SalesManagerPage: React.FC = () => {
    const [tab, setTab] = useState<'customers' | 'drafts' | 'statement' | 'refunds'>('customers');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

    const getHeaders = () => ({
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });

    // Load customers for the dropdown (used in statement/refunds)
    useEffect(() => {
        axios.get(`${API_URL}/api/sales-manager/customers?pageSize=500`, getHeaders())
            .then(res => {
                const data = res.data.data || res.data || [];
                setCustomers(Array.isArray(data) ? data : []);
            })
            .catch(err => console.error('Error fetching customers:', err));
    }, []);

    // ============================================
    // Shared Styles (same as SupplierAccountPage)
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
        btn: (variant: 'primary' | 'danger' | 'secondary' | 'success' | 'warning') => ({
            padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '14px',
            color: variant === 'secondary' ? '#374151' : '#fff',
            background: variant === 'primary' ? '#4f46e5' : variant === 'danger' ? '#ef4444' : variant === 'success' ? '#16a34a' : variant === 'warning' ? '#f59e0b' : '#f3f4f6',
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
            background: color === 'red' ? '#fef2f2' : color === 'green' ? '#f0fdf4' : color === 'blue' ? '#eff6ff' : color === 'yellow' ? '#fefce8' : '#f5f3ff',
            color: color === 'red' ? '#dc2626' : color === 'green' ? '#16a34a' : color === 'blue' ? '#2563eb' : color === 'yellow' ? '#ca8a04' : '#7c3aed'
        }),
        amount: (v: number) => ({ fontWeight: 600, color: v > 0 ? '#16a34a' : v < 0 ? '#dc2626' : '#374151' }),
    };

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <h1 style={styles.title}>Менеджер продаж</h1>
                {(tab === 'statement' || tab === 'refunds') && (
                    <select
                        style={styles.select}
                        value={selectedCustomerId ?? ''}
                        onChange={(e) => setSelectedCustomerId(e.target.value ? Number(e.target.value) : null)}
                    >
                        <option value="">— Выберите клиента —</option>
                        {customers.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                        ))}
                    </select>
                )}
            </div>

            <div style={styles.tabs}>
                <button style={styles.tab(tab === 'customers')} onClick={() => setTab('customers')}>Клиенты</button>
                <button style={styles.tab(tab === 'drafts')} onClick={() => setTab('drafts')}>Заявки</button>
                <button style={styles.tab(tab === 'statement')} onClick={() => setTab('statement')}>Акт сверки</button>
                <button style={styles.tab(tab === 'refunds')} onClick={() => setTab('refunds')}>Возвраты денег</button>
            </div>

            {tab === 'customers' && <CustomersTab styles={styles} getHeaders={getHeaders} />}
            {tab === 'drafts' && <DraftsTab styles={styles} getHeaders={getHeaders} />}
            {tab === 'statement' && <StatementTab customerId={selectedCustomerId} styles={styles} getHeaders={getHeaders} />}
            {tab === 'refunds' && <RefundsTab customerId={selectedCustomerId} customers={customers} styles={styles} getHeaders={getHeaders} />}
        </div>
    );
};

// ============================================
// CUSTOMERS TAB
// ============================================

interface TabProps {
    customerId?: number | null;
    customers?: Customer[];
    styles: any;
    getHeaders: () => any;
}

const CustomersTab: React.FC<TabProps> = ({ styles, getHeaders }) => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    // Address modal state
    const [geoCustomer, setGeoCustomer] = useState<Customer | null>(null);
    const [addresses, setAddresses] = useState<any[]>([]);
    const [addrLoading, setAddrLoading] = useState(false);
    const [addrForm, setAddrForm] = useState<{
        id?: number; label: string; addressText: string; lat: string; lng: string;
        accuracyM: string; comment: string; isDefault: boolean;
    } | null>(null);
    const [addrSaving, setAddrSaving] = useState(false);

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.set('q', search);
            params.set('pageSize', '100');
            const res = await axios.get(`${API_URL}/api/sales-manager/customers?${params}`, getHeaders());
            const data = res.data.customers || res.data.data || res.data || [];
            setCustomers(Array.isArray(data) ? data : []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [search]);

    useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

    // ── Address management helpers ──
    const fetchAddresses = useCallback(async (customerId: number) => {
        setAddrLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/sales-manager/customers/${customerId}/addresses`, getHeaders());
            setAddresses(Array.isArray(res.data) ? res.data : []);
        } catch (err) { console.error(err); }
        finally { setAddrLoading(false); }
    }, []);

    const openGeoModal = (c: Customer) => {
        setGeoCustomer(c);
        setAddrForm(null);
        fetchAddresses(c.id);
    };

    const closeGeoModal = () => {
        setGeoCustomer(null);
        setAddresses([]);
        setAddrForm(null);
    };

    const normCoord = (v: string) => v.replace(',', '.');

    const openAddForm = () => {
        setAddrForm({ label: '', addressText: '', lat: '', lng: '', accuracyM: '', comment: '', isDefault: false });
    };

    const openEditForm = (a: any) => {
        setAddrForm({
            id: a.id,
            label: a.label || '',
            addressText: a.addressText || '',
            lat: String(a.lat),
            lng: String(a.lng),
            accuracyM: a.accuracyM != null ? String(a.accuracyM) : '',
            comment: a.comment || '',
            isDefault: a.isDefault || false,
        });
    };

    const handleSaveAddr = async () => {
        if (!geoCustomer || !addrForm) return;
        const lat = normCoord(addrForm.lat);
        const lng = normCoord(addrForm.lng);
        if (!addrForm.addressText.trim()) return alert('Введите адрес');
        if (!lat || !lng) return alert('Введите координаты');
        setAddrSaving(true);
        try {
            const body = {
                label: addrForm.label || null,
                addressText: addrForm.addressText,
                lat, lng,
                accuracyM: addrForm.accuracyM ? Number(addrForm.accuracyM) : null,
                comment: addrForm.comment || null,
                isDefault: addrForm.isDefault,
            };
            if (addrForm.id) {
                await axios.patch(`${API_URL}/api/sales-manager/customers/${geoCustomer.id}/addresses/${addrForm.id}`, body, getHeaders());
            } else {
                await axios.post(`${API_URL}/api/sales-manager/customers/${geoCustomer.id}/addresses`, body, getHeaders());
            }
            setAddrForm(null);
            fetchAddresses(geoCustomer.id);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка сохранения адреса');
        } finally { setAddrSaving(false); }
    };

    const handleDeleteAddr = async (addressId: number) => {
        if (!geoCustomer || !confirm('Удалить этот адрес?')) return;
        try {
            await axios.delete(`${API_URL}/api/sales-manager/customers/${geoCustomer.id}/addresses/${addressId}`, getHeaders());
            fetchAddresses(geoCustomer.id);
        } catch (err: any) { alert(err.response?.data?.error || 'Ошибка удаления'); }
    };

    const handleMakeDefault = async (addressId: number) => {
        if (!geoCustomer) return;
        try {
            await axios.post(`${API_URL}/api/sales-manager/customers/${geoCustomer.id}/addresses/${addressId}/make-default`, {}, getHeaders());
            fetchAddresses(geoCustomer.id);
        } catch (err: any) { alert(err.response?.data?.error || 'Ошибка'); }
    };

    return (
        <div>
            <div style={styles.filterRow}>
                <input
                    style={{ ...styles.input, minWidth: '250px' }}
                    placeholder="Поиск по имени или коду..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchCustomers()}
                />
                <button style={styles.btn('secondary')} onClick={fetchCustomers}>Поиск</button>
            </div>

            <div style={styles.card}>
                {loading ? <p>Загрузка...</p> : (
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Код</th>
                                <th style={styles.th}>Название</th>
                                <th style={styles.th}>Юр. лицо</th>
                                <th style={styles.th}>Район</th>
                                <th style={styles.th}>Менеджер (справочник)</th>
                                <th style={styles.th}>Назначенные менеджеры</th>
                                <th style={styles.th}>Гео</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.length === 0 && (
                                <tr><td style={styles.td} colSpan={7}>Нет данных</td></tr>
                            )}
                            {customers.map(c => (
                                <tr key={c.id}>
                                    <td style={styles.td}><b>{c.code}</b></td>
                                    <td style={styles.td}>{c.name}</td>
                                    <td style={styles.td}>{c.legalName || '—'}</td>
                                    <td style={styles.td}>{c.district?.name || '—'}</td>
                                    <td style={styles.td}>{c.manager?.name || '—'}</td>
                                    <td style={styles.td}>
                                        {c._salesManagers && c._salesManagers.length > 0
                                            ? c._salesManagers.map(sm => (
                                                <span key={sm.user.id} style={styles.badge('blue')}>
                                                    {sm.user.name || sm.user.username}
                                                </span>
                                            ))
                                            : <span style={{ color: '#9ca3af' }}>—</span>
                                        }
                                    </td>
                                    <td style={styles.td}>
                                        <button
                                            style={{ ...styles.btn('secondary'), padding: '4px 10px' }}
                                            onClick={() => openGeoModal(c)}
                                            title="Управление адресами доставки"
                                        >📍</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── Geo Address Modal ── */}
            {geoCustomer && (
                <div style={styles.modal} onClick={closeGeoModal}>
                    <div style={{ ...styles.modalContent, width: '700px' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>
                            📍 Адреса доставки — {geoCustomer.name}
                        </h2>

                        {/* Address list */}
                        {addrLoading ? <p>Загрузка...</p> : (
                            <>
                                {addresses.length === 0 && !addrForm && (
                                    <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>
                                        Нет адресов. Добавьте первый.
                                    </p>
                                )}
                                {addresses.map(a => (
                                    <div key={a.id} style={{
                                        padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px',
                                        marginBottom: '8px', background: a.isDefault ? '#f0fdf4' : '#fff',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>
                                                    {a.label && <span style={styles.badge('blue')}>{a.label}</span>}{' '}
                                                    {a.addressText}
                                                    {a.isDefault && <span style={{ ...styles.badge('green'), marginLeft: '8px' }}>По умолчанию</span>}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                                                    {(() => {
                                                        const lat = parseFloat(String(a.lat).replace(',', '.'));
                                                        const lng = parseFloat(String(a.lng).replace(',', '.'));
                                                        if (Number.isFinite(lat) && Number.isFinite(lng)) {
                                                            return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                                                        }
                                                        return `${a.lat}, ${a.lng}`;
                                                    })()}
                                                    {a.accuracyM != null && <span> • ~{a.accuracyM}м</span>}
                                                </div>
                                                {a.comment && (
                                                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>💬 {a.comment}</div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                {!a.isDefault && (
                                                    <button style={{ ...styles.btn('success'), padding: '2px 8px', fontSize: '12px' }} onClick={() => handleMakeDefault(a.id)} title="Сделать по умолчанию">⭐</button>
                                                )}
                                                <button style={{ ...styles.btn('secondary'), padding: '2px 8px', fontSize: '12px' }} onClick={() => openEditForm(a)} title="Редактировать">✏️</button>
                                                <button style={{ ...styles.btn('danger'), padding: '2px 8px', fontSize: '12px' }} onClick={() => handleDeleteAddr(a.id)} title="Удалить">🗑️</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}

                        {/* Add/Edit form */}
                        {addrForm ? (
                            <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', marginTop: '12px', background: '#fafafa' }}>
                                <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>
                                    {addrForm.id ? 'Редактировать адрес' : 'Новый адрес'}
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div>
                                        <label style={{ fontSize: '12px', color: '#6b7280' }}>Подкатегория</label>
                                        <input style={{ ...styles.input, width: '100%' }} value={addrForm.label} onChange={e => setAddrForm({ ...addrForm, label: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', color: '#6b7280' }}>Адрес *</label>
                                        <input style={{ ...styles.input, width: '100%' }} value={addrForm.addressText} onChange={e => setAddrForm({ ...addrForm, addressText: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', color: '#6b7280' }}>Широта (lat) *</label>
                                        <input style={{ ...styles.input, width: '100%' }} value={addrForm.lat} onChange={e => setAddrForm({ ...addrForm, lat: e.target.value })} placeholder="41.311081" />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', color: '#6b7280' }}>Долгота (lng) *</label>
                                        <input style={{ ...styles.input, width: '100%' }} value={addrForm.lng} onChange={e => setAddrForm({ ...addrForm, lng: e.target.value })} placeholder="69.240562" />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', color: '#6b7280' }}>Точность (м)</label>
                                        <input style={{ ...styles.input, width: '100%' }} value={addrForm.accuracyM} onChange={e => setAddrForm({ ...addrForm, accuracyM: e.target.value })} type="number" />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', color: '#6b7280' }}>Комментарий</label>
                                        <input style={{ ...styles.input, width: '100%' }} value={addrForm.comment} onChange={e => setAddrForm({ ...addrForm, comment: e.target.value })} placeholder="Подъезд, код, ориентир" />
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={addrForm.isDefault} onChange={e => setAddrForm({ ...addrForm, isDefault: e.target.checked })} />
                                            Адрес по умолчанию
                                        </label>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                                    <button style={styles.btn('secondary')} onClick={() => setAddrForm(null)}>Отмена</button>
                                    <button style={{ ...styles.btn('primary'), opacity: addrSaving ? 0.5 : 1 }} onClick={handleSaveAddr} disabled={addrSaving}>
                                        {addrForm.id ? 'Сохранить' : 'Добавить'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                                <button style={styles.btn('primary')} onClick={openAddForm}>+ Добавить адрес</button>
                                <button style={styles.btn('secondary')} onClick={closeGeoModal}>Закрыть</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// DRAFTS TAB
// ============================================

const statusLabels: Record<string, string> = {
    NEW: 'Новая',
    CLARIFY: 'Уточнение',
    WAIT_CONFIRM: 'Ожидает подтверждения',
    CONFIRMED: 'Подтверждена',
    CANCELED: 'Отменена',
    ERROR: 'Ошибка',
    MANAGER_REVIEW: 'На рассмотрении',
    MANAGER_REJECTED: 'Отклонена',
    MANAGER_ACCEPTED: 'Принята',
};

const statusColors: Record<string, string> = {
    NEW: 'blue',
    CLARIFY: 'yellow',
    WAIT_CONFIRM: 'yellow',
    CONFIRMED: 'green',
    CANCELED: 'red',
    ERROR: 'red',
    MANAGER_REVIEW: 'purple',
    MANAGER_REJECTED: 'red',
    MANAGER_ACCEPTED: 'green',
};

const DraftsTab: React.FC<TabProps> = ({ styles, getHeaders }) => {
    const [drafts, setDrafts] = useState<Draft[]>([]);
    const [loading, setLoading] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Modal states
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectDraftId, setRejectDraftId] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailDraft, setDetailDraft] = useState<Draft | null>(null);

    const fetchDrafts = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (dateFrom) params.set('from', dateFrom);
            if (dateTo) params.set('to', dateTo);
            if (statusFilter) params.set('status', statusFilter);
            const res = await axios.get(`${API_URL}/api/sales-manager/drafts?${params}`, getHeaders());
            setDrafts(Array.isArray(res.data) ? res.data : []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [dateFrom, dateTo, statusFilter]);

    useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

    const handleAccept = async (draftId: number) => {
        if (!confirm('Принять заявку и создать заказ?')) return;
        try {
            await axios.post(`${API_URL}/api/sales-manager/drafts/${draftId}/accept`, {}, getHeaders());
            alert('Заявка принята, заказ создан');
            fetchDrafts();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка принятия заявки');
        }
    };

    const openReject = (draftId: number) => {
        setRejectDraftId(draftId);
        setRejectReason('');
        setShowRejectModal(true);
    };

    const handleReject = async () => {
        if (!rejectDraftId || !rejectReason.trim()) return alert('Укажите причину отклонения');
        try {
            await axios.post(`${API_URL}/api/sales-manager/drafts/${rejectDraftId}/reject`, { reason: rejectReason }, getHeaders());
            setShowRejectModal(false);
            fetchDrafts();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка отклонения');
        }
    };

    const handleReturnToReview = async (draftId: number) => {
        try {
            await axios.post(`${API_URL}/api/sales-manager/drafts/${draftId}/return-to-review`, {}, getHeaders());
            fetchDrafts();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка');
        }
    };

    const openDetail = (draft: Draft) => {
        setDetailDraft(draft);
        setShowDetailModal(true);
    };

    return (
        <div>
            <div style={styles.filterRow}>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={styles.input} />
                <span>—</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={styles.input} />
                <select style={{ ...styles.select, minWidth: '180px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="">Все статусы</option>
                    {Object.entries(statusLabels).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                    ))}
                </select>
                <button style={styles.btn('secondary')} onClick={fetchDrafts}>Применить</button>
            </div>

            <div style={styles.card}>
                {loading ? <p>Загрузка...</p> : (
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>#</th>
                                <th style={styles.th}>Дата</th>
                                <th style={styles.th}>Клиент</th>
                                <th style={styles.th}>Статус</th>
                                <th style={styles.th}>Позиций</th>
                                <th style={styles.th}>Примечание</th>
                                <th style={styles.th}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {drafts.length === 0 && (
                                <tr><td style={styles.td} colSpan={7}>Нет заявок</td></tr>
                            )}
                            {drafts.map(d => (
                                <tr key={d.id}>
                                    <td style={styles.td}>{d.id}</td>
                                    <td style={styles.td}>{new Date(d.createdAt).toLocaleDateString('ru-RU')}</td>
                                    <td style={styles.td}>{d.customer?.name} <span style={{ color: '#9ca3af' }}>({d.customer?.code})</span></td>
                                    <td style={styles.td}>
                                        <span style={styles.badge(statusColors[d.status] || 'purple')}>
                                            {statusLabels[d.status] || d.status}
                                        </span>
                                    </td>
                                    <td style={styles.td}>{d._count?.items ?? d.items?.length ?? '—'}</td>
                                    <td style={styles.td}>{d.note || d.managerDecisionNote || '—'}</td>
                                    <td style={styles.td}>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                            <button
                                                style={{ ...styles.btn('secondary'), padding: '4px 10px' }}
                                                onClick={() => openDetail(d)}
                                                title="Просмотр"
                                            >👁</button>

                                            {(d.status === 'CONFIRMED' || d.status === 'MANAGER_REVIEW') && (
                                                <button
                                                    style={{ ...styles.btn('success'), padding: '4px 10px' }}
                                                    onClick={() => handleAccept(d.id)}
                                                    title="Принять"
                                                >✓</button>
                                            )}

                                            {(d.status === 'CONFIRMED' || d.status === 'MANAGER_REVIEW') && (
                                                <button
                                                    style={{ ...styles.btn('danger'), padding: '4px 10px' }}
                                                    onClick={() => openReject(d.id)}
                                                    title="Отклонить"
                                                >✕</button>
                                            )}

                                            {d.status === 'MANAGER_REJECTED' && (
                                                <button
                                                    style={{ ...styles.btn('warning'), padding: '4px 10px' }}
                                                    onClick={() => handleReturnToReview(d.id)}
                                                    title="Вернуть на рассмотрение"
                                                >↩</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Detail Modal */}
            {showDetailModal && detailDraft && (
                <div style={styles.modal} onClick={() => setShowDetailModal(false)}>
                    <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>
                            Заявка #{detailDraft.id} — {detailDraft.customer?.name}
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px', fontSize: '14px' }}>
                            <div><b>Статус:</b> <span style={styles.badge(statusColors[detailDraft.status] || 'purple')}>{statusLabels[detailDraft.status] || detailDraft.status}</span></div>
                            <div><b>Дата:</b> {new Date(detailDraft.createdAt).toLocaleString('ru-RU')}</div>
                            {detailDraft.note && <div style={{ gridColumn: '1 / -1' }}><b>Примечание:</b> {detailDraft.note}</div>}
                            {detailDraft.managerDecisionNote && <div style={{ gridColumn: '1 / -1' }}><b>Решение менеджера:</b> {detailDraft.managerDecisionNote}</div>}
                        </div>

                        <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>Позиции</h3>
                        <table style={{ ...styles.table, marginBottom: '16px' }}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Исходный текст</th>
                                    <th style={styles.th}>Товар</th>
                                    <th style={styles.th}>Кол-во</th>
                                    <th style={styles.th}>Ед.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(detailDraft.items || []).map((item, idx) => (
                                    <tr key={idx}>
                                        <td style={styles.td}>{item.rawText}</td>
                                        <td style={styles.td}>{item.title || <span style={{ color: '#ef4444' }}>Не распознано</span>}</td>
                                        <td style={styles.td}>{item.quantity ?? '—'}</td>
                                        <td style={styles.td}>{item.unit || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button style={styles.btn('secondary')} onClick={() => setShowDetailModal(false)}>Закрыть</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <div style={styles.modal} onClick={() => setShowRejectModal(false)}>
                    <div style={{ ...styles.modalContent, width: '400px' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>Отклонить заявку</h2>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', color: '#6b7280' }}>Причина отклонения</label>
                            <textarea
                                style={{ ...styles.input, width: '100%', minHeight: '100px', resize: 'vertical' as const }}
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                placeholder="Укажите причину..."
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button style={styles.btn('secondary')} onClick={() => setShowRejectModal(false)}>Отмена</button>
                            <button style={styles.btn('danger')} onClick={handleReject}>Отклонить</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// STATEMENT TAB (Акт сверки)
// ============================================

const StatementTab: React.FC<TabProps> = ({ customerId, styles, getHeaders }) => {
    const [statement, setStatement] = useState<StatementData | null>(null);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const fetchStatement = useCallback(async () => {
        if (!customerId) { setStatement(null); return; }
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (dateFrom) params.set('from', dateFrom);
            if (dateTo) params.set('to', dateTo);
            const res = await axios.get(`${API_URL}/api/sales-manager/customers/${customerId}/statement?${params}`, getHeaders());
            setStatement(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [customerId, dateFrom, dateTo]);

    useEffect(() => { fetchStatement(); }, [fetchStatement]);

    const handleSendTelegram = async () => {
        if (!customerId) return;
        setSending(true);
        try {
            await axios.post(`${API_URL}/api/sales-manager/customers/${customerId}/statement/send`, {
                from: dateFrom || undefined,
                to: dateTo || undefined,
            }, getHeaders());
            alert('Акт сверки поставлен в очередь отправки в Telegram');
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка отправки');
        } finally { setSending(false); }
    };

    const sourceTypeLabels: Record<string, string> = {
        SHIPMENT: 'Отгрузка',
        RETURN_GOODS: 'Возврат товара',
        REFUND_MONEY: 'Возврат денег',
    };

    const sourceTypeColors: Record<string, string> = {
        SHIPMENT: 'green',
        RETURN_GOODS: 'purple',
        REFUND_MONEY: 'red',
    };

    if (!customerId) {
        return (
            <div style={styles.card}>
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>
                    Выберите клиента для просмотра акта сверки
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
                <div style={{ flex: 1 }} />
                <button
                    style={{ ...styles.btn('primary'), opacity: sending ? 0.5 : 1 }}
                    onClick={handleSendTelegram}
                    disabled={sending}
                >
                    📨 Отправить в Telegram
                </button>
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
                                {statement.entries.map((e, idx) => (
                                    <tr key={idx}>
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

// ============================================
// REFUNDS TAB (Возврат денег клиенту)
// ============================================

const RefundsTab: React.FC<TabProps> = ({ customerId, customers = [], styles, getHeaders }) => {
    const [refunds, setRefunds] = useState<Refund[]>([]);
    const [loading, setLoading] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingRefund, setEditingRefund] = useState<Refund | null>(null);
    const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);

    // Form fields
    const [formDate, setFormDate] = useState('');
    const [formAmount, setFormAmount] = useState<number>(0);
    const [formPaymentTypeId, setFormPaymentTypeId] = useState<number | ''>('');
    const [formReference, setFormReference] = useState('');
    const [formComment, setFormComment] = useState('');

    const fetchRefunds = useCallback(async () => {
        if (!customerId) { setRefunds([]); return; }
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (dateFrom) params.set('from', dateFrom);
            if (dateTo) params.set('to', dateTo);
            const res = await axios.get(`${API_URL}/api/sales-manager/customers/${customerId}/refunds?${params}`, getHeaders());
            setRefunds(Array.isArray(res.data) ? res.data : []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [customerId, dateFrom, dateTo]);

    useEffect(() => { fetchRefunds(); }, [fetchRefunds]);

    // Load payment types for form
    useEffect(() => {
        axios.get(`${API_URL}/api/payment-types`, getHeaders())
            .then(res => setPaymentTypes(Array.isArray(res.data) ? res.data : []))
            .catch(() => { });
    }, []);

    const openCreate = () => {
        setEditingRefund(null);
        setFormDate(new Date().toISOString().split('T')[0]);
        setFormAmount(0);
        setFormPaymentTypeId('');
        setFormReference('');
        setFormComment('');
        setShowModal(true);
    };

    const openEdit = (r: Refund) => {
        setEditingRefund(r);
        setFormDate(r.refundDate.split('T')[0]);
        setFormAmount(Number(r.amount));
        setFormPaymentTypeId(r.paymentTypeId || '');
        setFormReference(r.reference || '');
        setFormComment(r.comment || '');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formDate || formAmount <= 0) return alert('Заполните дату и сумму');
        const data = {
            refundDate: formDate,
            amount: formAmount,
            paymentTypeId: formPaymentTypeId || null,
            reference: formReference || null,
            comment: formComment || null,
        };
        try {
            if (editingRefund) {
                await axios.put(`${API_URL}/api/sales-manager/refunds/${editingRefund.id}`, data, getHeaders());
            } else {
                await axios.post(`${API_URL}/api/sales-manager/customers/${customerId}/refunds`, data, getHeaders());
            }
            setShowModal(false);
            fetchRefunds();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка сохранения');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Удалить этот возврат денег?')) return;
        try {
            await axios.delete(`${API_URL}/api/sales-manager/refunds/${id}`, getHeaders());
            fetchRefunds();
        } catch (err) { console.error(err); }
    };

    if (!customerId) {
        return (
            <div style={styles.card}>
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>
                    Выберите клиента для просмотра возвратов
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
                <button style={styles.btn('secondary')} onClick={fetchRefunds}>Применить</button>
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
                                <th style={styles.th}>Сумма</th>
                                <th style={styles.th}>Тип оплаты</th>
                                <th style={styles.th}>Документ</th>
                                <th style={styles.th}>Комментарий</th>
                                <th style={styles.th}>Создал</th>
                                <th style={styles.th}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {refunds.length === 0 && (
                                <tr><td style={styles.td} colSpan={8}>Нет данных</td></tr>
                            )}
                            {refunds.map(r => (
                                <tr key={r.id} style={r.deletedAt ? styles.disabled : {}}>
                                    <td style={styles.td}>{r.id}</td>
                                    <td style={styles.td}>{new Date(r.refundDate).toLocaleDateString('ru-RU')}</td>
                                    <td style={styles.td}><b>{Number(r.amount).toLocaleString('ru-RU', { minimumFractionDigits: 2 })}</b></td>
                                    <td style={styles.td}>{r.paymentType?.name || '—'}</td>
                                    <td style={styles.td}>{r.reference || '—'}</td>
                                    <td style={styles.td}>{r.comment || '—'}</td>
                                    <td style={styles.td}>{r.createdByUser?.name || '—'}</td>
                                    <td style={styles.td}>
                                        {!r.deletedAt && (
                                            <>
                                                <button style={{ ...styles.btn('secondary'), marginRight: '8px', padding: '4px 10px' }} onClick={() => openEdit(r)}>✏️</button>
                                                <button style={{ ...styles.btn('danger'), padding: '4px 10px' }} onClick={() => handleDelete(r.id)}>🗑</button>
                                            </>
                                        )}
                                        {r.deletedAt && <span style={styles.badge('red')}>Удалён</span>}
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
                        <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>{editingRefund ? 'Редактирование возврата' : 'Новый возврат денег'}</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ fontSize: '12px', color: '#6b7280' }}>Дата</label>
                                <input type="date" style={{ ...styles.input, width: '100%' }} value={formDate} onChange={e => setFormDate(e.target.value)} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: '#6b7280' }}>Сумма</label>
                                <input type="number" style={{ ...styles.input, width: '100%' }} value={formAmount || ''} onChange={e => setFormAmount(Number(e.target.value))} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: '#6b7280' }}>Тип оплаты</label>
                                <select style={{ ...styles.select, width: '100%' }} value={formPaymentTypeId} onChange={e => setFormPaymentTypeId(e.target.value ? Number(e.target.value) : '')}>
                                    <option value="">— Не указан —</option>
                                    {paymentTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: '#6b7280' }}>Номер документа</label>
                                <input style={{ ...styles.input, width: '100%' }} value={formReference} onChange={e => setFormReference(e.target.value)} placeholder="Необязательно" />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
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

export default SalesManagerPage;
