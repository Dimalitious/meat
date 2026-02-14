-- Backfill altName with name for rows where altName is null
-- ТЗ v5.4 §10.8
UPDATE "Product" SET "altName" = name WHERE "altName" IS NULL;
