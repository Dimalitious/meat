"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.me = exports.login = exports.register = void 0;
const db_1 = require("../db");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const register = async (req, res) => {
    try {
        const { username, password, name, role, telegramId } = req.body;
        const existingUser = await db_1.prisma.user.findUnique({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await db_1.prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                name,
                role: role || 'USER',
                telegramId: telegramId || null,
            },
        });
        res.status(201).json({ message: 'User created successfully', userId: user.id });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await db_1.prisma.user.findUnique({ where: { username } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Check isActive (RBAC)
        if (user.isActive === false) {
            return res.status(403).json({ error: 'User disabled' });
        }
        const validPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // New JWT payload: userId, username, av (authVersion)
        // Legacy field `role` included for backward compat with old frontend code
        const token = jsonwebtoken_1.default.sign({
            userId: user.id,
            username: user.username,
            av: user.authVersion ?? 1,
            role: user.role, // legacy compat
        }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                role: user.role, // legacy compat
                username: user.username,
            },
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.login = login;
/**
 * GET /api/auth/me
 * Returns current user info + RBAC roles/permissions.
 * Requires authenticateToken + loadUserContext middleware before this handler.
 */
const me = async (req, res) => {
    try {
        const u = req.user;
        if (!u)
            return res.status(401).json({ error: 'Unauthorized' });
        res.json({
            userId: u.userId,
            username: u.username,
            roles: u.roles,
            permissions: u.permissions,
            _rbac: {
                fallbackUsed: u._rbac?.fallbackUsed ?? false,
                tokenNeedsRefresh: u._rbac?.tokenNeedsRefresh ?? false,
            },
        });
    }
    catch (error) {
        console.error('Me endpoint error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.me = me;
