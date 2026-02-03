"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function migrateStatuses() {
    console.log('Migrating order statuses...');
    // Update old statuses to new ones
    const mappings = [
        { old: 'draft', new: 'new' },
        { old: 'confirmed', new: 'processing' },
        { old: 'assembling', new: 'processing' },
        { old: 'assembled', new: 'delivered' },
        { old: 'shipped', new: 'delivered' },
        { old: 'completed', new: 'delivered' }
    ];
    for (const mapping of mappings) {
        const result = await prisma.order.updateMany({
            where: { status: mapping.old },
            data: { status: mapping.new }
        });
        console.log(`Updated ${result.count} orders: ${mapping.old} → ${mapping.new}`);
    }
    console.log('Migration complete!');
    await prisma.$disconnect();
}
migrateStatuses();
