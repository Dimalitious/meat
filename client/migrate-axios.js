/**
 * Скрипт миграции axios на централизованный api инстанс
 * 
 * Запуск: node migrate-axios.js
 * 
 * Что делает:
 * 1. Заменяет импорты axios и API_URL на import api from '../config/axios'
 * 2. Заменяет axios.get/post/put/delete на api.get/post/put/delete
 * 3. Заменяет ${API_URL}/api/xxx на /api/xxx
 * 4. Убирает ручное добавление токена (headers: { Authorization: ... })
 * 5. Убирает const token = localStorage.getItem('token')
 */

const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, 'src', 'pages');

// Файлы для пропуска (уже мигрированы или особые случаи)
const SKIP_FILES = [
    'ProductsPage.tsx', // Уже мигрирован
    'LoginPage.tsx',    // Использует свой axios инстанс без interceptors
];

function migrateFile(filePath) {
    const fileName = path.basename(filePath);

    if (SKIP_FILES.includes(fileName)) {
        console.log(`⏭️  Пропуск: ${fileName}`);
        return { skipped: true };
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let changes = [];

    // 1. Заменяем импорты
    // import axios from 'axios'; + import { API_URL } from '../config/api';
    // -> import api from '../config/axios';

    const hasAxiosImport = content.includes("import axios from 'axios'");
    const hasApiUrlImport = content.includes("import { API_URL } from '../config/api'");

    if (!hasAxiosImport) {
        console.log(`⏭️  Пропуск (нет axios): ${fileName}`);
        return { skipped: true };
    }

    // Удаляем старые импорты и добавляем новый
    content = content.replace(/import axios from 'axios';\r?\n?/g, '');
    content = content.replace(/import \{ API_URL \} from '\.\.\/config\/api';\r?\n?/g, '');

    // Добавляем новый импорт после первого import
    const firstImportMatch = content.match(/^(import .+;\r?\n)/m);
    if (firstImportMatch) {
        const insertPos = firstImportMatch.index + firstImportMatch[0].length;
        content = content.slice(0, insertPos) + "import api from '../config/axios';\n" + content.slice(insertPos);
        changes.push('Заменены импорты на api');
    }

    // 2. Заменяем axios.get/post/put/delete на api.get/post/put/delete
    const axiosMethodPattern = /axios\.(get|post|put|delete|patch)/g;
    if (axiosMethodPattern.test(content)) {
        content = content.replace(axiosMethodPattern, 'api.$1');
        changes.push('axios.xxx -> api.xxx');
    }

    // 3. Заменяем ${API_URL}/api/xxx на /api/xxx
    content = content.replace(/`\$\{API_URL\}(\/api\/[^`]+)`/g, "'$1'");
    content = content.replace(/\$\{API_URL\}\/api\//g, '/api/');
    if (content !== originalContent) {
        changes.push('${API_URL}/api/xxx -> /api/xxx');
    }

    // 4. Убираем headers: { Authorization: `Bearer ${token}` }
    // Паттерны:
    // , { headers: { Authorization: `Bearer ${token}` } }
    // , {\n                headers: { Authorization: `Bearer ${token}` }\n            }
    content = content.replace(/,\s*\{\s*headers:\s*\{\s*Authorization:\s*`Bearer \$\{token\}`\s*\}\s*\}/g, '');

    // Для случаев когда headers внутри объекта с другими параметрами
    content = content.replace(/,?\s*headers:\s*\{\s*Authorization:\s*`Bearer \$\{token\}`\s*\}/g, '');

    // 5. Убираем const token = localStorage.getItem('token');
    content = content.replace(/\s*const token = localStorage\.getItem\('token'\);\r?\n?/g, '\n');

    // 6. Исправляем двойные запятые и пустые объекты
    content = content.replace(/,\s*,/g, ',');
    content = content.replace(/\(\s*,\s*/g, '(');
    content = content.replace(/,\s*\)/g, ')');

    // Убираем пустые объекты в конце вызовов: api.post('/url', data, {})
    content = content.replace(/,\s*\{\s*\}\s*\)/g, ')');

    if (content === originalContent) {
        console.log(`⏭️  Без изменений: ${fileName}`);
        return { unchanged: true };
    }

    // Записываем изменения
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Мигрирован: ${fileName} (${changes.join(', ')})`);
    return { migrated: true, changes };
}

function main() {
    console.log('🚀 Миграция axios на централизованный api инстанс\n');
    console.log(`📁 Директория: ${PAGES_DIR}\n`);

    const files = fs.readdirSync(PAGES_DIR)
        .filter(f => f.endsWith('.tsx'))
        .map(f => path.join(PAGES_DIR, f));

    let stats = { migrated: 0, skipped: 0, unchanged: 0 };

    for (const file of files) {
        const result = migrateFile(file);
        if (result.migrated) stats.migrated++;
        else if (result.skipped) stats.skipped++;
        else if (result.unchanged) stats.unchanged++;
    }

    console.log('\n📊 Результат:');
    console.log(`   ✅ Мигрировано: ${stats.migrated}`);
    console.log(`   ⏭️  Пропущено: ${stats.skipped}`);
    console.log(`   📄 Без изменений: ${stats.unchanged}`);
    console.log('\n⚠️  Рекомендуется проверить измененные файлы вручную!');
}

main();
