-- Миграция статусов заказов из старых в новые (FSM)
-- Выполнить один раз после добавления FSM полей

UPDATE "Order" SET status = 'NEW' WHERE status = 'new';
UPDATE "Order" SET status = 'LOADED' WHERE status = 'assigned';
UPDATE "Order" SET status = 'SHIPPED' WHERE status = 'delivered';
UPDATE "Order" SET status = 'SHIPPED' WHERE status = 'in_delivery';
UPDATE "Order" SET status = 'DISTRIBUTING' WHERE status = 'processing';
