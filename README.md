# ERP — Enterprise Multi-Tenant ERP SaaS

A full-scale, multi-tenant ERP platform with an **accounting engine (double-entry)**, **manufacturing/MRP**, **CRM-lite + quotes**, **real-time infrastructure**, and a **formal, elegant dashboard** built for professional daily use. Built to be e-commerce ready: future landing/storefront sites connect through per-tenant scoped API keys against the same API and database.

```
┌───────────────────────────────┐        ┌──────────────────────────────┐
│   frontend  Next.js 15 + MUI  │  WS    │        worker  BullMQ        │
│   App Router · Framer Motion  │◄──────►│   notifications · cron ·     │
│   SweetAlert2 · Tailwind      │        │   imports/exports · stats    │
└──────────────┬────────────────┘        └───────────────┬──────────────┘
               │ REST /api/v1 (JWT + tenant scope)       │ events (Redis)
┌──────────────▼────────────────┐        ┌───────────────▼──────────────┐
│        backend  Express       │        │      shared  @erp/shared     │
│   Mongoose · modular monolith │◄──────►│  TS types + zod schemas      │
│   RBAC · audit · 2FA · WS     │        │  single source of truth      │
└──────────────┬────────────────┘        └──────────────────────────────┘
               │
   ┌───────────▼───────────┐        ┌───────────▼───────────┐
   │    MongoDB (Mongoose) │        │   Redis (cache/bus)  │
   └───────────────────────┘        └───────────────────────┘
```

## Modules

| Module | Capabilities |
|---|---|
| Tenancy | Tenant provisioning, plan limits, per-tenant settings (currency, tax rate), full data isolation |
| Auth & Security | JWT login, granular RBAC roles, 2FA (TOTP), revocable sessions, scoped API keys for e-commerce |
| Catalog | Products, variants, batches (lot/expiry), barcodes, price lists, tax rules, reorder rules |
| Inventory | Multi-warehouse, immutable stock ledger, transfers (in-transit), adjustments, low-stock alerts |
| Sales | Quotes → orders state machine, payments, shipments, RMAs (returns/refunds), recurring invoices |
| Purchasing | Suppliers, purchase orders with approval chains, goods-received notes |
| Accounting | Chart of accounts, double-entry journal posting, trial balance, P&L, balance sheet, AR/AP aging, FX |
| Manufacturing | BOMs, work centers, work orders, material consumption, cost rollup, MRP suggestions |
| Finance | Expenses, expense claims with approval, multi-currency exchange rates |
| HR | Departments, employees, timesheets, shifts, attendance, leaves, payroll runs |
| System | Audit log (before/after diff), notifications, imports/exports (CSV/XLSX), feature flags |

## Repository structure

```
erp/
├── shared/       @erp/shared  — TypeScript types + zod schemas (single source of truth)
├── backend/      Express + Mongoose API, modular monolith, WebSockets
├── worker/       BullMQ consumers + cron jobs (notifications, imports, stats)
├── frontend/     Next.js App Router dashboard — MUI + SweetAlert2 + Framer Motion
├── infra/        Docker Compose (MongoDB, Redis) + environment templates
└── docs/         Full contract: data model, API, events, permissions, architecture
```

## Documentation (read these first)

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — full architecture preview: layers, tenancy, events, real-time, scaling
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — every Mongoose model, field, index, and relationship
- [`docs/API.md`](docs/API.md) — every REST endpoint group, methods, paths, and permissions
- [`docs/EVENTS.md`](docs/EVENTS.md) — event catalog for the async bus (order.placed, journal.posted, …)
- [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md) — granular permission catalog and role presets

## Tech stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript (strict), MUI (Material UI), SweetAlert2, Framer Motion, Tailwind CSS
- **Backend:** Node.js, Express, Mongoose, JWT, WebSockets (ws)
- **Async:** BullMQ + Redis (queue, cache, pub/sub), cron jobs
- **Data:** MongoDB 7 (transactions, compound tenant indexes), Redis 7
- **Tooling:** npm workspaces, `tsx` (dev), TypeScript strict, Docker Compose

## Getting started

```bash
# 1. Infra (MongoDB + Redis)
docker compose -f infra/docker-compose.yml up -d

# 2. Install
npm install

# 3. Environment
#    copy infra/.env.example values into backend/.env, worker/.env, frontend/.env.local

# 4. Run (three terminals)
npm run dev          # backend  → http://localhost:4000/api/v1/health
npm run dev:worker   # worker   (processes jobs)
npm run dev:frontend # frontend → http://localhost:3000

# 5. Verify types
npm run typecheck
```

## API at a glance

Base URL `/api/v1` — JSON responses, errors shaped `{ "error": string }`, JWT bearer auth, tenant isolation enforced by middleware. Full reference in [`docs/API.md`](docs/API.md).

| Group | Examples |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/signup`, `POST /auth/2fa/verify`, `DELETE /auth/sessions/:id` |
| Dashboard | `GET /dashboard/stats?from&to`, `GET /dashboard/approvals`, `GET /dashboard/alerts` |
| Catalog | `GET/POST /products`, `GET/PATCH /products/:id`, `GET/POST /categories`, `POST /products/:id/stock-adjust` |
| Inventory | `GET/POST /warehouses`, `POST /warehouses/transfer`, `GET /inventory/low-stock`, `GET /products/:id/movements` |
| Sales | `GET/POST /quotes`, `GET/POST /orders`, `PATCH /orders/:id/status`, `POST /orders/:id/payments`, `GET/POST /shipments`, `GET/POST /rmas`, `GET/POST /recurring-invoices` |
| Purchasing | `GET/POST /suppliers`, `GET/POST /purchase-orders`, `POST /purchase-orders/:id/approve`, `POST /purchase-orders/:id/receive` |
| Accounting | `GET /accounts`, `POST /journal-entries`, `GET /reports/trial-balance`, `GET /reports/pnl`, `GET /reports/balance-sheet`, `GET /reports/aging` |
| Manufacturing | `GET/POST /boms`, `GET/POST /work-centers`, `GET/POST /work-orders`, `POST /work-orders/:id/receive`, `GET /mrp/suggestions` |
| Finance | `GET/POST /expenses`, `GET/POST /expense-claims`, `GET/PATCH /exchange-rates` |
| HR | `GET/POST /employees`, `GET/POST /attendance`, `GET/POST /leaves`, `GET/POST /payroll/runs` |
| System | `GET /audit-logs`, `GET /notifications`, `POST /imports`, `GET /exports` |

## Conventions

- TypeScript strict everywhere; no `any` unless justified
- `camelCase` variables/functions, `PascalCase` types/components, `kebab-case` files
- REST, JSON, error shape `{ error: string }`, proper status codes
- Mongoose schemas with validation; compound indexes starting with `tenantId`
- Secrets only in `.env` / `.env.local` — never committed
- No dead code, no "what" comments, no unused imports

## Roadmap

- [x] Phase 0 — scaffold, contract, design system foundation
- [ ] Phases 1–9 — backend modules (auth → catalog/inventory → sales → accounting → purchasing/manufacturing → HR → dashboard)
- [ ] Phase 10 — UI/UX design system polish
- [ ] Phase 11 — frontend shell + all pages
- [ ] Phase 12 — integration review, seed demo tenant, done criteria
- [ ] Post-v1 — e-commerce landing pages over per-tenant API keys, real email, dark mode