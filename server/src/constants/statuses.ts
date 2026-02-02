// ============================================
// ORDER STATUS CONSTANTS (FSM)
// ============================================

/**
 * Статусы заказа согласно FSM:
 * NEW → IN_ASSEMBLY → DISTRIBUTING → LOADED → SHIPPED
 */
export const ORDER_STATUS = {
    NEW: 'NEW',                    // Новый заказ (создан из сводки)
    IN_ASSEMBLY: 'IN_ASSEMBLY',    // На сборке (кнопка "Начать сборку")
    DISTRIBUTING: 'DISTRIBUTING',  // Распределяется (кнопка "Подтвердить" в сборке)
    LOADED: 'LOADED',              // Погружен в машину (назначен экспедитор + сохранено)
    SHIPPED: 'SHIPPED',            // Отгружен / закрыт (экспедитор подписал и закрыл)
    CANCELLED: 'CANCELLED',        // Отменён
    REWORK: 'REWORK'               // На доработке (возврат в сводку)
} as const;

export type OrderStatusType = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

// ============================================
// FSM: ВАЛИДНЫЕ ПЕРЕХОДЫ СТАТУСОВ
// ============================================

/**
 * Карта валидных переходов FSM.
 * Ключ: текущий статус, Значение: массив допустимых следующих статусов
 */
export const VALID_TRANSITIONS: Record<string, string[]> = {
    [ORDER_STATUS.NEW]: [ORDER_STATUS.IN_ASSEMBLY, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.IN_ASSEMBLY]: [ORDER_STATUS.DISTRIBUTING, ORDER_STATUS.NEW, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.DISTRIBUTING]: [ORDER_STATUS.LOADED, ORDER_STATUS.IN_ASSEMBLY, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.LOADED]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.DISTRIBUTING, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.SHIPPED]: [],  // Финальный статус, переходы запрещены
    [ORDER_STATUS.CANCELLED]: [],  // Финальный статус
    [ORDER_STATUS.REWORK]: [ORDER_STATUS.NEW]  // Возврат на начало
};

/**
 * Проверяет, является ли переход из одного статуса в другой валидным по FSM
 */
export function isValidTransition(from: string, to: string): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Возвращает человекочитаемое название статуса на русском
 */
export function getStatusDisplayName(status: string): string {
    const names: Record<string, string> = {
        [ORDER_STATUS.NEW]: 'Новый',
        [ORDER_STATUS.IN_ASSEMBLY]: 'На сборке',
        [ORDER_STATUS.DISTRIBUTING]: 'Распределяется',
        [ORDER_STATUS.LOADED]: 'Погружен',
        [ORDER_STATUS.SHIPPED]: 'Отгружен',
        [ORDER_STATUS.CANCELLED]: 'Отменён',
        [ORDER_STATUS.REWORK]: 'На доработке'
    };
    return names[status] || status;
}

// ============================================
// SUMMARY ORDER STATUS CONSTANTS
// ============================================

export const SUMMARY_STATUS = {
    DRAFT: 'draft',
    FORMING: 'forming',
    SYNCED: 'synced'
} as const;

export type SummaryStatusType = typeof SUMMARY_STATUS[keyof typeof SUMMARY_STATUS];

// ============================================
// DELIVERY STATUS CONSTANTS
// ============================================

export const DELIVERY_STATUS = {
    PENDING: 'pending',
    IN_DELIVERY: 'in_delivery',
    DELIVERED: 'delivered'
} as const;

export type DeliveryStatusType = typeof DELIVERY_STATUS[keyof typeof DELIVERY_STATUS];

// ============================================
// PAYMENT TYPE CONSTANTS
// ============================================

export const PAYMENT_TYPE = {
    BANK: 'bank',
    CASH: 'cash',
    TERMINAL: 'terminal'
} as const;

export type PaymentType = typeof PAYMENT_TYPE[keyof typeof PAYMENT_TYPE];
