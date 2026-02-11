"use strict";
// ============================================
// ORDER STATUS CONSTANTS (FSM)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_TYPE = exports.DELIVERY_STATUS = exports.SUMMARY_STATUS = exports.VALID_TRANSITIONS = exports.ORDER_STATUS = void 0;
exports.isValidTransition = isValidTransition;
exports.getStatusDisplayName = getStatusDisplayName;
/**
 * Статусы заказа согласно FSM:
 * NEW → IN_ASSEMBLY → DISTRIBUTING → LOADED → SHIPPED
 */
exports.ORDER_STATUS = {
    NEW: 'NEW', // Новый заказ (создан из сводки)
    IN_ASSEMBLY: 'IN_ASSEMBLY', // На сборке (кнопка "Начать сборку")
    DISTRIBUTING: 'DISTRIBUTING', // Распределяется (кнопка "Подтвердить" в сборке)
    LOADED: 'LOADED', // Погружен в машину (назначен экспедитор + сохранено)
    SHIPPED: 'SHIPPED', // Отгружен / закрыт (экспедитор подписал и закрыл)
    CANCELLED: 'CANCELLED', // Отменён
    REWORK: 'REWORK' // На доработке (возврат в сводку)
};
// ============================================
// FSM: ВАЛИДНЫЕ ПЕРЕХОДЫ СТАТУСОВ
// ============================================
/**
 * Карта валидных переходов FSM.
 * Ключ: текущий статус, Значение: массив допустимых следующих статусов
 */
exports.VALID_TRANSITIONS = {
    [exports.ORDER_STATUS.NEW]: [exports.ORDER_STATUS.IN_ASSEMBLY, exports.ORDER_STATUS.CANCELLED],
    [exports.ORDER_STATUS.IN_ASSEMBLY]: [exports.ORDER_STATUS.DISTRIBUTING, exports.ORDER_STATUS.NEW, exports.ORDER_STATUS.CANCELLED],
    [exports.ORDER_STATUS.DISTRIBUTING]: [exports.ORDER_STATUS.LOADED, exports.ORDER_STATUS.IN_ASSEMBLY, exports.ORDER_STATUS.CANCELLED],
    [exports.ORDER_STATUS.LOADED]: [exports.ORDER_STATUS.SHIPPED, exports.ORDER_STATUS.DISTRIBUTING, exports.ORDER_STATUS.CANCELLED],
    [exports.ORDER_STATUS.SHIPPED]: [], // Финальный статус, переходы запрещены
    [exports.ORDER_STATUS.CANCELLED]: [], // Финальный статус
    [exports.ORDER_STATUS.REWORK]: [exports.ORDER_STATUS.NEW] // Возврат на начало
};
/**
 * Проверяет, является ли переход из одного статуса в другой валидным по FSM
 */
function isValidTransition(from, to) {
    return exports.VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
/**
 * Возвращает человекочитаемое название статуса на русском
 */
function getStatusDisplayName(status) {
    const names = {
        [exports.ORDER_STATUS.NEW]: 'Новый',
        [exports.ORDER_STATUS.IN_ASSEMBLY]: 'На сборке',
        [exports.ORDER_STATUS.DISTRIBUTING]: 'Распределяется',
        [exports.ORDER_STATUS.LOADED]: 'Погружен',
        [exports.ORDER_STATUS.SHIPPED]: 'Отгружен',
        [exports.ORDER_STATUS.CANCELLED]: 'Отменён',
        [exports.ORDER_STATUS.REWORK]: 'На доработке'
    };
    return names[status] || status;
}
// ============================================
// SUMMARY ORDER STATUS CONSTANTS
// ============================================
exports.SUMMARY_STATUS = {
    DRAFT: 'draft',
    FORMING: 'forming',
    SYNCED: 'synced'
};
// ============================================
// DELIVERY STATUS CONSTANTS
// ============================================
exports.DELIVERY_STATUS = {
    PENDING: 'pending',
    IN_DELIVERY: 'in_delivery',
    DELIVERED: 'delivered'
};
// ============================================
// PAYMENT TYPE CONSTANTS
// ============================================
exports.PAYMENT_TYPE = {
    BANK: 'bank',
    CASH: 'cash',
    TERMINAL: 'terminal'
};
