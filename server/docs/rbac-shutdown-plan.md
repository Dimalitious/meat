# RBAC Legacy Flags — Shutdown Plan

Two environment flags provide backward-compatibility during the RBAC migration.
Both should be disabled once the migration is fully verified.

---

## 1. `JWT_GRACE_OLD=false`

**What it does:** Allows JWT tokens minted *before* the `authVersion` field was added to continue working. Without this flag, old tokens would be rejected.

**When safe to disable:**
- All users have logged in at least once since the RBAC deploy (getting new tokens with `authVersion`).
- At least **24 hours** have passed since deploy (JWT expiry = 24h).

**How to verify:**
1. Check `/api/auth/me` responses — if `_rbac.tokenNeedsRefresh` is `true` for any user, they still have an old token.
2. If `/api/health/rbac` shows `fallbackCount === 0` and no warnings in logs referencing `JWT_GRACE_OLD`, it's safe.

**Action:** Set `JWT_GRACE_OLD=false` in `.env` and restart the server.

---

## 2. `RBAC_FALLBACK=false`

**What it does:** When a user has **no `UserRole` records** (e.g., missed migration), the system falls back to legacy `User.role` string to compute permissions. This avoids locking out users during the transition.

**When safe to disable:**
- All users have `UserRole` records (check: `SELECT u.id, u.username FROM "User" u WHERE NOT EXISTS (SELECT 1 FROM "UserRole" ur WHERE ur."userId" = u.id)`).
- `/api/health/rbac` → `fallbackCount === 0` over at least 24 hours.
- The seed has been run (`npm run seed:dev`) to migrate legacy roles.

**How to verify:**
1. Run the SQL query above — should return 0 rows.
2. Monitor `/api/health/rbac` for a day — `fallbackCount` must stay at 0.

**Action:** Set `RBAC_FALLBACK=false` in `.env` and restart the server.

---

## Recommended Rollout

1. **Week 1:** Keep both `true`. Monitor `/api/health/rbac` daily.
2. **Week 2:** Set `JWT_GRACE_OLD=false`. Verify no 401 spikes.
3. **Week 3:** Set `RBAC_FALLBACK=false`. Verify no 403 spikes.
4. **Week 4:** Remove both env vars and the related code branches (cleanup PR).

---

## Rollback

If disabling either flag causes issues:
1. Set the flag back to `true` in `.env`
2. Restart the server
3. Access is restored immediately (no DB migration needed)
