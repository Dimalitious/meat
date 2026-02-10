import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import {
    getUsers,
    createUser,
    updateUser,
    resetPassword,
    getRoles,
} from '../controllers/admin.controller';

const router = Router();

// All admin routes: auth + admin.users permission
// (admin.roles exists in PERM but is unused — single permission gates the whole admin UI)
router.use(authenticateToken);
router.use(loadUserContext);

// Users CRUD
router.get('/users', requirePermission(PERM.ADMIN_USERS), getUsers);
router.post('/users', requirePermission(PERM.ADMIN_USERS), createUser);
router.put('/users/:id', requirePermission(PERM.ADMIN_USERS), updateUser);
router.post('/users/:id/reset-password', requirePermission(PERM.ADMIN_USERS), resetPassword);

// Roles listing (read-only, same permission as users — one admin screen)
router.get('/roles', requirePermission(PERM.ADMIN_USERS), getRoles);

export default router;
