# Production Module v2 - Доработка с древовидной структурой MML

## Дата реализации
21.01.2026

## Обзор изменений

### Что изменилось:
1. **MML теперь хранит дерево** (корневые позиции + подпозиции)
2. **Удалена вкладка "Выработка"** — журнал становится выработкой
3. **Неограниченное количество строк** в MML (вместо фиксированных 5)
4. **Каскадная структура** для сложных техкарт

---

## Структура базы данных

### Новые таблицы:

```
ProductionMml (шапка MML)
├── id
├── productId (уникальный — один MML на товар)
├── createdBy (userId)
├── isLocked (зафиксирован)
└── nodes[] → ProductionMmlNode

ProductionMmlNode (узлы дерева)
├── id
├── mmlId
├── parentNodeId (NULL = корень, NOT NULL = подпозиция)
├── productId (товар узла)
├── sortOrder
└── children[] → ProductionMmlNode (самоссылка)

ProductionRun (документ выработки)
├── id
├── productId (что вырабатывается)
├── mmlId (какой MML)
├── userId (кто сделал)
├── isLocked (зафиксировано)
└── values[] → ProductionRunValue

ProductionRunValue (значения по узлам)
├── id
├── productionRunId
├── mmlNodeId
└── value (decimal)
```

---

## API Endpoints

### MML

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/production-v2/mml` | Список всех MML |
| GET | `/api/production-v2/mml/:id` | MML по ID с деревом |
| GET | `/api/production-v2/mml/product/:productId` | MML по productId |
| POST | `/api/production-v2/mml` | Создать MML |
| POST | `/api/production-v2/mml/:id/node` | Добавить корневой узел |
| POST | `/api/production-v2/mml/:id/node/:parentNodeId/child` | Добавить подпозицию |
| DELETE | `/api/production-v2/mml/node/:nodeId` | Удалить узел |
| PATCH | `/api/production-v2/mml/:id/lock` | Зафиксировать/разблокировать |

### Production Run (Выработка)

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/production-v2/runs` | Список выработок |
| GET | `/api/production-v2/runs/:id` | Выработка по ID с деревом значений |
| POST | `/api/production-v2/runs` | Создать выработку |
| PUT | `/api/production-v2/runs/:id/values` | Сохранить значения |
| PATCH | `/api/production-v2/runs/:id/lock` | Зафиксировать/разблокировать |
| POST | `/api/production-v2/runs/:id/clone` | Клонировать |
| DELETE | `/api/production-v2/runs/:id` | Удалить |

---

## Развёртывание

### 1. Применить миграцию БД

```bash
cd d:\meatpr\meat\server
npx prisma db push
npx prisma generate
```

### 2. Перезапустить сервер

```bash
npm run dev
```

---

## Примеры API

### Создать MML для товара
```bash
POST /api/production-v2/mml
Content-Type: application/json
Authorization: Bearer <token>

{
    "productId": 123
}
```

### Добавить корневую позицию
```bash
POST /api/production-v2/mml/1/node
Content-Type: application/json

{
    "productId": 456
}
```

### Добавить подпозицию
```bash
POST /api/production-v2/mml/1/node/5/child
Content-Type: application/json

{
    "productId": 789
}
```

### Создать выработку
```bash
POST /api/production-v2/runs
Content-Type: application/json

{
    "productId": 123
}
```

### Сохранить значения выработки
```bash
PUT /api/production-v2/runs/1/values
Content-Type: application/json

{
    "values": [
        { "mmlNodeId": 5, "value": 10.5 },
        { "mmlNodeId": 6, "value": 3.2 }
    ]
}
```

---

## Миграция старых данных

Если есть данные в старых таблицах (`ProductionMmlItem`, `ProductionBatch`, `ProductionBatchItem`), нужно:

1. Экспортировать старые данные
2. Преобразовать в новую структуру
3. Импортировать

**Рекомендация:** Оставить старые таблицы как есть (для истории), использовать новые для нового функционала.

---

## Фронтенд (TODO)

Нужно обновить:
- `ProductionPage.tsx` — удалить таб "Выработка"  
- Обновить MML-вкладку для работы с деревом
- Обновить журнал для отображения дерева с полями ввода
