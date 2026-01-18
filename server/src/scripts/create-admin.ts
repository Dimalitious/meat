import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
    const username = 'inventyce';
    const password = '1987';
    const name = 'Администратор';
    const role = 'ADMIN';

    try {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { username }
        });

        if (existingUser) {
            console.log(`User "${username}" already exists. Updating...`);
            const hashedPassword = await bcrypt.hash(password, 10);
            await prisma.user.update({
                where: { username },
                data: {
                    password: hashedPassword,
                    role: role,
                    name: name
                }
            });
            console.log(`User "${username}" updated successfully!`);
        } else {
            const hashedPassword = await bcrypt.hash(password, 10);
            await prisma.user.create({
                data: {
                    username,
                    password: hashedPassword,
                    name,
                    role
                }
            });
            console.log(`Admin user "${username}" created successfully!`);
        }
    } catch (error) {
        console.error('Error creating admin user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createAdmin();
