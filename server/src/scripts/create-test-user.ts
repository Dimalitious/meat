/**
 * Create a test user for RBAC verification.
 * Usage: npx ts-node --transpile-only src/scripts/create-test-user.ts
 * 
 * Creates an EXPEDITOR user "exp1" with password "exp1" for testing
 * restricted role access (403 on purchases, prices.purchase, etc.)
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ROLE_CODES, PERM, DEFAULT_ROLE_PERMS_SEED } from '../prisma/rbac.constants';

const prisma = new PrismaClient();

async function main() {
    const username = 'exp1';
    const password = 'exp1';
    const name = 'Expeditor 1 (test)';
    const roleCode = ROLE_CODES.EXPEDITOR;

    console.log(`Creating test user: ${username} / role: ${roleCode}`);

    // 1) Upsert user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.upsert({
        where: { username },
        create: {
            username,
            password: hashedPassword,
            name,
            role: roleCode,
            isActive: true,
            authVersion: 1,
        },
        update: {
            password: hashedPassword,
            role: roleCode,
            isActive: true,
        },
        select: { id: true },
    });
    console.log(`  ✓ User: id=${user.id}`);

    // 2) Ensure role exists
    const role = await prisma.role.findUnique({
        where: { code: roleCode },
        select: { id: true },
    });
    if (!role) {
        console.error(`  ✗ Role "${roleCode}" not found. Run seed first.`);
        return;
    }

    // 3) Assign role
    await prisma.userRole
        .create({ data: { userId: user.id, roleId: role.id } })
        .catch(() => void 0); // ignore duplicate
    console.log(`  ✓ Role assigned: ${roleCode}`);

    // 4) Print expected permissions
    const perms = DEFAULT_ROLE_PERMS_SEED[roleCode] ?? [];
    console.log(`  ✓ Expected permissions (${perms.length}):`);
    perms.forEach(p => console.log(`    - ${p}`));

    console.log('\n📋 Login credentials:');
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
