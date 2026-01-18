import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const hash = await bcrypt.hash('1234', 10);
    await prisma.user.create({
        data: {
            username: 'inventyce',
            name: 'Admin',
            password: hash,
            role: 'admin'
        }
    });
    console.log('User created: inventyce / 1234');
}

main().catch(console.error).finally(() => prisma.$disconnect());
