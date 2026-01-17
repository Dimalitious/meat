# Functional Gap Analysis

**Date**: 2026-01-17
**Legacy Source**: `c:\gr\legacy`
**Current System**: `z99-erp` (v1.0 Production)

## 📊 Summary
The current production system (`z99-erp`) successfully implements the **Core Foundation** (Auth, Master Data, Order Entry). However, a significant portion of the business logic responsible for **Production, Warehouse, and Finance** exists in the legacy code but is missing from the new system.

---

## 🛑 Missing Modules (Gap Analysis)

### 1. Production Planning (Critical)
*Legacy Files: `svod.html`, `svod.js`, `dashboard-svod.html`, `journal-svod.html`*
- **Legacy Functionality**: Aggregating all orders for a specific date to calculate total production volume (Svod).
- **Current Status**: ✅ Implemented (v1.1). API aggregates orders, frontend displays summary table.
- **Priority**: 🔥 High (Production cannot work without knowing *how much* to cook).

### 2. Manufacturing & Assembly
*Legacy Files: `production.html`, `assembly.html`, `dobor.html`, `nedobor.html`*
- **Legacy Functionality**: Converting raw materials into finished goods; tracking "Dobor" (extra production) and "Nedobor" (shortages).
- **Current Status**: ❌ Missing.
- **Priority**: 🔥 High.

### 3. Warehouse & Inventory
*Legacy Files: `storage.js`, `material.html`, `purchases.html`, `journal-purchases.html`*
- **Legacy Functionality**: Raw material inventory, stock updates, purchasing logs.
- **Current Status**: ❌ Missing. No inventory tracking.
- **Priority**: 🟡 Medium (depends on business need to track raw materials).

### 4. Logistics & Shipments
*Legacy Files: `shipments.html`, `expeditors.html`, `journal-shipments.html`*
- **Legacy Functionality**: Assigning orders to drivers (expeditors), tracking delivery status.
- **Current Status**: ✅ Implemented (v1.2). Expeditor management and shipment assignment.
- **Priority**: 🟡 Medium.

### 5. Finance & Reporting
*Legacy Files: `price.html`, `calculation.html`, `report-pnl.html`, `pricelist-shipment.html`*
- **Legacy Functionality**: Dynamic pricing, cost calculation, Profit & Loss reports.
- **Current Status**: ❌ Missing.
- **Priority**: 🟢 Low (can be done manually for now).

---

## 🗺️ Recommended Roadmap (Revised Phase 5)

We should temporarily pause "UI Beautification" and focus on **Operational Criticality**:

### Step 1: "Svod" (Production Summary)
**Goal**: Allow the kitchen to see *what* to make for tomorrow.
- Create `Svod` calculation logic (sum of `OrderItems` by `Product` for a `Date`).
- Create `SvodPage` for production staff.

### Step 2: Expedition (Logistics)
**Goal**: Ship the food.
- Implement `Expeditor` master data.
- Create `ShipmentPage`: Assign orders to expeditors.
- Generate delivery sheets (or Telegram messages).

### Step 3: Production/Assembly
**Goal**: Track what was actually made vs ordered.
- Implement "Fact vs Plan" entry.

---

## 📝 User Action Required
Please review this list. Does the business **urgently** need the "Svod" (Production Summary) and "Shipments" module to operate daily?
If yes, we should shift focus from UI to building the **Svod** module immediately.
