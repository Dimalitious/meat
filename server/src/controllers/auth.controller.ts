import { Request, Response } from 'express';
import { prisma } from '../db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const register = async (req: Request, res: Response) => {
    try {
        const { username, password, name, role, telegramId } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                name,
                role: role || 'USER',
                telegramId: telegramId || null,
            },
        });

        res.status(201).json({ message: 'User created successfully', userId: user.id });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check isActive (RBAC)
        if (user.isActive === false) {
            return res.status(403).json({ error: 'User disabled' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // New JWT payload: userId, username, av (authVersion)
        // Legacy field `role` included for backward compat with old frontend code
        const token = jwt.sign(
            {
                userId: user.id,
                username: user.username,
                av: user.authVersion ?? 1,
                role: user.role, // legacy compat
            },
            process.env.JWT_SECRET as string,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                role: user.role,     // legacy compat
                username: user.username,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /api/auth/me
 * Returns current user info + RBAC roles/permissions.
 * Requires authenticateToken + loadUserContext middleware before this handler.
 */
export const me = async (req: Request, res: Response) => {
    try {
        const u = req.user;
        if (!u) return res.status(401).json({ error: 'Unauthorized' });

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
    } catch (error) {
        console.error('Me endpoint error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
