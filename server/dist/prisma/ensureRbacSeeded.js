"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureRbacSeededRuntime = ensureRbacSeededRuntime;
const rbac_constants_1 = require("./rbac.constants");
/**
 * Runtime ensure: safe to call on every server start.
 * - Upserts permissions (adds new ones, updates module)
 * - Upserts system roles (adds missing)
 * - Links ADMIN -> ALL permissions (never misses new perms)
 * - Does NOT touch other role-permission mappings (UI customization persists)
 *
 * @param prisma - shared PrismaClient instance (from db.ts)
 */
async function ensureRbacSeededRuntime(prisma) {
    // 1) Upsert all permissions
    const perms = Object.values(rbac_constants_1.PERM).map(code => ({
        code,
        module: code.split('.')[0] ?? 'misc',
    }));
    for (const p of perms) {
        await prisma.permission.upsert({
            where: { code: p.code },
            create: { code: p.code, module: p.module },
            update: { module: p.module },
        });
    }
    // 2) Upsert system roles
    for (const r of rbac_constants_1.SYSTEM_ROLES) {
        await prisma.role.upsert({
            where: { code: r.code },
            create: { code: r.code, name: r.name, isSystem: r.isSystem },
            update: { name: r.name },
        });
    }
    // 3) Link ADMIN -> ALL permissions (auto-expand on new perms)
    const admin = await prisma.role.findUnique({
        where: { code: rbac_constants_1.ROLE_CODES.ADMIN },
        select: { id: true },
    });
    if (!admin)
        return;
    const allPermIds = await prisma.permission.findMany({ select: { id: true } });
    await prisma.rolePermission.createMany({
        data: allPermIds.map(p => ({ roleId: admin.id, permissionId: p.id })),
        skipDuplicates: true,
    });
}
