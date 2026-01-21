const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    const hash = await bcrypt.hash('admin', 10);

    // Удаляем всех пользователей и создаём заново
    await prisma.user.deleteMany({});

    const user = await prisma.user.create({
        data: {
            username: 'admin',
            password: hash,
            name: 'Администратор',
            role: 'ADMIN'
        }
    });

    console.log('✅ Пользователь создан:');
    console.log('   Логин: admin');
    console.log('   Пароль: admin');
    console.log('   ID:', user.id);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
