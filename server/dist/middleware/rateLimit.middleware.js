"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiLimiter = exports.loginLimiter = void 0;
/**
 * Rate-limit middleware for authentication endpoints.
 * Prevents brute-force attacks on /api/auth/login.
 *
 * Usage in auth.routes.ts:
 *   import { loginLimiter } from '../middleware/rateLimit.middleware';
 *   router.post('/login', loginLimiter, login);
 */
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
/**
 * Login endpoint: max 10 attempts per IP per 15-minute window.
 * After exceeding, returns 429 Too Many Requests.
 */
exports.loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true, // Return rate-limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    message: {
        error: 'Too many login attempts. Please try again after 15 minutes.',
    },
});
/**
 * General API rate limiter (optional, for future use).
 * 200 requests per minute per IP.
 */
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
});
