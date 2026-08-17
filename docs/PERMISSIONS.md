# Permissions Catalog

Granular permission codes — `<domain>:<action>`. Roles are sets of these codes. Route guards check codes from the JWT; the UI filters menus and routes identically.

## Catalog

| Code | Meaning |
|---|---|
| `catalog:read` | view products, categories, price lists, tax rules, reorder rules |
| `catalog:write` | create/update/deactivate products, categories, lists, rules |

## Inventory

| Code | Meaning |
|---|---|
| `inventory:read` | view stock, movements, batches, warehouses |
| `inventory:write` | adjust stock, transfer, receive goods, manage warehouses |

## Sales

| Code | Meaning |
|---|---|
| `sales:read` | view customers, quotes, orders, shipments, RMAs, recurring invoices |
| `sales:write` | create/edit orders, quotes, payments, shipments, RMAs, refunds |

## Purchasing

| Code | Meaning |
|---|---|
| `purchasing:read` | view suppliers, purchase orders |
| `purchasing:write` | create/edit POs, receive goods (GRN) |

## Approvals

| Code | Meaning |
|---|---|
| `approvals:read` | view approval queue |
| `approvals:write` | approve/reject requests (PO, claims, leaves) |

## Accounting & Finance

| Code | Meaning |
|---|---|
| `finance:read` | view accounts, journals, reports, expenses |
| `finance:write` | post journals, manage accounts, expenses, FX, claims |

## Manufacturing

| Code | Meaning |
|---|---|
| `manufacturing:read` | view BOMs, work centers, work orders, MRP |
| `manufacturing:write` | create/release/complete work orders, manage BOMs |

## HR

| Code | Meaning |
|---|---|
| `hr:read` | view employees, attendance, timesheets, leaves, payroll |
| `hr:write` | manage employees, attendance, payroll runs |

## Auth & System

| Code | Meaning |
|---|---|
| `auth:users:read` / `auth:users:write` | manage users |
| `auth:roles:read` / `auth:roles:write` | manage roles & permissions |
| `auth:sessions:read` / `auth:sessions:write` | manage sessions |
| `company:read` / `company:write` | company settings, API keys |
| `dashboard:read` | dashboard KPIs and alerts |
| `audit:read` | audit trail + compliance export |
| `notifications:read` | notifications |
| `imports:write` / `imports:read` | import jobs |
| `exports:read` | export jobs |

## Role presets (seeded per company)

| Role | Permissions |
|---|---|
| **admin** | all |
| **manager** | all read + sales:write, purchasing:write, approvals:write, hr:read, finance:read |
| **accountant** | finance:read/write, accounting:read/write, dashboard:read, audit:read |
| **support** | catalog:read, inventory:read, sales:read/write, customers |
| **storefront** (API key only) | catalog:read, sales:write (e-commerce orders) |
| **employee** (self-service) | hr:read (own), notifications:read |

## Route → permission map

Every endpoint in `docs/API.md` lists its required code. Enforcement: `rbac(permission)` middleware after `auth()` and `company()`.

Platform super-admins do not hold company permissions — their JWT carries `scope: "superadmin"` and is enforced by `requireSuperAdmin` on `/api/v1/admin/*` routes.