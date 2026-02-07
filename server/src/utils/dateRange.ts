/**
 * Utility functions for date range handling
 * Properly converts YYYY-MM-DD strings to UTC boundaries
 */

/**
 * Convert dateFrom/dateTo (YYYY-MM-DD) to UTC boundaries
 * Treats input as local server timezone and converts to UTC Date objects
 * 
 * @param dateFrom - Start date in YYYY-MM-DD format
 * @param dateTo - End date in YYYY-MM-DD format
 * @returns Object with from (00:00:00.000) and to (23:59:59.999) as Date objects
 */
export function getUtcRangeFromYmd(dateFrom: string, dateTo: string): { from: Date; to: Date } {
    // dateFrom/dateTo come as 'YYYY-MM-DD'
    // We treat them as local timezone boundaries [from 00:00:00.000, to 23:59:59.999]
    // and let JavaScript Date convert to UTC internally
    const from = new Date(`${dateFrom}T00:00:00.000`);
    const to = new Date(`${dateTo}T23:59:59.999`);
    return { from, to };
}

/**
 * Get single day UTC boundaries from a YYYY-MM-DD string
 * 
 * @param date - Date in YYYY-MM-DD format
 * @returns Object with from (00:00:00.000) and to (23:59:59.999) as Date objects
 */
export function getSingleDayRange(date: string): { from: Date; to: Date } {
    return getUtcRangeFromYmd(date, date);
}
