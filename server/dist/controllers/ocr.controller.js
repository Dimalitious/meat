"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ocrWeight = void 0;
const tesseract_js_1 = __importDefault(require("tesseract.js"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// ============================================
// PRODUCTION V3: OCR WEIGHT RECOGNITION
// Tesseract.js implementation
// ============================================
/**
 * POST /api/production-v2/ocr/weight
 * Recognize weight value from a photo of scales
 *
 * Uses Tesseract.js for digit recognition
 */
const ocrWeight = async (req, res) => {
    try {
        const { photoUrl } = req.body;
        if (!photoUrl) {
            return res.status(400).json({ error: 'photoUrl is required' });
        }
        // Construct file path from URL
        const uploadsDir = path_1.default.join(__dirname, '../../uploads');
        const filename = path_1.default.basename(photoUrl);
        const imagePath = path_1.default.join(uploadsDir, filename);
        // Check if file exists
        if (!fs_1.default.existsSync(imagePath)) {
            return res.status(404).json({
                error: 'Photo not found',
                value: null,
                confidence: 0
            });
        }
        console.log(`[OCR] Processing image: ${imagePath}`);
        // Run Tesseract OCR
        const result = await tesseract_js_1.default.recognize(imagePath, 'eng', // Language
        {
            // Tesseract options for digit recognition
            logger: m => {
                if (m.status === 'recognizing text') {
                    console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
                }
            }
        });
        const rawText = result.data.text;
        const confidence = result.data.confidence / 100; // Convert to 0-1 range
        console.log(`[OCR] Raw text: "${rawText}", confidence: ${confidence}`);
        // Extract weight value from OCR result
        const weightValue = parseWeightFromText(rawText);
        res.json({
            value: weightValue,
            confidence: weightValue !== null ? confidence : 0,
            raw: rawText.trim(),
            message: weightValue !== null
                ? `Распознано: ${weightValue} кг`
                : 'Не удалось распознать вес. Введите вручную.'
        });
    }
    catch (error) {
        console.error('ocrWeight error:', error);
        res.status(500).json({
            error: 'Failed to process OCR',
            value: null,
            confidence: 0
        });
    }
};
exports.ocrWeight = ocrWeight;
/**
 * Parse weight value from OCR text
 * Looks for patterns like: 12.345, 12,345, 12.34 kg, etc.
 */
function parseWeightFromText(text) {
    if (!text)
        return null;
    // Clean the text
    let cleaned = text
        .replace(/\s+/g, '') // Remove whitespace
        .replace(/[oO]/g, '0') // Common OCR mistake: O -> 0
        .replace(/[lI]/g, '1') // Common OCR mistake: l/I -> 1
        .replace(/[sS]/g, '5') // Common OCR mistake: S -> 5
        .replace(/[bB]/g, '8') // Common OCR mistake: B -> 8
        .replace(/[gG]/g, '9'); // Common OCR mistake: g -> 9
    // Try to find decimal number pattern (supports both . and ,)
    // Pattern: digits, optional decimal separator, optional more digits
    const patterns = [
        /(\d{1,4}[.,]\d{1,3})/, // 12.345 or 1,5
        /(\d{1,4})/ // Just digits: 123
    ];
    for (const pattern of patterns) {
        const match = cleaned.match(pattern);
        if (match) {
            let numStr = match[1].replace(',', '.');
            const num = parseFloat(numStr);
            // Sanity check: weight should be between 0.001 and 9999
            if (!isNaN(num) && num > 0 && num < 10000) {
                // Round to 3 decimal places
                return Math.round(num * 1000) / 1000;
            }
        }
    }
    return null;
}
