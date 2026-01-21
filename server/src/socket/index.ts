import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

// Типы для комнат и пользователей
interface ConnectedUser {
    id: number;
    username: string;
    name: string;
    socketId: string;
}

interface RoomState {
    users: Map<string, ConnectedUser>;
    editingFields: Map<number, ConnectedUser>; // nodeId -> user
}

// Хранилище состояния комнат
const rooms = new Map<string, RoomState>();

// Получение или создание состояния комнаты
const getRoom = (roomId: string): RoomState => {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, {
            users: new Map(),
            editingFields: new Map()
        });
    }
    return rooms.get(roomId)!;
};

// Аутентификация сокета через JWT
const authenticateSocket = (socket: Socket): ConnectedUser | null => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) return null;

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
        return {
            id: decoded.userId,
            username: decoded.username,
            name: decoded.name || decoded.username,
            socketId: socket.id
        };
    } catch (err) {
        return null;
    }
};

export const initializeSocketServer = (httpServer: HTTPServer): Server => {
    const io = new Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        },
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // Namespace для производства
    const productionNsp = io.of('/production');

    productionNsp.on('connection', (socket: Socket) => {
        const user = authenticateSocket(socket);

        if (!user) {
            console.log('[Socket] Unauthorized connection attempt');
            socket.disconnect();
            return;
        }

        console.log(`[Socket] User connected: ${user.username} (${socket.id})`);

        // === ПРИСОЕДИНЕНИЕ К КОМНАТЕ КАРТОЧКИ ===
        socket.on('join:run', (runId: number) => {
            const roomId = `run-${runId}`;
            socket.join(roomId);

            const room = getRoom(roomId);
            room.users.set(socket.id, user);

            // Отправляем список пользователей в комнате
            const usersInRoom = Array.from(room.users.values());
            productionNsp.to(roomId).emit('room:users', {
                runId,
                users: usersInRoom
            });

            console.log(`[Socket] ${user.username} joined run-${runId}`);
        });

        // === ПОКИДАНИЕ КОМНАТЫ ===
        socket.on('leave:run', (runId: number) => {
            const roomId = `run-${runId}`;
            socket.leave(roomId);

            const room = getRoom(roomId);
            room.users.delete(socket.id);

            // Удаляем редактирование полей этим пользователем
            room.editingFields.forEach((editingUser, nodeId) => {
                if (editingUser.socketId === socket.id) {
                    room.editingFields.delete(nodeId);
                }
            });

            // Обновляем список пользователей
            const usersInRoom = Array.from(room.users.values());
            productionNsp.to(roomId).emit('room:users', {
                runId,
                users: usersInRoom
            });

            console.log(`[Socket] ${user.username} left run-${runId}`);
        });

        // === ПРИСОЕДИНЕНИЕ К СПИСКУ КАРТОЧЕК ===
        socket.on('join:list', () => {
            socket.join('production-list');
            console.log(`[Socket] ${user.username} joined production-list`);
        });

        socket.on('leave:list', () => {
            socket.leave('production-list');
        });

        // === ОБНОВЛЕНИЕ ЗНАЧЕНИЯ В ПОЛЕ ===
        socket.on('value:update', (data: { runId: number; nodeId: number; value: number }) => {
            const roomId = `run-${data.runId}`;

            // Транслируем всем в комнате, кроме отправителя
            socket.to(roomId).emit('value:changed', {
                runId: data.runId,
                nodeId: data.nodeId,
                value: data.value,
                user: { id: user.id, username: user.username, name: user.name }
            });
        });

        // === ФОКУС НА ПОЛЕ (начало редактирования) ===
        socket.on('field:focus', (data: { runId: number; nodeId: number }) => {
            const roomId = `run-${data.runId}`;
            const room = getRoom(roomId);

            room.editingFields.set(data.nodeId, user);

            socket.to(roomId).emit('field:editing', {
                runId: data.runId,
                nodeId: data.nodeId,
                user: { id: user.id, username: user.username, name: user.name }
            });
        });

        // === ПОТЕРЯ ФОКУСА (конец редактирования) ===
        socket.on('field:blur', (data: { runId: number; nodeId: number }) => {
            const roomId = `run-${data.runId}`;
            const room = getRoom(roomId);

            room.editingFields.delete(data.nodeId);

            socket.to(roomId).emit('field:released', {
                runId: data.runId,
                nodeId: data.nodeId
            });
        });

        // === КАРТОЧКА СОХРАНЕНА ===
        socket.on('run:saved', (data: { runId: number }) => {
            const roomId = `run-${data.runId}`;

            socket.to(roomId).emit('run:updated', {
                runId: data.runId,
                action: 'saved',
                user: { id: user.id, username: user.username, name: user.name }
            });

            // Обновляем список
            productionNsp.to('production-list').emit('list:updated', {
                action: 'updated',
                runId: data.runId
            });
        });

        // === КАРТОЧКА ЗАФИКСИРОВАНА/РАЗБЛОКИРОВАНА ===
        socket.on('run:locked', (data: { runId: number; isLocked: boolean }) => {
            const roomId = `run-${data.runId}`;

            productionNsp.to(roomId).emit('run:lock-changed', {
                runId: data.runId,
                isLocked: data.isLocked,
                user: { id: user.id, username: user.username, name: user.name }
            });

            productionNsp.to('production-list').emit('list:updated', {
                action: 'lock-changed',
                runId: data.runId,
                isLocked: data.isLocked
            });
        });

        // === КАРТОЧКА СОЗДАНА ===
        socket.on('run:created', (data: { runId: number; productName: string }) => {
            productionNsp.to('production-list').emit('list:updated', {
                action: 'created',
                runId: data.runId,
                productName: data.productName,
                user: { id: user.id, username: user.username, name: user.name }
            });
        });

        // === КАРТОЧКА УДАЛЕНА ===
        socket.on('run:deleted', (data: { runId: number }) => {
            const roomId = `run-${data.runId}`;

            productionNsp.to(roomId).emit('run:removed', {
                runId: data.runId,
                user: { id: user.id, username: user.username, name: user.name }
            });

            productionNsp.to('production-list').emit('list:updated', {
                action: 'deleted',
                runId: data.runId
            });

            // Очищаем комнату
            rooms.delete(roomId);
        });

        // === ОТКЛЮЧЕНИЕ ===
        socket.on('disconnect', () => {
            console.log(`[Socket] User disconnected: ${user.username}`);

            // Удаляем пользователя из всех комнат
            rooms.forEach((room, roomId) => {
                if (room.users.has(socket.id)) {
                    room.users.delete(socket.id);

                    // Удаляем редактирование полей
                    room.editingFields.forEach((editingUser, nodeId) => {
                        if (editingUser.socketId === socket.id) {
                            room.editingFields.delete(nodeId);
                            productionNsp.to(roomId).emit('field:released', {
                                runId: parseInt(roomId.replace('run-', '')),
                                nodeId
                            });
                        }
                    });

                    // Обновляем список пользователей
                    const usersInRoom = Array.from(room.users.values());
                    productionNsp.to(roomId).emit('room:users', {
                        runId: parseInt(roomId.replace('run-', '')),
                        users: usersInRoom
                    });
                }
            });
        });
    });

    console.log('[Socket.IO] Server initialized');
    return io;
};
