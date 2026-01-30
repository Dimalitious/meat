-- Очистка дублирующихся ProductionRun 
-- Оставляем только один run на товар на дату (с минимальным id)

-- Сначала удаляем ProductionRunValue для дублей
DELETE FROM "ProductionRunValue" 
WHERE "productionRunId" IN (
    SELECT pr.id 
    FROM "ProductionRun" pr
    WHERE pr.id NOT IN (
        SELECT MIN(pr2.id) 
        FROM "ProductionRun" pr2 
        GROUP BY pr2."productId", DATE(pr2."productionDate")
    )
);

-- Потом удаляем сами дублирующиеся runs
DELETE FROM "ProductionRun" 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM "ProductionRun" 
    GROUP BY "productId", DATE("productionDate")
);
