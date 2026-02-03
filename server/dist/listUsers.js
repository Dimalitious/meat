"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const users = await prisma.user.findMany();
    console.log('=== USERS IN DATABASE ===');
    users.forEach(u => {
        console.log(`ID: ${u.id}, Username: ${u.username}, Name: ${u.name}, Role: ${u.role}`);
    });
    if (users.length === 0) {
        console.log('NO USERS FOUND! You need to create a user.');
    }
    await prisma.$disconnect();
}
main();
