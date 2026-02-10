import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Key, UserX, UserCheck, X, Shield, AlertTriangle, Eye, EyeOff } from 'lucide-react';

interface RoleInfo {
    id: number;
    code: string;
    name: string;
    isSystem: boolean;
    userCount: number;
}

interface UserInfo {
    id: number;
    username: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    roles: { id: number; code: string; name: string }[];
}

const AdminUsersPage = () => {
    const { token, user: currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserInfo[]>([]);
    const [roles, setRoles] = useState<RoleInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [accessError, setAccessError] = useState<string | null>(null);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
    const [formData, setFormData] = useState({
        username: '',
        name: '',
        password: '',
        roleIds: [] as number[],
    });

    // Password reset modal
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordTarget, setPasswordTarget] = useState<UserInfo | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

    const getHeaders = useCallback(() => ({
        Authorization: `Bearer ${token}`,
    }), [token]);

    const loadData = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setAccessError(null);
        try {
            const [usersRes, rolesRes] = await Promise.all([
                axios.get(`${API_URL}/api/admin/users`, { headers: getHeaders(), signal }),
                axios.get(`${API_URL}/api/admin/roles`, { headers: getHeaders(), signal }),
            ]);
            if (signal?.aborted) return;
            setUsers(usersRes.data);
            setRoles(rolesRes.data);
        } catch (err: any) {
            if (axios.isCancel(err) || signal?.aborted) return;
            const status = err.response?.status;
            if (status === 403) {
                setAccessError('Недостаточно прав для доступа к этой странице');
            } else if (status === 401) {
                logout();
                navigate('/login');
                return;
            } else {
                console.error('Failed to load admin data:', err);
                setAccessError('Не удалось загрузить данные');
            }
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [getHeaders, logout, navigate]);

    useEffect(() => {
        if (!token) return;
        const controller = new AbortController();
        loadData(controller.signal);
        return () => controller.abort();
    }, [token, loadData]);

    // Username validation helper
    const isUsernameValid = (v: string) => v.length >= 3 && /^[a-z0-9._-]+$/.test(v);

    // Open create modal
    const openCreateModal = () => {
        setEditingUser(null);
        setFormData({ username: '', name: '', password: '', roleIds: [] });
        setShowPassword(false);
        setShowModal(true);
    };

    // Open edit modal
    const openEditModal = (user: UserInfo) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            name: user.name,
            password: '',
            roleIds: user.roles.map(r => r.id),
        });
        setShowModal(true);
    };

    // Toggle role in form
    const toggleRole = (roleId: number) => {
        setFormData(prev => ({
            ...prev,
            roleIds: prev.roleIds.includes(roleId)
                ? prev.roleIds.filter(id => id !== roleId)
                : [...prev.roleIds, roleId],
        }));
    };

    // Save (create or update)
    const handleSave = async () => {
        try {
            if (editingUser) {
                await axios.put(
                    `${API_URL}/api/admin/users/${editingUser.id}`,
                    { name: formData.name, roleIds: formData.roleIds },
                    { headers: getHeaders() }
                );
            } else {
                if (!formData.username || !formData.password || !formData.name) {
                    alert('Заполните все обязательные поля');
                    return;
                }
                if (formData.password.length < 8) {
                    alert('Пароль должен быть не менее 8 символов');
                    return;
                }
                await axios.post(
                    `${API_URL}/api/admin/users`,
                    formData,
                    { headers: getHeaders() }
                );
            }
            setShowModal(false);
            loadData();
        } catch (err: any) {
            const msg = err.response?.data?.error || 'Ошибка сохранения';
            alert(msg);
        }
    };

    // Toggle active status
    const toggleActive = async (user: UserInfo) => {
        const action = user.isActive ? 'Отключить' : 'Включить';
        if (!confirm(`${action} пользователя "${user.username}"?`)) return;

        try {
            await axios.put(
                `${API_URL}/api/admin/users/${user.id}`,
                { isActive: !user.isActive },
                { headers: getHeaders() }
            );
            loadData();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка');
        }
    };

    // Reset password
    const openPasswordModal = (user: UserInfo) => {
        setPasswordTarget(user);
        setNewPassword('');
        setShowNewPassword(false);
        setShowPasswordModal(true);
    };

    const handleResetPassword = async () => {
        if (!passwordTarget || !newPassword) return;
        try {
            await axios.post(
                `${API_URL}/api/admin/users/${passwordTarget.id}/reset-password`,
                { password: newPassword },
                { headers: getHeaders() }
            );
            setShowPasswordModal(false);
            loadData();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Ошибка');
        }
    };

    // Role badge colors
    const roleBadgeColor = (code: string) => {
        const colors: Record<string, string> = {
            ADMIN: 'bg-red-100 text-red-700 border-red-200',
            OPERATOR: 'bg-blue-100 text-blue-700 border-blue-200',
            PRODUCTION: 'bg-amber-100 text-amber-700 border-amber-200',
            EXPEDITOR: 'bg-green-100 text-green-700 border-green-200',
            BUYER: 'bg-purple-100 text-purple-700 border-purple-200',
            ACCOUNTANT: 'bg-slate-100 text-slate-700 border-slate-200',
        };
        return colors[code] || 'bg-gray-100 text-gray-700 border-gray-200';
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        );
    }

    // Access denied / error screen
    if (accessError) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <AlertTriangle className="text-red-500" size={48} />
                <p className="text-lg font-medium text-slate-700">{accessError}</p>
                <a
                    href="/"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                    На главную
                </a>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Shield className="text-blue-600" size={28} />
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Пользователи и роли</h2>
                        <p className="text-sm text-slate-500">
                            {users.length} пользователей · {roles.length} ролей
                        </p>
                    </div>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                >
                    <Plus size={18} />
                    Новый пользователь
                </button>
            </div>

            {/* Users table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Пользователь</th>
                            <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Имя</th>
                            <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Роли</th>
                            <th className="text-center px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Статус</th>
                            <th className="text-right px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map(user => (
                            <tr key={user.id} className={`hover:bg-slate-50 transition-colors ${!user.isActive ? 'opacity-50' : ''}`}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
                                            ${user.isActive
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-slate-100 text-slate-400'
                                            }`}
                                        >
                                            {user.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <span className="font-medium text-slate-800">{user.username}</span>
                                            {currentUser?.id === user.id && (
                                                <span className="ml-2 text-xs text-blue-500 font-medium">(вы)</span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-600">{user.name}</td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1.5">
                                        {user.roles.length > 0 ? user.roles.map(r => (
                                            <span
                                                key={r.id}
                                                className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${roleBadgeColor(r.code)}`}
                                            >
                                                {r.name}
                                            </span>
                                        )) : (
                                            <span className="text-xs text-slate-400 italic">Нет ролей</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium
                                        ${user.isActive
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-red-100 text-red-700'
                                        }`}
                                    >
                                        {user.isActive ? 'Активен' : 'Отключён'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            onClick={() => openEditModal(user)}
                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Редактировать"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => openPasswordModal(user)}
                                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                            title="Сбросить пароль"
                                        >
                                            <Key size={16} />
                                        </button>
                                        <button
                                            onClick={() => toggleActive(user)}
                                            className={`p-2 rounded-lg transition-colors ${user.isActive
                                                ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                                : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                                                }`}
                                            title={user.isActive ? 'Отключить' : 'Включить'}
                                        >
                                            {user.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Roles summary */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Роли в системе</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {roles.map(role => (
                        <div key={role.id} className={`rounded-lg border p-3 ${roleBadgeColor(role.code)}`}>
                            <div className="font-semibold text-sm">{role.name}</div>
                            <div className="text-xs opacity-70 mt-0.5">{role.code}</div>
                            <div className="text-xs mt-2 opacity-80">{role.userCount} польз.</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Create/Edit modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-800">
                                {editingUser ? `Редактирование: ${editingUser.username}` : 'Новый пользователь'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            {/* Username (only for create) */}
                            {!editingUser && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Логин *</label>
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={e => setFormData(prev => ({ ...prev, username: e.target.value.toLowerCase() }))}
                                        onBlur={() => setFormData(prev => ({ ...prev, username: prev.username.trim() }))}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none
                                            ${formData.username && !isUsernameValid(formData.username) ? 'border-red-300' : 'border-slate-300'}`}
                                        placeholder="username"
                                    />
                                    {formData.username && !isUsernameValid(formData.username) && (
                                        <p className="text-xs text-red-500 mt-1">Мин. 3 символа, только a-z, 0-9, ., -, _</p>
                                    )}
                                </div>
                            )}

                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Имя *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    placeholder="Иванов Иван"
                                />
                            </div>

                            {/* Password (only for create) */}
                            {!editingUser && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Пароль * (минимум 8 символов)</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={formData.password}
                                            onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                            className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(p => !p)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Roles */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Роли</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {roles.map(role => (
                                        <label
                                            key={role.id}
                                            className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all
                                                ${formData.roleIds.includes(role.id)
                                                    ? `${roleBadgeColor(role.code)} ring-2 ring-blue-400`
                                                    : 'border-slate-200 hover:border-slate-300 bg-white'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={formData.roleIds.includes(role.id)}
                                                onChange={() => toggleRole(role.id)}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <div>
                                                <div className="text-sm font-medium">{role.name}</div>
                                                <div className="text-xs text-slate-500">{role.code}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
                            {formData.roleIds.length === 0 && (
                                <span className="text-xs text-amber-600">Выберите хотя бы одну роль</span>
                            )}
                            <div className="flex gap-3 ml-auto">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={formData.roleIds.length === 0}
                                    className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {editingUser ? 'Сохранить' : 'Создать'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Password reset modal */}
            {showPasswordModal && passwordTarget && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-800">
                                Сброс пароля: {passwordTarget.username}
                            </h3>
                            <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="px-6 py-5">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Новый пароль (минимум 8 символов)</label>
                            <div className="relative">
                                <input
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    placeholder="••••••••"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(p => !p)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
                            <button
                                onClick={() => setShowPasswordModal(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleResetPassword}
                                disabled={newPassword.length < 8}
                                className="px-5 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Сбросить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminUsersPage;
