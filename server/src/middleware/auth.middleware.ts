import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import {
    DEFAULT_ROLE_PERMS_FALLBACK,
    ROLE_CODES,
    mapLegacyRoleToRoleCode,
} from '../prisma/rbac.constants';

// ============================================
// Types
// ============================================

type JwtPayload = {
    userId: number;
    username: string;
    av?: number;       // New tokens: authVersion
    role?: string;     // Legacy tokens (pre-RBAC)
};

export type AuthedUser = {
    userId: number;
    username: string;
    av?: number;
    /** DEPRECATED (compat): legacy token role, if present */
    role?: string;
    roles: string[];
    permissions: string[];
    _rbac?: {
        loaded?: boolean;
        loading?: boolean;
        fallbackUsed: boolean;
        fallbackReason?: 'NO_USERROLES' | 'DB_ERROR';
        tokenNeedsRefresh?: boolean;
    };
};

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            user?: AuthedUser;
        }
    }
}

// ============================================
// Simple TTL caches
// ============================================

type CacheEntry<T> = { value: T; expiresAt: number };
const nowMs = () => Date.now();

function cacheGet<T>(m: Map<string, CacheEntry<T>>, key: string): T | null {
    const hit = m.get(key);
    if (!hit) return null;
    if (hit.expiresAt <= nowMs()) {
        m.delete(key);
        return null;
    }
    return hit.value;
}

function cacheSet<T>(m: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
    m.set(key, { value, expiresAt: nowMs() + ttlMs });
}

function cacheDel(m: Map<string, unknown>, key: string) {
    m.delete(key);
}

// ============================================
// RBAC Health Snapshot (for /api/health/rbac)
// ============================================

type RbacHealth = {
    fallbackCount: number;
    lastFallbackUserId: number | null;
    lastFallbackReason: 'NO_USERROLES' | 'DB_ERROR' | null;
    lastFallbackAt: string | null;
    fallbackEnabled: boolean;
};

const rbacHealth: RbacHealth = {
    fallbackCount: 0,
    lastFallbackUserId: null,
    lastFallbackReason: null,
    lastFallbackAt: null,
    fallbackEnabled: process.env.RBAC_FALLBACK === 'true',
};

export function getRbacHealthSnapshot() {
    rbacHealth.fallbackEnabled = process.env.RBAC_FALLBACK === 'true';
    return { ...rbacHealth };
}

function recordRbacFallbackEvent(userId: number, reason: 'NO_USERROLES' | 'DB_ERROR') {
    rbacHealth.fallbackCount += 1;
    rbacHealth.lastFallbackUserId = userId;
    rbacHealth.lastFallbackReason = reason;
    rbacHealth.lastFallbackAt = new Date().toISOString();
}

// ============================================
// Caches
// ============================================

const USER_META_TTL_MS = Number(process.env.USER_META_TTL_MS ?? 15_000);   // 15s
const PERMS_TTL_MS = Number(process.env.PERMS_TTL_MS ?? 120_000);          // 120s

type UserMeta = { isActive: boolean; authVersion: number; legacyRole: string | null };

// isFallback stored so cache-hits preserve observability flags
type UserCtx = {
    roles: string[];
    permissions: string[];
    isFallback: boolean;
    fallbackReason?: 'NO_USERROLES' | 'DB_ERROR';
};

const userMetaCache = new Map<string, CacheEntry<UserMeta>>();
const userCtxCache = new Map<string, CacheEntry<UserCtx>>();

/** Call when admin changes user roles/isActive/password etc. */
export function invalidateUserAccessCache(userId: number) {
    const key = String(userId);
    cacheDel(userMetaCache as any, key);
    cacheDel(userCtxCache as any, key);
}

// ============================================
// Convenience: composite middleware
// ============================================

/** Always add both auth + rbac context to a router */
export function rbacAuth(): [typeof authenticateToken, typeof loadUserContext] {
    return [authenticateToken, loadUserContext];
}

// ============================================
// Middleware: authenticateToken
// ============================================

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, process.env.JWT_SECRET as string, (err, decoded) => {
        if (err || !decoded) return res.status(403).json({ error: 'Invalid or expired token' });

        const u = decoded as JwtPayload;
        if (!u.userId || !u.username) return res.status(403).json({ error: 'Invalid token payload' });

        req.user = {
            userId: u.userId,
            username: u.username,
            av: u.av,
            role: u.role, // legacy compat
            roles: [],
            permissions: [],
            _rbac: { fallbackUsed: false, loaded: false, loading: false },
        };

        return next();
    });
}

// ============================================
// Core logic: loadUserContextInternal
// ============================================

/**
 * Core logic: loads and attaches userMeta + roles + permissions.
 *
 * Returns:
 * - true  -> context loaded, caller can continue
 * - false -> response already sent (401/403/503), caller must stop
 */
async function loadUserContextInternal(req: Request, res: Response): Promise<boolean> {
    if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return false;
    }

    // Already loaded on this request
    if (req.user._rbac?.loaded) return true;

    // Guard against accidental re-entry
    if (req.user._rbac?.loading) {
        res.status(500).json({ error: 'RBAC context loading re-entry detected' });
        return false;
    }

    req.user._rbac = req.user._rbac ?? { fallbackUsed: false };
    req.user._rbac.loading = true;

    const userId = req.user.userId;
    const cacheKey = String(userId);

    try {
        // 1) userMeta
        let meta = cacheGet(userMetaCache, cacheKey);
        if (!meta) {
            let dbUser: { isActive: boolean; authVersion: number; role: string | null } | null = null;
            try {
                dbUser = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { isActive: true, authVersion: true, role: true },
                });
            } catch (err) {
                console.error('USER_META_LOAD_FAILED', { userId, error: (err as Error)?.message ?? err });
                res.status(503).json({ error: 'Auth service unavailable' });
                return false;
            }

            if (!dbUser) {
                res.status(401).json({ error: 'User not found' });
                return false;
            }

            meta = {
                isActive: dbUser.isActive ?? true,
                authVersion: dbUser.authVersion ?? 1,
                legacyRole: dbUser.role ?? null,
            };
            cacheSet(userMetaCache, cacheKey, meta, USER_META_TTL_MS);
        }

        // 2) isActive check
        if (!meta.isActive) {
            res.status(401).json({ error: 'User disabled' });
            return false;
        }

        // 3) authVersion check
        const tokenAv = req.user.av;
        const allowOldTokens = process.env.JWT_GRACE_OLD === 'true';

        if (tokenAv === undefined) {
            if (!allowOldTokens) {
                res.setHeader('X-Token-Refresh', 'true');
                res.status(401).json({ error: 'Token upgrade required, please re-login' });
                return false;
            }
            req.user._rbac!.tokenNeedsRefresh = true;
            res.setHeader('X-Token-Refresh', 'true');
        } else if (tokenAv !== meta.authVersion) {
            res.status(401).json({ error: 'Token outdated, re-login required' });
            return false;
        }

        // 4) roles + permissions
        let ctx = cacheGet(userCtxCache, cacheKey);

        if (!ctx) {
            try {
                const roles = await prisma.userRole.findMany({
                    where: { userId },
                    select: {
                        role: {
                            select: {
                                code: true,
                                rolePermissions: {
                                    select: { permission: { select: { code: true } } },
                                },
                            },
                        },
                    },
                });

                if (roles.length > 0) {
                    // Normal RBAC path
                    const roleCodes = roles.map(r => r.role.code);
                    const permSet = new Set<string>();
                    for (const r of roles) {
                        for (const rp of r.role.rolePermissions) permSet.add(rp.permission.code);
                    }

                    ctx = { roles: roleCodes, permissions: [...permSet], isFallback: false };
                    cacheSet(userCtxCache, cacheKey, ctx, PERMS_TTL_MS);
                } else {
                    // No RBAC roles assigned
                    const fallbackEnabled = process.env.RBAC_FALLBACK === 'true';
                    if (!fallbackEnabled) {
                        ctx = { roles: [], permissions: [], isFallback: false };
                        cacheSet(userCtxCache, cacheKey, ctx, PERMS_TTL_MS);
                    } else {
                        const mappedRole = mapLegacyRoleToRoleCode(meta.legacyRole);
                        const fallbackPerms = DEFAULT_ROLE_PERMS_FALLBACK[mappedRole] ?? [];
                        ctx = {
                            roles: [mappedRole],
                            permissions: fallbackPerms,
                            isFallback: true,
                            fallbackReason: 'NO_USERROLES',
                        };
                        cacheSet(userCtxCache, cacheKey, ctx, PERMS_TTL_MS);
                        recordRbacFallbackEvent(userId, 'NO_USERROLES');
                        console.warn('RBAC_FALLBACK_NO_USERROLES', { userId, mappedRole });
                    }
                }
            } catch (err) {
                console.error('RBAC_JOIN_LOAD_FAILED', { userId, error: (err as Error)?.message ?? err });

                const fallbackEnabled = process.env.RBAC_FALLBACK === 'true';
                if (!fallbackEnabled) {
                    recordRbacFallbackEvent(userId, 'DB_ERROR');
                    res.status(503).json({ error: 'RBAC unavailable' });
                    return false;
                }

                // Fallback on DB error
                const mappedRole = mapLegacyRoleToRoleCode(meta.legacyRole);
                const fallbackPerms = DEFAULT_ROLE_PERMS_FALLBACK[mappedRole] ?? [];
                ctx = {
                    roles: [mappedRole],
                    permissions: fallbackPerms,
                    isFallback: true,
                    fallbackReason: 'DB_ERROR',
                };
                cacheSet(userCtxCache, cacheKey, ctx, PERMS_TTL_MS);
                recordRbacFallbackEvent(userId, 'DB_ERROR');
                console.error('SECURITY_MODE=FALLBACK', { userId, reason: 'DB_ERROR', mappedRole });
            }
        }

        // Apply ctx to request
        req.user.roles = ctx.roles;
        req.user.permissions = ctx.permissions;

        // Set observability flags (even on cache hits)
        if (ctx.isFallback) {
            req.user._rbac!.fallbackUsed = true;
            req.user._rbac!.fallbackReason = ctx.fallbackReason;
        } else {
            req.user._rbac!.fallbackUsed = false;
            delete req.user._rbac!.fallbackReason;
        }

        req.user._rbac!.loaded = true;
        return true;
    } finally {
        // Always clear loading flag
        if (req.user?._rbac) req.user._rbac.loading = false;
    }
}

// ============================================
// Express middleware wrapper
// ============================================

export async function loadUserContext(req: Request, res: Response, next: NextFunction) {
    const ok = await loadUserContextInternal(req, res);
    if (ok) next();
}

// ============================================
// Self-healing context loader (no hanging promises)
// ============================================

async function ensureContextLoaded(req: Request, res: Response): Promise<boolean> {
    if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return false;
    }
    if (req.user._rbac?.loaded) return true;
    return loadUserContextInternal(req, res);
}

// ============================================
// Permission guards
// ============================================

/** Require ANY of the listed permissions (OR logic). ADMIN bypasses. */
export const requirePermission = (...required: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const okLoaded = await ensureContextLoaded(req, res);
        if (!okLoaded) return;

        const u = req.user!;
        // ADMIN bypass (isActive/authVersion already checked above)
        if (u.roles.includes(ROLE_CODES.ADMIN)) return next();

        const perms = u.permissions ?? [];
        const ok = required.some(code => perms.includes(code));
        if (!ok) return res.status(403).json({ error: 'Недостаточно прав' });
        return next();
    };
};

/** Require ALL of the listed permissions (AND logic). ADMIN bypasses. */
export const requireAllPermissions = (...required: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const okLoaded = await ensureContextLoaded(req, res);
        if (!okLoaded) return;

        const u = req.user!;
        if (u.roles.includes(ROLE_CODES.ADMIN)) return next();

        const perms = u.permissions ?? [];
        const ok = required.every(code => perms.includes(code));
        if (!ok) return res.status(403).json({ error: 'Недостаточно прав' });
        return next();
    };
};

/**
 * DEPRECATED legacy role guard.
 * Keeps compatibility while you migrate route files.
 * Uses RBAC roles (not legacy User.role) via self-healing context.
 */
export const requireRole = (allowedRoles: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const okLoaded = await ensureContextLoaded(req, res);
        if (!okLoaded) return;

        const u = req.user!;
        const userRoles = (u.roles ?? []).map(r => r.toLowerCase());
        const ok = allowedRoles.some(ar => userRoles.includes(ar.toLowerCase()));
        if (!ok) return res.status(403).json({ error: 'Недостаточно прав' });
        return next();
    };
};
