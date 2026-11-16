# अर्थ SAATHI Backend

Express REST API foundation for the अर्थ SAATHI application.

## Setup

1. Run `npm install` in this directory.
2. Copy `.env.example` to `.env`.
3. Set `JWT_SECRET` to a deployment-provided secret before enabling token issuance. Keep all database values empty until the database integration owner wires the adapter.
4. Start with `npm run dev` or `npm start`; run checks with `npm test`.

The default production repository deliberately returns `503` for registration and login until persistence is connected. Tests inject an in-memory repository only from `test/helpers`; it is not used by the running application. No user data is persisted without the MongoDB adapter. MongoDB integration and runtime connection configuration are pending. `src/repositories/mongoUserRepository.js` accepts an injected official MongoDB Node.js Driver `Db` and defines `findByEmail`, `createUser`, and `findById`; the responsible team must wire it to the central account database and create a unique index on `users.email`. Do not store shopkeeper business data in the central database.

Server settings: `PORT` (default `3001`), `CORS_ORIGIN` (comma-separated explicit browser origins; wildcard is rejected), `JWT_SECRET` (required for login token issuance and verification), and `JWT_EXPIRES_IN` (default `1h`). JSON request bodies are limited to 1 MB; Helmet security headers are enabled. Authentication endpoints are limited to 10 requests per IP per 15 minutes. The default rate-limit store is process-local; production deployments with multiple API instances should inject a shared store. In production, configure the exact frontend origins in `CORS_ORIGIN`. MongoDB placeholders in `.env.example` intentionally remain empty.

For a route-by-route contract, copyable workflow examples, and complete integration handover, see [API_REFERENCE.md](./API_REFERENCE.md) and [DATABASE_INTEGRATION_HANDOVER.md](./DATABASE_INTEGRATION_HANDOVER.md). An importable [Postman collection](./postman/arth-saathi-api.postman_collection.json) includes placeholder requests for the registered endpoints. Database-backed routes return 503 until central persistence and tenant-scoped BYOD repository selection are integrated.

## API contract

All request and response bodies use JSON. Error responses have the form `{ "error": "...", "code": "..." }` when a stable error code applies.

### `GET /api/health`

No request body or authentication is required.

Success (`200`):

```json
{
  "status": "ok",
  "service": "arth-saathi-api",
  "timestamp": "2026-11-08T00:00:00.000Z",
  "database": "not_configured"
}
```

### `POST /api/auth/register`

Registers a user. Email is trimmed and normalized to lowercase. Passwords require at least 8 characters, at least one letter, and at least one number. Passwords are bcrypt-hashed; password and hash fields are never returned.

Request:

```json
{
  "fullName": "Asha Sharma",
  "email": "asha@example.com",
  "password": "example1234",
  "businessName": "Asha Stores"
}
```

Success (`201`):

```json
{
  "user": {
    "id": "user-id",
    "fullName": "Asha Sharma",
    "email": "asha@example.com",
    "businessName": "Asha Stores",
    "createdAt": "2026-11-08T00:00:00.000Z"
  }
}
```

Errors: `400` invalid or missing fields; `409` duplicate email (`EMAIL_ALREADY_EXISTS`); `503` persistence unavailable; `500` unexpected error.

### `POST /api/auth/login`

Request:

```json
{
  "email": "asha@example.com",
  "password": "example1234"
}
```

Success (`200`):

```json
{
  "user": {
    "id": "user-id",
    "fullName": "Asha Sharma",
    "email": "asha@example.com",
    "businessName": "Asha Stores",
    "createdAt": "2026-11-08T00:00:00.000Z"
  },
  "token": "<signed-jwt>"
}
```

Errors: `400` invalid or missing fields; `401` incorrect credentials (`INVALID_CREDENTIALS`); `503` persistence or JWT configuration unavailable; `500` unexpected error.

### Authenticated requests

Send `Authorization: Bearer <token>`. Use `src/middleware/requireAuthentication.js` to protect routes. The middleware attaches `{ userId, email }` to `request.auth` after successful verification.

Errors: `401` missing, invalid, or expired token; `503` JWT verification configuration unavailable. Tokens must be signed with the configured `JWT_SECRET`; there is no fallback secret.

Unknown routes return `404`; unexpected errors return `500` with a generic message and no stack or database details. Malformed JSON returns `400 INVALID_JSON`; bodies over 1 MB return `413 PAYLOAD_TOO_LARGE`; authentication throttling returns `429 RATE_LIMITED`.

## Inventory API (Phase 3)

All inventory endpoints require `Authorization: Bearer <token>`. The business scope is taken only from the verified JWT (`businessId`, or the signed subject for older tokens); client-supplied business IDs are ignored. Inventory repositories receive this scope for every operation.

### Products

Product fields are `name`, `description`, `sku`, `categoryId`, `purchasePrice`, `sellingPrice`, `stockQuantity`, `lowStockThreshold`, `unit`, `expiryDate`, `createdAt`, and `updatedAt`. Required on creation: `name`, `sku`, `purchasePrice`, `sellingPrice`, and `stockQuantity`. Prices must be finite non-negative numbers; quantities and thresholds must be non-negative integers. Defaults: empty description, no category, threshold `0`, unit `"unit"`, and no expiry date. Expiry may be an ISO date/datetime or `null`.

Create with `POST /api/products`:

```json
{
  "name": "Green Tea",
  "description": "Loose leaf tea",
  "sku": "GT-001",
  "categoryId": null,
  "purchasePrice": 4.25,
  "sellingPrice": 6.5,
  "stockQuantity": 20,
  "lowStockThreshold": 5,
  "unit": "box",
  "expiryDate": "2027-05-31"
}
```

Success (`201`):

```json
{
  "product": {
    "id": "64c1a492f12a9a5c7865f201",
    "name": "Green Tea",
    "description": "Loose leaf tea",
    "sku": "GT-001",
    "categoryId": null,
    "purchasePrice": 4.25,
    "sellingPrice": 6.5,
    "stockQuantity": 20,
    "lowStockThreshold": 5,
    "unit": "box",
    "expiryDate": "2027-05-31T00:00:00.000Z",
    "createdAt": "2026-11-08T00:00:00.000Z",
    "updatedAt": "2026-11-08T00:00:00.000Z"
  }
}
```

- `GET /api/products`: paginated list `{ "items": [], "total": 0, "page": 1, "limit": 20, "totalPages": 0 }`.
- Query parameters: `page` (default 1), `limit` (default 20, maximum 100), `search` (matches name or SKU), `categoryId`, `lowStock=true|false`, `expiryWithinDays` (0–3650), or `expired=true|false`. `expired=true` cannot be combined with `expiryWithinDays`.
- `GET /api/products/low-stock`: paginated products where `stockQuantity <= lowStockThreshold`.
- `GET /api/products/expiring?days=30`: products expiring from today through the end of the day `days` days from now. `days` defaults to 30 and may be 0–3650.
- `GET /api/products/expired`: paginated products with an expiry date before today. Products without an expiry date are excluded.
- `GET /api/products/:id`: returns `{ "product": { ... } }`.
- `PUT /api/products/:id`: accepts any non-empty subset of writable product fields; returns `{ "product": { ... } }` and updates `updatedAt`.
- `DELETE /api/products/:id`: returns `{ "message": "Product deleted successfully." }`.

Product status codes: `201` created; `200` read/updated/deleted; `400` invalid fields or ID; `401` missing/invalid authentication; `404` product not found; `503` persistence unavailable; `500` unexpected error.

### Categories

Create with `POST /api/categories`:

```json
{ "name": "Beverages", "description": "Drinks and tea" }
```

Success (`201`):

```json
{
  "category": {
    "id": "64c1a492f12a9a5c7865f202",
    "name": "Beverages",
    "description": "Drinks and tea",
    "createdAt": "2026-11-08T00:00:00.000Z",
    "updatedAt": "2026-11-08T00:00:00.000Z"
  }
}
```

- `GET /api/categories`: paginated list with the same `page` and `limit` parameters as products.
- `PUT /api/categories/:id`: update `name`, `description`, or both; returns `{ "category": { ... } }`.
- `DELETE /api/categories/:id`: returns a success message when no products reference it. Returns `409 CATEGORY_IN_USE` while products reference the category.
- Category names are trimmed and duplicate-checked case-insensitively within the authenticated business.

Category status codes: `201` created; `200` listed/updated/deleted; `400` invalid fields or ID; `401` missing/invalid authentication; `404` category not found; `409` duplicate name or category in use; `503` persistence unavailable; `500` unexpected error.

### Pending inventory database integration

No MongoDB connection or tenant database selection is configured here. The Mongo repositories in `src/repositories/mongoProductRepository.js` and `src/repositories/mongoCategoryRepository.js` accept an injected official-driver `Db` and scope queries by the signed `businessId`. The integration owner must select the correct shopkeeper `Db`, map authenticated accounts to a stable business ID, wire those repositories into `createApp`, create the unique `{ businessId, normalizedName }` category index, and address the documented concurrency TODOs for duplicate category creation and category deletion while products reference it. Until repositories are injected, inventory APIs return `503`; the application does not use in-memory storage.

## Customer Management and Khata (Phase 4)

All customer and Khata routes require `Authorization: Bearer <token>`. The business scope comes only from the verified JWT `businessId` (or its signed subject for older tokens). Body/query `businessId` values are never used to select repository scope.

### Customers

- `POST /api/customers` creates a customer. `fullName` and `phone` are required; email, address, and notes are optional.
- `GET /api/customers?page=1&limit=20&search=asha` lists customers, paginated, searching full name and normalized phone.
- `GET /api/customers/:id` returns `{ "customer": { ... } }`.
- `PUT /api/customers/:id` updates one or more profile fields and returns `{ "customer": { ... } }`.
- `DELETE /api/customers/:id` deletes a customer only if there is no ledger history. Any historical entry blocks deletion even if the balance is zero.
- `GET /api/customers/:id/purchases` returns business-scoped invoice history; it returns `503` until the invoice repository is injected.

Create request:

```json
{
  "fullName": "Asha Sharma",
  "phone": "+91 98765 43210",
  "email": "asha@example.com",
  "address": "12 Market Road",
  "notes": "Prefers evening delivery"
}
```

Success (`201`):

```json
{
  "customer": {
    "id": "64c1a492f12a9a5c7865f301",
    "fullName": "Asha Sharma",
    "phone": "+919876543210",
    "email": "asha@example.com",
    "address": "12 Market Road",
    "notes": "Prefers evening delivery",
    "createdAt": "2026-11-08T00:00:00.000Z",
    "updatedAt": "2026-11-08T00:00:00.000Z"
  }
}
```

Phone normalization removes spaces and common punctuation but does not add a country code. Phone is not assumed unique; likely duplicates are detected only for the same normalized name and phone within a business. Optional email is trimmed and lowercased.

Customer status codes: `201` created; `200` listed/read/updated/deleted; `400` invalid fields or ID; `401` missing/invalid authentication; `404` customer not found; `409` duplicate candidate or unsafe deletion due to ledger history; `503` customer/ledger/invoice persistence unavailable; `500` unexpected error.

### Khata ledger

- `POST /api/customers/:id/khata/credit` records a `CREDIT` entry.
- `POST /api/customers/:id/khata/payments` records a `PAYMENT` entry.
- `GET /api/customers/:id/khata?page=1&limit=20` returns the ledger newest first, with totals calculated over the complete ledger.
- `GET /api/customers/:id/khata/summary` returns total credit, total payments, outstanding balance, and entry count.
- `GET /api/khata/outstanding?page=1&limit=20&search=asha` lists customers with positive balances; search matches name or phone.

Credit request:

```json
{ "amount": 125.50, "note": "Groceries", "referenceId": "sale-17" }
```

Payment request:

```json
{ "amount": 50, "paymentMethod": "UPI", "note": "Part payment" }
```

Payment methods: `CASH`, `UPI`, `CARD`, `BANK_TRANSFER`, `OTHER`; optional. Amounts must be positive finite numbers with at most two decimal places. The service sums integer paise from ledger entries: `CREDIT` adds to the due and `PAYMENT` subtracts. A payment above the current outstanding amount returns `409 PAYMENT_EXCEEDS_BALANCE`.

Successful credit/payment (`201`) returns an immutable entry and resulting summary:

```json
{
  "entry": {
    "id": "64c1a492f12a9a5c7865f401",
    "customerId": "64c1a492f12a9a5c7865f301",
    "type": "CREDIT",
    "amount": 125.5,
    "paymentMethod": null,
    "note": "Groceries",
    "referenceId": "sale-17",
    "createdAt": "2026-11-08T00:00:00.000Z"
  },
  "summary": {
    "totalCredit": 125.5,
    "totalPayments": 0,
    "outstandingBalance": 125.5,
    "entryCount": 1
  }
}
```

Ledger read responses include `customerId`, `entries`, pagination fields, and `summary`. The outstanding response contains paginated `{ customer, outstandingBalance }` items. Ledger entries have no update or delete API.

Khata status codes: `201` entry created; `200` ledger/summary/outstanding read; `400` invalid ID, amount, or body; `401` missing/invalid authentication; `404` customer not found; `409` payment exceeds balance or customer has ledger history; `503` persistence or transaction support unavailable; `500` unexpected error.

### Pending customer and ledger integration

`src/repositories/mongoCustomerRepository.js` and `src/repositories/mongoLedgerRepository.js` accept injected official-driver `Db` handles; neither connects nor reads credentials. The tenant integration owner must inject the shopkeeper database, map accounts to stable business IDs, create indexes on `{ businessId, normalizedName, phone }` and `{ businessId, customerId, createdAt }`, and supply a replica-set database that supports transactions. Ledger writes increment an internal customer `ledgerRevision` in the same transaction before reading balances and appending an entry. Customer deletion checks for any history and deletes in that transaction. This serializes per-customer ledger operations without storing an editable balance. Until repositories are injected, customer/Khata APIs return `503` and no data is stored by the running app.

The outstanding-customer endpoint currently loads matching customers and their ledger entries for service-layer balance calculation; aggregation or streaming may be needed as tenant data grows.

## Billing and invoices (Phase 5)

All invoice endpoints require `Authorization: Bearer <token>`. Tenant scope comes only from the verified token. Invoice amounts are stored as integer paise (for example, ₹12.50 is `1250`); product catalog prices and request-side custom charge prices are expressed in rupees and are converted by the backend. Product selling and purchase prices always come from the tenant product repository. Client-supplied price fields are rejected.

### Create invoice

`POST /api/invoices` accepts inventory products, optional custom charges and a fixed rupee discount. Product quantities must be positive integers. `CREDIT` requires a customer belonging to the current business. `CASH` is immediately marked `PAID`; `CREDIT` starts with `amountPaid: 0`, `amountDue: totalAmount` and status `UNPAID`.

```json
{
  "customerId": "64c1a492f12a9a5c7865f301",
  "items": [
    { "productId": "64c1a492f12a9a5c7865f201", "quantity": 2 }
  ],
  "additionalCharges": [
    { "name": "Delivery", "quantity": 1, "unitPrice": 25.5 }
  ],
  "discount": 5,
  "paymentType": "CREDIT"
}
```

`Idempotency-Key` is an optional request header (8–128 safe characters). Repeating a request with the same key in the same business returns the original invoice. A response is `{ "invoice": { ... } }` with snapshots in `items` and `additionalChargeItems`; `subtotal`, `additionalCharges`, `discount`, `totalAmount`, `totalCost`, `totalProfit`, line prices/totals/costs/profits, `amountPaid`, and `amountDue` are all paise integers. Custom charges do not change stock. Formula: product line total = catalog selling price × quantity; line cost = catalog purchase price × quantity; invoice total = product subtotal + custom charge totals − discount; total cost = sum of product line costs; total profit = invoice total − total cost.

Example success (`201`):

```json
{
  "invoice": {
    "id": "64c1a492f12a9a5c7865f701",
    "invoiceNumber": "INV-00000001",
    "customerId": "64c1a492f12a9a5c7865f301",
    "items": [{
      "productId": "64c1a492f12a9a5c7865f201",
      "productName": "Green Tea",
      "sku": "GT-001",
      "quantity": 2,
      "unit": "box",
      "sellingPrice": 650,
      "purchasePrice": 425,
      "lineTotal": 1300,
      "lineCost": 850,
      "lineProfit": 450
    }],
    "subtotal": 1300,
    "additionalCharges": 2550,
    "discount": 500,
    "totalAmount": 3350,
    "totalCost": 850,
    "totalProfit": 2500,
    "paymentType": "CREDIT",
    "amountPaid": 0,
    "amountDue": 3350,
    "status": "UNPAID"
  }
}
```

For `CREDIT`, the same database transaction inserts a `CREDIT` entry in the existing `customerLedger` with reference `invoice:<invoiceId>`. The existing Khata `calculateSummary` logic is reused when checking cancellation eligibility; no second customer balance is stored. Cash is not added to Khata.

### Read and cancel invoices

- `GET /api/invoices?page=1&limit=20&from=2026-01-01&to=2026-12-31&customerId=<id>&status=UNPAID` returns `{ items, total, page, limit, totalPages }`, newest first. All filters are optional; status is `UNPAID`, `PARTIALLY_PAID`, `PAID`, or `CANCELLED` (`DUE` remains accepted for older records).
- `GET /api/invoices/:id` returns `{ "invoice": { ... } }`.
- `GET /api/invoices/number/:invoiceNumber` returns `{ "invoice": { ... } }`.
- `GET /api/customers/:id/purchases?page=1&limit=20` now returns that business-scoped customer's invoice snapshots, newest first.
- `POST /api/invoices/:id/cancel` accepts an optional `{ "reason": "entered in error" }` body. It marks the invoice `CANCELLED`, records the actor/time/reason, restores inventory, and never deletes the invoice. An unpaid `CREDIT` invoice appends a matching Khata `PAYMENT` reversal (`invoice-cancel:<invoiceId>`) in the same transaction. Repeated cancellation returns `409 INVOICE_ALREADY_CANCELLED`.

Cancellation is refused when `amountPaid > 0`, so fully paid CASH invoices and any settled invoice cannot be cancelled (`409 INVOICE_HAS_PAYMENTS`). A CREDIT cancellation is also refused if existing Khata payments have reduced the customer's aggregate due below the invoice amount (`409 INVOICE_CREDIT_PARTIALLY_SETTLED`).

Invoice status codes include `201` created; `200` read/cancelled; `400` invalid request; `401` missing/invalid token; `404` invoice, product, or customer not found in this business; `409` insufficient stock, duplicate/idempotent conflict, or ineligible cancellation; `503` database/transaction integration unavailable; `500` unexpected error. Product stock changes, invoice insert, sequence increment, and CREDIT ledger entry are grouped in a MongoDB transaction. If transaction support is unavailable, the operation fails without committing partial writes.

### Billing database integration

`src/repositories/mongoInvoiceRepository.js` accepts an injected official-driver tenant `Db`; it does not open a connection. The application currently injects an unavailable repository, so invoice operations and purchase-history reads return `503 PERSISTENCE_UNAVAILABLE`. The tenant integration owner still needs to select/inject the business database, provision a replica set or sharded cluster with transaction support, and verify driver transaction behavior under its deployment. Required indexes include unique `{ businessId: 1, invoiceNumber: 1 }`, unique partial `{ businessId: 1, idempotencyKey: 1 }` where the key is a string, `{ businessId: 1, createdAt: -1 }`, `{ businessId: 1, customerId: 1, createdAt: -1 }`, and unique sequence `_id` in `invoiceSequences` (the built-in `_id` index). The existing customer ledger index `{ businessId: 1, customerId: 1, createdAt: 1 }` should be present. Index creation and tenant selection remain TODOs; no Atlas URI or database credentials are configured.

## Payment collection and transaction history (Phase 6)

All routes below require `Authorization: Bearer <token>`. Request money values use rupees with at most two decimals; payment records, invoice allocations, and payment totals are stored and returned as integer paise. For example, `₹12.50` is `1250`. The invoice payment status is recalculated from amounts after each allocation: `UNPAID` when `amountPaid` is zero, `PARTIALLY_PAID` when both paid and due are positive, and `PAID` when due reaches zero. Existing CASH invoices remain paid and cannot receive another payment.

### Collecting payment

- `POST /api/invoices/:id/payments` applies a payment to one eligible CREDIT invoice.
- `POST /api/customers/:id/payments` receives one customer payment. Supply `allocations` to allocate explicitly, or omit it to apply to the customer's oldest outstanding CREDIT invoices first (FIFO). Every invoice must belong to that customer and business; allocations cannot exceed due, duplicate invoice IDs are rejected, and the sum must exactly equal the payment amount. Any amount beyond total eligible invoice dues is rejected.
- Both endpoints accept `amount`, `paymentMethod` (`CASH`, `UPI`, `CARD`, `BANK_TRANSFER`, `OTHER`), optional `note`, and optional `referenceNumber`. Customer-level requests may also include:

```json
{
  "amount": 70,
  "paymentMethod": "UPI",
  "note": "Part payment",
  "referenceNumber": "UPI-98421",
  "allocations": [
    { "invoiceId": "64c1a492f12a9a5c7865f701", "allocatedAmount": 30 },
    { "invoiceId": "64c1a492f12a9a5c7865f702", "allocatedAmount": 40 }
  ]
}
```

Send an optional `Idempotency-Key` header (8–128 safe characters) to safely retry a payment request. Success (`201`) returns `{ "payment": { "paymentId", "customerId", "amount", "paymentMethod", "allocations", "note", "referenceNumber", "createdAt" } }`; `amount` and `allocations[].allocatedAmount` are paise. A corresponding single Khata `PAYMENT` entry references `payment:<paymentId>`, regardless of how many invoices are allocated. Invoice amounts/status and the payment record update in the same transaction. The customer Khata balance is checked and cannot go below zero.

### Payment reads and transaction history

- `GET /api/payments?page=1&limit=20&from=2026-01-01&to=2026-12-31&customerId=<id>&invoiceId=<id>&paymentMethod=UPI` returns paginated payment records, newest first.
- `GET /api/payments/:id` returns `{ "payment": { ...allocations } }`.
- `GET /api/payments/summary?from=2026-11-01&to=2026-11-30` returns payment totals by method and total received for the selected period (all amounts paise), plus current `outstandingCustomerDues`, `unpaidInvoices`, `partiallyPaidInvoices`, and `paidInvoices`. `outstandingBalanceAsOf` identifies the current balance snapshot; date filters affect received totals only.
- `GET /api/transactions?page=1&limit=20&from=...&to=...&type=PAYMENT_RECEIVED&customerId=<id>&invoiceId=<id>&paymentMethod=UPI` returns a unified, newest-first history of actual invoice-created/cancelled events, payment records, and unlinked/manual Khata credit/payment entries. Supported types are `INVOICE_CREATED`, `INVOICE_CANCELLED`, `PAYMENT_RECEIVED`, `CREDIT_RECORDED`, and `KHATA_PAYMENT`. A payment ledger entry linked to a payment record is not emitted a second time.
- `GET /api/transactions/:id` returns the identified event. IDs are stable strings such as `payment:<id>`, `invoice:<id>:created`, `invoice:<id>:cancelled`, and `ledger:<id>`.

Errors include `400 VALIDATION_ERROR` for invalid amounts or allocations, `401` for missing/invalid authentication, `404` for missing or out-of-scope customers/invoices/payments, `409 PAYMENT_EXCEEDS_INVOICE_DUE`, `409 PAYMENT_EXCEEDS_INVOICE_DUES`, `409 PAYMENT_EXCEEDS_BALANCE`, `409 INVOICE_NOT_PAYABLE`, and `503 PERSISTENCE_UNAVAILABLE` or `INVOICE_TRANSACTION_UNAVAILABLE`. There are no payment update/delete APIs. Refunds and reversals are not implemented; original payments remain immutable and paid invoices cannot be cancelled through the invoice cancellation endpoint.

Payment writes use the existing injected invoice transaction boundary and append one shared Khata ledger entry in that transaction. Pending integration requires adding `payments` collection indexes: unique `{ businessId: 1, paymentId: 1 }`, unique partial `{ businessId: 1, idempotencyKey: 1 }` for string keys, `{ businessId: 1, createdAt: -1 }`, `{ businessId: 1, customerId: 1, createdAt: -1 }`, and multikey `{ businessId: 1, allocations.invoiceId: 1 }`. Invoice, payment, ledger, and customer marker updates require MongoDB transaction support. No database connection or credentials are configured; until the tenant repository is injected, payment and transaction APIs return `503`.

Readiness note: the current payment summary and unified transaction-history repository calculates summaries/events from tenant-scoped documents in application memory. Pagination is applied after transaction event assembly. This is correct for current isolated fixtures but can consume substantial memory and scan time for large tenants; before production scale, move summary calculations and event filtering/pagination into aggregation pipelines or streaming queries and benchmark against representative tenant volumes.

## Dashboard and analytics (Phase 7)

All routes require `Authorization: Bearer <token>`. Tenant scope comes only from the verified token's `businessId`; any client-supplied `businessId` query value is ignored. Until an analytics repository is injected, these routes return `503 PERSISTENCE_UNAVAILABLE`.

All monetary values returned by analytics are integer paise (₹1 = 100 paise). Inventory valuations use current product prices; realized sales and profit use invoice records and historical item snapshots. Payment records are not added to sales. Cancelled invoices are excluded from all sales, profit, category and product performance calculations. Invoice status counts use the current non-cancelled invoice records.

### Dashboard overview

`GET /api/dashboard/overview?from=2026-11-01&to=2026-11-07` returns an `overview` object with `totalSalesToday`, `totalSalesThisWeek`, `totalSalesThisMonth`, their corresponding `totalProfit...` values, `totalProducts`, `totalStockQuantity`, `totalInventoryValue` (purchase cost of current stock), `lowStockProductsCount`, `expiringProductsCount`, `totalCustomers`, `outstandingKhataBalance`, `totalTransactionsToday`, `totalInvoicesToday`, and current `paidInvoicesCount`, `partiallyPaidInvoicesCount`, and `unpaidInvoicesCount`.

The optional `from` and `to` values add `salesRange: { from, to, totalSales, totalProfit, totalInvoices }`; they do not rewrite the today/week/month fields, current stock/customer metrics, or current Khata balance. `totalTransactionsToday` counts invoice creation, invoice cancellation, payment receipt, and standalone Khata ledger events; a payment's linked ledger mirror is counted once. `totalInvoicesToday` counts invoices created today, including invoices subsequently cancelled, while sales/profit exclude cancelled invoices.

Example response:

```json
{
  "overview": {
    "totalSalesToday": 125000,
    "totalProfitToday": 32000,
    "totalProducts": 48,
    "totalInventoryValue": 530000,
    "lowStockProductsCount": 4,
    "outstandingKhataBalance": 82500,
    "salesRange": { "from": "2026-11-01T00:00:00.000Z", "to": "2026-11-07T23:59:59.999Z", "totalSales": 780000, "totalProfit": 195000, "totalInvoices": 36 },
    "timezone": "UTC"
  }
}
```

### Sales time series

`GET /api/analytics/sales?period=daily&from=2026-11-01&to=2026-11-07` supports `period=daily|weekly|monthly|yearly` and optional `from`/`to`. Missing bounds default to a recent window (30 days, 12 weeks, 12 months, or 5 years, respectively). The result's `data` is chronological and includes zero-filled buckets with `date`, `totalSales`, `totalProfit`, `totalInvoices`, and `totalUnitsSold`. Weeks begin Monday. Sales use invoice `createdAt` and invoice snapshots; payment dates never add revenue.

### Category and product performance

- `GET /api/analytics/categories?from=2026-11-01&to=2026-11-30` returns `{ "from", "to", "items": [...] }`; each item has `categoryId`, the saved `categoryName` snapshot, `unitsSold`, `totalRevenue`, `totalCost`, `totalProfit`, `profitMarginPercentage`, and `invoiceCount`. Historical invoices without a category snapshot are grouped as `Uncategorized` or `Category snapshot unavailable`; deleted categories remain reportable by their saved name/ID.
- `GET /api/analytics/products?sortBy=unitsSold&order=desc&page=1&limit=20&from=2026-11-01&to=2026-11-30` returns a paginated `{ items, total, page, limit, totalPages, sortBy, order, from, to }`. `sortBy` accepts `unitsSold`, `totalRevenue`, `totalCost`, `totalProfit`, `invoiceCount`, or `profitMarginPercentage`; `order` is `asc` or `desc`. Sorting by units ascending includes current products with zero sales. A page can be used for best/least-selling, highest-revenue, or highest-profit lists by selecting the appropriate sort.

Category/product totals use item-level integer-paise snapshots. Invoice-level discounts are proportionally allocated across product items for analytics; legacy invoices fall back to their stored `lineTotal` and `lineProfit`. Custom non-product invoice charges are included in invoice-level sales/profit, but are not attributed to any product/category.

### Inventory analytics

`GET /api/analytics/inventory` returns `{ "inventory": { "totalProducts", "totalStockQuantity", "totalPurchaseValue", "totalSellingValue", "lowStockProducts", "expiringProducts", "expiredProducts", "categoryWiseStock" } }`. Values are computed from current product purchase/selling prices times stock quantity. Low stock means `stockQuantity <= lowStockThreshold`; expiring means expiry in the current business-local date through the next 30 dates, inclusive; expired means before the current business-local date. Products without an expiry date are omitted from both expiry lists. This current inventory valuation is not realized sales profit.

### Date and timezone behavior

`BUSINESS_TIME_ZONE` is an IANA timezone used by the analytics service and defaults to `UTC`. Date-only values are interpreted as local calendar dates in that timezone; an inclusive `to` date ends at the last millisecond of that local date. Date-time inputs must include `Z` or a numeric offset. Invalid dates, unsupported periods, overlarge sales ranges, and reversed ranges return `400`. This runtime setting is currently global; the tenant integration owner must supply each business's timezone before enabling multi-business timezone-specific reporting. The default is explicit and not inferred from the server host.

### Analytics persistence and indexes

`src/repositories/mongoAnalyticsRepository.js` accepts an injected official MongoDB Node.js Driver `Db` for one tenant and uses MongoDB aggregation pipelines for the dashboard, sales, categories, and product performance. The integration owner must inject it through `createApp({ analyticsDataRepository })` only after selecting the authenticated tenant's database. `src/repositories/unavailableAnalyticsRepository.js` is the production default and returns 503; in-memory fixtures exist only under `test/helpers`. No connection is opened and no database credentials are configured here.

Create/verify tenant indexes for the query patterns: invoices `{ businessId: 1, createdAt: 1 }`, `{ businessId: 1, status: 1, createdAt: 1 }`, multikey `{ businessId: 1, "items.productId": 1 }`, and multikey `{ businessId: 1, "items.categoryId": 1 }`; products `{ businessId: 1, categoryId: 1 }`, `{ businessId: 1, expiryDate: 1 }`, and `{ businessId: 1, stockQuantity: 1 }`; customers `{ businessId: 1 }`; payments `{ businessId: 1, createdAt: 1 }`; and Khata ledger `{ businessId: 1, createdAt: 1 }`. Existing customer-specific ledger and payment indexes from prior phases should be retained. MongoDB 5.0 or later is required for `$dateTrunc`; `$unionWith` is used to include zero-sales products while paginating in the database.

New invoices now save category ID/name and discount-adjusted analytics revenue/profit snapshots on each item. Existing invoices are not backfilled. If a legacy item lacks these fields or a category snapshot, analytics uses the documented fallback. This feature depends on the tenant integration supplying the category collection to the invoice transaction repository as well as the analytics repository.

## Business profile, settings, and reset (Phase 8)

All routes require `Authorization: Bearer <token>`. The business ID is read only from the verified token. Request bodies, query parameters, and headers cannot select a business. Business profile and settings use their own tenant-scoped repository collections and are not stored in the central authentication database.

### Business profile

- `GET /api/business/profile` returns `{ "profile": { "businessName", "businessType", "phone", "email", "address", "createdAt", "updatedAt" } }`. If no profile exists yet, it returns `404 BUSINESS_PROFILE_NOT_FOUND`.
- `PUT /api/business/profile` accepts one or more editable fields. The first profile update must include `businessName`.

```json
{
  "businessName": "Asha General Store",
  "businessType": "Grocery",
  "phone": "+919876543210",
  "email": "owner@example.com",
  "address": "12 Market Road"
}
```

The response uses the same `{ "profile": { ... } }` shape. Email is trimmed and lowercased. Phone punctuation/spacing is removed and the remaining number must contain 8–15 digits, optionally prefixed by `+`. `businessId`, `ownerId`, timestamps, and any other unsupported fields are rejected.

### Business settings

- `GET /api/business/settings` returns `{ "settings": { "currency": "INR", "timezone": "UTC", "lowStockThreshold": 5 } }` when no saved settings exist.
- `PUT /api/business/settings` accepts any non-empty subset of `currency`, `timezone`, and `lowStockThreshold`.

```json
{ "currency": "INR", "timezone": "Asia/Kolkata", "lowStockThreshold": 8 }
```

Currency must be a supported three-letter ISO currency code; timezone must be a valid IANA identifier; the stock threshold must be an integer from 0 through 1,000,000. Unknown/protected settings are rejected. The saved threshold becomes the default for new products when the request omits `lowStockThreshold`; explicit product thresholds continue to take precedence.

When the tenant-scoped business repository is injected, analytics resolves the timezone from that business's settings for each request. Until then, analytics retains the existing global `BUSINESS_TIME_ZONE` fallback (default `UTC`). Tenant-specific settings and their use by analytics are implemented behind dependency injection; persistence has not been verified against a live database.

### Reset preview and confirmation

`GET /api/business/reset/preview` returns tenant-only counts, a SHA-256 snapshot fingerprint, and a timestamp:

```json
{
  "businessId": "business-id-from-token",
  "counts": {
    "products": 12,
    "categories": 4,
    "customers": 35,
    "khataLedgerEntries": 48,
    "invoices": 80,
    "payments": 27,
    "invoiceSequences": 1,
    "transactions": 172
  },
  "snapshotFingerprint": "<64 lowercase hexadecimal characters>",
  "asOf": "2026-11-08T10:30:00.000Z"
}
```

After reviewing the preview, send its exact `counts` object and `snapshotFingerprint` with the required confirmation phrase:

```json
{
  "confirmationText": "RESET MY BUSINESS DATA",
  "counts": {
    "products": 12,
    "categories": 4,
    "customers": 35,
    "khataLedgerEntries": 48,
    "invoices": 80,
    "payments": 27,
    "invoiceSequences": 1,
    "transactions": 172
  },
  "snapshotFingerprint": "<copied from preview>"
}
```

Success (`200`) returns `{ "success": true, "businessId", "resetAt", "deletedCounts", "confirmationText" }`. `transactions` is a count of derived history events, not a separate collection. The reset deletes only the authenticated tenant's products, categories, customers, customer Khata ledger entries, invoices, payments, and invoice-number sequence. It preserves central account/authentication records, tenant connection metadata, business profile, business settings, and the reset audit collection. No collection names or business IDs are accepted from the client.

The Mongo repository rechecks all preview counts and a deterministic fingerprint of the complete BSON documents inside the MongoDB transaction before deleting. The fingerprint detects same-count edits and replacements. Stale previews return `409 RESET_PREVIEW_STALE`; deletion-count mismatches abort with `409 RESET_CONFLICT`. All deletes and a minimal audit record are in the same transaction. Fingerprinting reads every document in the reset allowlist, so preview and reset work grows linearly with tenant data size; operations require enough time/transaction capacity for this scan. If sessions/transactions are unavailable or the tenant database is not a replica set or sharded cluster, reset returns `503 BUSINESS_RESET_TRANSACTION_UNAVAILABLE` without a non-transactional fallback.

Other validation errors return `400 VALIDATION_ERROR`; the initial profile write without `businessName` returns `400 BUSINESS_NAME_REQUIRED`; missing/invalid authentication returns `401`; database-backed profile/settings/preview operations return `503 PERSISTENCE_UNAVAILABLE` until their repository is injected. Missing profiles return `404 BUSINESS_PROFILE_NOT_FOUND`; stale reset previews return `409 RESET_PREVIEW_STALE`, and deletion-count conflicts return `409 RESET_CONFLICT`. Errors use the shared `{ "error", "code" }` response format.

### Integration points and indexes

`src/repositories/mongoBusinessRepository.js` accepts an injected official-driver tenant `Db`. Inject it as `createApp({ businessDataRepository })`; it does not create connections. The adapter uses `businessProfiles` and `businessSettings` for settings/profile state, and `businessResetAudits` for preserved reset audit entries. Create/verify unique `{ businessId: 1 }` indexes for the profile/settings collections and `{ businessId: 1, resetAt: -1 }` for the audit collection. Reset preview/deletion uses business-scoped counts and deletes for products, categories, customers, `customerLedger`, invoices, and payments; retain indexes with `businessId` as a leading key on those collections. The invoice sequence uses `_id: businessId`.

No tenant database is selected here and no real connection was opened. The integration owner must inject the business repository using the tenant selected from authenticated context, verify transaction support, and keep the central user and BYOD connection metadata outside the tenant reset path. Reset counts and transaction behavior are covered with isolated repository tests, not a live MongoDB instance.
