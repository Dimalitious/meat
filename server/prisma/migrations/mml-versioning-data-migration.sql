-- MML Versioning: Data Migration Script
-- Run AFTER prisma db push / migrate deploy

-- 1. Set version=1 for all existing MMLs (if NULL due to migration)
UPDATE "ProductionMml" SET version = 1 WHERE version IS NULL;

-- 2. Set isActive=true for all existing MMLs
UPDATE "ProductionMml" SET "isActive" = true WHERE "isActive" IS NULL;

-- 3. Set isActive=true for all existing nodes
UPDATE "ProductionMmlNode" SET "isActive" = true WHERE "isActive" IS NULL;

-- 4. Auto-freeze: set isLocked=true for MMLs that have ProductionRun consumers
UPDATE "ProductionMml" SET "isLocked" = true
WHERE id IN (SELECT DISTINCT "mmlId" FROM "ProductionRun");

-- 5. Auto-freeze: set isLocked=true for MMLs that have CuttingLine consumers
UPDATE "ProductionMml" SET "isLocked" = true
WHERE id IN (SELECT DISTINCT "mmlId" FROM "ProductionCuttingLine");

-- 6. Verify: check for any MMLs with consumers but not locked (should return 0 rows)
SELECT m.id, m."productId", m.version, m."isLocked",
       (SELECT COUNT(*) FROM "ProductionRun" r WHERE r."mmlId" = m.id) as run_count,
       (SELECT COUNT(*) FROM "ProductionCuttingLine" c WHERE c."mmlId" = m.id) as cutting_count
FROM "ProductionMml" m
WHERE m."isLocked" = false
  AND (EXISTS (SELECT 1 FROM "ProductionRun" r WHERE r."mmlId" = m.id)
    OR EXISTS (SELECT 1 FROM "ProductionCuttingLine" c WHERE c."mmlId" = m.id));
