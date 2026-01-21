import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

export const config = {
    telegram: {
        apiId: parseInt(process.env.TELEGRAM_API_ID || '0', 10),
        apiHash: process.env.TELEGRAM_API_HASH || '',
        phone: process.env.TELEGRAM_PHONE || '',
        sessionPath: process.env.SESSION_PATH || './session/telegram.session',
    },
    server: {
        url: process.env.MEATPR_SERVER_URL || 'http://localhost:3000',
        apiKey: process.env.MEATPR_API_KEY || '',
    },
    // Default parse patterns (can be overridden per group)
    defaultPatterns: {
        // "Говядина 10кг" или "Говядина - 10 кг" или "Говядина: 10кг"
        productWithQuantity: /^(.+?)\s*[-–:=]?\s*(\d+(?:[.,]\d+)?)\s*(кг|г|шт|л|kg|g|pcs)/gim,

        // "Заказ #123" или "Заказ №123" или "№123" или "#123"
        orderNumber: /(?:заказ\s*)?[#№]\s*(\d+)/i,

        // "Клиент: Иванов" или "Клиент - Иванов" или "Заказчик: ООО Рога"
        customer: /(?:клиент|заказчик|покупатель)\s*[:–-]\s*(.+)/i,

        // "Доставка: ул. Ленина, 15" или "Адрес: ..."
        address: /(?:доставка|адрес)\s*[:–-]\s*(.+)/i,

        // Price patterns (optional)
        price: /(\d+(?:[.,]\d+)?)\s*(?:₸|тг|тенге|руб|₽)?/i,
    },
};

// Validate config
export function validateConfig(): boolean {
    const errors: string[] = [];

    if (!config.telegram.apiId || config.telegram.apiId === 0) {
        errors.push('TELEGRAM_API_ID is required');
    }
    if (!config.telegram.apiHash) {
        errors.push('TELEGRAM_API_HASH is required');
    }
    if (!config.telegram.phone) {
        errors.push('TELEGRAM_PHONE is required');
    }

    if (errors.length > 0) {
        console.error('❌ Configuration errors:');
        errors.forEach(e => console.error(`   - ${e}`));
        console.error('\n📝 Please copy .env.example to .env and fill in the values');
        return false;
    }

    return true;
}
