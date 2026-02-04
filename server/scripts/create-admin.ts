/**
 * Скрипт создания пользователя admin
 * Запуск: npx ts-node scripts/create-admin.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const username = 'admin';
    const password = 'admin';
    const name = 'Администратор';
    const role = 'admin';

    // Проверяем существование
    const existing = await prisma.user.findUnique({
        where: { username }
    });

    if (existing) {
        console.log(`Пользователь "${username}" уже существует (ID: ${existing.id})`);
        return;
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создаём пользователя
    const user = await prisma.user.create({
        data: {
            username,
            password: hashedPassword,
            name,
            role
        }
    });

    console.log('✅ Пользователь admin создан:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Логин: ${username}`);
    console.log(`   Пароль: ${password}`);
    console.log(`   Роль: ${role}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
