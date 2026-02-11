"use strict";
// Utility functions for ParamValue management
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeProcessingText = normalizeProcessingText;
exports.sentenceCase = sentenceCase;
exports.formatWeightLabel = formatWeightLabel;
exports.autoLabel = autoLabel;
/**
 * Normalize PROCESSING valueText to canonical form:
 * trim, collapse multiple spaces, toLowerCase
 */
function normalizeProcessingText(input) {
    return input.trim().replace(/\s+/g, ' ').toLowerCase();
}
/**
 * Sentence case: first character uppercase, rest unchanged
 */
function sentenceCase(s) {
    if (!s)
        return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}
/**
 * Format weight in grams to human-readable label.
 * "1 кг" if divisible by 1000, otherwise "750 г"
 */
function formatWeightLabel(grams) {
    if (!Number.isFinite(grams) || grams <= 0)
        return '';
    return grams % 1000 === 0 ? `${grams / 1000} кг` : `${grams} г`;
}
/**
 * Auto-generate label from param value if label is not provided.
 * Called at create time; stored in DB.
 */
function autoLabel(paramType, values) {
    switch (paramType) {
        case 'LENGTH_CM':
        case 'WIDTH_CM': {
            const n = values.valueNum != null ? String(values.valueNum) : '';
            return n ? `${n} см` : '';
        }
        case 'WEIGHT_G':
            return values.valueInt != null ? formatWeightLabel(values.valueInt) : '';
        case 'PROCESSING':
            // Sentence case from canonical lowercase
            return values.valueText ? sentenceCase(values.valueText) : '';
        default:
            return '';
    }
}
