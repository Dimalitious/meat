"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logOrphanedPhoto = exports.deletePhotoFile = exports.uploadPhoto = exports.uploadMiddleware = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
// ============================================
// PRODUCTION V3: PHOTO UPLOADS
// ============================================
const UPLOAD_DIR = path_1.default.join(__dirname, '../../uploads/production');
// Ensure upload directory exists
if (!fs_1.default.existsSync(UPLOAD_DIR)) {
    fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
}
// Generate monthly subfolder (YYYY-MM)
function getMonthlyFolder() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}
// Multer storage configuration
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const monthFolder = path_1.default.join(UPLOAD_DIR, getMonthlyFolder());
        if (!fs_1.default.existsSync(monthFolder)) {
            fs_1.default.mkdirSync(monthFolder, { recursive: true });
        }
        cb(null, monthFolder);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = crypto_1.default.randomBytes(8).toString('hex');
        const ext = path_1.default.extname(file.originalname) || '.jpg';
        cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
    }
});
// File filter: only images
const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
};
// Multer instance
exports.uploadMiddleware = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max (client should compress to ~400KB)
    }
});
/**
 * POST /api/production-v2/uploads/photo
 * Upload a photo for production operations
 */
const uploadPhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const file = req.file;
        const monthFolder = getMonthlyFolder();
        const relativePath = `/uploads/production/${monthFolder}/${file.filename}`;
        // Calculate SHA256 hash
        const fileBuffer = fs_1.default.readFileSync(file.path);
        const sha256 = crypto_1.default.createHash('sha256').update(fileBuffer).digest('hex');
        // Get file stats
        const stats = fs_1.default.statSync(file.path);
        const meta = {
            width: null, // TODO: use sharp to get dimensions
            height: null,
            sizeBytes: stats.size,
            mime: file.mimetype,
            sha256
        };
        res.json({
            url: relativePath,
            meta
        });
    }
    catch (error) {
        console.error('uploadPhoto error:', error);
        res.status(500).json({ error: 'Failed to upload photo' });
    }
};
exports.uploadPhoto = uploadPhoto;
/**
 * Delete a photo file (used for orphan cleanup)
 * Returns true if deleted, false if file not found or error
 */
const deletePhotoFile = (photoUrl) => {
    try {
        if (!photoUrl || !photoUrl.startsWith('/uploads/production/')) {
            return false;
        }
        const filePath = path_1.default.join(__dirname, '../..', photoUrl);
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
            return true;
        }
        return false;
    }
    catch (error) {
        console.error('deletePhotoFile error:', error);
        return false;
    }
};
exports.deletePhotoFile = deletePhotoFile;
/**
 * Log orphaned photo event (structured JSON log)
 */
const logOrphanedPhoto = (params) => {
    const logEntry = {
        event: 'production.photo_orphaned',
        level: 'WARN',
        service: 'production-v2',
        env: process.env.NODE_ENV || 'development',
        runId: params.runId,
        runValueId: params.runValueId,
        userId: params.userId,
        oldPhotoUrl: params.oldPhotoUrl,
        newPhotoUrl: params.newPhotoUrl,
        reason: params.reason,
        stack: params.stack,
        ts: new Date().toISOString()
    };
    // Structured JSON log (WARN level)
    console.log(JSON.stringify(logEntry));
};
exports.logOrphanedPhoto = logOrphanedPhoto;
