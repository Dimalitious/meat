/**
 * Общие утилиты форматирования для всего приложения
 */

/**
 * Форматирует число для отображения.
 * Нули и пустые значения отображаются как "—" для лучшей читаемости.
 */
export function formatNumber(value: number | null | undefined, decimals = 3): string {
    if (value === null || value === undefined) return '—';
    if (value === 0) return '—';
    return value.toLocaleString('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals
    });
}

/**
 * Форматирует валюту (KZT)
 */
export function formatCurrency(amount: number): string {
    if (amount === 0 || amount === null || amount === undefined) return '—';
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'KZT',
        minimumFractionDigits: 0
    }).format(amount);
}

/**
 * Форматирует дату в русском формате
 */
export function formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}
