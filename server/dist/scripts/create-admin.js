"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
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
            const hashedPassword = await bcryptjs_1.default.hash(password, 10);
            await prisma.user.update({
                where: { username },
                data: {
                    password: hashedPassword,
                    role: role,
                    name: name
                }
            });
            console.log(`User "${username}" updated successfully!`);
        }
        else {
            const hashedPassword = await bcryptjs_1.default.hash(password, 10);
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
    }
    catch (error) {
        console.error('Error creating admin user:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
createAdmin();
