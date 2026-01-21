import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../config/api';

// ============================================
// ТИПЫ
// ============================================

interface SocketUser {
    id: number;
    username: string;
    name: string;
}

interface ValueChangeEvent {
    runId: number;
    nodeId: number;
    value: number;
    user: SocketUser;
}

interface FieldEditingEvent {
    runId: number;
    nodeId: number;
    user: SocketUser;
}

interface RoomUsersEvent {
    runId: number;
    users: SocketUser[];
}

interface RunUpdateEvent {
    runId: number;
    action: string;
    user: SocketUser;
}

interface ListUpdateEvent {
    action: 'created' | 'updated' | 'deleted' | 'lock-changed';
    runId: number;
    productName?: string;
    isLocked?: boolean;
    user?: SocketUser;
}

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    // Production room methods
    joinRun: (runId: number) => void;
    leaveRun: (runId: number) => void;
    joinList: () => void;
    leaveList: () => void;
    // Value updates
    emitValueUpdate: (runId: number, nodeId: number, value: number) => void;
    emitFieldFocus: (runId: number, nodeId: number) => void;
    emitFieldBlur: (runId: number, nodeId: number) => void;
    // Run events
    emitRunSaved: (runId: number) => void;
    emitRunLocked: (runId: number, isLocked: boolean) => void;
    emitRunCreated: (runId: number, productName: string) => void;
    emitRunDeleted: (runId: number) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

// ============================================
// PROVIDER
// ============================================

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        // Получаем базовый URL без /api
        const baseUrl = API_URL.replace('/api', '').replace(':3000', ':3000');

        const newSocket = io(`${baseUrl}/production`, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        newSocket.on('connect', () => {
            console.log('[Socket] Connected to production namespace');
            setIsConnected(true);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason);
            setIsConnected(false);
        });

        newSocket.on('connect_error', (error) => {
            console.error('[Socket] Connection error:', error.message);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);

    // Room methods
    const joinRun = useCallback((runId: number) => {
        socket?.emit('join:run', runId);
    }, [socket]);

    const leaveRun = useCallback((runId: number) => {
        socket?.emit('leave:run', runId);
    }, [socket]);

    const joinList = useCallback(() => {
        socket?.emit('join:list');
    }, [socket]);

    const leaveList = useCallback(() => {
        socket?.emit('leave:list');
    }, [socket]);

    // Value updates
    const emitValueUpdate = useCallback((runId: number, nodeId: number, value: number) => {
        socket?.emit('value:update', { runId, nodeId, value });
    }, [socket]);

    const emitFieldFocus = useCallback((runId: number, nodeId: number) => {
        socket?.emit('field:focus', { runId, nodeId });
    }, [socket]);

    const emitFieldBlur = useCallback((runId: number, nodeId: number) => {
        socket?.emit('field:blur', { runId, nodeId });
    }, [socket]);

    // Run events
    const emitRunSaved = useCallback((runId: number) => {
        socket?.emit('run:saved', { runId });
    }, [socket]);

    const emitRunLocked = useCallback((runId: number, isLocked: boolean) => {
        socket?.emit('run:locked', { runId, isLocked });
    }, [socket]);

    const emitRunCreated = useCallback((runId: number, productName: string) => {
        socket?.emit('run:created', { runId, productName });
    }, [socket]);

    const emitRunDeleted = useCallback((runId: number) => {
        socket?.emit('run:deleted', { runId });
    }, [socket]);

    const value: SocketContextType = {
        socket,
        isConnected,
        joinRun,
        leaveRun,
        joinList,
        leaveList,
        emitValueUpdate,
        emitFieldFocus,
        emitFieldBlur,
        emitRunSaved,
        emitRunLocked,
        emitRunCreated,
        emitRunDeleted,
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};

// ============================================
// HOOKS
// ============================================

export const useSocket = (): SocketContextType => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};

// Hook для комнаты выработки
export const useProductionRun = (
    runId: number | null,
    callbacks: {
        onValueChanged?: (nodeId: number, value: number, user: SocketUser) => void;
        onFieldEditing?: (nodeId: number, user: SocketUser) => void;
        onFieldReleased?: (nodeId: number) => void;
        onRunUpdated?: (action: string, user: SocketUser) => void;
        onLockChanged?: (isLocked: boolean, user: SocketUser) => void;
        onRunRemoved?: () => void;
    }
) => {
    const { socket, joinRun, leaveRun } = useSocket();
    const [roomUsers, setRoomUsers] = useState<SocketUser[]>([]);
    const [editingFields, setEditingFields] = useState<Map<number, SocketUser>>(new Map());
    const callbacksRef = useRef(callbacks);
    callbacksRef.current = callbacks;

    useEffect(() => {
        if (!socket || !runId) return;

        joinRun(runId);

        // Обработчики событий
        const handleRoomUsers = (data: RoomUsersEvent) => {
            if (data.runId === runId) {
                setRoomUsers(data.users);
            }
        };

        const handleValueChanged = (data: ValueChangeEvent) => {
            if (data.runId === runId) {
                callbacksRef.current.onValueChanged?.(data.nodeId, data.value, data.user);
            }
        };

        const handleFieldEditing = (data: FieldEditingEvent) => {
            if (data.runId === runId) {
                setEditingFields(prev => new Map(prev).set(data.nodeId, data.user));
                callbacksRef.current.onFieldEditing?.(data.nodeId, data.user);
            }
        };

        const handleFieldReleased = (data: { runId: number; nodeId: number }) => {
            if (data.runId === runId) {
                setEditingFields(prev => {
                    const next = new Map(prev);
                    next.delete(data.nodeId);
                    return next;
                });
                callbacksRef.current.onFieldReleased?.(data.nodeId);
            }
        };

        const handleRunUpdated = (data: RunUpdateEvent) => {
            if (data.runId === runId) {
                callbacksRef.current.onRunUpdated?.(data.action, data.user);
            }
        };

        const handleLockChanged = (data: { runId: number; isLocked: boolean; user: SocketUser }) => {
            if (data.runId === runId) {
                callbacksRef.current.onLockChanged?.(data.isLocked, data.user);
            }
        };

        const handleRunRemoved = (data: { runId: number }) => {
            if (data.runId === runId) {
                callbacksRef.current.onRunRemoved?.();
            }
        };

        socket.on('room:users', handleRoomUsers);
        socket.on('value:changed', handleValueChanged);
        socket.on('field:editing', handleFieldEditing);
        socket.on('field:released', handleFieldReleased);
        socket.on('run:updated', handleRunUpdated);
        socket.on('run:lock-changed', handleLockChanged);
        socket.on('run:removed', handleRunRemoved);

        return () => {
            leaveRun(runId);
            socket.off('room:users', handleRoomUsers);
            socket.off('value:changed', handleValueChanged);
            socket.off('field:editing', handleFieldEditing);
            socket.off('field:released', handleFieldReleased);
            socket.off('run:updated', handleRunUpdated);
            socket.off('run:lock-changed', handleLockChanged);
            socket.off('run:removed', handleRunRemoved);
        };
    }, [socket, runId, joinRun, leaveRun]);

    return {
        roomUsers,
        editingFields
    };
};

// Hook для списка выработок
export const useProductionList = (
    callbacks: {
        onListUpdated?: (event: ListUpdateEvent) => void;
    }
) => {
    const { socket, joinList, leaveList } = useSocket();
    const callbacksRef = useRef(callbacks);
    callbacksRef.current = callbacks;

    useEffect(() => {
        if (!socket) return;

        joinList();

        const handleListUpdated = (data: ListUpdateEvent) => {
            callbacksRef.current.onListUpdated?.(data);
        };

        socket.on('list:updated', handleListUpdated);

        return () => {
            leaveList();
            socket.off('list:updated', handleListUpdated);
        };
    }, [socket, joinList, leaveList]);
};
