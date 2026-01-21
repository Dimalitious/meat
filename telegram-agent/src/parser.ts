import Fuse from 'fuse.js';
import { config } from './config';
import { ProductMatch, TelegramGroup } from './api';

export interface ParsedItem {
    rawProductName: string;
    rawQuantity: string;
    rawPrice: string | null;
    matchedProducts?: ProductMatch[];
}

export interface ParsedOrder {
    isOrder: boolean;
    orderNumber: string | null;
    customer: string | null;
    address: string | null;
    items: ParsedItem[];
}

// Fuse.js instance for fuzzy matching
let fuse: Fuse<ProductMatch> | null = null;

/**
 * Initialize fuzzy search with products
 */
export function initFuzzySearch(products: ProductMatch[]): void {
    fuse = new Fuse(products, {
        keys: [
            { name: 'name', weight: 0.5 },
            { name: 'altName', weight: 0.3 },
            { name: 'code', weight: 0.2 }
        ],
        threshold: 0.4,
        includeScore: true,
        minMatchCharLength: 2,
    });
    console.log(`🔍 Fuzzy search initialized with ${products.length} products`);
}

/**
 * Find matching products for a raw product name
 */
export function findMatchingProducts(rawName: string, limit: number = 3): ProductMatch[] {
    if (!fuse) return [];

    const results = fuse.search(rawName, { limit });
    return results.map(r => ({
        ...r.item,
        score: Math.round((1 - (r.score || 0)) * 100)
    }));
}

/**
 * Get patterns for a group (custom or default)
 */
function getPatterns(group: TelegramGroup): typeof config.defaultPatterns {
    const custom = group.parsePatterns;
    if (!custom) return config.defaultPatterns;

    // Merge custom patterns with defaults
    return {
        productWithQuantity: custom.productWithQuantity
            ? new RegExp(custom.productWithQuantity, 'gim')
            : config.defaultPatterns.productWithQuantity,
        orderNumber: custom.orderNumber
            ? new RegExp(custom.orderNumber, 'i')
            : config.defaultPatterns.orderNumber,
        customer: custom.customer
            ? new RegExp(custom.customer, 'i')
            : config.defaultPatterns.customer,
        address: custom.address
            ? new RegExp(custom.address, 'i')
            : config.defaultPatterns.address,
        price: custom.price
            ? new RegExp(custom.price, 'i')
            : config.defaultPatterns.price,
    };
}

/**
 * Parse message text to extract order information
 */
export function parseOrder(text: string, group?: TelegramGroup): ParsedOrder {
    const patterns = group ? getPatterns(group) : config.defaultPatterns;
    const items: ParsedItem[] = [];

    // Split into lines and process each
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    for (const line of lines) {
        // Skip lines that look like metadata (order number, customer, address)
        if (patterns.orderNumber.test(line)) continue;
        if (patterns.customer.test(line)) continue;
        if (patterns.address.test(line)) continue;

        // Try to match product with quantity
        // Reset regex lastIndex for global patterns
        const regex = new RegExp(patterns.productWithQuantity.source, 'gim');
        const match = regex.exec(line);

        if (match) {
            const rawProductName = match[1].trim();
            const quantity = match[2];
            const unit = match[3];

            // Skip if product name is too short or looks like noise
            if (rawProductName.length < 2) continue;
            if (/^(заказ|клиент|доставка|адрес|итого|всего)/i.test(rawProductName)) continue;

            const item: ParsedItem = {
                rawProductName,
                rawQuantity: `${quantity}${unit}`,
                rawPrice: null,
            };

            // Try to find matching products
            if (fuse) {
                item.matchedProducts = findMatchingProducts(rawProductName);
            }

            items.push(item);
        }
    }

    // Extract metadata
    const orderNumberMatch = text.match(patterns.orderNumber);
    const customerMatch = text.match(patterns.customer);
    const addressMatch = text.match(patterns.address);

    return {
        isOrder: items.length > 0,
        orderNumber: orderNumberMatch ? orderNumberMatch[1] : null,
        customer: customerMatch ? customerMatch[1].trim() : null,
        address: addressMatch ? addressMatch[1].trim() : null,
        items,
    };
}

/**
 * Check if a message looks like an order (quick check)
 */
export function looksLikeOrder(text: string): boolean {
    // Check for common order indicators
    const indicators = [
        /заказ/i,
        /доставка/i,
        /\d+\s*(кг|г|шт|л)/i,
        /клиент/i,
    ];

    let score = 0;
    for (const pattern of indicators) {
        if (pattern.test(text)) score++;
    }

    // At least 2 indicators should match
    return score >= 2;
}
