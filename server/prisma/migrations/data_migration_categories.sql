-- ТЗ v5.6: Data Migration — populate ProductCategory from legacy category strings
-- Run this AFTER prisma migrate deploy
-- Normalization matches app: trim + collapse spaces + lower

-- Step 1: Populate ProductCategory from distinct non-null product.category values
INSERT INTO "ProductCategory" ("name", "nameNormalized", "isActive", "createdAt", "updatedAt")
SELECT DISTINCT
    REGEXP_REPLACE(TRIM(category), '\s+', ' ', 'g'),
    LOWER(REGEXP_REPLACE(TRIM(category), '\s+', ' ', 'g')),
    true,
    NOW(),
    NOW()
FROM "Product"
WHERE category IS NOT NULL
  AND TRIM(category) != ''
ON CONFLICT ("nameNormalized") DO NOTHING;

-- Step 2: Backfill Product.categoryId from the newly created categories
UPDATE "Product" p
SET "categoryId" = pc.id
FROM "ProductCategory" pc
WHERE LOWER(REGEXP_REPLACE(TRIM(p.category), '\s+', ' ', 'g')) = pc."nameNormalized"
  AND p.category IS NOT NULL
  AND TRIM(p.category) != ''
  AND p."categoryId" IS NULL;

-- Step 3: Verify
SELECT
    COUNT(*) AS total_products,
    COUNT("categoryId") AS with_category_id,
    COUNT(category) AS with_legacy_category
FROM "Product";

SELECT COUNT(*) AS total_categories FROM "ProductCategory";
