# Event Catalog

Events flow through Redis (BullMQ queues for async work, pub/sub for live UI updates). Naming: `{domain}.{action}`.

## Queues (async work)

| Queue | Events | Consumer action |
|---|---|---|
| `notifications` | `notification.created` | deliver in-app (WS) / email (future) |
| `stats` | `stats.refresh` | materialize dashboard KPIs into cache |
| `jobs:import` | `import.queued` | parse CSV/XLSX, validate, write in batch |
| `jobs:export` | `export.queued` | generate file, store URL |
| `finance` | `invoice.overdue` | mark overdue, notify |
| `catalog` | `stock.low` | low-stock digest, notify managers |

## Domain events (published)

### Sales
| Event | Payload highlights | Consumers |
|---|---|---|
| `order.created` | orderId, tenantId | stats, audit |
| `order.status.changed` | orderId, from, to | WS live, notifications |
| `order.paid` | orderId, amount, method | finance (invoice auto-paid), stats |
| `order.fulfilled` | orderId, lines | inventory (stock already decremented in txn) |
| `payment.captured` | paymentId, orderId, amount | stats, finance |
| `payment.failed` | paymentId, orderId, reason | notifications |
| `rma.approved` | rmaId, orderId | inventory (restock), finance (refund) |
| `shipment.delivered` | shipmentId, orderId, tracking | notifications |
| `recurring.invoice.run` | recurringInvoiceId | finance (generate next invoice) |

### Inventory
| Event | Payload | Consumers |
|---|---|---|
| `stock.adjusted` | productId, warehouseId, quantity, type | stats, WS live |
| `stock.low` | productId, warehouseId, quantity | notifications, cron digest |
| `batch.expiring` | batchId, productId, expiryDate | notifications |
| `transfer.received` | transferId, items | WS live |

### Purchasing & Manufacturing
| Event | Payload | Consumers |
|---|---|---|
| `po.created` | poId, total | approvals (if over threshold) |
| `po.approved` / `po.rejected` | poId, approverId | notifications |
| `po.received` | poId, grnId | inventory (via txn), finance, stats |
| `wo.completed` | woId, productId, quantity, unitCost | inventory, finance (cost rollup) |

### Accounting & Finance
| Event | Payload | Consumers |
|---|---|---|
| `journal.posted` | entryId, tenantId | stats, audit, WS live |
| `invoice.overdue` | invoiceId, customerId, amount | notifications, cron |
| `expense.claim.submitted` | claimId, userId, total | approvals |
| `expense.claim.decided` | claimId, status | notifications |

### HR
| Event | Payload | Consumers |
|---|---|---|
| `leave.requested` | leaveId, employeeId, type | approvals |
| `leave.decided` | leaveId, status | notifications |
| `attendance.recorded` | employeeId, date, status | notifications (late/absent) |
| `payroll.paid` | runId, period | finance (journal), notifications |

### System
| Event | Payload | Consumers |
|---|---|---|
| `audit.recorded` | logId, entity, action | (sink) |
| `user.login` | userId, ip, device | audit, security |
| `user.locked` | userId, reason | notifications |
| `import.completed` | jobId, result | notifications |
| `export.completed` | jobId, url | notifications |

## Cron (repeatable jobs)

| Job | Schedule | Action |
|---|---|---|
| `low-stock-digest` | daily 08:00 | collect low stock, notify managers |
| `overdue-invoices` | daily 06:00 | mark overdue, notify |
| `batch-expiry-check` | daily 09:00 | expiring within 30 days → alert |
| `attendance-check` | daily 18:00 | missing marks → notify HR |
| `fx-sync` | daily 04:00 | refresh exchange rates |
| `recurring-invoices` | hourly | run due recurring invoices |

## WS push (live UI)

Channel: `tenant:{tenantId}` — pushed as `{ event, payload, at }`.
Order events, stock alerts, approval queue changes, notification.created, stats.refresh.