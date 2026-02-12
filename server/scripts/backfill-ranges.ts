/**
 * Backfill script: migrate legacy single values to min=max ranges.
 * Run AFTER `npx prisma db push` to populate new range fields.
 *
 * Usage: npx ts-node scripts/backfill-ranges.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Backfill valueNumMin/Max from legacy valueNum (LENGTH, WIDTH, HEIGHT, THICKNESS)
    const numResult = await prisma.$executeRawUnsafe(`
        UPDATE "ParamValue"
        SET "valueNumMin" = "valueNum",
            "valueNumMax" = "valueNum"
        WHERE "valueNum" IS NOT NULL
          AND "valueNumMin" IS NULL
    `);
    console.log(`Backfilled ${numResult} rows: valueNum → valueNumMin/Max`);

    // Backfill valueIntMin/Max from legacy valueInt (WEIGHT_G)
    const intResult = await prisma.$executeRawUnsafe(`
        UPDATE "ParamValue"
        SET "valueIntMin" = "valueInt",
            "valueIntMax" = "valueInt"
        WHERE "valueInt" IS NOT NULL
          AND "valueIntMin" IS NULL
    `);
    console.log(`Backfilled ${intResult} rows: valueInt → valueIntMin/Max`);

    console.log('Done.');
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
