import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// ============================================
// PRODUCTION V3: PHOTO UPLOADS
// ============================================

const UPLOAD_DIR = path.join(__dirname, '../../uploads/production');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Generate monthly subfolder (YYYY-MM)
function getMonthlyFolder(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const monthFolder = path.join(UPLOAD_DIR, getMonthlyFolder());
        if (!fs.existsSync(monthFolder)) {
            fs.mkdirSync(monthFolder, { recursive: true });
        }
        cb(null, monthFolder);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = crypto.randomBytes(8).toString('hex');
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
    }
});

// File filter: only images
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
};

// Multer instance
export const uploadMiddleware = multer({
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
export const uploadPhoto = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const file = req.file;
        const monthFolder = getMonthlyFolder();
        const relativePath = `/uploads/production/${monthFolder}/${file.filename}`;

        // Calculate SHA256 hash
        const fileBuffer = fs.readFileSync(file.path);
        const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Get file stats
        const stats = fs.statSync(file.path);

        const meta = {
            width: null as number | null,  // TODO: use sharp to get dimensions
            height: null as number | null,
            sizeBytes: stats.size,
            mime: file.mimetype,
            sha256
        };

        res.json({
            url: relativePath,
            meta
        });
    } catch (error) {
        console.error('uploadPhoto error:', error);
        res.status(500).json({ error: 'Failed to upload photo' });
    }
};

/**
 * Delete a photo file (used for orphan cleanup)
 * Returns true if deleted, false if file not found or error
 */
export const deletePhotoFile = (photoUrl: string): boolean => {
    try {
        if (!photoUrl || !photoUrl.startsWith('/uploads/production/')) {
            return false;
        }

        const filePath = path.join(__dirname, '../..', photoUrl);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    } catch (error) {
        console.error('deletePhotoFile error:', error);
        return false;
    }
};

/**
 * Log orphaned photo event (structured JSON log)
 */
export const logOrphanedPhoto = (params: {
    runId: number;
    runValueId: number;
    userId: number | undefined;
    oldPhotoUrl: string;
    newPhotoUrl: string;
    reason: string;
    stack?: string;
}) => {
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
