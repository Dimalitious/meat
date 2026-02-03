"use strict";
// ============================================
// ORDER STATUS CONSTANTS
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_TYPE = exports.DELIVERY_STATUS = exports.SUMMARY_STATUS = exports.ORDER_STATUS = void 0;
exports.ORDER_STATUS = {
    NEW: 'new',
    PROCESSING: 'processing',
    ASSIGNED: 'assigned', // After expeditor assigned in Distribution
    READY: 'ready',
    PENDING: 'pending',
    IN_DELIVERY: 'in_delivery',
    DELIVERED: 'delivered',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    REWORK: 'rework'
};
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
