# План реализации: Производство — "Загрузить из закупа"

## Обзор

Доработка модуля Производство для связи с модулем Закупки:
- Кнопка «Загрузить из закупа» подтягивает сырьё из закупок
- Левая часть UI показывает загруженное сырьё
- Третья часть UI — разделка по MML (техкарте)

---

## ФАЗА 1: Изменения в базе данных

### 1.1. Новая модель: `ProductionDoc` (документ производства)

```prisma
model ProductionDoc {
  id              Int       @id @default(autoincrement())
  date            DateTime  @db.Date  // Дата производства
  warehouseId     Int       // FK → Warehouse (склад-приёмник)
  status          String    @default("draft")  // draft / loaded / cutting / done / canceled
  createdByUserId Int       // FK → User
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  warehouse       Warehouse @relation(fields: [warehouseId], references: [id])
  createdBy       User      @relation("ProductionDocCreator", fields: [createdByUserId], references: [id])
  inputs          ProductionInput[]
  outputs         ProductionOutput[]
  cuttingLines    ProductionCuttingLine[]
  
  @@unique([date, warehouseId])  // Один документ на дату и склад
  @@index([date])
  @@index([status])
}
```

### 1.2. Новая модель: `ProductionInput` (входные партии сырья)

```prisma
model ProductionInput {
  id              Int       @id @default(autoincrement())
  productionDocId Int       // FK → ProductionDoc
  purchaseId      Int       // FK → Purchase (документ закупки)
  purchaseItemId  Int       // FK → PurchaseItem (конкретная строка закупа)
  productId       Int       // FK → Product
  warehouseId     Int       // FK → Warehouse
  qtyIn           Decimal   @db.Decimal(14, 3)  // Кол-во загружено
  qtyUsed         Decimal   @default(0) @db.Decimal(14, 3)  // Сколько уже использовано
  priceIn         Decimal?  @db.Decimal(14, 2)  // Закупочная цена (опционально)
  loadedAt        DateTime  @default(now())
  loadedByUserId  Int       // FK → User
  
  productionDoc   ProductionDoc @relation(fields: [productionDocId], references: [id], onDelete: Cascade)
  purchase        Purchase      @relation(fields: [purchaseId], references: [id])
  purchaseItem    PurchaseItem  @relation(fields: [purchaseItemId], references: [id])
  product         Product       @relation("ProductionInputProduct", fields: [productId], references: [id])
  warehouse       Warehouse     @relation(fields: [warehouseId], references: [id])
  loadedBy        User          @relation("ProductionInputLoader", fields: [loadedByUserId], references: [id])
  cuttingLines    ProductionCuttingLine[]
  
  @@unique([productionDocId, purchaseItemId])  // Одна позиция закупа = один раз в документе
  @@index([productionDocId])
  @@index([purchaseItemId])
  @@index([productId])
}
```

### 1.3. Новая модель: `ProductionOutput` (выход после разделки)

```prisma
model ProductionOutput {
  id              Int       @id @default(autoincrement())
  productionDocId Int       // FK → ProductionDoc
  productId       Int       // FK → Product (выходная часть/товар)
  qtyOut          Decimal   @db.Decimal(14, 3)  // Количество выхода
  uom             String    @default("kg")  // Ед. измерения (kg / pcs)
  costTotal       Decimal?  @db.Decimal(14, 2)  // Себестоимость общая
  costPerUnit     Decimal?  @db.Decimal(14, 4)  // Себестоимость за единицу
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  productionDoc   ProductionDoc @relation(fields: [productionDocId], references: [id], onDelete: Cascade)
  product         Product       @relation("ProductionOutputProduct", fields: [productId], references: [id])
  
  @@unique([productionDocId, productId])  // Один товар = одна строка выхода
  @@index([productionDocId])
  @@index([productId])
}
```

### 1.4. Новая модель: `ProductionCuttingLine` (линии разделки по MML)

```prisma
model ProductionCuttingLine {
  id                Int       @id @default(autoincrement())
  productionDocId   Int       // FK → ProductionDoc
  productionInputId Int       // FK → ProductionInput (из какой партии сырья)
  mmlId             Int       // FK → ProductionMml (какой MML применён)
  outProductId      Int       // FK → Product (выходной товар)
  qtyOut            Decimal   @db.Decimal(14, 3)  // Кол-во выхода
  qtyInConsumed     Decimal   @db.Decimal(14, 3)  // Сколько сырья съело
  createdAt         DateTime  @default(now())
  createdByUserId   Int       // FK → User
  
  productionDoc     ProductionDoc     @relation(fields: [productionDocId], references: [id], onDelete: Cascade)
  productionInput   ProductionInput   @relation(fields: [productionInputId], references: [id])
  mml               ProductionMml     @relation(fields: [mmlId], references: [id])
  outProduct        Product           @relation("CuttingLineOutput", fields: [outProductId], references: [id])
  createdBy         User              @relation("CuttingLineCreator", fields: [createdByUserId], references: [id])
  
  @@index([productionDocId])
  @@index([productionInputId])
  @@index([mmlId])
}
```

### 1.5. Обновление существующих моделей

```prisma
// В модель PurchaseItem добавить:
model PurchaseItem {
  // ... существующие поля ...
  
  // Связь с производством
  productionInputs  ProductionInput[]
}

// В модель Purchase добавить:
model Purchase {
  // ... существующие поля ...
  
  // Связь с производством
  productionInputs  ProductionInput[]
}

// В модель Warehouse добавить:
model Warehouse {
  // ... существующие поля ...
  
  productionDocs      ProductionDoc[]
  productionInputs    ProductionInput[]
}

// В модель User добавить:
model User {
  // ... существующие поля ...
  
  productionDocs      ProductionDoc[]     @relation("ProductionDocCreator")
  productionInputs    ProductionInput[]   @relation("ProductionInputLoader")
  cuttingLines        ProductionCuttingLine[] @relation("CuttingLineCreator")
}

// В модель Product добавить:
model Product {
  // ... существующие поля ...
  
  productionInputs    ProductionInput[]   @relation("ProductionInputProduct")
  productionOutputs   ProductionOutput[]  @relation("ProductionOutputProduct")
  cuttingLineOutputs  ProductionCuttingLine[] @relation("CuttingLineOutput")
}

// В модель ProductionMml добавить:
model ProductionMml {
  // ... существующие поля ...
  
  cuttingLines  ProductionCuttingLine[]
}
```

---

## ФАЗА 2: Backend API

### 2.1. Новый контроллер: `productionDoc.controller.ts`

**Эндпоинты:**

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/production-docs` | Список документов (с фильтрами) |
| GET | `/api/production-docs/:id` | Получить документ с inputs/outputs |
| POST | `/api/production-docs` | Создать документ |
| PUT | `/api/production-docs/:id` | Обновить документ |
| DELETE | `/api/production-docs/:id` | Удалить (только draft) |
| POST | `/api/production-docs/:id/load-from-purchase` | **Загрузить из закупа** |
| POST | `/api/production-docs/:id/clear-inputs` | Очистить загруженное сырьё |
| POST | `/api/production-docs/:id/apply-cutting` | Применить разделку по MML |
| POST | `/api/production-docs/:id/finalize` | Провести документ (status → done) |
| POST | `/api/production-docs/:id/cancel` | Отменить документ |

### 2.2. Алгоритм "Загрузить из закупа"

```typescript
async function loadFromPurchase(docId: number, params: {
  dateFrom?: Date;
  dateTo?: Date;
  purchaseId?: number;
  supplierId?: number;
}) {
  // 1. Проверить статус документа
  const doc = await prisma.productionDoc.findUnique({ where: { id: docId } });
  if (!doc || doc.status === 'done' || doc.status === 'canceled') {
    throw new Error('Документ недоступен для загрузки');
  }
  
  // 2. Получить подходящие позиции закупа
  const purchaseItems = await prisma.purchaseItem.findMany({
    where: {
      purchase: {
        purchaseDate: {
          gte: params.dateFrom || doc.date,
          lte: params.dateTo || doc.date,
        },
        isDisabled: false,
        ...(params.purchaseId ? { id: params.purchaseId } : {}),
      },
      ...(params.supplierId ? { supplierId: params.supplierId } : {}),
    },
    include: { purchase: true, product: true },
  });
  
  // 3. Для каждой позиции вычислить остаток
  for (const item of purchaseItems) {
    const alreadyLoaded = await prisma.productionInput.aggregate({
      where: { purchaseItemId: item.id },
      _sum: { qtyIn: true },
    });
    
    const availableQty = item.qty - (alreadyLoaded._sum.qtyIn || 0);
    if (availableQty <= 0) continue;
    
    // 4. Upsert в production_input
    await prisma.productionInput.upsert({
      where: {
        productionDocId_purchaseItemId: {
          productionDocId: docId,
          purchaseItemId: item.id,
        },
      },
      create: {
        productionDocId: docId,
        purchaseId: item.purchaseId,
        purchaseItemId: item.id,
        productId: item.productId,
        warehouseId: doc.warehouseId,
        qtyIn: availableQty,
        priceIn: item.price,
        loadedByUserId: currentUserId,
      },
      update: {
        qtyIn: availableQty,
        priceIn: item.price,
      },
    });
  }
  
  // 5. Обновить статус документа
  await prisma.productionDoc.update({
    where: { id: docId },
    data: { status: 'loaded' },
  });
}
```

### 2.3. Алгоритм "Применить разделку по MML"

```typescript
async function applyCutting(docId: number, cuttingData: {
  inputId: number;
  mmlId: number;
  outputs: { productId: number; qtyOut: number }[];
}) {
  const input = await prisma.productionInput.findUnique({
    where: { id: cuttingData.inputId },
  });
  
  const qtyAvailable = input.qtyIn - input.qtyUsed;
  const totalConsumed = cuttingData.outputs.reduce((sum, o) => sum + o.qtyOut, 0);
  
  if (totalConsumed > qtyAvailable) {
    throw new Error(`Недостаточно сырья. Доступно: ${qtyAvailable}, запрошено: ${totalConsumed}`);
  }
  
  // Создать линии разделки
  for (const output of cuttingData.outputs) {
    await prisma.productionCuttingLine.create({
      data: {
        productionDocId: docId,
        productionInputId: input.id,
        mmlId: cuttingData.mmlId,
        outProductId: output.productId,
        qtyOut: output.qtyOut,
        qtyInConsumed: output.qtyOut, // упрощённо 1:1
        createdByUserId: currentUserId,
      },
    });
    
    // Обновить/создать ProductionOutput
    await prisma.productionOutput.upsert({
      where: {
        productionDocId_productId: { productionDocId: docId, productId: output.productId },
      },
      create: {
        productionDocId: docId,
        productId: output.productId,
        qtyOut: output.qtyOut,
      },
      update: {
        qtyOut: { increment: output.qtyOut },
      },
    });
  }
  
  // Обновить qtyUsed в input
  await prisma.productionInput.update({
    where: { id: input.id },
    data: { qtyUsed: { increment: totalConsumed } },
  });
}
```

---

## ФАЗА 3: Frontend UI

### 3.1. Новая страница: `ProductionDocPage.tsx`

**Структура интерфейса (3 части):**

```
┌─────────────────────────────────────────────────────────────────┐
│  ШАПКА: Дата | Склад | Статус | [Загрузить из закупа] [Провести]│
├───────────────────────┬─────────────────────────────────────────┤
│ ЛЕВАЯ ЧАСТЬ           │ ПРАВАЯ ЧАСТЬ (3-я)                      │
│ Сырьё из закупа       │ Разделка по MML                         │
├───────────────────────┼─────────────────────────────────────────┤
│ ☐ Говядина            │ Выбор MML: [Говяжья туша v]             │
│   закуплено: 100 кг   │                                         │
│   доступно: 80 кг     │ ┌─────────────────────────────────────┐ │
│   цена: 450 ₽/кг      │ │ Вырезка      20%    16 кг           │ │
│   источник: Закупка#5 │ │ Лопатка      25%    20 кг           │ │
│                       │ │ Рёбра        15%    12 кг           │ │
│ ☐ Свинина             │ │ Фарш         30%    24 кг           │ │
│   закуплено: 50 кг    │ │ Кости        10%    8 кг            │ │
│   доступно: 50 кг     │ └─────────────────────────────────────┘ │
│   ...                 │                                         │
│                       │ Итого выход: 80 кг                      │
│                       │ [Применить разделку]                    │
└───────────────────────┴─────────────────────────────────────────┤
│ ВЫХОД (результат): товар | кол-во | себестоимость              │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2. Компоненты

1. **ProductionDocHeader** — шапка с датой, складом, статусом, кнопками
2. **ProductionInputList** — левая часть (список сырья из закупа)
3. **ProductionCuttingPanel** — правая часть (разделка по MML)
4. **ProductionOutputTable** — внизу (результат выхода)
5. **LoadFromPurchaseModal** — модалка для выбора параметров загрузки

---

## ФАЗА 4: Порядок реализации

### Этап 1: База данных (1-2 часа)
- [ ] Добавить модели в schema.prisma
- [ ] Запустить `prisma migrate dev`
- [ ] Проверить миграцию

### Этап 2: Backend API (2-3 часа)
- [ ] Создать `productionDoc.controller.ts`
- [ ] Создать `productionDoc.routes.ts`
- [ ] Реализовать CRUD для ProductionDoc
- [ ] Реализовать "Загрузить из закупа"
- [ ] Реализовать "Применить разделку"

### Этап 3: Frontend (3-4 часа)
- [ ] Создать `ProductionDocPage.tsx`
- [ ] Создать компоненты UI
- [ ] Интегрировать с API
- [ ] Тестирование

### Этап 4: Интеграция и тесты (1 час)
- [ ] E2E тестирование полного сценария
- [ ] Фикс багов
- [ ] Документация

---

## Риски и ограничения

1. **Валидация остатков** — критично проверять, что нельзя использовать больше, чем доступно
2. **Статусы документов** — нельзя редактировать закрытые документы
3. **Откат** — при отмене документа нужно восстанавливать остатки
4. **Производительность** — при большом количестве закупок оптимизировать запросы

---

## Готов к реализации?

Подтвердите начало работы, и я начну с **Фазы 1: Изменения в schema.prisma**.
