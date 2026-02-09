/**
 * Rate-limit middleware for authentication endpoints.
 * Prevents brute-force attacks on /api/auth/login.
 *
 * Usage in auth.routes.ts:
 *   import { loginLimiter } from '../middleware/rateLimit.middleware';
 *   router.post('/login', loginLimiter, login);
 */
import rateLimit from 'express-rate-limit';

/**
 * Login endpoint: max 10 attempts per IP per 15-minute window.
 * After exceeding, returns 429 Too Many Requests.
 */
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,   // Return rate-limit info in `RateLimit-*` headers
    legacyHeaders: false,    // Disable `X-RateLimit-*` headers
    message: {
        error: 'Too many login attempts. Please try again after 15 minutes.',
    },
    keyGenerator: (req) => {
        // Use X-Forwarded-For behind proxy (Railway, nginx), fallback to IP
        return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
            || req.ip
            || 'unknown';
    },
});

/**
 * General API rate limiter (optional, for future use).
 * 200 requests per minute per IP.
 */
export const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
});
