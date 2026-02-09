import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { ensureRbacSeededRuntime } from './ensureRbacSeeded';
import { ROLE_CODES, PERM, DEFAULT_ROLE_PERMS_SEED, mapLegacyRoleToRoleCode } from './rbac.constants';

/**
 * Manual/CI seed:
 * - Calls runtime ensure (permissions + roles + ADMIN all perms)
 * - Applies default mappings for system roles ONLY if role has no permissions yet
 * - Migrates legacy User.role -> UserRole if user has no roles yet
 * - Creates admin user ONLY if ADMIN_SEED_PASSWORD env is set
 */
async function main() {
    console.log('Running RBAC seed...');

    // 1) Runtime ensure (permissions + roles + ADMIN linkage)
    await ensureRbacSeededRuntime(prisma);
    console.log('  ✓ Permissions and roles upserted');

    // 2) Sync default role→permission matrix for non-ADMIN roles
    //    Uses createMany+skipDuplicates to add missing permissions without removing existing ones
    for (const [roleCode, permCodes] of Object.entries(DEFAULT_ROLE_PERMS_SEED)) {
        const role = await prisma.role.findUnique({ where: { code: roleCode }, select: { id: true } });
        if (!role) continue;

        const perms = await prisma.permission.findMany({
            where: { code: { in: permCodes } },
            select: { id: true },
        });

        const result = await prisma.rolePermission.createMany({
            data: perms.map(p => ({ roleId: role.id, permissionId: p.id })),
            skipDuplicates: true,
        });

        if (result.count > 0) {
            console.log(`  ✓ Role ${roleCode}: added ${result.count} new permissions (total: ${perms.length})`);
        } else {
            console.log(`  · Role ${roleCode}: ${perms.length} permissions up to date`);
        }
    }

    // 3) Create admin user if ADMIN_SEED_PASSWORD is set
    const adminSeedPassword = process.env.ADMIN_SEED_PASSWORD;
    if (adminSeedPassword) {
        const adminUsername = process.env.ADMIN_SEED_USERNAME || 'admin';
        const adminName = process.env.ADMIN_SEED_NAME || 'Administrator';

        const adminUser = await prisma.user.upsert({
            where: { username: adminUsername },
            create: {
                username: adminUsername,
                password: await bcrypt.hash(adminSeedPassword, 10),
                name: adminName,
                role: 'ADMIN',
                isActive: true,
                authVersion: 1,
            },
            update: {},
            select: { id: true },
        });

        const adminRole = await prisma.role.findUnique({
            where: { code: ROLE_CODES.ADMIN },
            select: { id: true },
        });
        if (adminRole) {
            await prisma.userRole
                .create({ data: { userId: adminUser.id, roleId: adminRole.id } })
                .catch(() => void 0); // ignore duplicate
        }
        console.log(`  ✓ Admin user "${adminUsername}" ensured`);
    } else {
        console.log('  · ADMIN_SEED_PASSWORD not set, skipping admin user creation');
    }

    // 4) Migrate legacy users: if user has no RBAC roles yet, assign based on legacy User.role
    const adminRole = await prisma.role.findUnique({
        where: { code: ROLE_CODES.ADMIN },
        select: { id: true },
    });
    const allRoles = await prisma.role.findMany({ select: { id: true, code: true } });
    const roleMap = new Map(allRoles.map(r => [r.code, r.id]));

    const users = await prisma.user.findMany({ select: { id: true, role: true, username: true } });
    let migrated = 0;

    for (const u of users) {
        const hasRoles = await prisma.userRole.count({ where: { userId: u.id } });
        if (hasRoles > 0) continue;

        const mappedRoleCode = mapLegacyRoleToRoleCode(u.role);
        const roleId = roleMap.get(mappedRoleCode);
        if (!roleId) continue;

        await prisma.userRole
            .create({ data: { userId: u.id, roleId } })
            .catch(() => void 0); // ignore duplicate
        migrated++;
        console.log(`  ✓ User "${u.username}" (legacy: ${u.role}) → ${mappedRoleCode}`);
    }
    if (migrated > 0) {
        console.log(`  ✓ Migrated ${migrated} legacy users to RBAC roles`);
    } else {
        console.log('  · No legacy users to migrate');
    }

    console.log('Seed completed.');
}

main()
    .catch(e => {
        console.error('Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => prisma.$disconnect());
