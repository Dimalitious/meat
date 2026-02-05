# ТЗ (RFC): Production V3 — Lot-based FIFO, Allocations, Closures, Adjustments, MML

**Версия:** 1.2.1  
**Статус:** Утверждено  
**Дата:** 2026-02-05

---

## 0. Цель

Система "Production V3" фиксирует факт производства (RUN), распределяет расход сырья по партиям закупок (FIFO allocations), считает статусы закрытий (LOT и PRODUCT closures), поддерживает корректировки (ADJUSTMENT) и управляет MML-структурами.

**Цель** — атомарность, конкурентная безопасность, аудит, строгое FIFO.

---

## 1. Термины

| Термин | Описание |
|--------|----------|
| **RUN** | Документ выработки (факт производства по продукту в дату) |
| **ADJUSTMENT (ADJ)** | Корректирующий документ (добавляет факт к отчётам) |
| **PurchaseItem** | Позиция закупки (лот/партия) |
| **Allocation** | Запись распределения веса документа по партиям |
| **LOT closure** | Статус закрытия конкретной партии |
| **PRODUCT closure** | Статус закрытия продукта на дату |
| **dayStart(D), dayEnd(D)** | Границы дня по Ташкенту (UTC+5) |

---

## 2. Ключевые решения

### 2.1. Источник правды
Единственный источник правды по доступности и расходу сырья — **allocations по партиям** (PurchaseItem).

### 2.2. Время и таймзона
Единая функция: `getTashkentDayRange(dateStr) -> {dayStart, dayEnd}`  
**Запрещено:** `setHours/setUTCHours` вне этой функции.

### 2.3. INVARIANTS (immutable rules)

> [!IMPORTANT]
> На code review можно ссылаться как **INV-x**

| ID | Правило |
|----|---------|
| **INV-1** | Доступность сырья = партии минус активные allocations. MaterialReport не участвует. |
| **INV-2** | Hide/void не удаляет историю. Старые allocations остаются как voided. |
| **INV-3** | Unhide = попытка перепроведения с пересборкой allocations. Нехватка → 400. |
| **INV-4** | Порядок документов внутри дня определяется `allocatedAt ASC`. |
| **INV-5** | Adjustments — такой же конкурентный потребитель партий, как runs. |
| **INV-6** | Recalc forward: `closures-only` или `rebuild-allocations` (manager). |
| **INV-7** | Concurrency: обязательно row-lock (FOR UPDATE) или denorm qtyRemaining. |
| **INV-8** | Posted документ полностью покрыт allocations или 400. Никаких овердрафтов. |

---

## 3. Политика неизменяемости

### 3.1. Закрытие дня
Если `ProductionClosure(P, D).status = closed`:
- Все RUN по `productionDate in D` для продукта P → **read-only** (для оператора)
- ADJ не "открывает" день

### 3.2. Изменение прошлых дат
Только через:
1. **Reopen** (manager) + редактирование
2. **ADJUSTMENT** (предпочтительно для аудита)

---

## 4. Модель данных

### 4.1. PurchaseItem (партия)
```prisma
model PurchaseItem {
  id            Int       @id @default(autoincrement())
  productId     Int
  qty           Decimal   @db.Decimal(14, 3)  // qtyPurchased
  purchaseDate  DateTime
  isDisabled    Boolean   @default(false)
  qtyRemaining  Decimal   @db.Decimal(14, 3)  // denorm (Mode B)
  // ... existing relations
}
```

### 4.2. ProductionRun (RUN)
```prisma
model ProductionRun {
  id              Int       @id @default(autoincrement())
  productId       Int
  mmlId           Int
  userId          Int
  productionDate  DateTime  // дата факта
  actualWeight    Decimal   @db.Decimal(14, 3)
  plannedWeight   Decimal?  @db.Decimal(14, 3)
  status          String    @default("draft")  // draft | posted
  isHidden        Boolean   @default(false)
  isLocked        Boolean   @default(false)
  version         Int?      // optimistic locking
  // ... relations
  allocations     ProductionAllocation[]
}
```

### 4.3. ProductionAdjustment (ADJ)
```prisma
model ProductionAdjustment {
  id              Int       @id @default(autoincrement())
  productId       Int
  adjustmentDate  DateTime  // FIFO/closures
  effectiveDate   DateTime  // только отчёты
  deltaWeight     Decimal   @db.Decimal(14, 3)  // >= 0
  status          String    @default("draft")  // draft | posted | voided
  isLocked        Boolean   @default(false)
  // ... relations
  allocations     ProductionAllocation[]
}
```

### 4.4. ProductionAllocation
```prisma
model ProductionAllocation {
  id              Int       @id @default(autoincrement())
  sourceType      String    // RUN | ADJ
  sourceId        Int       // runId или adjId
  purchaseItemId  Int
  productId       Int       // denorm, MUST == document.productId
  qtyAllocated    Decimal   @db.Decimal(14, 3)
  allocatedAt     DateTime  @default(now())  // порядок (INV-4)
  isVoided        Boolean   @default(false)
  voidedAt        DateTime?
  voidReason      String?

  purchaseItem    PurchaseItem @relation(...)
  
  @@index([purchaseItemId, isVoided])
  @@index([productId, allocatedAt, isVoided])
  @@index([sourceType, sourceId])
}
```

### 4.5. Closures
Существующие модели остаются:
- `ProductionLotClosure` — по purchaseItemId
- `ProductionClosure` — по (productionDate, productId)
- `ProductionClosureAudit` — добавить новые action types: `POSTED`, `VOIDED`, `HIDDEN`, `UNHIDDEN`, `REBUILD_ALLOC`

---

## 5. Доступность закупки

> Закупка дня D доступна для выработки дня D **с начала дня D**.  
> FIFO видит партии: `purchaseDate < dayEnd(D)`

---

## 6. Допуски закрытий

```typescript
const PCT_TOL = 0.01;    // 1%
const ABS_TOL_KG = 0.3;  // 300 г
```

**LOT closure:**
```
closed IF qtyRemaining <= ABS_TOL_KG OR qtyRemaining/qtyPurchased <= PCT_TOL
```

**PRODUCT closure:**
```
closed IF abs(totalIn - totalProduced) <= ABS_TOL_KG 
       OR abs(totalIn - totalProduced)/totalIn <= PCT_TOL
```

---

## 7. FIFO Allocations

### 7.1. Общие требования
- FIFO: `purchaseDate ASC, purchaseItemId ASC`
- Учитываются все активные allocations (исключая voided)
- Сумма allocations = documentWeight, иначе 400 (INV-8)

### 7.2. Порядок документов (INV-4)
При пересборке: сортировка по `allocatedAt ASC`

### 7.3. Concurrency (INV-7)

**Режим B (рекомендуется):** Denorm `qtyRemaining` + условные UPDATE:
```sql
UPDATE purchase_item 
SET qty_remaining = qty_remaining - :take 
WHERE id = :id AND qty_remaining >= :take
```

> [!WARNING]
> При `rowsAffected = 0`: НЕ retry, перейти к следующей партии.  
> После обхода если `need > 0` → 400 INSUFFICIENT_AVAILABLE_QTY

### 7.4. Build allocations
```typescript
async function buildFifoAllocations(
  tx: Prisma.TransactionClient,
  productId: number,
  dayEnd: Date,
  documentWeight: Decimal
): Promise<Array<{purchaseItemId: number, qtyAllocated: Decimal}>>
```

---

## 8. Documents Lifecycle

### 8.1. RUN
| Переход | Правило |
|---------|---------|
| draft → posted | Создаёт allocations |
| posted → posted (repost) | Void старых + новые allocations. Только если day open и not locked |
| hide | isVoided=true для allocations. Исключает из totals |
| unhide | Repost. При нехватке → 400 |

### 8.2. ADJUSTMENT
| Переход | Правило |
|---------|---------|
| draft → posted | Создаёт allocations по adjustmentDate |
| voided | allocations → isVoided. Нельзя восстановить |

**effectiveDate vs adjustmentDate:**
- FIFO/closures используют `adjustmentDate`
- Отчёты используют `effectiveDate`

---

## 9. Reopen / Unlock / Recalc

### 9.1. unlockDocument (manager)
Снимает `isLocked`. Не пересчитывает.

### 9.2. reopenProductForDate (manager)
Переводит `ProductionClosure(P,D)` в open. Без каскада.

### 9.3. Recalc forward (INV-6)
| Mode | Описание |
|------|----------|
| `closures-only` | Пересчёт closures, без изменения allocations |
| `rebuild-allocations` | Пересборка allocations (manager). Locked документы пропускаются |

---

## 10. Closures: расчёты

### 10.1. recalcLotClosures
```typescript
recalcLotClosures(tx, purchaseItemIds[])
```
- `qtyProduced = Σ allocations.qtyAllocated WHERE isVoided=false`
- `qtyRemaining = qtyPurchased - qtyProduced`

### 10.2. Carryover
```
carryover(D) = Σ qtyRemaining 
               WHERE purchaseDate < dayStart(D) 
               AND isDisabled = false
```

---

## 11. Атомарность

Любое изменение → одна транзакция:
1. Изменение документа
2. Изменение allocations (create + void)
3. Изменение qtyRemaining
4. Пересчёт LOT closures
5. Пересчёт PRODUCT closure
6. Audit log

---

## 12. Роли

| Роль | Права |
|------|-------|
| **Operator** | create/post RUN (если day open), edit (если not locked), hide |
| **Manager** | + unhide, reopen, unlock, post/void ADJ, rebuild allocations, recalc |

---

## 13. API

### 13.1. RUN
```
POST /runs                    - create draft
POST /runs/:id/post           - draft→posted
POST /runs/:id/repost         - posted→posted (void+new)
PATCH /runs/:id/hide          - hide
PATCH /runs/:id/unhide        - unhide (manager, repost)
PATCH /runs/:id/lock          - lock toggle
```

### 13.2. ADJ
```
POST /adjustments             - create draft
PUT /adjustments/:id/post     - post
PATCH /adjustments/:id/void   - void (manager)
```

### 13.3. Recalc
```
POST /recalc-forward          - { mode: 'closures' | 'rebuild' }
POST /reopen-product          - { productId, date } (manager)
POST /unlock-document         - { type, id } (manager)
```

> [!CAUTION]
> **DELETE endpoints отсутствуют намеренно (P16)**

---

## 14. Индексы

```prisma
// Allocations
@@index([purchaseItemId, isVoided])
@@index([productId, allocatedAt, isVoided])
@@index([sourceType, sourceId])

// PurchaseItem (Mode B)
@@index([productId, qtyRemaining])
```

---

## 15. Миграция

### 15.1. Режим
Production → read-only на время миграции.

### 15.2. Алгоритм
1. По дням от earliest до latest
2. Для каждого дня и продукта: FIFO allocations

### 15.3. Нехватка партий
- `needsReview = true` на RUN
- Запись `MigrationIssue`
- **Запрещено:** автоматические "Unallocated Legacy" партии

### 15.4. Порядок при миграции
Если `allocatedAt` отсутствует:
```
recordedAt (если есть) → createdAt → id ASC
```

---

## 16. Ошибки

| Код | Описание |
|-----|----------|
| 400 INSUFFICIENT_AVAILABLE_QTY | needed, allocated, shortage, productId, date |
| 400 DAY_CLOSED | День закрыт для редактирования |
| 400 DOCUMENT_LOCKED | Документ заблокирован |
| 400 CANNOT_UNHIDE_INSUFFICIENT_QTY | Нехватка при unhide |
| 403 FORBIDDEN_ROLE | Недостаточно прав |
| 409 CONFLICT_VERSION | Optimistic lock conflict |

---

## Приложение A — Минимальные требования

> [!IMPORTANT]
> Если не выполнено — несоответствие ТЗ

- [ ] allocations в общей таблице с sourceType
- [ ] историчность через isVoided
- [ ] порядок по allocatedAt
- [ ] concurrency через FOR UPDATE или denorm qtyRemaining
- [ ] unhide = repost, 400 при shortage
- [ ] carryover только из партий
- [ ] отсутствие DELETE
