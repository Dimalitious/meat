import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthRequest extends Request {
    user?: any;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('[AUTH] Path:', req.path);
    console.log('[AUTH] Token present:', !!token);
    console.log('[AUTH] JWT_SECRET set:', !!process.env.JWT_SECRET);

    if (!token) {
        console.log('[AUTH] No token provided');
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET as string, (err, user) => {
        if (err) {
            console.log('[AUTH] Token verification failed:', err.message);
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        console.log('[AUTH] Token valid, user:', user);
        req.user = user;
        next();
    });
};
