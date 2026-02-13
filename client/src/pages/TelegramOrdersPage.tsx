import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { MessageCircle, Plus, RefreshCw, Check, X, Eye, Trash2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface TelegramGroup {
    id: number;
    chatId: string;
    title: string;
    username: string | null;
    isActive: boolean;
    lastMessageId: number | null;
    parsePatterns: Record<string, string> | null;
    createdAt: string;
    _count?: { orderDrafts: number };
}

interface DraftItem {
    id: number;
    draftId: number;
    rawProductName: string;
    rawQuantity: string;
    rawPrice: string | null;
    productId: number | null;
    quantity: number | null;
    price: number | null;
}

interface TelegramDraft {
    id: number;
    groupId: number;
    messageId: string;
    messageText: string;
    messageDate: string;
    senderName: string | null;
    senderId: string | null;
    parsedOrderNumber: string | null;
    parsedCustomer: string | null;
    parsedAddress: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'transferred';
    transferredOrderId: number | null;
    approvedBy: string | null;
    approvedAt: string | null;
    rejectedReason: string | null;
    createdAt: string;
    group: { id: number; title: string; username: string | null };
    items: DraftItem[];
}

interface Product {
    id: number;
    code: string;
    name: string;
    altName: string | null;
}

interface Customer {
    id: number;
    code: string;
    name: string;
}

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    transferred: 'bg-blue-100 text-blue-800',
};

const statusLabels: Record<string, string> = {
    pending: 'Новый',
    approved: 'Одобрен',
    rejected: 'Отклонён',
    transferred: 'Перенесён',
};

export default function TelegramOrdersPage() {
    const { socket, isConnected } = useSocket();

    // Groups state
    const [groups, setGroups] = useState<TelegramGroup[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(true);
    const [addGroupOpen, setAddGroupOpen] = useState(false);
    const [newGroup, setNewGroup] = useState({ chatId: '', title: '', username: '' });

    // Drafts state
    const [drafts, setDrafts] = useState<TelegramDraft[]>([]);
    const [loadingDrafts, setLoadingDrafts] = useState(true);
    const [selectedDraft, setSelectedDraft] = useState<TelegramDraft | null>(null);
    const [draftDialogOpen, setDraftDialogOpen] = useState(false);

    // Approve dialog state
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
    const [itemMappings, setItemMappings] = useState<Record<number, { productId: number | null; quantity: number; price: number }>>({});

    // Notification state
    const [pendingCount, setPendingCount] = useState(0);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Load groups
    const loadGroups = useCallback(async () => {
        try {
            setLoadingGroups(true);
            const res = await fetch(`${API_URL}/api/telegram/groups`);
            const data = await res.json();
            setGroups(data);
        } catch (error) {
            console.error('Failed to load groups:', error);
        } finally {
            setLoadingGroups(false);
        }
    }, []);

    // Load drafts
    const loadDrafts = useCallback(async () => {
        try {
            setLoadingDrafts(true);
            const res = await fetch(`${API_URL}/api/telegram/drafts?limit=100`);
            const data = await res.json();
            setDrafts(data);
            setPendingCount(data.filter((d: TelegramDraft) => d.status === 'pending').length);
        } catch (error) {
            console.error('Failed to load drafts:', error);
        } finally {
            setLoadingDrafts(false);
        }
    }, []);

    // Load products and customers
    const loadReferenceData = useCallback(async () => {
        try {
            const [productsRes, customersRes] = await Promise.all([
                fetch(`${API_URL}/api/products`),
                fetch(`${API_URL}/api/customers`)
            ]);
            setProducts(await productsRes.json());
            setCustomers(await customersRes.json());
        } catch (error) {
            console.error('Failed to load reference data:', error);
        }
    }, []);

    // Initial load
    useEffect(() => {
        loadGroups();
        loadDrafts();
        loadReferenceData();
    }, [loadGroups, loadDrafts, loadReferenceData]);

    // Socket.IO listener for new drafts
    useEffect(() => {
        if (!socket) return;

        const handleNewDraft = (data: { id: number; groupTitle: string; itemCount: number }) => {
            console.log('New draft received:', data);

            // Play notification sound
            try {
                const audio = new Audio('/sounds/notification.mp3');
                audio.volume = 0.5;
                audio.play().catch(() => { });
            } catch (err) {
                console.log('Audio play failed', err);
            }

            // Show notification
            showNotification(`Новый заказ из "${data.groupTitle}" (${data.itemCount} поз.)`, 'info');

            // Reload drafts
            loadDrafts();
        };

        socket.on('telegram:new-draft', handleNewDraft);

        return () => {
            socket.off('telegram:new-draft', handleNewDraft);
        };
    }, [socket, loadDrafts]);

    const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    // Add group
    const handleAddGroup = async () => {
        if (!newGroup.chatId || !newGroup.title) return;

        try {
            const res = await fetch(`${API_URL}/api/telegram/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newGroup)
            });

            if (res.ok) {
                setAddGroupOpen(false);
                setNewGroup({ chatId: '', title: '', username: '' });
                loadGroups();
                showNotification('Группа добавлена', 'success');
            } else {
                const error = await res.json();
                showNotification(error.error || 'Ошибка', 'error');
            }
        } catch (error) {
            console.error('Failed to add group:', error);
            showNotification('Ошибка добавления группы', 'error');
        }
    };

    // Toggle group active
    const handleToggleGroup = async (groupId: number, isActive: boolean) => {
        try {
            await fetch(`${API_URL}/api/telegram/groups/${groupId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive })
            });
            loadGroups();
        } catch (error) {
            console.error('Failed to toggle group:', error);
        }
    };

    // Delete group
    const handleDeleteGroup = async (groupId: number) => {
        if (!confirm('Удалить группу? Все черновики заказов также будут удалены.')) return;

        try {
            await fetch(`${API_URL}/api/telegram/groups/${groupId}`, { method: 'DELETE' });
            loadGroups();
            loadDrafts();
            showNotification('Группа удалена', 'success');
        } catch (error) {
            console.error('Failed to delete group:', error);
            showNotification('Ошибка удаления', 'error');
        }
    };

    // Open draft for review
    const handleOpenDraft = (draft: TelegramDraft) => {
        setSelectedDraft(draft);

        // Initialize item mappings
        const mappings: Record<number, { productId: number | null; quantity: number; price: number }> = {};
        for (const item of draft.items) {
            // Try to find product by name
            const match = products.find(p =>
                p.name.toLowerCase().includes(item.rawProductName.toLowerCase()) ||
                (p.altName && p.altName.toLowerCase().includes(item.rawProductName.toLowerCase()))
            );

            // Parse quantity
            const qtyMatch = item.rawQuantity.match(/(\d+(?:[.,]\d+)?)/);
            const qty = qtyMatch ? parseFloat(qtyMatch[1].replace(',', '.')) : 0;

            mappings[item.id] = {
                productId: match?.id || null,
                quantity: qty,
                price: item.price ? Number(item.price) : 0
            };
        }
        setItemMappings(mappings);

        // Try to find customer
        if (draft.parsedCustomer) {
            const customer = customers.find(c =>
                c.name.toLowerCase().includes(draft.parsedCustomer!.toLowerCase())
            );
            setSelectedCustomerId(customer?.id || null);
        } else {
            setSelectedCustomerId(null);
        }

        setDraftDialogOpen(true);
    };

    // Approve draft
    const handleApproveDraft = async () => {
        if (!selectedDraft || !selectedCustomerId) {
            showNotification('Выберите клиента', 'error');
            return;
        }

        // Validate all items have products
        const items = Object.entries(itemMappings).map(([itemId, mapping]) => ({
            itemId: parseInt(itemId),
            productId: mapping.productId,
            quantity: mapping.quantity,
            price: mapping.price
        }));

        if (items.some(i => !i.productId || !i.quantity)) {
            showNotification('Заполните все товары', 'error');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/telegram/drafts/${selectedDraft.id}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: selectedCustomerId,
                    items: items.map(i => ({
                        productId: i.productId,
                        quantity: i.quantity,
                        price: i.price
                    })),
                    approvedBy: 'user'
                })
            });

            if (res.ok) {
                const data = await res.json();
                setDraftDialogOpen(false);
                loadDrafts();
                showNotification(`Заказ #${data.orderId} создан`, 'success');
            } else {
                const error = await res.json();
                showNotification(error.error || 'Ошибка', 'error');
            }
        } catch (error) {
            console.error('Failed to approve draft:', error);
            showNotification('Ошибка создания заказа', 'error');
        }
    };

    // Reject draft
    const handleRejectDraft = async () => {
        if (!selectedDraft) return;

        const reason = prompt('Причина отклонения:');
        if (!reason) return;

        try {
            await fetch(`${API_URL}/api/telegram/drafts/${selectedDraft.id}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason })
            });

            setDraftDialogOpen(false);
            loadDrafts();
            showNotification('Заказ отклонён', 'success');
        } catch (error) {
            console.error('Failed to reject draft:', error);
            showNotification('Ошибка', 'error');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500 rounded-lg">
                        <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">Telegram заказы</h1>
                    {pendingCount > 0 && (
                        <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                            {pendingCount} новых
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {isConnected ? 'Подключено' : 'Отключено'}
                    </span>
                    <button
                        onClick={() => { loadGroups(); loadDrafts(); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Обновить
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Groups Section */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-slate-800">Группы мониторинга</h2>
                        <button
                            onClick={() => setAddGroupOpen(true)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    {loadingGroups ? (
                        <div className="flex justify-center py-4">
                            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : groups.length === 0 ? (
                        <div className="text-center py-4 text-slate-500 text-sm">
                            Нет групп для мониторинга
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {groups.map(group => (
                                <div key={group.id} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={group.isActive}
                                            onChange={(e) => handleToggleGroup(group.id, e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-slate-300 peer-checked:bg-blue-600 rounded-full peer-focus:ring-2 peer-focus:ring-blue-300 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                                    </label>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm text-slate-800 truncate">{group.title}</div>
                                        <div className="text-xs text-slate-500 truncate">
                                            {group.username ? `@${group.username}` : group.chatId}
                                        </div>
                                    </div>
                                    {group._count && (
                                        <span className="px-2 py-0.5 text-xs bg-slate-200 text-slate-600 rounded-full">
                                            {group._count.orderDrafts}
                                        </span>
                                    )}
                                    <button
                                        onClick={() => handleDeleteGroup(group.id)}
                                        className="p-1 text-slate-400 hover:text-red-600"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Drafts Section */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                    <h2 className="font-semibold text-slate-800 mb-4">Черновики заказов</h2>

                    {loadingDrafts ? (
                        <div className="flex justify-center py-8">
                            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : drafts.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            Нет заказов из Telegram
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left py-2 px-3 font-medium text-slate-600">Дата</th>
                                        <th className="text-left py-2 px-3 font-medium text-slate-600">Группа</th>
                                        <th className="text-left py-2 px-3 font-medium text-slate-600">Товары</th>
                                        <th className="text-left py-2 px-3 font-medium text-slate-600">Клиент</th>
                                        <th className="text-left py-2 px-3 font-medium text-slate-600">Статус</th>
                                        <th className="text-right py-2 px-3 font-medium text-slate-600"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {drafts.map(draft => (
                                        <tr
                                            key={draft.id}
                                            onClick={() => handleOpenDraft(draft)}
                                            className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${draft.status === 'pending' ? 'bg-yellow-50/50' : ''}`}
                                        >
                                            <td className="py-2 px-3">
                                                {new Date(draft.messageDate).toLocaleString('ru-RU', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </td>
                                            <td className="py-2 px-3">{draft.group.title}</td>
                                            <td className="py-2 px-3">
                                                <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">
                                                    {draft.items.length} поз.
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-slate-600">
                                                {draft.parsedCustomer || '—'}
                                            </td>
                                            <td className="py-2 px-3">
                                                <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[draft.status]}`}>
                                                    {statusLabels[draft.status]}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                                <Eye className="w-4 h-4 text-slate-400" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Group Modal */}
            {addGroupOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAddGroupOpen(false)}>
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Добавить группу</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Chat ID</label>
                                <input
                                    type="text"
                                    value={newGroup.chatId}
                                    onChange={(e) => setNewGroup({ ...newGroup, chatId: e.target.value })}
                                    placeholder="-1001234567890"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                                <p className="text-xs text-slate-500 mt-1">ID группы (можно получить через @userinfobot)</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Название</label>
                                <input
                                    type="text"
                                    value={newGroup.title}
                                    onChange={(e) => setNewGroup({ ...newGroup, title: e.target.value })}
                                    placeholder="Закупки мясо"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Username (опционально)</label>
                                <input
                                    type="text"
                                    value={newGroup.username}
                                    onChange={(e) => setNewGroup({ ...newGroup, username: e.target.value })}
                                    placeholder="meat_orders"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                                <p className="text-xs text-slate-500 mt-1">Без @</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setAddGroupOpen(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleAddGroup}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Добавить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Draft Review Modal */}
            {draftDialogOpen && selectedDraft && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDraftDialogOpen(false)}>
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-200 flex items-center gap-2">
                            <MessageCircle className="w-5 h-5 text-blue-600" />
                            <h3 className="text-lg font-semibold text-slate-800">Проверка заказа</h3>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[selectedDraft.status]}`}>
                                {statusLabels[selectedDraft.status]}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Original message */}
                                <div>
                                    <h4 className="text-sm font-medium text-slate-700 mb-2">Оригинальное сообщение:</h4>
                                    <div className="p-3 bg-slate-50 rounded-lg font-mono text-sm whitespace-pre-wrap max-h-60 overflow-auto">
                                        {selectedDraft.messageText}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                        Отправитель: {selectedDraft.senderName || 'Неизвестно'} • {new Date(selectedDraft.messageDate).toLocaleString('ru-RU')}
                                    </p>
                                </div>

                                {/* Parsed data */}
                                <div>
                                    <h4 className="text-sm font-medium text-slate-700 mb-2">Распознанные данные:</h4>

                                    <div className="mb-3">
                                        <label className="block text-xs text-slate-500 mb-1">Клиент *</label>
                                        <select
                                            value={selectedCustomerId || ''}
                                            onChange={(e) => setSelectedCustomerId(e.target.value ? parseInt(e.target.value) : null)}
                                            disabled={selectedDraft.status !== 'pending'}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
                                        >
                                            <option value="">Выберите клиента</option>
                                            {customers.map(c => (
                                                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="block text-xs text-slate-500 mb-1">Адрес доставки</label>
                                        <input
                                            type="text"
                                            value={selectedDraft.parsedAddress || ''}
                                            disabled
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100"
                                        />
                                    </div>

                                    <hr className="my-3" />

                                    <h4 className="text-sm font-medium text-slate-700 mb-2">Товары:</h4>
                                    <div className="space-y-2">
                                        {selectedDraft.items.map(item => (
                                            <div key={item.id} className="p-3 bg-slate-50 rounded-lg">
                                                <p className="text-xs text-slate-500 mb-2">
                                                    {item.rawProductName} — {item.rawQuantity}
                                                </p>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <select
                                                        value={itemMappings[item.id]?.productId || ''}
                                                        onChange={(e) => {
                                                            setItemMappings(prev => ({
                                                                ...prev,
                                                                [item.id]: { ...prev[item.id], productId: e.target.value ? parseInt(e.target.value) : null }
                                                            }));
                                                        }}
                                                        disabled={selectedDraft.status !== 'pending'}
                                                        className="col-span-1 px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                                                    >
                                                        <option value="">Товар</option>
                                                        {products.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                    <input
                                                        type="number"
                                                        placeholder="Кол-во"
                                                        value={itemMappings[item.id]?.quantity || ''}
                                                        onChange={(e) => {
                                                            setItemMappings(prev => ({
                                                                ...prev,
                                                                [item.id]: { ...prev[item.id], quantity: parseFloat(e.target.value) || 0 }
                                                            }));
                                                        }}
                                                        disabled={selectedDraft.status !== 'pending'}
                                                        className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                                                    />
                                                    <input
                                                        type="number"
                                                        placeholder="Цена"
                                                        value={itemMappings[item.id]?.price || ''}
                                                        onChange={(e) => {
                                                            setItemMappings(prev => ({
                                                                ...prev,
                                                                [item.id]: { ...prev[item.id], price: parseFloat(e.target.value) || 0 }
                                                            }));
                                                        }}
                                                        disabled={selectedDraft.status !== 'pending'}
                                                        className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
                            {selectedDraft.status === 'pending' ? (
                                <>
                                    <button
                                        onClick={handleRejectDraft}
                                        className="flex items-center gap-1 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                                    >
                                        <X className="w-4 h-4" />
                                        Отклонить
                                    </button>
                                    <button
                                        onClick={handleApproveDraft}
                                        className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                    >
                                        <Check className="w-4 h-4" />
                                        Создать заказ
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setDraftDialogOpen(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                                >
                                    Закрыть
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Notification */}
            {notification && (
                <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg text-white ${notification.type === 'success' ? 'bg-green-600' :
                    notification.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
                    }`}>
                    {notification.message}
                </div>
            )}
        </div>
    );
}
