/**
 * Константы статусов заказов (FSM)
 * Синхронизированы с сервером: server/src/constants/statuses.ts
 */

export const ORDER_STATUS = {
    NEW: 'NEW',                    // Новый заказ
    IN_ASSEMBLY: 'IN_ASSEMBLY',    // На сборке
    DISTRIBUTING: 'DISTRIBUTING',  // Распределяется
    LOADED: 'LOADED',              // Погружен в машину
    SHIPPED: 'SHIPPED',            // Отгружен (закрыт)
    CANCELLED: 'CANCELLED',        // Отменён
    REWORK: 'REWORK'               // На доработке
} as const;

export type OrderStatusType = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

/**
 * Человекочитаемые названия статусов
 */
export const STATUS_LABELS: Record<string, string> = {
    [ORDER_STATUS.NEW]: 'Новый',
    [ORDER_STATUS.IN_ASSEMBLY]: 'На сборке',
    [ORDER_STATUS.DISTRIBUTING]: 'Распределяется',
    [ORDER_STATUS.LOADED]: 'Погружен',
    [ORDER_STATUS.SHIPPED]: 'Отгружен',
    [ORDER_STATUS.CANCELLED]: 'Отменён',
    [ORDER_STATUS.REWORK]: 'На доработке'
};

/**
 * Цвета для статусов (Tailwind CSS классы)
 */
export const STATUS_COLORS: Record<string, string> = {
    [ORDER_STATUS.NEW]: 'bg-yellow-100 text-yellow-800',
    [ORDER_STATUS.IN_ASSEMBLY]: 'bg-blue-100 text-blue-800',
    [ORDER_STATUS.DISTRIBUTING]: 'bg-indigo-100 text-indigo-800',
    [ORDER_STATUS.LOADED]: 'bg-purple-100 text-purple-800',
    [ORDER_STATUS.SHIPPED]: 'bg-green-100 text-green-800',
    [ORDER_STATUS.CANCELLED]: 'bg-red-100 text-red-800',
    [ORDER_STATUS.REWORK]: 'bg-orange-100 text-orange-800'
};

/**
 * Получить label статуса
 */
export function getStatusLabel(status: string): string {
    return STATUS_LABELS[status] || status;
}

/**
 * Получить CSS классы для статуса
 */
export function getStatusColor(status: string): string {
    return STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';
}
