-- Migration: add_order_disabled_field
-- Description: Добавление поля isDisabled для soft-disable заказов

-- 1. Добавляем поле isDisabled (default = false)
ALTER TABLE "Order" 
ADD COLUMN "isDisabled" BOOLEAN NOT NULL DEFAULT false;

-- 2. Создаём индексы для оптимизации выборок журнала заказов
CREATE INDEX "Order_date_idx" ON "Order"("date");
CREATE INDEX "Order_isDisabled_idx" ON "Order"("isDisabled");
CREATE INDEX "Order_isDisabled_date_idx" ON "Order"("isDisabled", "date");
