"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    const hash = await bcryptjs_1.default.hash('1234', 10);
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
