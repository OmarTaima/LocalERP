# Permissions Catalog

Granular permission codes — `<module>:<access>`. Roles are sets of these codes. Route guards check codes from the JWT; the UI filters menus and routes identically.

## Catalog: 11 modules × 4 access levels = 44 codes

Every module exposes the same four access levels:

| Access | Meaning |
|---|---|
| `read` | view/list/detail endpoints (GET) |
| `write` | update + action endpoints (PATCH, status changes, approve, receive, adjust, pay, start/complete, bulk actions) |
| `create` | create endpoints (POST for new resources) |
| `delete` | delete/deactivate endpoints (DELETE) |

| Module | Codes |
|---|---|
| companies | `companies:read`, `companies:write`, `companies:create`, `companies:delete` |
| users | `users:read`, `users:write`, `users:create`, `users:delete` |
| roles | `roles:read`, `roles:write`, `roles:create`, `roles:delete` |
| profile | `profile:read`, `profile:write`, `profile:create`, `profile:delete` |
| hr | `hr:read`, `hr:write`, `hr:create`, `hr:delete` |
| accountant | `accountant:read`, `accountant:write`, `accountant:create`, `accountant:delete` |
| manufacturing | `manufacturing:read`, `manufacturing:write`, `manufacturing:create`, `manufacturing:delete` |
| purchasing | `purchasing:read`, `purchasing:write`, `purchasing:create`, `purchasing:delete` |
| inventory | `inventory:read`, `inventory:write`, `inventory:create`, `inventory:delete` |
| catalog | `catalog:read`, `catalog:write`, `catalog:create`, `catalog:delete` |
| sales | `sales:read`, `sales:write`, `sales:create`, `sales:delete` |

`profile` guards self-service endpoints (`PATCH /auth/password`, `POST /auth/avatar`, 2FA setup/verify). The accountant module guards all finance endpoints (journals, expenses, claims, exchange rates, reports).

## Role presets (seeded per company, `isSystem: true`)

| Role | Permissions |
|---|---|
| **admin** | all 44 codes |
| **manager** | catalog/inventory/sales/purchasing/manufacturing/hr: read + write + create; accountant/users/roles/companies: read; profile: read + write |
| **accountant** | accountant: read + write + create + delete; users/roles/companies: read; profile: read + write |
| **support** | catalog: read + write + create; inventory/purchasing/hr: read; sales: read + write + create; profile: read + write |
| **employee** | hr: read; profile: read + write |
| **user** | catalog/inventory/sales/purchasing/hr: read; profile: read + write |

## Auth-only (no permission code)

The following areas no longer require a permission code — any authenticated, company-scoped user may access them:

- Dashboard endpoints (`GET /dashboard/stats`, `GET /dashboard/approvals`, `GET /dashboard/alerts`)
- Notifications (`GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`)
- Audit trail (`GET /audit-logs`, `GET /audit-logs/export`)
- Import/export jobs (`POST /imports`, `GET /imports/:id`, `GET /exports`, `GET /exports/:id/download`)
- `GET /auth/me`

## Route → permission map

Every endpoint in `docs/API.md` lists its required code. Enforcement: `rbac(permission)` middleware after `auth()` and `company()`.

Platform super-admins do not hold company permissions — their JWT carries `scope: "superadmin"` and is enforced by `requireSuperAdmin` on `/api/v1/admin/*` routes.