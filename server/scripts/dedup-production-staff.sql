-- ============================================
-- ProductionStaff Deduplication Script
-- Run this BEFORE any Prisma migrate if duplicates exist
-- ============================================

BEGIN;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Lock table to prevent new duplicates during fix
LOCK TABLE "ProductionStaff" IN EXCLUSIVE MODE;

-- B0: Deactivate NULL userId records
UPDATE "ProductionStaff"
SET "isActive" = FALSE
WHERE "userId" IS NULL;

-- C1: Create mapping table (keep newest, drop rest)
CREATE TEMP TABLE drop_mapping AS
WITH dup AS (
    SELECT
        "userId",
        MAX(id) AS keep_id,
        ARRAY_REMOVE(ARRAY_AGG(id ORDER BY id), MAX(id)) AS drop_ids
    FROM "ProductionStaff"
    WHERE "userId" IS NOT NULL
    GROUP BY "userId"
    HAVING COUNT(*) > 1
)
SELECT
    d."userId",
    d.keep_id,
    unnest(d.drop_ids) AS drop_id
FROM dup d;

-- C2.1: Update ProductionRunValue FK
UPDATE "ProductionRunValue" rv
SET "staffId" = m.keep_id
FROM drop_mapping m
WHERE rv."staffId" = m.drop_id;

-- C2.2: Update ProductionJournal FK
UPDATE "ProductionJournal" pj
SET "staffId" = m.keep_id
FROM drop_mapping m
WHERE pj."staffId" = m.drop_id;

-- C3: Delete duplicate staff records
DELETE FROM "ProductionStaff" s
USING drop_mapping m
WHERE s.id = m.drop_id;

-- C4: Validation queries (should return 0 rows each)
-- Check 1: No duplicates remain
DO $$
DECLARE
    dup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dup_count
    FROM (
        SELECT "userId"
        FROM "ProductionStaff"
        WHERE "userId" IS NOT NULL
        GROUP BY "userId"
        HAVING COUNT(*) > 1
    ) dups;
    
    IF dup_count > 0 THEN
        RAISE EXCEPTION 'VALIDATION FAILED: % duplicate userId groups remain', dup_count;
    END IF;
END $$;

-- Check 2: No orphaned ProductionRunValue references
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM "ProductionRunValue" rv
    WHERE rv."staffId" IS NOT NULL
      AND rv."staffId" NOT IN (SELECT id FROM "ProductionStaff");
    
    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'VALIDATION FAILED: % orphaned ProductionRunValue.staffId references', orphan_count;
    END IF;
END $$;

-- Cleanup
DROP TABLE drop_mapping;

COMMIT;

-- Post-migration verification (run manually)
-- SELECT "userId", COUNT(*) FROM "ProductionStaff" WHERE "userId" IS NOT NULL GROUP BY "userId" HAVING COUNT(*) > 1;
