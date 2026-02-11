"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const router = (0, express_1.Router)();
// Public: register only if explicitly allowed
if (process.env.ALLOW_PUBLIC_REGISTER === 'true') {
    router.post('/register', auth_controller_1.register);
}
else {
    // Explicit 404 so the endpoint doesn't leak through other middleware as 401
    router.post('/register', (_req, res) => {
        res.status(404).json({ error: 'Registration is disabled' });
    });
}
// Public: login (rate-limited: 10 attempts per 15 min per IP)
router.post('/login', rateLimit_middleware_1.loginLimiter, auth_controller_1.login);
// Authenticated: get current user info + roles/permissions
router.get('/me', auth_middleware_1.authenticateToken, auth_middleware_1.loadUserContext, auth_controller_1.me);
exports.default = router;
