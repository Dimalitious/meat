"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importCustomersFromZip = exports.exportCustomersWithPhotos = exports.importCustomers = exports.downloadImportTemplate = exports.deleteCustomer = exports.updateCustomer = exports.createCustomer = exports.getCustomers = void 0;
const db_1 = require("../db");
const XLSX = __importStar(require("xlsx"));
const archiver_1 = __importDefault(require("archiver"));
const unzipper_1 = __importDefault(require("unzipper"));
const axios_1 = __importDefault(require("axios"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const stream_1 = require("stream");
const getCustomers = async (req, res) => {
    try {
        const { search } = req.query;
        let where = {};
        if (search) {
            where.OR = [
                { code: { contains: String(search) } },
                { name: { contains: String(search) } }
            ];
        }
        const items = await db_1.prisma.customer.findMany({
            where,
            include: { district: true, manager: true },
            orderBy: { name: 'asc' }
        });
        res.json(items);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};
exports.getCustomers = getCustomers;
const createCustomer = async (req, res) => {
    try {
        const item = await db_1.prisma.customer.create({ data: req.body });
        res.status(201).json(item);
    }
    catch (error) {
        res.status(400).json({ error: 'Failed' });
    }
};
exports.createCustomer = createCustomer;
const updateCustomer = async (req, res) => {
    try {
        const { code } = req.params;
        const item = await db_1.prisma.customer.update({ where: { code }, data: req.body });
        res.json(item);
    }
    catch (error) {
        res.status(400).json({ error: 'Failed' });
    }
};
exports.updateCustomer = updateCustomer;
const deleteCustomer = async (req, res) => {
    try {
        const { code } = req.params;
        await db_1.prisma.customer.delete({ where: { code } });
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        res.status(400).json({ error: 'Failed' });
    }
};
exports.deleteCustomer = deleteCustomer;
// Скачать шаблон Excel для импорта клиентов
const downloadImportTemplate = async (req, res) => {
    try {
        // Создаём workbook с примерами
        const wb = XLSX.utils.book_new();
        // Лист 1: Клиенты
        const customersData = [
            ['Код клиента*', 'Название*', 'Юр. название', 'ИНН', 'Telegram группа', 'Telegram username', 'Код района', 'Код менеджера'],
            ['CLIENT001', 'ООО Мясной Дом', 'ООО "Мясной Дом"', '123456789', 'Мясной Дом - Заказы', '@myasnoy_dom', 'CENTER', 'MGR01'],
            ['CLIENT002', 'ИП Иванов', 'ИП Иванов И.И.', '987654321', '', '', 'NORTH', 'MGR02'],
        ];
        const customersWs = XLSX.utils.aoa_to_sheet(customersData);
        customersWs['!cols'] = [
            { wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 12 },
            { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 15 }
        ];
        XLSX.utils.book_append_sheet(wb, customersWs, 'Клиенты');
        // Лист 2: Карточки клиентов (позиции товаров с описаниями)
        const cardsData = [
            ['Код клиента*', 'Название карточки', 'Код товара*', 'Описание разделки'],
            ['CLIENT001', 'Основной ассортимент', 'LAMB001', 'Нарезка кубиками 3x3 см, без кости'],
            ['CLIENT001', 'Основной ассортимент', 'LAMB002', 'Стейки толщиной 2 см'],
            ['CLIENT001', 'Премиум', 'BEEF001', 'Филе без жил, порционно по 200г'],
            ['CLIENT002', 'Стандарт', 'LAMB001', 'Крупная нарезка для шашлыка'],
        ];
        const cardsWs = XLSX.utils.aoa_to_sheet(cardsData);
        cardsWs['!cols'] = [
            { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 50 }
        ];
        XLSX.utils.book_append_sheet(wb, cardsWs, 'Карточки');
        // Лист 3: Инструкция
        const instructionData = [
            ['ИНСТРУКЦИЯ ПО ЗАПОЛНЕНИЮ'],
            [''],
            ['Лист "Клиенты":'],
            ['• Код клиента* - уникальный код (обязательно)'],
            ['• Название* - название клиента (обязательно)'],
            ['• Юр. название - юридическое название'],
            ['• ИНН - до 9 символов'],
            ['• Telegram группа - название группы в Telegram'],
            ['• Telegram username - @username группы'],
            ['• Код района - должен существовать в справочнике районов'],
            ['• Код менеджера - должен существовать в справочнике менеджеров'],
            [''],
            ['Лист "Карточки":'],
            ['• Код клиента* - должен совпадать с кодом из листа "Клиенты"'],
            ['• Название карточки - группировка товаров (если пусто - "Основной ассортимент")'],
            ['• Код товара* - должен существовать в справочнике товаров'],
            ['• Описание разделки - детальное описание как разделывать товар для этого клиента'],
            [''],
            ['* - обязательные поля'],
        ];
        const instructionWs = XLSX.utils.aoa_to_sheet(instructionData);
        instructionWs['!cols'] = [{ wch: 80 }];
        XLSX.utils.book_append_sheet(wb, instructionWs, 'Инструкция');
        // Генерируем buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="customers_import_template.xlsx"');
        res.send(buffer);
    }
    catch (error) {
        console.error('Failed to generate template:', error);
        res.status(500).json({ error: 'Failed to generate template' });
    }
};
exports.downloadImportTemplate = downloadImportTemplate;
// Импорт клиентов из Excel
const importCustomers = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        console.log('[IMPORT] Sheet names in workbook:', workbook.SheetNames);
        // Читаем лист "Клиенты" — ищем по разным названиям или берём первый
        const customersSheet = workbook.Sheets['Клиенты'] ||
            workbook.Sheets['клиенты'] ||
            workbook.Sheets['Customers'] ||
            workbook.Sheets[workbook.SheetNames[0]];
        const customersData = XLSX.utils.sheet_to_json(customersSheet, { header: 1 });
        // Читаем лист "Карточки" — ищем по разным названиям или берём второй лист
        let cardsSheet = workbook.Sheets['Карточки'] ||
            workbook.Sheets['карточки'] ||
            workbook.Sheets['Cards'] ||
            workbook.Sheets['Позиции'] ||
            workbook.Sheets['позиции'];
        // Если не нашли по названию — берём второй лист если он есть
        if (!cardsSheet && workbook.SheetNames.length > 1) {
            cardsSheet = workbook.Sheets[workbook.SheetNames[1]];
        }
        const cardsData = cardsSheet ? XLSX.utils.sheet_to_json(cardsSheet, { header: 1 }) : [];
        console.log('[IMPORT] Customers data rows:', customersData.length);
        console.log('[IMPORT] Cards data rows:', cardsData.length);
        const results = {
            customersCreated: 0,
            customersUpdated: 0,
            cardsCreated: 0,
            itemsCreated: 0,
            errors: []
        };
        // Пропускаем заголовок, обрабатываем клиентов
        for (let i = 1; i < customersData.length; i++) {
            const row = customersData[i];
            if (!row || !row[0])
                continue; // Пропускаем пустые строки
            const code = String(row[0]).trim();
            const name = String(row[1] || '').trim();
            if (!code || !name) {
                results.errors.push(`Строка ${i + 1}: Код и название клиента обязательны`);
                continue;
            }
            try {
                const customerData = {
                    code,
                    name,
                    legalName: row[2] ? String(row[2]).trim() : null,
                    inn: row[3] ? String(row[3]).trim().slice(0, 9) : null,
                    telegramGroupName: row[4] ? String(row[4]).trim() : null,
                    telegramGroupUsername: row[5] ? String(row[5]).trim() : null,
                    districtId: row[6] ? String(row[6]).trim() : null,
                    managerId: row[7] ? String(row[7]).trim() : null,
                };
                // Upsert клиента
                const existing = await db_1.prisma.customer.findUnique({ where: { code } });
                if (existing) {
                    await db_1.prisma.customer.update({ where: { code }, data: customerData });
                    results.customersUpdated++;
                }
                else {
                    await db_1.prisma.customer.create({ data: customerData });
                    results.customersCreated++;
                }
            }
            catch (err) {
                results.errors.push(`Строка ${i + 1} (${code}): ${err.message}`);
            }
        }
        // Обрабатываем карточки
        const cardCache = new Map(); // customerCode_cardName -> cardId
        for (let i = 1; i < cardsData.length; i++) {
            const row = cardsData[i];
            if (!row || !row[0])
                continue;
            const customerCode = String(row[0]).trim();
            const cardName = String(row[1] || 'Основной ассортимент').trim();
            const productCode = String(row[2] || '').trim();
            const description = row[3] ? String(row[3]).trim() : null;
            console.log(`[IMPORT] Processing card row ${i}: customer=${customerCode}, card=${cardName}, product=${productCode}`);
            if (!customerCode || !productCode) {
                results.errors.push(`Карточки, строка ${i + 1}: Код клиента и код товара обязательны`);
                continue;
            }
            try {
                // Находим клиента
                const customer = await db_1.prisma.customer.findUnique({ where: { code: customerCode } });
                if (!customer) {
                    results.errors.push(`Карточки, строка ${i + 1}: Клиент ${customerCode} не найден`);
                    continue;
                }
                // Находим товар
                const product = await db_1.prisma.product.findUnique({ where: { code: productCode } });
                if (!product) {
                    results.errors.push(`Карточки, строка ${i + 1}: Товар ${productCode} не найден`);
                    continue;
                }
                // Получаем или создаём карточку
                const cacheKey = `${customerCode}_${cardName}`;
                let cardId = cardCache.get(cacheKey);
                if (!cardId) {
                    // Ищем существующую карточку
                    let card = await db_1.prisma.customerCard.findFirst({
                        where: { customerId: customer.id, name: cardName }
                    });
                    if (!card) {
                        card = await db_1.prisma.customerCard.create({
                            data: { customerId: customer.id, name: cardName }
                        });
                        results.cardsCreated++;
                    }
                    cardId = card.id;
                    cardCache.set(cacheKey, cardId);
                }
                // Создаём или обновляем позицию карточки
                await db_1.prisma.customerCardItem.upsert({
                    where: {
                        cardId_productId: { cardId, productId: product.id }
                    },
                    update: { description },
                    create: {
                        cardId,
                        productId: product.id,
                        description,
                        sortOrder: i
                    }
                });
                results.itemsCreated++;
            }
            catch (err) {
                results.errors.push(`Карточки, строка ${i + 1}: ${err.message}`);
            }
        }
        res.json({
            success: true,
            message: `Импорт завершён: создано ${results.customersCreated} клиентов, обновлено ${results.customersUpdated}, создано ${results.cardsCreated} карточек, ${results.itemsCreated} позиций`,
            ...results
        });
    }
    catch (error) {
        console.error('Import failed:', error);
        res.status(500).json({ error: 'Import failed: ' + error.message });
    }
};
exports.importCustomers = importCustomers;
// Экспорт клиентов с карточками и фото в ZIP
const exportCustomersWithPhotos = async (req, res) => {
    try {
        // Загружаем всех клиентов с карточками и фото
        const customers = await db_1.prisma.customer.findMany({
            include: {
                district: true,
                manager: true,
                customerCards: {
                    include: {
                        items: {
                            include: {
                                product: true,
                                photos: { orderBy: { sortOrder: 'asc' } }
                            },
                            orderBy: { sortOrder: 'asc' }
                        }
                    }
                }
            },
            orderBy: { name: 'asc' }
        });
        // Создаём workbook
        const wb = XLSX.utils.book_new();
        // Лист 1: Клиенты
        const customersData = [
            ['Код клиента', 'Название', 'Юр. название', 'ИНН', 'Telegram группа', 'Telegram username', 'Код района', 'Код менеджера']
        ];
        for (const c of customers) {
            customersData.push([
                c.code,
                c.name,
                c.legalName || '',
                c.inn || '',
                c.telegramGroupName || '',
                c.telegramGroupUsername || '',
                c.districtId || '',
                c.managerId || ''
            ]);
        }
        const customersWs = XLSX.utils.aoa_to_sheet(customersData);
        XLSX.utils.book_append_sheet(wb, customersWs, 'Клиенты');
        // Лист 2: Карточки с фото
        const cardsData = [
            ['Код клиента', 'Название карточки', 'Код товара', 'Название товара', 'Описание разделки', 'Фото1', 'Фото2', 'Фото3']
        ];
        const photoUrls = [];
        let photoIndex = 0;
        for (const c of customers) {
            for (const card of c.customerCards) {
                for (const item of card.items) {
                    const photoFilenames = [];
                    for (const photo of item.photos.slice(0, 3)) {
                        photoIndex++;
                        const ext = path.extname(photo.url) || '.jpg';
                        const filename = `photo_${photoIndex}${ext}`;
                        photoFilenames.push(filename);
                        photoUrls.push({ url: photo.url, filename });
                    }
                    cardsData.push([
                        c.code,
                        card.name,
                        item.product.code,
                        item.product.name,
                        item.description || '',
                        photoFilenames[0] || '',
                        photoFilenames[1] || '',
                        photoFilenames[2] || ''
                    ]);
                }
            }
        }
        const cardsWs = XLSX.utils.aoa_to_sheet(cardsData);
        XLSX.utils.book_append_sheet(wb, cardsWs, 'Карточки');
        // Генерируем Excel buffer
        const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        // Создаём ZIP архив
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="customers_export.zip"');
        const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
        archive.pipe(res);
        // Добавляем Excel файл
        archive.append(excelBuffer, { name: 'customers.xlsx' });
        // Скачиваем и добавляем фото
        for (const photo of photoUrls) {
            try {
                const response = await axios_1.default.get(photo.url, { responseType: 'arraybuffer', timeout: 10000 });
                archive.append(Buffer.from(response.data), { name: `photos/${photo.filename}` });
            }
            catch (err) {
                console.warn(`Failed to download photo: ${photo.url}`);
            }
        }
        await archive.finalize();
    }
    catch (error) {
        console.error('Export failed:', error);
        res.status(500).json({ error: 'Export failed: ' + error.message });
    }
};
exports.exportCustomersWithPhotos = exportCustomersWithPhotos;
// Импорт клиентов из ZIP с фотографиями
const importCustomersFromZip = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const results = {
            customersCreated: 0,
            customersUpdated: 0,
            cardsCreated: 0,
            itemsCreated: 0,
            photosUploaded: 0,
            errors: []
        };
        // Создаём временную директорию
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'customer-import-'));
        const photosDir = path.join(tempDir, 'photos');
        try {
            // Распаковываем ZIP
            const zipStream = stream_1.Readable.from(req.file.buffer);
            await new Promise((resolve, reject) => {
                zipStream
                    .pipe(unzipper_1.default.Extract({ path: tempDir }))
                    .on('close', resolve)
                    .on('error', reject);
            });
            // Ищем Excel файл
            const files = fs.readdirSync(tempDir);
            const excelFile = files.find(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
            if (!excelFile) {
                throw new Error('Excel файл не найден в архиве');
            }
            const workbook = XLSX.readFile(path.join(tempDir, excelFile));
            // Читаем лист "Клиенты"
            const customersSheet = workbook.Sheets['Клиенты'] || workbook.Sheets[workbook.SheetNames[0]];
            const customersData = XLSX.utils.sheet_to_json(customersSheet, { header: 1 });
            // Читаем лист "Карточки"
            const cardsSheet = workbook.Sheets['Карточки'] || workbook.Sheets[workbook.SheetNames[1]];
            const cardsData = cardsSheet ? XLSX.utils.sheet_to_json(cardsSheet, { header: 1 }) : [];
            // Импортируем клиентов
            for (let i = 1; i < customersData.length; i++) {
                const row = customersData[i];
                if (!row || !row[0])
                    continue;
                const code = String(row[0]).trim();
                const name = String(row[1] || '').trim();
                if (!code || !name)
                    continue;
                try {
                    const customerData = {
                        code,
                        name,
                        legalName: row[2] ? String(row[2]).trim() : null,
                        inn: row[3] ? String(row[3]).trim().slice(0, 9) : null,
                        telegramGroupName: row[4] ? String(row[4]).trim() : null,
                        telegramGroupUsername: row[5] ? String(row[5]).trim() : null,
                        districtId: row[6] ? String(row[6]).trim() : null,
                        managerId: row[7] ? String(row[7]).trim() : null,
                    };
                    const existing = await db_1.prisma.customer.findUnique({ where: { code } });
                    if (existing) {
                        await db_1.prisma.customer.update({ where: { code }, data: customerData });
                        results.customersUpdated++;
                    }
                    else {
                        await db_1.prisma.customer.create({ data: customerData });
                        results.customersCreated++;
                    }
                }
                catch (err) {
                    results.errors.push(`Клиент ${code}: ${err.message}`);
                }
            }
            // Импортируем карточки с фото
            const cardCache = new Map();
            for (let i = 1; i < cardsData.length; i++) {
                const row = cardsData[i];
                if (!row || !row[0])
                    continue;
                const customerCode = String(row[0]).trim();
                const cardName = String(row[1] || 'Основной ассортимент').trim();
                const productCode = String(row[2] || '').trim();
                const description = row[4] ? String(row[4]).trim() : null;
                const photoFiles = [row[5], row[6], row[7]].filter(f => f && String(f).trim());
                if (!customerCode || !productCode)
                    continue;
                try {
                    const customer = await db_1.prisma.customer.findUnique({ where: { code: customerCode } });
                    if (!customer) {
                        results.errors.push(`Карточка строка ${i + 1}: Клиент ${customerCode} не найден`);
                        continue;
                    }
                    const product = await db_1.prisma.product.findUnique({ where: { code: productCode } });
                    if (!product) {
                        results.errors.push(`Карточка строка ${i + 1}: Товар ${productCode} не найден`);
                        continue;
                    }
                    // Получаем или создаём карточку
                    const cacheKey = `${customerCode}_${cardName}`;
                    let cardId = cardCache.get(cacheKey);
                    if (!cardId) {
                        let card = await db_1.prisma.customerCard.findFirst({
                            where: { customerId: customer.id, name: cardName }
                        });
                        if (!card) {
                            card = await db_1.prisma.customerCard.create({
                                data: { customerId: customer.id, name: cardName }
                            });
                            results.cardsCreated++;
                        }
                        cardId = card.id;
                        cardCache.set(cacheKey, cardId);
                    }
                    // Создаём или обновляем позицию карточки
                    const item = await db_1.prisma.customerCardItem.upsert({
                        where: {
                            cardId_productId: { cardId, productId: product.id }
                        },
                        update: { description },
                        create: {
                            cardId,
                            productId: product.id,
                            description,
                            sortOrder: i
                        }
                    });
                    results.itemsCreated++;
                    // Добавляем фото из архива
                    if (fs.existsSync(photosDir)) {
                        for (let photoIdx = 0; photoIdx < photoFiles.length; photoIdx++) {
                            const photoFilename = String(photoFiles[photoIdx]).trim();
                            const photoPath = path.join(photosDir, photoFilename);
                            if (fs.existsSync(photoPath)) {
                                // Читаем файл и сохраняем как base64 URL или загружаем на сервер
                                // Для простоты сохраняем как data URL
                                const photoData = fs.readFileSync(photoPath);
                                const ext = path.extname(photoFilename).toLowerCase();
                                const mimeType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
                                const dataUrl = `data:${mimeType};base64,${photoData.toString('base64')}`;
                                // Проверяем, есть ли уже такое фото
                                const existingPhoto = await db_1.prisma.customerCardItemPhoto.findFirst({
                                    where: { itemId: item.id, sortOrder: photoIdx }
                                });
                                if (existingPhoto) {
                                    await db_1.prisma.customerCardItemPhoto.update({
                                        where: { id: existingPhoto.id },
                                        data: { url: dataUrl }
                                    });
                                }
                                else {
                                    await db_1.prisma.customerCardItemPhoto.create({
                                        data: {
                                            itemId: item.id,
                                            url: dataUrl,
                                            sortOrder: photoIdx
                                        }
                                    });
                                }
                                results.photosUploaded++;
                            }
                        }
                    }
                }
                catch (err) {
                    results.errors.push(`Карточка строка ${i + 1}: ${err.message}`);
                }
            }
        }
        finally {
            // Очищаем временную директорию
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        res.json({
            success: true,
            message: `Импорт завершён: ${results.customersCreated} клиентов создано, ${results.customersUpdated} обновлено, ${results.cardsCreated} карточек, ${results.itemsCreated} позиций, ${results.photosUploaded} фото`,
            ...results
        });
    }
    catch (error) {
        console.error('ZIP Import failed:', error);
        res.status(500).json({ error: 'Import failed: ' + error.message });
    }
};
exports.importCustomersFromZip = importCustomersFromZip;
