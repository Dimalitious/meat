import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface User {
    id: number;
    username: string;
    name: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
    sessionExpiredMessage: string | null;
    clearSessionExpiredMessage: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);

    useEffect(() => {
        if (token) {
            localStorage.setItem('token', token);
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                setUser(JSON.parse(storedUser));
            }
        } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
        }
    }, [token]);

    // Слушаем событие истечения сессии от axios interceptor
    useEffect(() => {
        const handleSessionExpired = (event: CustomEvent<{ message: string }>) => {
            setSessionExpiredMessage(event.detail.message);
            setToken(null);
            setUser(null);
        };

        window.addEventListener('auth:session-expired', handleSessionExpired as EventListener);
        return () => {
            window.removeEventListener('auth:session-expired', handleSessionExpired as EventListener);
        };
    }, []);

    const login = useCallback((newToken: string, newUser: User) => {
        setSessionExpiredMessage(null); // Очищаем сообщение при новом логине
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('user', JSON.stringify(newUser));
    }, []);

    const logout = useCallback(() => {
        setToken(null);
        setUser(null);
    }, []);

    const clearSessionExpiredMessage = useCallback(() => {
        setSessionExpiredMessage(null);
    }, []);

    return (
        <AuthContext.Provider value={{
            user,
            token,
            login,
            logout,
            isAuthenticated: !!token,
            sessionExpiredMessage,
            clearSessionExpiredMessage
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
