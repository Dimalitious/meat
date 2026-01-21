-- Migration: add_sales_price_effective_date_and_hidden
-- Description: Добавление полей effectiveDate и isHidden в SalesPriceList

-- 1. Добавляем поле effectiveDate (NOT NULL с default = NOW() для существующих записей)
ALTER TABLE "SalesPriceList" 
ADD COLUMN "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- 2. Добавляем поле isHidden (default = false)
ALTER TABLE "SalesPriceList" 
ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- 3. Создаём индексы для оптимизации запросов
CREATE INDEX "SalesPriceList_effectiveDate_idx" ON "SalesPriceList"("effectiveDate");
CREATE INDEX "SalesPriceList_isHidden_listType_idx" ON "SalesPriceList"("isHidden", "listType");

-- 4. Обновляем существующие записи: устанавливаем effectiveDate = createdAt
UPDATE "SalesPriceList" SET "effectiveDate" = "createdAt";

-- 5. Убираем default для effectiveDate (теперь поле обязательное, значение должно передаваться явно)
ALTER TABLE "SalesPriceList" ALTER COLUMN "effectiveDate" DROP DEFAULT;
