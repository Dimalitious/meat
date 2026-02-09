import { Router } from 'express';
import { register, login, me } from '../controllers/auth.controller';
import { authenticateToken, loadUserContext } from '../middleware/auth.middleware';
import { loginLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// Public: register only if explicitly allowed
if (process.env.ALLOW_PUBLIC_REGISTER === 'true') {
    router.post('/register', register);
} else {
    // Explicit 404 so the endpoint doesn't leak through other middleware as 401
    router.post('/register', (_req, res) => {
        res.status(404).json({ error: 'Registration is disabled' });
    });
}

// Public: login (rate-limited: 10 attempts per 15 min per IP)
router.post('/login', loginLimiter, login);

// Authenticated: get current user info + roles/permissions
router.get('/me', authenticateToken, loadUserContext, me);

export default router;
