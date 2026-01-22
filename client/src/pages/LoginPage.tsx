import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_URL } from '../config/api';

// Configure Axios base URL for login (не используем interceptor тут)
const api = axios.create({
    baseURL: `${API_URL}/api`,
});

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login, sessionExpiredMessage, clearSessionExpiredMessage } = useAuth();
    const navigate = useNavigate();

    // Показываем сообщение об истечении сессии
    useEffect(() => {
        if (sessionExpiredMessage) {
            setError(sessionExpiredMessage);
            clearSessionExpiredMessage();
        }
    }, [sessionExpiredMessage, clearSessionExpiredMessage]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const response = await api.post('/auth/login', { username, password });
            const { token, user } = response.data;
            login(token, user);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Ошибка входа');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6 text-center">Мясокомбинат ERP</h2>
                {error && (
                    <div className={`p-3 rounded mb-4 ${error.includes('Сессия')
                            ? 'bg-amber-100 text-amber-700 border border-amber-300'
                            : 'bg-red-100 text-red-700'
                        }`}>
                        {error.includes('Сессия') && <span className="mr-2">⏰</span>}
                        {error}
                    </div>
                )}
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2">Имя пользователя</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                            autoFocus
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-700 mb-2">Пароль</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition duration-200"
                    >
                        Войти
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;

