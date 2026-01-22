// Централизованный axios инстанс с обработкой ошибок авторизации
import axios from 'axios';
import { API_URL } from './api';

// Создаём axios инстанс
const api = axios.create({
    baseURL: API_URL,
});

// Интерсептор для добавления токена к каждому запросу
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Интерсептор для обработки ошибок авторизации
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            // Проверяем, что это ошибка авторизации
            const isAuthError =
                error.response?.data?.error?.toLowerCase().includes('token') ||
                error.response?.data?.error?.toLowerCase().includes('unauthorized') ||
                error.response?.data?.error?.toLowerCase().includes('forbidden') ||
                error.response?.data?.message?.toLowerCase().includes('token') ||
                error.response?.status === 401;

            if (isAuthError) {
                // Очищаем данные авторизации
                localStorage.removeItem('token');
                localStorage.removeItem('user');

                // Показываем уведомление
                const message = 'Сессия истекла. Пожалуйста, войдите заново.';

                // Создаём кастомное событие для уведомления AuthContext
                window.dispatchEvent(new CustomEvent('auth:session-expired', {
                    detail: { message }
                }));

                // Перенаправляем на страницу входа
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;
