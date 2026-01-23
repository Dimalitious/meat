/**
 * Скрипт для заполнения productId в SummaryOrderJournal
 * на основе productFullName
 * 
 * npm run fill-product-ids
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fillProductIds() {
    console.log('🔍 Ищем записи без productId...');

    // Находим все записи без productId
    const entriesWithoutProductId = await prisma.summaryOrderJournal.findMany({
        where: { productId: null },
        select: {
            id: true,
            productFullName: true,
            productCode: true
        }
    });

    console.log(`📋 Найдено ${entriesWithoutProductId.length} записей без productId`);

    if (entriesWithoutProductId.length === 0) {
        console.log('✅ Все записи уже имеют productId!');
        return;
    }

    // Получаем все товары для поиска
    const products = await prisma.product.findMany({
        select: { id: true, name: true, code: true }
    });

    console.log(`📦 Загружено ${products.length} товаров из справочника`);

    // Создаём маппинги для быстрого поиска
    const productByName = new Map<string, number>();
    const productByCode = new Map<string, number>();

    for (const product of products) {
        // По точному названию
        productByName.set(product.name.toLowerCase().trim(), product.id);
        // По коду
        if (product.code) {
            productByCode.set(product.code.toLowerCase().trim(), product.id);
        }
    }

    let updated = 0;
    let notFound = 0;
    const notFoundNames: string[] = [];

    for (const entry of entriesWithoutProductId) {
        let productId: number | null = null;

        // Сначала ищем по коду
        if (entry.productCode) {
            productId = productByCode.get(entry.productCode.toLowerCase().trim()) || null;
        }

        // Если не нашли по коду — ищем по названию
        if (!productId && entry.productFullName) {
            productId = productByName.get(entry.productFullName.toLowerCase().trim()) || null;
        }

        if (productId) {
            await prisma.summaryOrderJournal.update({
                where: { id: entry.id },
                data: { productId }
            });
            updated++;

            if (updated % 50 === 0) {
                console.log(`  ✓ Обновлено ${updated}...`);
            }
        } else {
            notFound++;
            if (notFoundNames.length < 20) {
                notFoundNames.push(entry.productFullName || entry.productCode || 'N/A');
            }
        }
    }

    console.log('\n📊 Результаты:');
    console.log(`  ✅ Обновлено: ${updated}`);
    console.log(`  ❌ Не найдено: ${notFound}`);

    if (notFoundNames.length > 0) {
        console.log('\n⚠️ Примеры товаров которые не найдены:');
        notFoundNames.forEach((name, i) => console.log(`  ${i + 1}. ${name}`));
    }
}

fillProductIds()
    .then(() => {
        console.log('\n✅ Готово!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Ошибка:', error);
        process.exit(1);
    })
    .finally(() => {
        prisma.$disconnect();
    });
