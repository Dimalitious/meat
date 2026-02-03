"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    console.log('[AUTH] Path:', req.path);
    console.log('[AUTH] Token present:', !!token);
    console.log('[AUTH] JWT_SECRET set:', !!process.env.JWT_SECRET);
    if (!token) {
        console.log('[AUTH] No token provided');
        return res.status(401).json({ error: 'Access token required' });
    }
    jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.log('[AUTH] Token verification failed:', err.message);
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        console.log('[AUTH] Token valid, user:', user);
        req.user = user;
        next();
    });
};
exports.authenticateToken = authenticateToken;
