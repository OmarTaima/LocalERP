# Data Model

All Mongoose models. **Every model carries `companyId`** (except `Company` and `SuperAdmin` themselves). All compound indexes start with `companyId`. All models include `createdAt` / `updatedAt` timestamps.

Legend: `T` = text search index, `U` = unique, `S` = sparse.

---

## Companies

### Company
| Field | Type | Notes |
|---|---|---|
| name | string | required |
| slug | string | unique, used in URLs |
| plan | `starter\|pro\|enterprise` | default `starter` |
| isActive | boolean | default true |
| settings | { currency: string, taxRate: number, timezone: string } | defaults USD / 0 / UTC |
| limits | { maxUsers, maxProducts, features[] } | enforced by `PlanLimit` |
| createdAt / updatedAt | date | |

Indexes: `{ slug: 1 } U`

Created only by platform super-admins (`POST /api/v1/admin/companies`). Company creation and user creation are separate operations.

---

## Auth & Security

### SuperAdmin (platform)
| Field | Type | Notes |
|---|---|---|
| email | string | required, lowercase, unique |
| name | string | required |
| passwordHash | string | bcrypt, never returned |
| createdAt / updatedAt | date | |

Not company-scoped. Authenticates via `POST /api/v1/admin/auth/login`; JWT carries `scope: "superadmin"` and no `companyId`. No Session documents are created for superadmins.

### User
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| email | string | required, lowercase |
| passwordHash | string | bcrypt, never returned |
| name | string | required |
| roleId | ObjectId → Role | |
| isActive | boolean | default true |
| lastLoginAt | date | nullable |
| mustChangePassword | boolean | default false |

Indexes: `{ companyId, email } U`, `{ companyId, roleId }`

### Role
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| name | string | e.g. `admin`, `manager`, `support` |
| permissions | string[] | granular codes — see `docs/PERMISSIONS.md` |
| isSystem | boolean | system roles not deletable |

Indexes: `{ companyId, name } U`

### Session
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| userId | ObjectId | |
| tokenHash | string | hashed refresh token |
| device | string | user agent |
| ip | string | |
| expiresAt | date | TTL index for cleanup |
| revokedAt | date | nullable |

Indexes: `{ companyId, userId }`, `{ expiresAt } S`

### ApiKey
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | for future e-commerce storefronts |
| name | string | |
| keyHash | string | SHA-256, shown once on creation |
| permissions | string[] | scoped, e.g. `catalog:read`, `sales:write` |
| lastUsedAt | date | nullable |
| revokedAt | date | nullable |

Indexes: `{ keyHash } U`

### TwoFactor
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| userId | ObjectId | unique per user |
| secretEncrypted | string | |
| recoveryCodes | string[] | hashed |
| enabled | boolean | default false |
| verifiedAt | date | nullable |

Indexes: `{ companyId, userId } U`

---

## Catalog

### Category
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| name | string | required |
| slug | string | |
| parentId | ObjectId → Category | nullable, tree |
| order | number | display order |

Indexes: `{ companyId, parentId }`

### Product
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| sku | string | required |
| name | string | required, T |
| description | string | T |
| categoryId | ObjectId → Category | nullable |
| brand | string | |
| price | number | selling price |
| cost | number | average cost |
| barcode | string | |
| isActive | boolean | default true |
| lowStockThreshold | number | default 5 |
| images | string[] | URLs |
| variants | [{ name: string, options: string[], sku: string, price?: number, cost?: number, barcode?: string }] | optional |
| version | number | optimistic lock |

Indexes: `{ companyId, sku } U`, `{ companyId, categoryId }`, `{ companyId, name: "text" } T`, `{ companyId, isActive, lowStockThreshold }`

### Batch (lot tracking)
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| productId | ObjectId | |
| lotNumber | string | required |
| expiryDate | date | nullable |
| quantity | number | remaining in batch |
| supplierId | ObjectId | nullable |
| receivedAt | date | |

Indexes: `{ companyId, productId, lotNumber } U`, `{ companyId, expiryDate }`

### PriceList / PriceListItem
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| name | string | e.g. `wholesale`, `retail` |
| customerSegmentIds | ObjectId[] | applicable segments |
| isDefault | boolean | |

PriceListItem: `companyId`, `priceListId`, `productId`, `price`, `minQuantity`, index `{ companyId, priceListId, productId } U`

### TaxRule
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| name | string | e.g. VAT 20% |
| rate | number | percent |
| appliesTo | `product\|category\|region` | |
| region | string | nullable |
| categoryId | ObjectId | nullable |
| isActive | boolean | |

Indexes: `{ companyId, appliesTo, region }`

### ReorderRule
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| productId | ObjectId | |
| warehouseId | ObjectId | |
| minQuantity | number | |
| maxQuantity | number | |
| enabled | boolean | |

Indexes: `{ companyId, productId, warehouseId } U`

---

## Inventory

### Warehouse
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| name | string | required |
| address | string | |
| isDefault | boolean | |
| isActive | boolean | |

### Inventory
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| productId | ObjectId | |
| warehouseId | ObjectId | |
| quantity | number | current stock |
| version | number | optimistic lock |

Indexes: `{ companyId, productId, warehouseId } U`, `{ companyId, quantity }`

### StockMovement (immutable ledger)
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| productId | ObjectId | |
| warehouseId | ObjectId | |
| batchId | ObjectId | nullable |
| quantity | number | signed (+/-) |
| type | `sold\|received\|adjusted\|transferred\|returned\|consumed\|produced` | |
| referenceId | ObjectId | order / PO / WO / RMA / transfer |
| note | string | |
| userId | ObjectId | actor |

Indexes: `{ companyId, productId, createdAt }`, `{ companyId, referenceId }`, `{ companyId, createdAt }`

### Transfer
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| fromWarehouseId | ObjectId | |
| toWarehouseId | ObjectId | |
| items | [{ productId, quantity, batchId? }] | |
| status | `draft\|in-transit\|received\|cancelled` | |
| referenceNumber | string | |
| version | number | |

---

## Sales (CRM-lite)

### Customer
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| email | string | |
| name | string | required |
| phone | string | |
| addresses | [{ label, street, city, country }] | |
| segmentId | ObjectId → PriceList.customerSegmentIds | |
| creditLimit | number | default 0 = no limit |
| tags | string[] | |
| notes | string | |
| totalSpent | number | denormalized |
| status | `active\|inactive` | |

Indexes: `{ companyId, email } U`, `{ companyId, name: "text" } T`

### Quote
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| quoteNumber | string | sequential per company |
| customerId | ObjectId | |
| items | [{ productId, name, sku, quantity, unitPrice, taxRate }] | |
| totals | { subtotal, tax, discount, total } | |
| status | `draft\|sent\|accepted\|declined\|expired\|converted` | |
| validUntil | date | |
| version | number | |

Indexes: `{ companyId, quoteNumber } U`, `{ companyId, customerId, createdAt }`

### SalesOrder
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| orderNumber | string | sequential per company |
| customerId | ObjectId | required |
| quoteId | ObjectId | nullable (conversion) |
| items | [{ productId, name, sku, quantity, unitPrice, taxRate, batchId? }] | |
| totals | { subtotal, tax, shipping, discount, total } | |
| status | `quote→draft→confirmed→paid→fulfilled→shipped→delivered` + `cancelled\|refunded` | state machine |
| shippingAddress | object | |
| notes | string | |
| idempotencyKey | string | unique |
| version | number | |

Indexes: `{ companyId, orderNumber } U`, `{ companyId, customerId, createdAt }`, `{ companyId, status }`, `{ companyId, idempotencyKey } U`

### Payment
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| orderId | ObjectId | |
| amount | number | |
| method | `card\|transfer\|cash\|refund` | |
| status | `pending\|captured\|failed\|reversed` | |
| reference | string | provider ref |
| idempotencyKey | string | unique |
| paidAt | date | |

Indexes: `{ companyId, orderId }`, `{ companyId, idempotencyKey } U`, `{ companyId, status, paidAt }`

### Shipment
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| orderId | ObjectId | |
| carrier | string | |
| trackingNumber | string | |
| pickList | [{ productId, quantity, fromWarehouseId }] | |
| status | `draft\|packed\|shipped\|delivered` | |
| shippedAt / deliveredAt | date | |

### RMA (return)
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| rmaNumber | string | sequential |
| orderId | ObjectId | |
| items | [{ productId, quantity, batchId?, condition }] | |
| reason | string | |
| status | `requested\|approved\|received\|refunded\|rejected` | |
| restockedAt | date | nullable |

### RecurringInvoice
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| customerId | ObjectId | |
| items | [{ productId?, name, quantity, unitPrice }] | |
| interval | `weekly\|monthly\|quarterly\|yearly` | |
| nextRunAt | date | |
| status | `active\|paused\|cancelled` | |
| dayOfPeriod | number | billing day |

---

## Purchasing

### Supplier
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| name | string | required |
| contactName | string | |
| email / phone | string | |
| address | string | |
| paymentTerms | string | |
| isActive | boolean | |

Indexes: `{ companyId, name: "text" } T`

### PurchaseOrder
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| poNumber | string | sequential per company |
| supplierId | ObjectId | required |
| items | [{ productId, quantity, unitCost, batchId? }] | |
| expectedDate | date | |
| status | `draft\|pending-approval\|sent\|partial\|received\|closed\|rejected` | |
| approvalId | ObjectId → ApprovalRequest | nullable |
| grns | [{ grnNumber, receivedAt, items[] }] | goods received notes |
| version | number | |

Indexes: `{ companyId, poNumber } U`, `{ companyId, supplierId, createdAt }`

---

## Accounting (double-entry)

### Account (chart of accounts)
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| code | string | e.g. `1100` |
| name | string | e.g. `Accounts Receivable` |
| type | `asset\|liability\|equity\|revenue\|expense\|contra` | |
| parentId | ObjectId | nullable |
| isSystem | boolean | seeded defaults not deletable |
| currency | string | nullable — foreign-currency accounts |

Indexes: `{ companyId, code } U`

### JournalEntry
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| entryNumber | string | sequential |
| date | date | |
| description | string | |
| reference | { type, id } | source doc (order, PO, payment, …) |
| lines | JournalLine[] | see below |
| status | `posted\|reversed` | |
| reversedById | ObjectId | nullable |
| createdBy | ObjectId | |

Indexes: `{ companyId, entryNumber } U`, `{ companyId, date }`, `{ companyId, "reference.type", "reference.id" }`

### JournalLine
| Field | Type | Notes |
|---|---|---|
| accountId | ObjectId → Account | |
| debit / credit | number | exactly one > 0 per line |
| currency / fxRate | number | for multi-currency |
| description | string | |

**Invariant:** per entry, `Σ debit === Σ credit` (enforced by zod schema + service).

---

## Manufacturing

### BOM (bill of materials)
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| productId | ObjectId | finished good |
| components | [{ productId, quantity }] | |
| outputQuantity | number | default 1 |
| version | number | |

Indexes: `{ companyId, productId } U`

### WorkCenter
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| name | string | |
| costPerHour | number | |
| capacity | number | hours/day |
| isActive | boolean | |

### WorkOrder
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| woNumber | string | sequential |
| bomId | ObjectId | |
| productId | ObjectId | output product |
| quantity | number | to produce |
| workCenterId | ObjectId | |
| plannedHours | number | |
| status | `draft\|released\|in-progress\|completed\|cancelled` | |
| materialConsumed | [{ productId, quantity, batchId? }] | |
| finishedGoods | [{ batchId, quantity }] | on completion |
| unitCost | number | cost rollup result |
| startedAt / completedAt | date | |

Indexes: `{ companyId, woNumber } U`, `{ companyId, status }`

### MRP suggestion
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| productId | ObjectId | |
| warehouseId | ObjectId | |
| type | `purchase\|produce` | |
| suggestedQuantity | number | (max − current) |
| reason | string | |
| status | `open\|actioned\|dismissed` | |

---

## Finance

### Expense
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| description | string | |
| amount | number | |
| category | string | |
| date | date | |
| paidBy | ObjectId → User | |
| receiptUrl | string | nullable |

### ExpenseClaim
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| userId | ObjectId | claimant |
| items | [{ description, amount, date, receiptUrl? }] | |
| total | number | |
| status | `draft\|submitted\|approved\|rejected\|paid` | |
| approvalId | ObjectId | nullable |

### ExchangeRate
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| fromCurrency / toCurrency | string | |
| rate | number | |
| date | date | |

Indexes: `{ companyId, fromCurrency, toCurrency, date } U`

---

## HR

### Department
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| name | string | |
| parentId | ObjectId | nullable, tree |
| headUserId | ObjectId | nullable |

### Employee
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| userId | ObjectId | nullable — link to login |
| name | string | required |
| email | string | |
| departmentId | ObjectId | |
| position | string | |
| salary | number | |
| hireDate | date | |
| status | `active\|onLeave\|terminated` | |

Indexes: `{ companyId, departmentId }`, `{ companyId, email } U S`

### Timesheet
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| employeeId | ObjectId | |
| date | date | |
| hours | number | |
| project / notes | string | |
| status | `draft\|submitted\|approved` | |

Indexes: `{ companyId, employeeId, date } U`

### ShiftPattern
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| name | string | e.g. `morning` |
| startTime / endTime | string | |
| days | number[] | weekdays |

### Attendance
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| employeeId | ObjectId | |
| date | date | |
| status | `present\|absent\|leave\|holiday\|late` | |
| shiftPatternId | ObjectId | nullable |
| note | string | |

Indexes: `{ companyId, employeeId, date } U`, `{ companyId, date, status }`

### LeaveRequest
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| employeeId | ObjectId | |
| type | `annual\|sick\|unpaid\|maternity\|paternity` | |
| from / to | date | |
| days | number | computed |
| status | `pending\|approved\|rejected\|cancelled` | |
| approvedBy | ObjectId | nullable |
| approvalId | ObjectId | nullable |

### PayrollRun
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| period | { month, year } | |
| entries | [{ employeeId, gross, deductions, tax, net, status }] | |
| status | `draft\|paid` | |
| paidAt | date | nullable |

Indexes: `{ companyId, period.month, period.year } U`

---

## System

### AuditLog
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| userId | ObjectId | actor |
| action | `create\|update\|delete\|approve\|reject\|login\|export` | |
| entity | string | model name |
| entityId | ObjectId | |
| changes | { before?: object, after?: object } | field-level diff |
| ip | string | |

Indexes: `{ companyId, createdAt }`, `{ companyId, entity, entityId }`, `{ companyId, userId, createdAt }`

### Notification
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| userId | ObjectId | recipient |
| type | `stock-alert\|order\|approval\|invoice\|leave\|system` | |
| title / body | string | |
| link | string | deep link |
| isRead | boolean | default false |

Indexes: `{ companyId, userId, isRead, createdAt }`

### NotificationPreference
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| userId | ObjectId | unique |
| channels | { inApp: boolean, email: boolean } | |

### ImportJob / ExportJob
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| type | `products\|customers\|orders\|employees` | |
| fileUrl | string | |
| status | `queued\|processing\|done\|failed` | |
| result | { processed, failed, errors[] } | |
| createdBy | ObjectId | |

### Setting
| Field | Type | Notes |
|---|---|---|
| companyId | ObjectId | |
| key | string | |
| value | mixed | |

Indexes: `{ companyId, key } U`

### FeatureFlag
| Field | Type | Notes |
|---|---|---|
| key | string | global flag |
| enabledForCompanyIds | ObjectId[] | opt-in list |
| defaultEnabled | boolean | |

### PlanLimit
| Field | Type | Notes |
|---|---|---|
| plan | `starter\|pro\|enterprise` | |
| maxUsers / maxProducts | number | |
| features | string[] | enabled features |

---

## Relationships map (summary)

```
Company ─┬─ User ─ Role, Session, TwoFactor, ApiKey
        ├─ Product ─ Category, Batch, Inventory, StockMovement, BOM, ReorderRule, PriceListItem, TaxRule
        ├─ SalesOrder ─ Customer, Quote, Payment, Shipment, RMA, RecurringInvoice, Invoice
        ├─ PurchaseOrder ─ Supplier, ApprovalRequest, GRN
        ├─ JournalEntry ─ Account
        ├─ WorkOrder ─ WorkCenter, BOM
        ├─ Employee ─ Department, Timesheet, Attendance, LeaveRequest, PayrollRun
        └─ AuditLog, Notification, ImportJob, ExportJob
```