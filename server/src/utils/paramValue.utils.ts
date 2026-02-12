// Utility functions for ParamValue management

import type { ParamType } from '@prisma/client';

/**
 * Normalize PROCESSING valueText to canonical form:
 * trim, collapse multiple spaces, toLowerCase
 */
export function normalizeProcessingText(input: string): string {
    return input.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Sentence case: first character uppercase, rest unchanged
 */
export function sentenceCase(s: string): string {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Format weight in grams to human-readable label.
 * "1 кг" if divisible by 1000, otherwise "750 г"
 */
export function formatWeightLabel(grams: number): string {
    if (!Number.isFinite(grams) || grams <= 0) return '';
    return grams % 1000 === 0 ? `${grams / 1000} кг` : `${grams} г`;
}

/**
 * Format weight range in grams to human-readable label.
 * Single: "1 кг" / "750 г"
 * Range: "400–500 г" / "1–2 кг"
 */
export function formatWeightRange(min: number, max: number): string {
    if (!Number.isFinite(min) || min <= 0) return '';
    if (min === max) return formatWeightLabel(min);
    // Both divisible by 1000 → show in kg
    if (min % 1000 === 0 && max % 1000 === 0) {
        return `${min / 1000}–${max / 1000} кг`;
    }
    return `${min}–${max} г`;
}

/**
 * Auto-generate label from param value if label is not provided.
 * Called at create time; stored in DB.
 * Supports both legacy single values and new min/max ranges.
 */
export function autoLabel(
    paramType: ParamType,
    values: {
        valueNum?: string | number | null;
        valueInt?: number | null;
        valueText?: string | null;
        valueNumMin?: string | number | null;
        valueNumMax?: string | number | null;
        valueIntMin?: number | null;
        valueIntMax?: number | null;
    }
): string {
    switch (paramType) {
        case 'LENGTH_CM':
        case 'WIDTH_CM':
        case 'HEIGHT_CM':
        case 'THICKNESS_CM': {
            const min = values.valueNumMin != null ? String(values.valueNumMin) : null;
            const max = values.valueNumMax != null ? String(values.valueNumMax) : null;
            if (min && max) {
                return min === max ? `${min} см` : `${min}–${max} см`;
            }
            // Fallback to legacy single value
            const n = values.valueNum != null ? String(values.valueNum) : '';
            return n ? `${n} см` : '';
        }
        case 'WEIGHT_G': {
            const min = values.valueIntMin != null ? Number(values.valueIntMin) : null;
            const max = values.valueIntMax != null ? Number(values.valueIntMax) : null;
            if (min != null && max != null) {
                return formatWeightRange(min, max);
            }
            // Fallback to legacy single value
            return values.valueInt != null ? formatWeightLabel(values.valueInt) : '';
        }
        case 'PROCESSING':
            // Sentence case from canonical lowercase
            return values.valueText ? sentenceCase(values.valueText) : '';
        default:
            return '';
    }
}
