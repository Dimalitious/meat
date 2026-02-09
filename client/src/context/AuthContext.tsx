import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { API_URL } from '../config/api';

interface User {
    id: number;
    username: string;
    name: string;
    role?: string;          // legacy field (optional, kept for compat)
    roles?: string[];       // RBAC role codes
    permissions?: string[]; // RBAC permission codes
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
    sessionExpiredMessage: string | null;
    clearSessionExpiredMessage: () => void;
    // RBAC helpers
    roles: string[];
    permissions: string[];
    hasPermission: (code: string) => boolean;
    hasAnyPermission: (codes: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);
    const [roles, setRoles] = useState<string[]>([]);
    const [permissions, setPermissions] = useState<string[]>([]);

    // Restore user from localStorage when token changes
    useEffect(() => {
        if (token) {
            localStorage.setItem('token', token);
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                const parsed = JSON.parse(storedUser) as User;
                setUser(parsed);
                setRoles(parsed.roles ?? []);
                setPermissions(parsed.permissions ?? []);
            }
        } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
            setRoles([]);
            setPermissions([]);
        }
    }, [token]);

    // Listen for session expiration events (from axios interceptor)
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
        setSessionExpiredMessage(null);
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('user', JSON.stringify(newUser));
        setRoles(newUser.roles ?? []);
        setPermissions(newUser.permissions ?? []);
    }, []);

    const logout = useCallback(() => {
        setToken(null);
        setUser(null);
    }, []);

    const clearSessionExpiredMessage = useCallback(() => {
        setSessionExpiredMessage(null);
    }, []);

    // RBAC permission helpers (stable refs via useCallback)
    const hasPermission = useCallback(
        (code: string) => permissions.includes(code),
        [permissions]
    );

    const hasAnyPermission = useCallback(
        (codes: string[]) => codes.some(c => permissions.includes(c)),
        [permissions]
    );

    /**
     * P1: Fetch /api/auth/me on app start (and whenever token changes)
     * to hydrate RBAC roles/permissions from the backend.
     *
     * Anti-loop guard: only call /me when token is present.
     * On 401/403 from /me → clear auth (token becomes null → effect won't re-fire).
     */
    useEffect(() => {
        let cancelled = false;

        async function fetchMe(currentToken: string) {
            try {
                const res = await fetch(`${API_URL}/api/auth/me`, {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${currentToken}` },
                });

                if (cancelled) return;

                if (res.status === 401 || res.status === 403) {
                    // Token invalid / expired / disabled user → clear auth once
                    logout();
                    return;
                }

                if (!res.ok) {
                    // Non-auth error (500, network issue, etc): keep session, just log
                    console.warn('[AuthContext] /me failed:', res.status);
                    return;
                }

                const data = await res.json();
                // Backend shape: { userId, username, roles: [], permissions: [], _rbac: {} }
                const meRoles: string[] = data.roles ?? [];
                const mePerms: string[] = data.permissions ?? [];

                // Merge with existing user info (name from login, rbac from /me)
                setUser(prev => {
                    const updated: User = {
                        ...(prev ?? { id: data.userId, username: data.username, name: data.username }),
                        id: data.userId,
                        username: data.username,
                        roles: meRoles,
                        permissions: mePerms,
                    };
                    localStorage.setItem('user', JSON.stringify(updated));
                    return updated;
                });
                setRoles(meRoles);
                setPermissions(mePerms);
            } catch (e) {
                // Network error: don't kick user out (temporary connectivity issue)
                console.warn('[AuthContext] /me network error:', e);
            }
        }

        if (!token) return; // critical anti-loop guard
        fetchMe(token);

        return () => {
            cancelled = true;
        };
    }, [token, logout]);

    return (
        <AuthContext.Provider value={{
            user,
            token,
            login,
            logout,
            isAuthenticated: !!token,
            sessionExpiredMessage,
            clearSessionExpiredMessage,
            roles,
            permissions,
            hasPermission,
            hasAnyPermission,
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
