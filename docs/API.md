# REST API Reference

Base URL: `/api/v1` — JSON. Errors: `{ "error": string }` with proper status codes.

Auth: `Authorization: Bearer <jwt>` except public routes. Permission codes shown per route — see `docs/PERMISSIONS.md`. All responses are company-scoped by middleware. Company-user JWTs carry `{ sub, companyId, permissions, role }`; superadmin JWTs carry `{ sub, scope: "superadmin", permissions: ["superadmin"] }` and no `companyId`.

---

## Auth, Admin & Companies

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/auth/login` | public | email/password → `{ accessToken, refreshToken }` |
| POST | `/auth/2fa/setup` | auth | generates TOTP secret + recovery codes |
| POST | `/auth/2fa/verify` | auth | verifies TOTP, enables 2FA |
| POST | `/auth/refresh` | refresh token | rotates session |
| POST | `/auth/logout` | auth | revokes current session |
| GET | `/auth/me` | auth | current user + permissions |
| PATCH | `/auth/password` | auth | change password |
| GET | `/auth/sessions` | `auth:sessions:read` | list my sessions |
| DELETE | `/auth/sessions/:id` | `auth:sessions:write` | revoke a session |
| GET/POST | `/auth/users` | `auth:users:read/write` | list (search, paginate) / create users |
| PATCH/DELETE | `/auth/users/:id` | `auth:users:write` | update / deactivate user |
| GET/POST | `/auth/roles` | `auth:roles:read/write` | list / create roles |
| PATCH/DELETE | `/auth/roles/:id` | `auth:roles:write` | update / delete role |
| GET/PATCH | `/company/settings` | `company:read/write` | company settings (currency, taxRate) |
| GET/POST | `/company/api-keys` | `company:write` | manage API keys for e-commerce |
| DELETE | `/company/api-keys/:id` | `company:write` | revoke key |

### Platform admin (super-admin, separate JWT — no `companyId` claim)

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/admin/auth/login` | public | `{ email, password }` → `{ accessToken }` (7d, payload `{ sub, scope: "superadmin", permissions: ["superadmin"] }`) |
| GET | `/admin/companies?page&pageSize` | `requireSuperAdmin` | list companies with `usersCount` |
| POST | `/admin/companies` | `requireSuperAdmin` | `{ name, slug, plan?, settings? }` → creates Company + system roles (admin + presets) in one transaction; no user is created |
| PATCH | `/admin/companies/:id` | `requireSuperAdmin` | update `plan` (resets limits), `isActive`, `limits` |
| GET | `/admin/companies/:id/roles` | `requireSuperAdmin` | list the company's roles as `[{ id, name, permissions, isSystem }]` (system roles marked `isSystem: true`) — lets the console discover a role `id` to pass as `roleId` when creating the company's first admin user |
| POST | `/admin/companies/:id/users` | `requireSuperAdmin` | `{ name, email, password, roleId? }` → creates a user inside the company (enforces `limits.maxUsers`, email uniqueness; defaults role to the company `user` preset) |

## Dashboard

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/dashboard/stats?from&to` | `dashboard:read` | revenue, orders, AOV, top products, stock alerts, chart series |
| GET | `/dashboard/approvals` | `approvals:read` | pending approval queue count + list |
| GET | `/dashboard/alerts` | `dashboard:read` | low stock, expiring batches, overdue invoices |

## Catalog

| Method | Path | Permission | Description |
|---|---|---|---|
| GET/POST | `/categories` | `catalog:read/write` | tree list / create |
| PATCH/DELETE | `/categories/:id` | `catalog:write` | update / delete |
| GET | `/products?search&category&status&page&sort` | `catalog:read` | paginated, filterable, searchable |
| POST | `/products` | `catalog:write` | create |
| GET/PATCH | `/products/:id` | `catalog:read/write` | detail / update |
| DELETE | `/products/:id` | `catalog:write` | soft deactivate |
| GET | `/products/:id/movements?from&to` | `inventory:read` | stock ledger for product |
| POST | `/products/:id/stock-adjust` | `inventory:write` | adjustment → movement + inventory update |
| GET/POST | `/price-lists` | `catalog:read/write` | price lists |
| PATCH | `/price-lists/:id/items` | `catalog:write` | bulk set item prices |
| GET/POST | `/tax-rules` | `catalog:read/write` | tax rules |
| GET/POST | `/reorder-rules` | `catalog:read/write` | reorder rules |

## Inventory

| Method | Path | Permission | Description |
|---|---|---|---|
| GET/POST | `/warehouses` | `inventory:read/write` | list / create |
| PATCH/DELETE | `/warehouses/:id` | `inventory:write` | update / delete |
| GET | `/inventory/low-stock` | `inventory:read` | low-stock products |
| POST | `/warehouses/transfer` | `inventory:write` | create transfer (in-transit) |
| POST | `/warehouses/transfers/:id/receive` | `inventory:write` | complete transfer, moves stock |
| GET | `/batches?expiringWithin` | `inventory:read` | batches with expiry alerts |

## Sales

| Method | Path | Permission | Description |
|---|---|---|---|
| GET/POST | `/customers` | `sales:read/write` | search/paginate / create |
| GET/PATCH | `/customers/:id` | `sales:read/write` | detail / update (credit limit) |
| GET/POST | `/quotes` | `sales:read/write` | list / create |
| GET/PATCH | `/quotes/:id` | `sales:read/write` | detail / update |
| POST | `/quotes/:id/convert` | `sales:write` | quote → order |
| GET/POST | `/orders` | `sales:read/write` | list (status/customer/date filters) / create (idempotency key) |
| GET | `/orders/:id` | `sales:read` | detail with timeline |
| PATCH | `/orders/:id/status` | `sales:write` | state machine transition |
| POST | `/orders/:id/payments` | `sales:write` | capture payment (idempotency key) |
| POST | `/orders/:id/invoice` | `finance:write` | (re)generate invoice |
| GET/POST | `/shipments` | `sales:read/write` | list / create (packing from pick list) |
| PATCH | `/shipments/:id/status` | `sales:write` | ship / deliver + tracking |
| GET/POST | `/rmas` | `sales:read/write` | returns list / request |
| PATCH | `/rmas/:id/status` | `sales:write` | approve → restock (batch-aware) → refund |
| GET/POST | `/recurring-invoices` | `sales:read/write` | subscription invoices |
| PATCH | `/recurring-invoices/:id/status` | `sales:write` | pause / cancel |

## Purchasing

| Method | Path | Permission | Description |
|---|---|---|---|
| GET/POST | `/suppliers` | `purchasing:read/write` | list / create |
| PATCH/DELETE | `/suppliers/:id` | `purchasing:write` | update / delete |
| GET/POST | `/purchase-orders` | `purchasing:read/write` | list / create (auto approval request over threshold) |
| GET/PATCH | `/purchase-orders/:id` | `purchasing:read/write` | detail / update |
| POST | `/purchase-orders/:id/approve` | `approvals:write` | approve (chain-aware) |
| POST | `/purchase-orders/:id/receive` | `purchasing:write` | GRN → inventory + movements + journal |

## Accounting & Finance

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/accounts` | `finance:read` | chart of accounts (tree) |
| POST | `/accounts` | `finance:write` | create account |
| POST | `/journal-entries` | `finance:write` | manual entry (balanced) |
| GET | `/journal-entries?from&to&account` | `finance:read` | ledger search |
| GET | `/reports/trial-balance?from&to` | `finance:read` | trial balance |
| GET | `/reports/pnl?from&to` | `finance:read` | profit & loss |
| GET | `/reports/balance-sheet?asOf` | `finance:read` | balance sheet |
| GET | `/reports/aging?type=ar\|ap` | `finance:read` | debtor/creditor aging |
| POST | `/reports/fx-revaluation` | `finance:write` | period-end FX revaluation entries |
| GET/POST | `/expenses` | `finance:read/write` | list / create |
| PATCH/DELETE | `/expenses/:id` | `finance:write` | update / delete |
| GET/POST | `/expense-claims` | `finance:read/write` | list / submit |
| PATCH | `/expense-claims/:id/status` | `approvals:write` | approve / reject / mark paid |
| GET/PATCH | `/exchange-rates` | `finance:read/write` | rates (cron-synced) |

## Manufacturing

| Method | Path | Permission | Description |
|---|---|---|---|
| GET/POST | `/boms` | `manufacturing:read/write` | bill of materials |
| PATCH/DELETE | `/boms/:id` | `manufacturing:write` | update / delete |
| GET/POST | `/work-centers` | `manufacturing:read/write` | work centers |
| GET/POST | `/work-orders` | `manufacturing:read/write` | list / create |
| GET/PATCH | `/work-orders/:id` | `manufacturing:read/write` | detail / update |
| POST | `/work-orders/:id/start` | `manufacturing:write` | release + consume materials |
| POST | `/work-orders/:id/receive` | `manufacturing:write` | complete → finished goods + cost rollup + journal |
| GET | `/mrp/suggestions` | `manufacturing:read` | purchase/produce suggestions |
| POST | `/mrp/suggestions/:id/action` | `manufacturing:write` | action (create PO) or dismiss |

## HR

| Method | Path | Permission | Description |
|---|---|---|---|
| GET/POST | `/departments` | `hr:read/write` | org tree |
| GET/POST | `/employees` | `hr:read/write` | list (search) / create |
| GET/PATCH/DELETE | `/employees/:id` | `hr:read/write` | detail / update / terminate |
| GET/POST | `/attendance?month&year` | `hr:read/write` | month grid / bulk mark |
| GET/POST | `/timesheets` | `hr:read/write` | list / submit |
| PATCH | `/timesheets/:id/approve` | `hr:write` | approve |
| GET/POST | `/leaves` | `hr:read/write` | list / request |
| PATCH | `/leaves/:id/status` | `approvals:write` | approve / reject |
| GET/POST | `/payroll/runs` | `hr:write` | list / generate (compute components) |
| POST | `/payroll/runs/:id/pay` | `hr:write` | mark paid → journal entries |
| GET/POST | `/shift-patterns` | `hr:read/write` | shift patterns |

## System

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/audit-logs?entity&user&from&to&page` | `audit:read` | paginated audit trail |
| GET | `/audit-logs/export?from&to` | `audit:read` | compliance export (CSV) |
| GET | `/notifications` | `notifications:read` | my notifications |
| PATCH | `/notifications/:id/read` | `notifications:read` | mark read |
| PATCH | `/notifications/read-all` | `notifications:read` | mark all read |
| POST | `/imports` | `imports:write` | queue CSV/XLSX import |
| GET | `/imports/:id` | `imports:read` | job status + errors |
| GET | `/exports?type&from&to` | `exports:read` | queue export |
| GET | `/exports/:id/download` | `exports:read` | download file |
| GET | `/approvals` | `approvals:read` | approval queue (my chain) |
| POST | `/approvals/:id/decide` | `approvals:write` | approve / reject with note |

## Health

| Method | Path | Description |
|---|---|---|
| GET | `/health` | `{ status: "ok" }` — liveness, no auth |