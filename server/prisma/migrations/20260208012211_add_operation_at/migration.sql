-- AlterTable
ALTER TABLE "ProductionRunValue" ADD COLUMN "operationAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: copy recordedAt into operationAt for existing rows
UPDATE "ProductionRunValue" SET "operationAt" = "recordedAt";
