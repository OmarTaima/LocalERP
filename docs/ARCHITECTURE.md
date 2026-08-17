# Architecture — ERP SaaS

Full architecture preview for the whole project.

## 1. System context

Three deployables plus one shared contract package, orchestrated by npm workspaces:

```
┌────────────┐  REST /api/v1   ┌────────────┐  jobs/events   ┌────────────┐
│  frontend  │◄───────────────►│  backend   │◄──────────────►│   worker   │
│ (Next.js)  │   WebSocket     │  Express   │   (Redis)      │  BullMQ    │
└────────────┘                 └─────┬──────┘                └────────────┘
                                     │ Mongoose
                            ┌────────▼────────┐   ┌──────────────┐
                            │    MongoDB 7    │   │   Redis 7    │
                            └─────────────────┘   └──────────────┘
```

- **backend** — modular monolith. All API surface, auth, business rules, WebSockets.
- **worker** — consumes BullMQ queues (notifications, invoice side-effects, imports/exports, stats materialization) and cron jobs (low-stock digest, overdue invoices, FX sync).
- **frontend** — server-rendered Next.js dashboard; subscribes to WebSocket channel `/ws/tenant/:tenantId` for live updates.
- **shared** — pure TS package `@erp/shared`: model types + zod schemas, imported by all three. Single source of truth for the API contract.

## 2. Multi-tenancy

- Every collection carries `tenantId`. Compound indexes always start with `tenantId`.
- Signup provisions a `Tenant` + admin `User` atomically.
- JWT payload: `{ userId, tenantId, permissions }`.
- Middleware pipeline: `auth()` (verify JWT) → `tenant()` (resolve `tenantId` from token, reject mismatches on path params) → `rbac()` (permission check per route).
- **Isolation guarantee:** all queries are built through a tenant-scoped repository layer; a cross-tenant read is impossible by construction, not by convention.
- **E-commerce readiness:** `ApiKey` records (scoped, hashed at rest) let external landing sites authenticate as the tenant's public storefront with limited permissions (`catalog:read`, `sales:write`).

## 3. Event-driven core

Outbox-style events published to Redis (BullMQ queues + pub/sub):

| Concern | Mechanic |
|---|---|
| Async side-effects | BullMQ queues: `notifications`, `jobs:import`, `jobs:export`, `stats` |
| Live UI updates | Redis pub/sub → backend WS hub → `wss://…/ws/tenant/:tenantId` |
| Cron | BullMQ repeatable jobs: daily low-stock digest, overdue-invoice reminders, attendance checks, FX rate sync |

Event catalog: `docs/EVENTS.md`.

## 4. Transactional integrity

- Mongo **transactions** wrap cross-collection mutations: order fulfillment (stock decrement + movement + journal entry + payment), purchase receiving (inventory + GRN + journal), refunds (payment reversal + restock + reversal journal).
- **Optimistic locking:** models with concurrent-write risk carry `version`; updates use `findOneAndUpdate({ version })` and retry once.
- **Idempotency keys:** order creation and payments accept `Idempotency-Key`; duplicates are detected and return the original result.
- **Financial immutability:** journal entries are never updated/deleted; corrections are reversal entries.

## 5. Real-time

- Backend WS hub authenticates via JWT (query param), subscribes to `tenant:{tenantId}` channel.
- Events pushed: order status change, stock alert, approval request, notification, dashboard stats refresh.
- Frontend: hook-based WS client (`useLiveQuery`) revalidates the relevant server component / SWR-style cache on event.

## 6. Data flow examples

**Order placed (e-commerce API key or dashboard):**
```
POST /orders  →  transaction:
   create order (draft) → payment captured → status: paid
   → stock decrement per line (batch-aware) + StockMovement rows
   → journal entry (AR / Revenue / Tax / Inventory-COGS)
   → invoice generated
   → publish order.paid, stock.adjusted, journal.posted, notification.created
worker → push WS event → frontend live-updates dashboard KPIs
```

**Purchase receive:**
```
POST /purchase-orders/:id/receive  →  transaction:
   inventory + per warehouse/batch + StockMovement rows
   → GRN record → journal entry (Inventory / AP)
   → status partial|received → publish po.received
```

## 7. Security

- Passwords: bcrypt. 2FA: TOTP (RFC 6238), recovery codes, `TwoFactor` model (secret encrypted).
- Sessions are explicit `Session` documents — revocable per device, refresh-token rotation.
- API keys: stored hashed (SHA-256), scoped to permission sets, rate-limited per tenant.
- Rate limiting per tenant+route (token bucket on Redis); request IDs + structured logs.
- Audit: every mutation writes `AuditLog` with before/after diff (entity-level).

## 8. Frontend architecture

- App Router, server components for list pages (data fetching), client components for interactive surfaces (forms, kanban, timeline).
- Design system: MUI theme (formal slate + indigo), `@erp` component library in `frontend/src/components`.
- Feedback: SweetAlert2 for confirmations/success/error toasts. Animation: Framer Motion page/component transitions (subtle, professional).
- Route guards: permission-based (`permissions.ts` map) — menu and routes filter by role.
- State: React Query-style lightweight fetch layer + WS live updates.

## 9. Scaling path

1. Single Mongo + Redis (v1).
2. Read replicas for reports; dashboard stats materialized in Redis.
3. Horizontal backend behind a load balancer; WS sticky sessions or shared hub via Redis.
4. Per-tenant sharding for very large tenants (future).

## 10. Repository layout

```
shared/src/models/*   model TS types (PascalCase)
shared/src/schemas/*  zod validation schemas
backend/src/config/   env, db, redis, ws
backend/src/middleware/ auth, tenant, rbac, audit, idempotency, rate-limit
backend/src/modules/  feature modules (catalog, sales, accounting, …)
worker/src/jobs/      queue processors
worker/src/cron/      repeatable jobs
frontend/src/app/     App Router pages
frontend/src/components/ UI library + feature components
frontend/src/lib/     api client, ws hook, permissions
infra/                docker-compose, .env templates
docs/                 contract documentation
```