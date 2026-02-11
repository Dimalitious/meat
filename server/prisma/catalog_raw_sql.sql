-- ================================================================
-- Raw SQL additions for Product Catalog migration
-- Append this to the end of the Prisma-generated migration.sql
-- ================================================================

-- 1. XOR CHECK constraint on ParamValue: exactly one of subcategoryId / productId must be set
ALTER TABLE "ParamValue"
ADD CONSTRAINT "chk_param_value_owner_xor"
CHECK (
    ("subcategoryId" IS NOT NULL AND "productId" IS NULL)
    OR
    ("subcategoryId" IS NULL AND "productId" IS NOT NULL)
);

-- 2. Partial unique indexes for active ParamValue entries
--    Prevents duplicate active values within same owner

-- 2a. Subcategory + LENGTH_CM
CREATE UNIQUE INDEX "uq_pv_subcat_length_active"
ON "ParamValue" ("subcategoryId", "paramType", "valueNum")
WHERE "subcategoryId" IS NOT NULL
  AND "paramType" = 'LENGTH_CM'
  AND "isActive" = true;

-- 2b. Subcategory + WIDTH_CM
CREATE UNIQUE INDEX "uq_pv_subcat_width_active"
ON "ParamValue" ("subcategoryId", "paramType", "valueNum")
WHERE "subcategoryId" IS NOT NULL
  AND "paramType" = 'WIDTH_CM'
  AND "isActive" = true;

-- 2c. Subcategory + WEIGHT_G
CREATE UNIQUE INDEX "uq_pv_subcat_weight_active"
ON "ParamValue" ("subcategoryId", "paramType", "valueInt")
WHERE "subcategoryId" IS NOT NULL
  AND "paramType" = 'WEIGHT_G'
  AND "isActive" = true;

-- 2d. Subcategory + PROCESSING (valueText stored as canonical lowercase)
CREATE UNIQUE INDEX "uq_pv_subcat_processing_active"
ON "ParamValue" ("subcategoryId", "paramType", "valueText")
WHERE "subcategoryId" IS NOT NULL
  AND "paramType" = 'PROCESSING'
  AND "isActive" = true;

-- 2e. Product + numeric (LENGTH/WIDTH) override
CREATE UNIQUE INDEX "uq_pv_product_num_active"
ON "ParamValue" ("productId", "paramType", "valueNum")
WHERE "productId" IS NOT NULL
  AND "paramType" IN ('LENGTH_CM', 'WIDTH_CM')
  AND "isActive" = true;

-- 2f. Product + WEIGHT_G override
CREATE UNIQUE INDEX "uq_pv_product_weight_active"
ON "ParamValue" ("productId", "paramType", "valueInt")
WHERE "productId" IS NOT NULL
  AND "paramType" = 'WEIGHT_G'
  AND "isActive" = true;

-- 2g. Product + PROCESSING override (valueText stored as canonical lowercase)
CREATE UNIQUE INDEX "uq_pv_product_processing_active"
ON "ParamValue" ("productId", "paramType", "valueText")
WHERE "productId" IS NOT NULL
  AND "paramType" = 'PROCESSING'
  AND "isActive" = true;
