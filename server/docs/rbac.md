# RBAC Configuration & Architecture

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `RBAC_FALLBACK` | `true` | When `true`, users without RBAC roles fall back to legacy `User.role` mapping. Set to `false` after migration complete. |
| `JWT_GRACE_OLD` | `true` | When `true`, accept old JWT tokens (without `av` field). Set to `false` after all users re-login. |
| `ALLOW_PUBLIC_REGISTER` | *not set* | When `true`, `/api/auth/register` is publicly accessible. When not set, register returns 404. |
| `ADMIN_SEED_USERNAME` | `admin` | Username for seed-created admin account (only used if `ADMIN_SEED_PASSWORD` is set). |
| `ADMIN_SEED_PASSWORD` | *not set* | Password for seed-created admin. If not set, no admin user is seeded. **Never commit this.** |
| `ADMIN_SEED_NAME` | `Administrator` | Display name for seed-created admin. |
| `USER_META_TTL_MS` | `60000` | TTL for user metadata cache (ms). |
| `PERMS_TTL_MS` | `300000` | TTL for permission cache (ms). |

## Roles

| Code | Name | Description |
|---|---|---|
| `ADMIN` | Администратор | Full access (bypass all permission checks) |
| `OPERATOR` | Оператор | Orders, assembly, summary, journals, import |
| `PRODUCTION` | Производство | Production runs, MML, closures |
| `EXPEDITOR` | Экспедитор | Orders (read), expedition, returns |
| `BUYER` | Закупщик | Purchases, purchase prices, sales prices (read) |
| `ACCOUNTANT` | Бухгалтер | Orders/purchases (read), sales prices, reports |

## Permission Matrix

| Permission | OPERATOR | PRODUCTION | BUYER | EXPEDITOR | ACCOUNTANT |
|---|---|---|---|---|---|
| `orders.read` | ✓ | | | ✓ | ✓ |
| `orders.create` | ✓ | | | | |
| `orders.edit` | ✓ | | | | |
| `orders.delete` | | | | | |
| `orders.assign_expeditor` | ✓ | | | ✓ | |
| `orders.change_status` | ✓ | | | | |
| `summary.read` | ✓ | | | | |
| `summary.create` | ✓ | | | | |
| `summary.sync` | ✓ | | | | |
| `assembly.read` | ✓ | | | | |
| `assembly.manage` | ✓ | | | | |
| `expedition.read` | | | | ✓ | |
| `expedition.manage` | | | | ✓ | |
| `journals.read` | ✓ | | | | |
| `journals.manage` | ✓ | | | | |
| `returns.read` | ✓ | | | ✓ | ✓ |
| `returns.create` | ✓ | | | ✓ | |
| `prices.purchase.read` | | | ✓ | | |
| `prices.purchase.manage` | | | ✓ | | |
| `prices.sales.read` | ✓ | | ✓ | | ✓ |
| `prices.sales.manage` | | | | | ✓ |
| `purchases.read` | | ✓ | ✓ | | ✓ |
| `purchases.create` | | | ✓ | | |
| `purchases.manage` | | | ✓ | | |
| `import.execute` | ✓ | | | | |
| `production.read` | | ✓ | | | |
| `production.create` | | ✓ | | | |
| `production.edit` | | ✓ | | | |
| `production.post` | | ✓ | | | |
| `production.void` | | ✓ | | | |
| `production.adjust` | | ✓ | | | |
| `production.closures` | | ✓ | | | |
| `production.delete` | | ✓ | | | |
| `production.hide` | | ✓ | | | |
| `mml.read` | | ✓ | | | |
| `mml.manage` | | ✓ | | | |
| `mml.lock` | | ✓ | | | |
| `catalog.products` | ✓ | ✓ | ✓ | | |
| `catalog.customers` | ✓ | | | | |
| `catalog.suppliers` | | | ✓ | | |
| `warehouses.read` | | | | | |
| `warehouses.manage` | | | | | |
| `reports.read` | ✓ | ✓ | | | ✓ |
| `reports.manage` | | | | | |
| `admin.users` | | | | | |
| `admin.roles` | | | | | |
| `admin.audit` | *reserved P2* | | | | |

> **Note:** ADMIN implicitly has ALL permissions (bypass). Only non-ADMIN roles listed above.

## Deployment

### First deploy (or new environment)

```bash
cd server
npm install                        # triggers postinstall → prisma generate
npm run migrate                    # prisma migrate deploy
npm run seed                       # seed roles, permissions, admin user
npm run start                      # node dist/index.js
```

### Railway

- **Build**: `npm run build`
- **Deploy hook**: `npm run migrate`
- **Start**: `npm run start`

### Rollback plan

1. Set `RBAC_FALLBACK=true` in env (immediate effect, no restart needed for new requests)
2. If critical: revert to previous Docker image/commit
3. RBAC tables remain in DB (safe — old code doesn't reference them)
4. `User.isActive` and `User.authVersion` have safe defaults (`true` / `1`)
