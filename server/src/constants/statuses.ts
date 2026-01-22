// ============================================
// ORDER STATUS CONSTANTS
// ============================================

export const ORDER_STATUS = {
    NEW: 'new',
    PROCESSING: 'processing',
    READY: 'ready',
    PENDING: 'pending',
    IN_DELIVERY: 'in_delivery',
    DELIVERED: 'delivered',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    REWORK: 'rework'
} as const;

export type OrderStatusType = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

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
