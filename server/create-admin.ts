/**
 * Скрипт создания админа
 * Запуск: npx ts-node create-admin.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const username = 'admin';
    const password = 'admin';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Проверяем, существует ли уже админ
    const existing = await prisma.user.findUnique({
        where: { username }
    });

    if (existing) {
        console.log(`Пользователь "${username}" уже существует (ID: ${existing.id})`);
        console.log('Обновляем пароль и роль...');

        await prisma.user.update({
            where: { id: existing.id },
            data: {
                password: hashedPassword,
                role: 'ADMIN'
            }
        });
        console.log('✅ Пароль и роль обновлены');
    } else {
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                name: 'Администратор',
                role: 'ADMIN'
            }
        });
        console.log(`✅ Админ создан: ID=${user.id}, username="${username}", role="${user.role}"`);
    }

    console.log('\n📋 Данные для входа:');
    console.log(`   Логин: ${username}`);
    console.log(`   Пароль: ${password}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
