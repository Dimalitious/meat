import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkAndCreateAdmin() {
    console.log('=== Проверка пользователей ===\n');

    try {
        // Список всех пользователей
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                createdAt: true,
            },
        });

        console.log(`📋 Всего пользователей: ${users.length}\n`);

        if (users.length > 0) {
            console.log('Существующие пользователи:');
            users.forEach((u) => {
                console.log(`   [${u.id}] ${u.username} | ${u.name} | ${u.role}`);
            });
        }

        // Проверка наличия админа
        const admin = await prisma.user.findUnique({
            where: { username: 'admin' },
        });

        if (!admin) {
            console.log('\n⚠️ Пользователь "admin" не найден. Создаём...');

            const hashedPassword = await bcrypt.hash('admin123', 10);

            const newAdmin = await prisma.user.create({
                data: {
                    username: 'admin',
                    password: hashedPassword,
                    name: 'Администратор',
                    role: 'ADMIN',
                },
            });

            console.log(`✅ Администратор создан!`);
            console.log(`   Логин: admin`);
            console.log(`   Пароль: admin123`);
            console.log(`   ID: ${newAdmin.id}`);
        } else {
            console.log(`\n✅ Пользователь "admin" существует (ID: ${admin.id}, role: ${admin.role})`);

            // Сбросим пароль на admin123
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await prisma.user.update({
                where: { id: admin.id },
                data: { password: hashedPassword },
            });

            console.log(`🔑 Пароль сброшен на: admin123`);
        }

    } catch (error) {
        console.error('Ошибка:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkAndCreateAdmin();
