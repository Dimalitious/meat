# z99-erp Project Status
**Last Updated**: 2026-01-17 17:07 UTC+5

## 📝 Changelog

### 2026-01-17: Implemented Shipments Module
- **Feature**: Added "Shipments" (Expedition) module.
- **Schema**: New `Expeditor` model, added `expeditorId` to `Order`.
- **Backend**: CRUD for Expeditors, update order driver logic.
- **Frontend**: `/expeditors` (Master Data), `/shipments` (Logistics Dashboard).
- **Files**: `server/src/controllers/expeditors.controller.ts`, `client/src/pages/ShipmentsPage.tsx`, `client/src/pages/ExpeditorsPage.tsx`.

### 2026-01-17: Implemented Svod Module
- **Feature**: Added "Svod" (Production Summary) module.
- **Backend**: `GET /api/reports/svod` aggregates orders by product for a specific date.
- **Frontend**: New `/svod` page with table, Excel export, and print view.
- **Files**: `server/src/controllers/reports.controller.ts`, `client/src/pages/SvodPage.tsx`.

### 2026-01-17: Implemented Web Data Import
- **Feature**: Excel data import via Web UI.
- **Backend**: `POST /api/import/excel` using `multer` and `xlsx`.
- **Frontend**: New `/import` page with file upload and status reporting.
- **Logic**: Auto-creates/updates Products, Customers, Suppliers. Generates customer codes from names.
- **Files**: `server/src/controllers/import.controller.ts`, `client/src/pages/ImportPage.tsx`.

### 2026-01-17: Fix P2021 Error (Table Does Not Exist)
- **Problem**: Registration/login failed with `P2021: The table 'public.User' does not exist`
- **Root Cause**: `server/package.json` start script was missing `npx prisma db push`
- **Fix**: Changed start script from `node dist/index.js` to `npx prisma db push && node dist/index.js`
- **Commit**: `61437bc` - "fix: add prisma db push to start command"
- **Why it happened**: During previous debugging of Prisma 7 engine errors, the db push command was accidentally removed or never added back after downgrade to Prisma 6.8.2

---

## 🚀 Production URLs
| Service | URL | Status |
|---------|-----|--------|
| **Frontend** | https://z99.uz | ✅ Live |
| **Backend API** | https://backend.z99.uz | ✅ Live |
| **GitHub Repo** | z99-erp (monorepo) | ✅ Connected |

## 🛠 Tech Stack
- **Frontend**: React + Vite + TailwindCSS (Vercel)
- **Backend**: Node.js + Express + Prisma 6 (Railway)
- **Database**: PostgreSQL (Railway)
- **DNS**: Cloudflare

## ✅ Completed Phases

### Phase 1: Infrastructure & Auth
- [x] Backend setup (Express, TypeScript)
- [x] Prisma schema (User, JWT auth)
- [x] Frontend React app with routing
- [x] Login page + AuthContext

### Phase 2: Master Data
- [x] Models: Product, Customer, Supplier, District, Manager
- [x] CRUD APIs for all entities
- [x] Frontend pages: Products, Customers, Suppliers

### Phase 3: Order Management
- [x] Order + OrderItem models
- [x] Order creation with line items
- [x] Orders list page

### Phase 4: Production Deployment
- [x] Git monorepo setup
- [x] Prisma 7 → 6 downgrade (compatibility fix)
- [x] Railway deployment with PostgreSQL
- [x] Vercel deployment with VITE_API_URL
- [x] Custom domains (z99.uz, backend.z99.uz)

## 📁 Key Files
| File | Purpose |
|------|---------|
| `client/src/config/api.ts` | API_URL configuration |
| `server/src/db.ts` | Prisma singleton |
| `server/prisma/schema.prisma` | Database schema |
| `server/src/controllers/reports.controller.ts` | **Reports Logic (Svod)** |

## 🔑 Environment Variables
**Railway (Backend)**:
- `DATABASE_URL` — PostgreSQL connection
- `JWT_SECRET` — Auth token secret

**Vercel (Frontend)**:
- `VITE_API_URL` = `https://backend.z99.uz`

## 📋 Phase 5 Roadmap (Revised for Operations)
| Priority | Task | Status |
|----------|------|--------|
| 1 | **Svod (Production Summary)** — Aggregation logic (Critical) | ✅ Done |
| 2 | **Shipments (Logistics)** — Driver assignment | ✅ Done |
| 3 | **Data Import** — Products, Customers from Excel | ✅ Done |
| 4 | **UI/UX Improvements** — Fix Tailwind, improve design | 🔄 In Progress |
| 5 | **Roles & Permissions (RBAC)** — Access control | ⏳ Queued |
| 6 | **Telegram Bot** — Notifications | ⏳ Queued |

## 🔄 How to Resume in New Chat
Copy this prompt:
```
Привет! Продолжаем работу над z99-erp.
Прочитай файл docs/PROJECT_STATUS.md в репозитории c:\gr.
Текущий статус: Frontend и Backend задеплоены.
Следующая задача: [опиши что нужно сделать]
```
