# REST API Reference

Base URL: `/api/v1` — JSON. Errors: `{ "error": string }` with proper status codes.

Auth: `Authorization: Bearer <jwt>` except public routes. Permission codes shown per route — see `docs/PERMISSIONS.md`. All responses are company-scoped by middleware. Company-user JWTs carry `{ sub, companyId, permissions, role }`; superadmin JWTs carry `{ sub, scope: "superadmin", permissions: ["superadmin"] }` and no `companyId`.

> Permission redesign: codes are now `module:access` (`read` / `write` / `create` / `delete`). Dashboard, notifications, audit logs and import/export endpoints no longer require a permission code (auth + company scope only).

---

## Auth, Admin & Companies

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/auth/login` | public | email/password → `{ accessToken, refreshToken }` |
| POST | `/auth/2fa/setup` | `profile:write` | generates TOTP secret + recovery codes |
| POST | `/auth/2fa/verify` | `profile:write` | verifies TOTP, enables 2FA |
| POST | `/auth/refresh` | refresh token | rotates session |
| POST | `/auth/logout` | auth | revokes current session |
| GET | `/auth/me` | auth | current user + permissions |
| PATCH | `/auth/password` | `profile:write` | change password |
| POST | `/auth/avatar` | `profile:write` | set avatar photo → `{ avatarUrl }` (body `{ avatarUrl: https }`, uploaded via `/upload/direct`) |
| GET | `/users` | `users:read` | list users (search, paginate) |
| POST | `/users` | `users:create` | create user (`avatarUrl?` https URL sets avatar) |
| PATCH | `/users/:id` | `users:write` | update user (name, role, isActive, `avatarUrl?`) |
| DELETE | `/users/:id` | `users:delete` | soft-deactivate user |
| GET | `/roles` | `roles:read` | list roles |
| POST | `/roles` | `roles:create` | create role `{ name, permissions[] }` |
| PATCH | `/roles/:id` | `roles:write` | update role (system role name locked) |
| DELETE | `/roles/:id` | `roles:delete` | delete role (system roles rejected) |
| GET | `/company/settings` | `companies:read` | company settings + display name |
| PATCH | `/company/settings` | `companies:write` | update `name` and/or settings (`currency`, `taxRate`, `timezone`) — at least one field required |
| POST | `/company/logo` | `companies:write` | set company logo → `{ logoUrl }` (body `{ logoUrl: https }`) |

> Image uploads (avatar, logo, product photo): the browser uploads the file directly to Cloudflare R2 (S3-compatible, presigned URLs) and stores the resulting URL. Flow: `POST /upload/direct` with `{ name, type, folder? }` (any authenticated user incl. superadmin) → `{ uploadURL, publicUrl }`; the client PUTs the raw file bytes to `uploadURL` with the `Content-Type` header set (15 min expiry); then save `publicUrl` via the endpoint above (avatar/logo) or as `image` on product create/update. Requires `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` on the backend; returns 503 `{ error }` when unconfigured.

### Platform admin (super-admin, separate JWT — no `companyId` claim)

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/admin/auth/login` | public | `{ email, password }` → `{ accessToken }` (7d, payload `{ sub, scope: "superadmin", permissions: ["superadmin"] }`) |
| GET | `/admin/me` | `requireSuperAdmin` | current superadmin `{ id, email, name }` from token `sub`; 401 `{ error: "session no longer valid" }` if the account no longer exists |
| GET | `/admin/companies?page&pageSize` | `requireSuperAdmin` | list companies with `usersCount` |
| POST | `/admin/companies` | `requireSuperAdmin` | `{ name, slug, plan?, settings? }` → creates Company + system roles (admin + presets) in one transaction; no user is created |
| PATCH | `/admin/companies/:id` | `requireSuperAdmin` | update `name`, `plan` (resets limits), `isActive`, `limits` |
| DELETE | `/admin/companies/:id` | `requireSuperAdmin` | soft-deactivate (`isActive=false`), idempotent, 404 if missing → `{ ok: true }` |
| POST | `/admin/companies/:id/logo` | `requireSuperAdmin` | set company logo (body `{ logoUrl: https }`) → `{ logoUrl }`; 404 if company missing |
| GET | `/admin/companies/:id/roles` | `requireSuperAdmin` | list the company's roles as `[{ id, name, permissions, isSystem }]` (system roles marked `isSystem: true`) — lets the console discover a role `id` to pass as `roleId` when creating the company's first admin user |
| POST | `/admin/companies/:id/users` | `requireSuperAdmin` | `{ name, email, password, roleId?, avatarUrl? }` → creates a user inside the company (enforces `limits.maxUsers`, email uniqueness; defaults role to the company `user` preset) |
| GET | `/admin/users?page&pageSize&search&companyId` | `requireSuperAdmin` | paginated list of ALL users across companies → `{ items, total, page, pageSize }`; each item is the user serialization + `companyName` + `roleName` (batch-resolved) |
| POST | `/admin/users` | `requireSuperAdmin` | `{ name, email, password, companyId, roleId?, avatarUrl? }` → creates a user in any company (company 404 if missing, role 400 if not in company, 409 on plan `maxUsers` limit or duplicate email, bcrypt 12; defaults role to the company `user` preset) |
| PATCH | `/admin/users/:id` | `requireSuperAdmin` | `{ name?, roleId?, companyId?, isActive?, avatarUrl? }` → update; moving company re-validates limits and that the role belongs to the new company |
| DELETE | `/admin/users/:id` | `requireSuperAdmin` | soft-deactivate (`isActive=false`), idempotent |
| POST | `/admin/companies/:id/roles` | `requireSuperAdmin` | `{ name, permissions[] }` (role schema) → custom role; 409 duplicate name in company, 400 if name is a system preset name |
| PATCH | `/admin/companies/:id/roles/:roleId` | `requireSuperAdmin` | `{ name?, permissions[]? }` → update; system role names locked (400), permissions editable; role must belong to the company (404) |
| DELETE | `/admin/companies/:id/roles/:roleId` | `requireSuperAdmin` | delete custom role; 400 for system roles, 409 if users are assigned (`reassign members first`) |

## Dashboard (auth only — no permission code)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/dashboard/stats?from&to` | auth | revenue, orders, AOV, top products, stock alerts, chart series |
| GET | `/dashboard/approvals` | auth | pending approval queue count + list |
| GET | `/dashboard/alerts` | auth | low stock, expiring batches, overdue invoices |

## Catalog

| Method | Path | Permission | Description |
|---|---|---|---|
| GET/POST | `/categories` | `catalog:read/create` | tree list / create |
| PATCH/DELETE | `/categories/:id` | `catalog:write/delete` | update / delete |
| GET | `/products?search&category&status&page&sort` | `catalog:read` | paginated, filterable, searchable |
| POST | `/products` | `catalog:create` | create (optional `image` https URL → saved photo becomes `images[0]`; `images[]` URLs still accepted) |
| GET/PATCH | `/products/:id` | `catalog:read/write` | detail / update (optional `image` https URL replaces `images` with the uploaded photo) |
| DELETE | `/products/:id` | `catalog:delete` | soft deactivate |
| GET | `/products/:id/movements?from&to` | `catalog:read` | stock ledger for product |
| POST | `/products/:id/stock-adjust` | `catalog:write` | adjustment → movement + inventory update |
| GET/POST | `/price-lists` | `catalog:read/create` | price lists |
| PATCH | `/price-lists/:id/items` | `catalog:write` | bulk set item prices |
| GET/POST | `/tax-rules` | `catalog:read/create` | tax rules |
| PATCH/DELETE | `/tax-rules/:id` | `catalog:write/delete` | update / delete |
| GET/POST | `/reorder-rules` | `catalog:read/create` | reorder rules |
| DELETE | `/reorder-rules/:id` | `catalog:delete` | delete rule |

## Inventory

| Method | Path | Permission | Description |
|---|---|---|---|
| GET/POST | `/warehouses` | `inventory:read/create` | list / create |
| PATCH/DELETE | `/warehouses/:id` | `inventory:write/delete` | update / delete |
| GET | `/inventory/low-stock` | `inventory:read` | low-stock products |
| POST | `/warehouses/transfer` | `inventory:create` | create transfer (in-transit) |
| POST | `/warehouses/transfers/:id/receive` | `inventory:write` | complete transfer, moves stock |
| GET | `/batches?expiringWithin` | `inventory:read` | batches with expiry alerts |

## Sales

| Method | Path | Permission | Description |
|---|---|---|---|
| GET/POST | `/customers` | `sales:read/create` | search/paginate / create |
| GET/PATCH | `/customers/:id` | `sales:read/write` | detail / update (credit limit) |
| GET/POST | `/quotes` | `sales:read/create` | list / create |
| GET/PATCH | `/quotes/:id` | `sales:read/write` | detail / update |
| POST | `/quotes/:id/convert` | `sales:write` | quote → order |
| GET/POST | `/orders` | `sales:read/create` | list (status/customer/date filters) / create (idempotency key) |
| GET | `/orders/:id` | `sales:read` | detail with timeline |
| PATCH | `/orders/:id/status` | `sales:write` | state machine transition |
| POST | `/orders/:id/payments` | `sales:write` | capture payment (idempotency key) |
| GET/POST | `/shipments` | `sales:read/create` | list / create (packing from pick list) |
| PATCH | `/shipments/:id/status` | `sales:write` | ship / deliver + tracking |
| GET/POST | `/rmas` | `sales:read/create` | returns list / request |
| PATCH | `/rmas/:id/status` | `sales:write` | approve → restock (batch-aware) → refund |
| GET/POST | `/recurring-invoices` | `sales:read/create` | subscription invoices |
| PATCH | `/recurring-invoices/:id/status` | `sales:write` | pause / cancel |

## Purchasing

| Method | Path | Permission | Description |
|---|---|---|---|
| GET/POST | `/suppliers` | `purchasing:read/create` | list / create |
| PATCH/DELETE | `/suppliers/:id` | `purchasing:write/delete` | update / delete |
| GET/POST | `/purchase-orders` | `purchasing:read/create` | list / create (auto approval request over threshold) |
| GET/PATCH | `/purchase-orders/:id` | `purchasing:read/write` | detail / update |
| POST | `/purchase-orders/:id/approve` | `purchasing:write` | approve (chain-aware) |
| POST | `/purchase-orders/:id/receive` | `purchasing:write` | GRN → inventory + movements + journal |
| GET | `/approval-requests` | `purchasing:read` | approval queue (my chain) |

## Accounting & Finance (accountant module)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/accounts` | `accountant:read` | chart of accounts (tree) |
| POST | `/accounts` | `accountant:create` | create account |
| PATCH | `/accounts/:id` | `accountant:write` | update account |
| POST | `/accounts/seed` | `accountant:write` | seed default chart of accounts |
| POST | `/journal-entries` | `accountant:create` | manual entry (balanced) |
| GET | `/journal-entries?from&to&account` | `accountant:read` | ledger search |
| POST | `/journal-entries/:id/reverse` | `accountant:write` | reverse entry (mirror lines) |
| GET | `/reports/trial-balance?from&to` | `accountant:read` | trial balance |
| GET | `/reports/pnl?from&to` | `accountant:read` | profit & loss |
| GET | `/reports/balance-sheet?asOf` | `accountant:read` | balance sheet |
| GET | `/reports/aging?type=ar\|ap` | `accountant:read` | debtor/creditor aging |
| POST | `/reports/fx-revaluation` | `accountant:write` | period-end FX revaluation entries |
| GET/POST | `/expenses` | `accountant:read/create` | list / create |
| PATCH/DELETE | `/expenses/:id` | `accountant:write/delete` | update / delete |
| GET/POST | `/expense-claims` | `accountant:read/create` | list / submit |
| PATCH | `/expense-claims/:id/status` | `accountant:write` | approve / reject / mark paid |
| GET/POST | `/exchange-rates` | `accountant:read/create` | rates (cron-synced) |

## Manufacturing

| Method | Path | Permission | Description |
|---|---|---|---|
| GET/POST | `/boms` | `manufacturing:read/create` | bill of materials |
| PATCH/DELETE | `/boms/:id` | `manufacturing:write/delete` | update / delete |
| GET/POST | `/work-centers` | `manufacturing:read/create` | work centers |
| GET/POST | `/work-orders` | `manufacturing:read/create` | list / create |
| GET/PATCH | `/work-orders/:id` | `manufacturing:read/write` | detail / update |
| POST | `/work-orders/:id/start` | `manufacturing:write` | release + consume materials |
| POST | `/work-orders/:id/receive` | `manufacturing:write` | complete → finished goods + cost rollup + journal |
| POST | `/work-orders/:id/cancel` | `manufacturing:write` | cancel work order |
| GET | `/mrp/suggestions` | `manufacturing:read` | purchase/produce suggestions |
| POST | `/mrp/generate` | `manufacturing:write` | (re)generate MRP suggestions |
| POST | `/mrp/suggestions/:id/action` | `manufacturing:write` | action (create PO/WO) or dismiss |

## HR

| Method | Path | Permission | Description |
|---|---|---|---|
| GET/POST | `/departments` | `hr:read/create` | org tree |
| GET/POST | `/employees` | `hr:read/create` | list (search) / create |
| GET/PATCH/DELETE | `/employees/:id` | `hr:read/write/delete` | detail / update / terminate |
| GET | `/attendance?month&year` | `hr:read` | month grid |
| POST | `/attendance` | `hr:write` | bulk mark attendance |
| GET/POST | `/timesheets` | `hr:read/create` | list / submit |
| PATCH | `/timesheets/:id/approve` | `hr:write` | approve |
| GET/POST | `/leaves` | `hr:read/create` | list / request |
| PATCH | `/leaves/:id/status` | `hr:write` | approve / reject |
| GET | `/payroll/runs` | `hr:read` | list runs |
| POST | `/payroll/runs` | `hr:create` | generate (compute components) |
| POST | `/payroll/runs/:id/pay` | `hr:write` | mark paid → journal entries |
| GET/POST | `/shift-patterns` | `hr:read/create` | shift patterns |
| PATCH/DELETE | `/shift-patterns/:id` | `hr:write/delete` | update / delete |

## System (auth only — no permission code)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/audit-logs?entity&user&from&to&page` | auth | paginated audit trail |
| GET | `/audit-logs/export?from&to` | auth | compliance export (CSV) |
| GET | `/notifications` | auth | my notifications |
| PATCH | `/notifications/:id/read` | auth | mark read |
| PATCH | `/notifications/read-all` | auth | mark all read |
| POST | `/imports` | auth | queue CSV/XLSX import |
| GET | `/imports/:id` | auth | job status + errors |
| GET | `/exports?type&from&to` | auth | queue export |
| GET | `/exports/:id/download` | auth | download file |
| POST | `/recurring-invoices/run` | `sales:write` | cron hook — run due recurring invoices |

## Health

| Method | Path | Description |
|---|---|---|
| GET | `/health` | `{ status: "ok" }` — liveness, no auth |