# Project Analysis: ERP System

## Overview

This project is a web-based **ERP (Enterprise Resource Planning) System** designed to manage various business processes such as:

- **Orders and Shipments**
- **Production and Storage**
- **Customers and Suppliers**
- **Reports (PnL, Materials, Production)**
- **User Administration**

## Technology Stack

The application is built using a **pure "Vanilla" stack**, meaning it does not rely on complex frameworks or build tools.

- **HTML5:** Structure of the pages. Each module (e.g., `orders.html`, `production.html`) has its own HTML file.
- **CSS3:** Styling using native CSS variables (`:root`), Flexbox, and Grid. No external CSS framework (like Bootstrap or Tailwind) is used, although class names mimic Bootstrap conventions (e.g., `.btn-primary`).
- **JavaScript (ES6+):** Logic for interactivity and data manipulation. The code uses modern features like Arrow Functions, `const`/`let`, and `Modules` concepts (though implemented via script tags).

## Data Persistence & Architecture (CRITICAL)

**Current State:**
The application uses **Browser `localStorage`** as its "database". This is defined in `storage.js`.

**Implications:**

- **Single-Device Access:** Data stored in the ERP is **local to the specific browser and computer** where it is opened.
- **No Real-Time Sync:** If "User A" adds an order on their computer, "User B" (e.g., the Production Manager) **will NOT see it** on their computer.
- **Deployment Behavior:** If you deploy this to a public URL (like Vercel), **every visitor will see their own empty database**. It acts like a "Single Player" application.

**Files of Interest:**

- `storage.js`: The core data layer. Handles reading/writing to `localStorage` for all entities (Products, Orders, Users, etc.).
- `styles.css`: The global stylesheet containing the design system (Dark mode theme).
- `sidebar.js`: Handles the navigation menu rendering across different HTML pages.
- `admin.html` / `admin.js`: User management (creating accounts, assigning roles). *Note: Even these "accounts" are stored locally.*

## Structure

The project uses a flat file structure.

- `*.html`: Views for each section.
- `*.js`: Logic corresponding to each view (e.g., `orders.js` controls `orders.html`).
- `storage.js`: Shared library for data access.
- `styles.css`: Shared library for visual styles.

## Recommendation for Future

To make this a true multi-user ERP where managers and workers see the same live data, you will need to:

1. **Backend Migration:** Replace `storage.js` logic to call a real API (e.g., Node.js/Express, Python/Django, or Firebase).
2. **Database:** Store data in a centralized database (PostgreSQL, MongoDB, or Firebase Firestore) instead of `localStorage`.
