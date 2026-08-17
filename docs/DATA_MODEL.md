# Data Model

All Mongoose models. **Every model carries `tenantId`** (except `Tenant` itself). All compound indexes start with `tenantId`. All models include `createdAt` / `updatedAt` timestamps.

Legend: `T` = text search index, `U` = unique, `S` = sparse.

---

## Tenancy

### Tenant
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

---

## Auth & Security

### User
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| email | string | required, lowercase |
| passwordHash | string | bcrypt, never returned |
| name | string | required |
| roleId | ObjectId → Role | |
| isActive | boolean | default true |
| lastLoginAt | date | nullable |
| mustChangePassword | boolean | default false |

Indexes: `{ tenantId, email } U`, `{ tenantId, roleId }`

### Role
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| name | string | e.g. `admin`, `manager`, `support` |
| permissions | string[] | granular codes — see `docs/PERMISSIONS.md` |
| isSystem | boolean | system roles not deletable |

Indexes: `{ tenantId, name } U`

### Session
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| userId | ObjectId | |
| tokenHash | string | hashed refresh token |
| device | string | user agent |
| ip | string | |
| expiresAt | date | TTL index for cleanup |
| revokedAt | date | nullable |

Indexes: `{ tenantId, userId }`, `{ expiresAt } S`

### ApiKey
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | for future e-commerce storefronts |
| name | string | |
| keyHash | string | SHA-256, shown once on creation |
| permissions | string[] | scoped, e.g. `catalog:read`, `sales:write` |
| lastUsedAt | date | nullable |
| revokedAt | date | nullable |

Indexes: `{ keyHash } U`

### TwoFactor
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| userId | ObjectId | unique per user |
| secretEncrypted | string | |
| recoveryCodes | string[] | hashed |
| enabled | boolean | default false |
| verifiedAt | date | nullable |

Indexes: `{ tenantId, userId } U`

---

## Catalog

### Category
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| name | string | required |
| slug | string | |
| parentId | ObjectId → Category | nullable, tree |
| order | number | display order |

Indexes: `{ tenantId, parentId }`

### Product
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
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

Indexes: `{ tenantId, sku } U`, `{ tenantId, categoryId }`, `{ tenantId, name: "text" } T`, `{ tenantId, isActive, lowStockThreshold }`

### Batch (lot tracking)
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| productId | ObjectId | |
| lotNumber | string | required |
| expiryDate | date | nullable |
| quantity | number | remaining in batch |
| supplierId | ObjectId | nullable |
| receivedAt | date | |

Indexes: `{ tenantId, productId, lotNumber } U`, `{ tenantId, expiryDate }`

### PriceList / PriceListItem
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| name | string | e.g. `wholesale`, `retail` |
| customerSegmentIds | ObjectId[] | applicable segments |
| isDefault | boolean | |

PriceListItem: `tenantId`, `priceListId`, `productId`, `price`, `minQuantity`, index `{ tenantId, priceListId, productId } U`

### TaxRule
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| name | string | e.g. VAT 20% |
| rate | number | percent |
| appliesTo | `product\|category\|region` | |
| region | string | nullable |
| categoryId | ObjectId | nullable |
| isActive | boolean | |

Indexes: `{ tenantId, appliesTo, region }`

### ReorderRule
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| productId | ObjectId | |
| warehouseId | ObjectId | |
| minQuantity | number | |
| maxQuantity | number | |
| enabled | boolean | |

Indexes: `{ tenantId, productId, warehouseId } U`

---

## Inventory

### Warehouse
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| name | string | required |
| address | string | |
| isDefault | boolean | |
| isActive | boolean | |

### Inventory
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| productId | ObjectId | |
| warehouseId | ObjectId | |
| quantity | number | current stock |
| version | number | optimistic lock |

Indexes: `{ tenantId, productId, warehouseId } U`, `{ tenantId, quantity }`

### StockMovement (immutable ledger)
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| productId | ObjectId | |
| warehouseId | ObjectId | |
| batchId | ObjectId | nullable |
| quantity | number | signed (+/-) |
| type | `sold\|received\|adjusted\|transferred\|returned\|consumed\|produced` | |
| referenceId | ObjectId | order / PO / WO / RMA / transfer |
| note | string | |
| userId | ObjectId | actor |

Indexes: `{ tenantId, productId, createdAt }`, `{ tenantId, referenceId }`, `{ tenantId, createdAt }`

### Transfer
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
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
| tenantId | ObjectId | |
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

Indexes: `{ tenantId, email } U`, `{ tenantId, name: "text" } T`

### Quote
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| quoteNumber | string | sequential per tenant |
| customerId | ObjectId | |
| items | [{ productId, name, sku, quantity, unitPrice, taxRate }] | |
| totals | { subtotal, tax, discount, total } | |
| status | `draft\|sent\|accepted\|declined\|expired\|converted` | |
| validUntil | date | |
| version | number | |

Indexes: `{ tenantId, quoteNumber } U`, `{ tenantId, customerId, createdAt }`

### SalesOrder
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| orderNumber | string | sequential per tenant |
| customerId | ObjectId | required |
| quoteId | ObjectId | nullable (conversion) |
| items | [{ productId, name, sku, quantity, unitPrice, taxRate, batchId? }] | |
| totals | { subtotal, tax, shipping, discount, total } | |
| status | `quote→draft→confirmed→paid→fulfilled→shipped→delivered` + `cancelled\|refunded` | state machine |
| shippingAddress | object | |
| notes | string | |
| idempotencyKey | string | unique |
| version | number | |

Indexes: `{ tenantId, orderNumber } U`, `{ tenantId, customerId, createdAt }`, `{ tenantId, status }`, `{ tenantId, idempotencyKey } U`

### Payment
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| orderId | ObjectId | |
| amount | number | |
| method | `card\|transfer\|cash\|refund` | |
| status | `pending\|captured\|failed\|reversed` | |
| reference | string | provider ref |
| idempotencyKey | string | unique |
| paidAt | date | |

Indexes: `{ tenantId, orderId }`, `{ tenantId, idempotencyKey } U`, `{ tenantId, status, paidAt }`

### Shipment
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| orderId | ObjectId | |
| carrier | string | |
| trackingNumber | string | |
| pickList | [{ productId, quantity, fromWarehouseId }] | |
| status | `draft\|packed\|shipped\|delivered` | |
| shippedAt / deliveredAt | date | |

### RMA (return)
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| rmaNumber | string | sequential |
| orderId | ObjectId | |
| items | [{ productId, quantity, batchId?, condition }] | |
| reason | string | |
| status | `requested\|approved\|received\|refunded\|rejected` | |
| restockedAt | date | nullable |

### RecurringInvoice
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
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
| tenantId | ObjectId | |
| name | string | required |
| contactName | string | |
| email / phone | string | |
| address | string | |
| paymentTerms | string | |
| isActive | boolean | |

Indexes: `{ tenantId, name: "text" } T`

### PurchaseOrder
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| poNumber | string | sequential per tenant |
| supplierId | ObjectId | required |
| items | [{ productId, quantity, unitCost, batchId? }] | |
| expectedDate | date | |
| status | `draft\|pending-approval\|sent\|partial\|received\|closed\|rejected` | |
| approvalId | ObjectId → ApprovalRequest | nullable |
| grns | [{ grnNumber, receivedAt, items[] }] | goods received notes |
| version | number | |

Indexes: `{ tenantId, poNumber } U`, `{ tenantId, supplierId, createdAt }`

---

## Accounting (double-entry)

### Account (chart of accounts)
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| code | string | e.g. `1100` |
| name | string | e.g. `Accounts Receivable` |
| type | `asset\|liability\|equity\|revenue\|expense\|contra` | |
| parentId | ObjectId | nullable |
| isSystem | boolean | seeded defaults not deletable |
| currency | string | nullable — foreign-currency accounts |

Indexes: `{ tenantId, code } U`

### JournalEntry
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| entryNumber | string | sequential |
| date | date | |
| description | string | |
| reference | { type, id } | source doc (order, PO, payment, …) |
| lines | JournalLine[] | see below |
| status | `posted\|reversed` | |
| reversedById | ObjectId | nullable |
| createdBy | ObjectId | |

Indexes: `{ tenantId, entryNumber } U`, `{ tenantId, date }`, `{ tenantId, "reference.type", "reference.id" }`

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
| tenantId | ObjectId | |
| productId | ObjectId | finished good |
| components | [{ productId, quantity }] | |
| outputQuantity | number | default 1 |
| version | number | |

Indexes: `{ tenantId, productId } U`

### WorkCenter
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| name | string | |
| costPerHour | number | |
| capacity | number | hours/day |
| isActive | boolean | |

### WorkOrder
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
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

Indexes: `{ tenantId, woNumber } U`, `{ tenantId, status }`

### MRP suggestion
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
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
| tenantId | ObjectId | |
| description | string | |
| amount | number | |
| category | string | |
| date | date | |
| paidBy | ObjectId → User | |
| receiptUrl | string | nullable |

### ExpenseClaim
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| userId | ObjectId | claimant |
| items | [{ description, amount, date, receiptUrl? }] | |
| total | number | |
| status | `draft\|submitted\|approved\|rejected\|paid` | |
| approvalId | ObjectId | nullable |

### ExchangeRate
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| fromCurrency / toCurrency | string | |
| rate | number | |
| date | date | |

Indexes: `{ tenantId, fromCurrency, toCurrency, date } U`

---

## HR

### Department
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| name | string | |
| parentId | ObjectId | nullable, tree |
| headUserId | ObjectId | nullable |

### Employee
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| userId | ObjectId | nullable — link to login |
| name | string | required |
| email | string | |
| departmentId | ObjectId | |
| position | string | |
| salary | number | |
| hireDate | date | |
| status | `active\|onLeave\|terminated` | |

Indexes: `{ tenantId, departmentId }`, `{ tenantId, email } U S`

### Timesheet
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| employeeId | ObjectId | |
| date | date | |
| hours | number | |
| project / notes | string | |
| status | `draft\|submitted\|approved` | |

Indexes: `{ tenantId, employeeId, date } U`

### ShiftPattern
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| name | string | e.g. `morning` |
| startTime / endTime | string | |
| days | number[] | weekdays |

### Attendance
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| employeeId | ObjectId | |
| date | date | |
| status | `present\|absent\|leave\|holiday\|late` | |
| shiftPatternId | ObjectId | nullable |
| note | string | |

Indexes: `{ tenantId, employeeId, date } U`, `{ tenantId, date, status }`

### LeaveRequest
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
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
| tenantId | ObjectId | |
| period | { month, year } | |
| entries | [{ employeeId, gross, deductions, tax, net, status }] | |
| status | `draft\|paid` | |
| paidAt | date | nullable |

Indexes: `{ tenantId, period.month, period.year } U`

---

## System

### AuditLog
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| userId | ObjectId | actor |
| action | `create\|update\|delete\|approve\|reject\|login\|export` | |
| entity | string | model name |
| entityId | ObjectId | |
| changes | { before?: object, after?: object } | field-level diff |
| ip | string | |

Indexes: `{ tenantId, createdAt }`, `{ tenantId, entity, entityId }`, `{ tenantId, userId, createdAt }`

### Notification
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| userId | ObjectId | recipient |
| type | `stock-alert\|order\|approval\|invoice\|leave\|system` | |
| title / body | string | |
| link | string | deep link |
| isRead | boolean | default false |

Indexes: `{ tenantId, userId, isRead, createdAt }`

### NotificationPreference
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| userId | ObjectId | unique |
| channels | { inApp: boolean, email: boolean } | |

### ImportJob / ExportJob
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| type | `products\|customers\|orders\|employees` | |
| fileUrl | string | |
| status | `queued\|processing\|done\|failed` | |
| result | { processed, failed, errors[] } | |
| createdBy | ObjectId | |

### Setting
| Field | Type | Notes |
|---|---|---|
| tenantId | ObjectId | |
| key | string | |
| value | mixed | |

Indexes: `{ tenantId, key } U`

### FeatureFlag
| Field | Type | Notes |
|---|---|---|
| key | string | global flag |
| enabledForTenantIds | ObjectId[] | opt-in list |
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
Tenant ─┬─ User ─ Role, Session, TwoFactor, ApiKey
        ├─ Product ─ Category, Batch, Inventory, StockMovement, BOM, ReorderRule, PriceListItem, TaxRule
        ├─ SalesOrder ─ Customer, Quote, Payment, Shipment, RMA, RecurringInvoice, Invoice
        ├─ PurchaseOrder ─ Supplier, ApprovalRequest, GRN
        ├─ JournalEntry ─ Account
        ├─ WorkOrder ─ WorkCenter, BOM
        ├─ Employee ─ Department, Timesheet, Attendance, LeaveRequest, PayrollRun
        └─ AuditLog, Notification, ImportJob, ExportJob
```