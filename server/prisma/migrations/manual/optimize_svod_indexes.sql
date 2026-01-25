-- ============================================
-- Оптимизация индексов для СВОД (SvodTab)
-- ============================================
-- Эти индексы ускоряют запросы обновления свода

-- Составной индекс для SummaryOrderJournal - ускоряет агрегацию заказов
-- Используется в buildSvodPreview для SQL агрегации
CREATE INDEX IF NOT EXISTS "SummaryOrderJournal_shipDate_status_productId_idx" 
ON "SummaryOrderJournal" ("shipDate", "status", "productId");

-- Индекс для Stock по productId с quantity > 0
-- Используется для получения остатков
CREATE INDEX IF NOT EXISTS "Stock_productId_quantity_idx" 
ON "Stock" ("productId") 
WHERE "quantity" > 0;

-- Составной индекс для PurchaseItem - ускоряет получение закупок
CREATE INDEX IF NOT EXISTS "PurchaseItem_productId_supplierId_idx" 
ON "PurchaseItem" ("productId", "supplierId");

-- Составной индекс для ProductionRunValue - ускоряет получение производства
CREATE INDEX IF NOT EXISTS "ProductionRunValue_snapshotProductId_value_idx" 
ON "ProductionRunValue" ("snapshotProductId") 
WHERE "value" IS NOT NULL;

-- Индекс для SvodLine по svodId и productId (уже есть через @@unique, но добавляем для надёжности)
-- CREATE INDEX IF NOT EXISTS "SvodLine_svodId_productId_idx" ON "SvodLine" ("svodId", "productId");

-- ============================================
-- Примечание: Перед применением рекомендуется:
-- 1. Сделать резервную копию БД
-- 2. Применить скрипт во время минимальной нагрузки
-- ============================================
