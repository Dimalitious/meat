ALTER TABLE "Purchase" DROP CONSTRAINT IF EXISTS "Purchase_createdByUserId_fkey";
UPDATE "Purchase" SET "createdByUserId" = NULL;
