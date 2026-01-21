-- Добавление первичного MML поставщику
-- Позволяет назначить поставщику его основной MML/калькуляцию

-- 1. Добавляем поле primaryMmlId в таблицу Supplier
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "primaryMmlId" INTEGER;

-- 2. Добавляем поле primaryMmlId в таблицу PurchasePriceListSupplier
-- Это поле фиксирует MML поставщика на момент создания закупочного прайса
ALTER TABLE "PurchasePriceListSupplier" ADD COLUMN IF NOT EXISTS "primaryMmlId" INTEGER;

-- 3. Создаём индекс для быстрого поиска по primaryMmlId
CREATE INDEX IF NOT EXISTS "PurchasePriceListSupplier_primaryMmlId_idx" 
ON "PurchasePriceListSupplier"("primaryMmlId");

-- 4. Добавляем внешние ключи
-- FK: Supplier.primaryMmlId -> ProductionMml.id
ALTER TABLE "Supplier" 
ADD CONSTRAINT "Supplier_primaryMmlId_fkey" 
FOREIGN KEY ("primaryMmlId") REFERENCES "ProductionMml"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;

-- FK: PurchasePriceListSupplier.primaryMmlId -> ProductionMml.id
ALTER TABLE "PurchasePriceListSupplier" 
ADD CONSTRAINT "PurchasePriceListSupplier_primaryMmlId_fkey" 
FOREIGN KEY ("primaryMmlId") REFERENCES "ProductionMml"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;
