import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { invalidateUserAccessCache } from '../middleware/auth.middleware';
import { ROLE_CODES } from '../prisma/rbac.constants';

// Map RBAC role codes to legacy role field (highest priority wins)
const LEGACY_ROLE_PRIORITY: Record<string, number> = {
    [ROLE_CODES.ADMIN]: 0,
    [ROLE_CODES.PRODUCTION]: 1,
    [ROLE_CODES.BUYER]: 2,
    [ROLE_CODES.ACCOUNTANT]: 3,
    [ROLE_CODES.EXPEDITOR]: 4,
    [ROLE_CODES.OPERATOR]: 5,
    [ROLE_CODES.SALES_MANAGER]: 6,
};

function inferLegacyRole(roleCodes: string[]): string | null {
    const mapped: string[] = [];
    const unmapped: string[] = [];
    for (const c of roleCodes) {
        (c in LEGACY_ROLE_PRIORITY ? mapped : unmapped).push(c);
    }
    if (unmapped.length > 0) {
        console.warn(`[Admin] inferLegacyRole: unmapped role codes ignored: ${unmapped.join(', ')}`);
    }
    // All codes unmapped → caller must decide (block or fallback)
    if (mapped.length === 0) return null;
    mapped.sort((a, b) => LEGACY_ROLE_PRIORITY[a] - LEGACY_ROLE_PRIORITY[b]);
    return mapped[0];
}

/** Shared password policy for createUser and resetPassword. */
function validatePassword(password: unknown, username?: string): string | null {
    if (typeof password !== 'string' || password.length < 8) {
        return 'Пароль должен быть не менее 8 символов';
    }
    if (password !== password.trim()) {
        return 'Пароль не должен начинаться/заканчиваться пробелами';
    }
    if (username && username.length >= 4 && password.toLowerCase().includes(username.toLowerCase())) {
        return 'Пароль не должен содержать логин';
    }
    return null; // valid
}

/** Coerce + validate roleIds: ensure all are positive integers.
 *  Rejects scientific notation ("1e2"), floats, and non-numeric strings. */
function parseRoleIds(raw: unknown): number[] | null {
    if (!Array.isArray(raw)) return null;
    const ids: number[] = [];
    for (const v of raw) {
        // Accept number or numeric string like "1", "42"; reject "1e2", "3.5", "abc"
        if (typeof v === 'number' && Number.isInteger(v) && v > 0) {
            ids.push(v);
        } else if (typeof v === 'string' && /^\d+$/.test(v) && Number(v) > 0) {
            ids.push(Number(v));
        } else {
            return null;
        }
    }
    return [...new Set(ids)];
}

// ============================================
// GET /api/admin/users — list all users with roles
// ============================================
export const getUsers = async (_req: Request, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                name: true,
                isActive: true,
                createdAt: true,
                userRoles: {
                    select: {
                        role: {
                            select: { id: true, code: true, name: true }
                        }
                    }
                }
            },
            orderBy: { id: 'asc' },
        });

        const result = users.map(u => ({
            id: u.id,
            username: u.username,
            name: u.name,
            isActive: u.isActive,
            createdAt: u.createdAt,
            roles: u.userRoles.map(ur => ur.role),
        }));

        res.json(result);
    } catch (error) {
        console.error('Admin getUsers error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
};

// ============================================
// GET /api/admin/roles — list all roles
// ============================================
export const getRoles = async (_req: Request, res: Response) => {
    try {
        const roles = await prisma.role.findMany({
            orderBy: { id: 'asc' },
            select: {
                id: true,
                code: true,
                name: true,
                isSystem: true,
                _count: { select: { userRoles: true } },
            },
        });

        res.json(roles.map(r => ({
            ...r,
            userCount: r._count.userRoles,
        })));
    } catch (error) {
        console.error('Admin getRoles error:', error);
        res.status(500).json({ error: 'Failed to get roles' });
    }
};

// ============================================
// POST /api/admin/users — create user
// ============================================
export const createUser = async (req: Request, res: Response) => {
    try {
        const { password, name, roleIds } = req.body;
        const username = typeof req.body.username === 'string'
            ? req.body.username.trim().toLowerCase()
            : '';

        const trimmedName = typeof name === 'string' ? name.trim() : '';
        if (!username || !trimmedName) {
            return res.status(400).json({ error: 'username и name обязательны' });
        }

        // Username format: 3+ chars, only lowercase alphanumeric, dot, dash, underscore
        if (username.length < 3 || !/^[a-z0-9._-]+$/.test(username)) {
            return res.status(400).json({
                error: 'Логин: минимум 3 символа, только латинские буквы, цифры, точка, дефис, подчёркивание',
            });
        }

        // Password policy (shared with resetPassword)
        const pwError = validatePassword(password, username);
        if (pwError) {
            return res.status(400).json({ error: pwError });
        }

        // Parse, coerce, and deduplicate roleIds
        const uniqueRoleIds = parseRoleIds(roleIds);
        if (!uniqueRoleIds || uniqueRoleIds.length === 0) {
            return res.status(400).json({ error: 'Необходимо назначить хотя бы одну роль (массив целых чисел)' });
        }

        // Validate roleIds exist in DB
        const validRoles = await prisma.role.findMany({
            where: { id: { in: uniqueRoleIds } },
            select: { id: true, code: true },
        });
        if (validRoles.length !== uniqueRoleIds.length) {
            return res.status(400).json({ error: 'Некоторые из указанных ролей не существуют' });
        }

        // Check unique username (case-insensitive)
        const existing = await prisma.user.findFirst({
            where: { username: { equals: username, mode: 'insensitive' } },
        });
        if (existing) {
            return res.status(409).json({ error: 'Пользователь с таким логином уже существует' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Determine legacy role from assigned RBAC roles
        const legacyRole = inferLegacyRole(validRoles.map(r => r.code));
        if (legacyRole === null) {
            return res.status(400).json({ error: 'Назначенные роли не поддерживаются legacy-слоем' });
        }

        const user = await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    username,
                    password: hashedPassword,
                    name: trimmedName,
                    role: legacyRole,
                    isActive: true,
                    authVersion: 1,
                },
            });

            await tx.userRole.createMany({
                data: uniqueRoleIds.map((roleId) => ({
                    userId: newUser.id,
                    roleId,
                })),
                skipDuplicates: true,
            });

            return newUser;
        });

        res.status(201).json({ id: user.id, username: user.username });
    } catch (error: any) {
        // P2002 = unique constraint violation (username race condition)
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Пользователь с таким логином уже существует' });
        }
        console.error('Admin createUser error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
};

// ============================================
// PUT /api/admin/users/:id — update user
// ============================================
export const updateUser = async (req: Request, res: Response) => {
    try {
        const userId = Number(req.params.id);
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({ error: 'Некорректный ID пользователя' });
        }

        const { name, isActive, roleIds } = req.body;
        const currentUserId = (req as any).user?.userId;

        // Check user exists
        const target = await prisma.user.findUnique({
            where: { id: userId },
            include: { userRoles: { select: { role: { select: { id: true, code: true } } } } },
        });
        if (!target) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        // Parse, coerce, and deduplicate roleIds (null = not changing roles)
        // If roleIds is present in body but not an array → reject explicitly
        const roleIdsPresent = 'roleIds' in req.body;
        if (roleIdsPresent && !Array.isArray(roleIds)) {
            return res.status(400).json({ error: 'roleIds должен быть массивом' });
        }
        const uniqueRoleIds = roleIdsPresent ? parseRoleIds(roleIds) : null;
        if (roleIdsPresent && uniqueRoleIds === null) {
            return res.status(400).json({ error: 'roleIds должен быть массивом целых положительных чисел' });
        }
        // Policy: every user must have at least 1 role
        if (uniqueRoleIds !== null && uniqueRoleIds.length === 0) {
            return res.status(400).json({ error: 'Необходимо назначить хотя бы одну роль' });
        }
        // Compare roles to detect actual change (before fetching role details)
        const currentRoleIds = new Set(target.userRoles.map(ur => ur.role.id));
        const rolesActuallyChanged = uniqueRoleIds !== null
            && (uniqueRoleIds.length !== currentRoleIds.size
                || uniqueRoleIds.some(id => !currentRoleIds.has(id)));

        // Validate & fetch role codes only if roles are actually changing
        let newRoleCodes: string[] | null = null;
        if (rolesActuallyChanged && uniqueRoleIds !== null) {
            const validRoles = await prisma.role.findMany({
                where: { id: { in: uniqueRoleIds } },
                select: { id: true, code: true },
            });
            if (validRoles.length !== uniqueRoleIds.length) {
                return res.status(400).json({ error: 'Некоторые из указанных ролей не существуют' });
            }
            newRoleCodes = validRoles.map(r => r.code);
            // Block if all assigned roles are unmapped in legacy layer
            const legacyRole = inferLegacyRole(newRoleCodes);
            if (legacyRole === null) {
                return res.status(400).json({ error: 'Назначенные роли не поддерживаются legacy-слоем' });
            }
        }

        // Prevent disabling yourself
        if (currentUserId === userId && isActive === false) {
            return res.status(400).json({ error: 'Нельзя отключить самого себя' });
        }

        // --- Last-admin guard (best-effort, not fully atomic) ---
        // NOTE: Two concurrent requests could both pass this check.
        // Acceptable for internal ERP with few admins; for strict atomicity
        // would need SELECT ... FOR UPDATE inside the transaction.
        // Only applies if target is currently an active admin
        const targetIsActiveAdmin = target.isActive
            && target.userRoles.some(ur => ur.role.code === ROLE_CODES.ADMIN);

        if (targetIsActiveAdmin) {
            const adminRole = await prisma.role.findFirst({ where: { code: ROLE_CODES.ADMIN } });
            if (!adminRole) {
                // Fail closed: broken RBAC seed → block destructive operations
                return res.status(503).json({ error: 'RBAC misconfigured: роль ADMIN не найдена в БД' });
            }

            const removingAdminRole = uniqueRoleIds !== null && !uniqueRoleIds.includes(adminRole.id);
            const disablingUser = isActive === false;

            if (removingAdminRole || disablingUser) {
                const otherActiveAdmins = await prisma.userRole.count({
                    where: {
                        roleId: adminRole.id,
                        user: { isActive: true, id: { not: userId } },
                    },
                });
                if (otherActiveAdmins === 0) {
                    return res.status(400).json({
                        error: 'Нельзя удалить роль ADMIN / отключить последнего администратора',
                    });
                }
            }
        }

        const willChangeIsActive = isActive !== undefined && isActive !== target.isActive;
        const needAuthBump = willChangeIsActive || rolesActuallyChanged;

        // Validate name before transaction (keep txn for DB-only ops)
        let trimmedName: string | undefined;
        if (name !== undefined) {
            trimmedName = typeof name === 'string' ? name.trim() : '';
            if (!trimmedName) {
                return res.status(400).json({ error: 'Имя не может быть пустым' });
            }
        }

        await prisma.$transaction(async (tx) => {
            const updateData: any = {};
            if (trimmedName !== undefined) updateData.name = trimmedName;
            if (isActive !== undefined) updateData.isActive = isActive;

            // Sync roles only if actually changed
            if (rolesActuallyChanged && uniqueRoleIds !== null && newRoleCodes !== null) {
                await tx.userRole.deleteMany({ where: { userId } });
                await tx.userRole.createMany({
                    data: uniqueRoleIds.map((roleId) => ({
                        userId,
                        roleId,
                    })),
                    skipDuplicates: true,
                });
                // Keep legacy User.role in sync — defensive assert
                const legacy = inferLegacyRole(newRoleCodes);
                if (!legacy) {
                    console.error('[BUG] inferLegacyRole returned null inside txn — should have been blocked by validation');
                    throw new Error('Internal consistency error');
                }
                updateData.role = legacy;
            }

            if (needAuthBump) {
                updateData.authVersion = { increment: 1 };
            }

            if (Object.keys(updateData).length > 0) {
                await tx.user.update({
                    where: { id: userId },
                    data: updateData,
                });
            }
        });

        // Invalidate cache so next request picks up new roles/isActive
        invalidateUserAccessCache(userId);

        res.json({ ok: true });
    } catch (error: any) {
        // Prisma P2025 = record not found (race condition)
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        console.error('Admin updateUser error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

// ============================================
// POST /api/admin/users/:id/reset-password
// ============================================
export const resetPassword = async (req: Request, res: Response) => {
    try {
        const userId = Number(req.params.id);
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({ error: 'Некорректный ID пользователя' });
        }

        const { password } = req.body;

        // Check user exists (need username for password policy)
        const target = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true },
        });
        if (!target) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        // Shared password policy
        const pwError = validatePassword(password, target.username);
        if (pwError) {
            return res.status(400).json({ error: pwError });
        }

        const hashedPassword = await bcrypt.hash(password as string, 10);

        await prisma.user.update({
            where: { id: userId },
            data: {
                password: hashedPassword,
                authVersion: { increment: 1 }, // force re-login
            },
        });

        invalidateUserAccessCache(userId);

        res.json({ ok: true });
    } catch (error) {
        console.error('Admin resetPassword error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
};
