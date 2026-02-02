/**
 * Утилиты для работы с датами в таймзоне Asia/Tashkent (UTC+5)
 * 
 * Все заказы хранятся в БД как DateTime (UTC).
 * Бизнес-логика работает в таймзоне Ташкента.
 */

const TASHKENT_OFFSET_HOURS = 5; // UTC+5, без перехода на летнее время

/**
 * Конвертирует календарную дату (YYYY-MM-DD) в диапазон UTC 
 * для бизнес-дня в Asia/Tashkent
 * 
 * @param dateStr - строка даты в формате YYYY-MM-DD
 * @returns { start, end } - диапазон UTC для запроса к БД
 * 
 * @example
 * // Для даты 2026-02-02 в Ташкенте:
 * // start = 2026-02-01T19:00:00.000Z (00:00 по Ташкенту)
 * // end = 2026-02-02T19:00:00.000Z (00:00 следующего дня по Ташкенту)
 */
export function getDateRangeForTashkent(dateStr: string): { start: Date; end: Date } {
    const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);

    // 00:00 Tashkent = 19:00 UTC предыдущего дня
    const start = new Date(Date.UTC(y, m - 1, d, -TASHKENT_OFFSET_HOURS, 0, 0, 0));
    // 00:00 следующего дня Tashkent
    const end = new Date(Date.UTC(y, m - 1, d + 1, -TASHKENT_OFFSET_HOURS, 0, 0, 0));

    return { start, end };
}

/**
 * Извлекает компоненты даты (день, месяц, год) в таймзоне Ташкента
 * из UTC даты
 * 
 * @param utcDate - дата в UTC (как хранится в БД)
 * @returns { day, month, year } - компоненты даты в таймзоне Ташкента
 * 
 * @example
 * // Заказ создан 2026-02-01T21:30:00Z (UTC)
 * // В Ташкенте это 2026-02-02 02:30
 * // getDateComponentsInTashkent => { day: 2, month: 2, year: 2026 }
 */
export function getDateComponentsInTashkent(utcDate: Date): { day: number; month: number; year: number } {
    // Добавляем смещение UTC+5 к UTC-времени
    const tashkentTime = new Date(utcDate.getTime() + TASHKENT_OFFSET_HOURS * 60 * 60 * 1000);

    return {
        day: tashkentTime.getUTCDate(),
        month: tashkentTime.getUTCMonth() + 1,
        year: tashkentTime.getUTCFullYear()
    };
}

/**
 * Форматирует дату в IDN формат (DDMMYYYY) в таймзоне Ташкента
 * 
 * @param utcDate - дата в UTC
 * @returns строка IDN в формате DDMMYYYY
 */
export function formatIdnFromDate(utcDate: Date): string {
    const { day, month, year } = getDateComponentsInTashkent(utcDate);
    return `${String(day).padStart(2, '0')}${String(month).padStart(2, '0')}${year}`;
}

/**
 * Получает текущий бизнес-день в Asia/Tashkent как строку YYYY-MM-DD
 */
export function getTashkentToday(): string {
    const now = new Date();
    // Asia/Tashkent = UTC+5
    const tashkentTime = new Date(now.getTime() + TASHKENT_OFFSET_HOURS * 60 * 60 * 1000);
    return tashkentTime.toISOString().slice(0, 10);
}

/**
 * Конвертирует строку YYYY-MM-DD в Date для поля dispatchDay (Prisma @db.Date)
 * Возвращает дату в формате UTC (без времени)
 */
export function parseDispatchDay(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}
