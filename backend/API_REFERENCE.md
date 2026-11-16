# अर्थ SAATHI API Reference

This reference describes the routes registered by `src/app.js` and their current validators/controllers/services. Base URL examples use `http://localhost:3001`. All bodies and responses use JSON. Unless stated otherwise, authenticated endpoints require `Authorization: Bearer <JWT>` and derive business scope from the verified token. Supplying `businessId` in a request does not select another business.

## Runtime and status behavior

The current app starts without MongoDB, but database-backed routes use explicit unavailable repositories by default and return `503 PERSISTENCE_UNAVAILABLE`; they do not persist to memory. Success response shapes below describe the route contract when the matching repository is injected. `/api/health` is available without a repository and returns `database: "not_configured"`.

Common errors use `{ "error": "...", "code": "..." }` when a stable code exists. `400` means invalid input; `401` means missing/invalid/expired JWT; `404` means missing route or tenant-scoped resource; `409` means a duplicate or business-rule conflict; `413` means JSON body exceeds 1 MB; `429` means the auth limiter was reached; `503` means persistence, JWT configuration, or required transaction support is unavailable; `500` is a generic unexpected error without stack/database details. Malformed JSON returns `400 INVALID_JSON`. Auth endpoints are limited to 10 requests per IP in 15 minutes.

## Route catalog

### Health and authentication

| Method and route | Auth | Inputs | Success | Errors and validation |
|---|---|---|---|---|
| `GET /api/health` | No | None | `200 { status, service, timestamp, database: "not_configured" }` | No DB probe is performed. |
| `POST /api/auth/register` | No | `Content-Type: application/json`; body: `{ fullName, email, password, businessName }` | `201 { user: { id, fullName, email, businessName, createdAt } }` | `400` required fields, email or password invalid; extra properties are ignored by the current validator; `409 EMAIL_ALREADY_EXISTS`; `503 PERSISTENCE_UNAVAILABLE`; `429 RATE_LIMITED`. Email is trimmed/lowercased; password requires at least 8 characters, one letter and one number. Hashes are never returned. |
| `POST /api/auth/login` | No | `Content-Type: application/json`; body: `{ email, password }` | `200 { user: { id, fullName, email, businessName, createdAt }, token }` | `400` invalid input; extra properties are ignored by the current validator; `401 INVALID_CREDENTIALS`; `503` persistence or JWT signing configuration unavailable; `429 RATE_LIMITED`. |

### Products and categories

| Method and route | Auth | Inputs | Success | Errors and validation |
|---|---|---|---|---|
| `POST /api/products` | Yes | JSON product body: required `name`, `sku`, `purchasePrice`, `sellingPrice`, `stockQuantity`; optional `description`, `categoryId`, `lowStockThreshold`, `unit`, `expiryDate` | `201 { product }` | `400` unknown/missing fields, invalid category/date, price not safe to paise precision, negative/noninteger quantity; `503` persistence. Product prices are nonnegative rupee values with at most two decimals; quantity and threshold are nonnegative integers. |
| `GET /api/products` | Yes | Query: `page` (1), `limit` (20, max 100), `search` (max 100 chars), `categoryId`, `lowStock=true|false`, `expiryWithinDays` (0–3650), `expired=true|false` | `200 { items, total, page, limit, totalPages }` | `400` invalid query/ObjectId; `expired=true` cannot be combined with `expiryWithinDays`; `503` persistence. Search matches name or SKU. |
| `GET /api/products/low-stock` | Yes | Query `page`, `limit` | `200 { items, total, page, limit, totalPages }` | `400` invalid pagination; returns `stockQuantity <= lowStockThreshold`; `503` persistence. |
| `GET /api/products/expiring?days=30` | Yes | Query `days` (default 30, range 0–3650), `page`, `limit` | `200 { items, total, page, limit, totalPages }` | `400` invalid days/pagination; `503` persistence. Dated products only, through the end of the selected UTC date window. |
| `GET /api/products/expired` | Yes | Query `page`, `limit` | `200 { items, total, page, limit, totalPages }` | `400` invalid pagination; products without expiry dates are excluded; `503` persistence. |
| `GET /api/products/:id` | Yes | Path `id` is a 24-character hex ObjectId | `200 { product }` | `400 INVALID_ID`; `404 PRODUCT_NOT_FOUND`; `503` persistence. |
| `PUT /api/products/:id` | Yes | Path `id`; nonempty subset of product creation fields except server timestamps/business scope | `200 { product }` | `400` malformed ID or invalid/unsupported fields; `404 PRODUCT_NOT_FOUND`; `503` persistence. Server updates `updatedAt`. |
| `DELETE /api/products/:id` | Yes | Path `id` | `200 { message: "Product deleted successfully." }` | `400 INVALID_ID`; `404 PRODUCT_NOT_FOUND`; `503` persistence. |
| `POST /api/categories` | Yes | JSON `{ name, description? }` | `201 { category }` | `400` invalid/unsupported fields; `409 CATEGORY_ALREADY_EXISTS`; `503` persistence. Name is required and max 150 chars. |
| `GET /api/categories` | Yes | Query `page`, `limit` | `200 { items, total, page, limit, totalPages }` | `400` invalid pagination; `503` persistence. |
| `PUT /api/categories/:id` | Yes | Path `id`; nonempty JSON subset `{ name?, description? }` | `200 { category }` | `400` invalid ID/body; `404 CATEGORY_NOT_FOUND`; `409 CATEGORY_ALREADY_EXISTS`; `503` persistence. |
| `DELETE /api/categories/:id` | Yes | Path `id` | `200 { message: "Category deleted successfully." }` | `400 INVALID_ID`; `404 CATEGORY_NOT_FOUND`; `409 CATEGORY_IN_USE`; `503` persistence. |

### Customers and Khata

| Method and route | Auth | Inputs | Success | Errors and validation |
|---|---|---|---|---|
| `POST /api/customers` | Yes | JSON `{ fullName, phone, email?, address?, notes? }` | `201 { customer }` | `400` missing/unsupported/invalid fields; `409 CUSTOMER_ALREADY_EXISTS` for same normalized name and phone; `503` persistence. Name max 150, phone 7–15 digits (optional leading `+`), email normalized/lowercase, address max 1000, notes max 2000. |
| `GET /api/customers` | Yes | Query `page` (1), `limit` (20, max 100), `search` (max 100) | `200 { items, total, page, limit, totalPages }` | `400` invalid pagination/search; `503` persistence. Search matches name or normalized phone. |
| `GET /api/customers/:id` | Yes | Path ObjectId | `200 { customer }` | `400 INVALID_ID`; `404 CUSTOMER_NOT_FOUND`; `503` persistence. |
| `PUT /api/customers/:id` | Yes | Path ObjectId; nonempty subset `{ fullName?, phone?, email?, address?, notes? }` | `200 { customer }` | `400` invalid ID/body; `404 CUSTOMER_NOT_FOUND`; `409 CUSTOMER_ALREADY_EXISTS`; `503` persistence. |
| `DELETE /api/customers/:id` | Yes | Path ObjectId | `200 { message: "Customer deleted successfully." }` | `400 INVALID_ID`; `404 CUSTOMER_NOT_FOUND`; `409` when ledger history exists; `503` persistence/transaction support. |
| `GET /api/customers/:id/purchases` | Yes | Path ObjectId; query `page`, `limit` | `200 { items, total, page, limit, totalPages }` (invoice snapshots) | `400` invalid ID/pagination; `404 CUSTOMER_NOT_FOUND`; `503` invoice persistence. |
| `POST /api/customers/:id/khata/credit` | Yes | Path ObjectId; JSON `{ amount, note?, referenceId? }` | `201 { entry, summary }` | `400` positive amount with at most two decimals; `404 CUSTOMER_NOT_FOUND`; `503` ledger transaction unavailable. Creates immutable CREDIT. |
| `POST /api/customers/:id/khata/payments` | Yes | Path ObjectId; JSON `{ amount, paymentMethod?, note?, referenceId? }` | `201 { entry, summary }` | `400` invalid amount/method/body; `404 CUSTOMER_NOT_FOUND`; `409 PAYMENT_EXCEEDS_BALANCE`; `503` ledger transaction unavailable. |
| `GET /api/customers/:id/khata` | Yes | Path ObjectId; query `page`, `limit` | `200 { customerId, entries, total, page, limit, totalPages, summary }` | `400` invalid ID/pagination; `404 CUSTOMER_NOT_FOUND`; `503` persistence. |
| `GET /api/customers/:id/khata/summary` | Yes | Path ObjectId | `200 { customerId, totalCredit, totalPayments, outstandingBalance, entryCount }` | `400 INVALID_ID`; `404 CUSTOMER_NOT_FOUND`; `503` persistence. |
| `GET /api/khata/outstanding` | Yes | Query `page`, `limit`, optional `search` (max 100) | `200 { items: [{ customer, outstandingBalance }], total, page, limit, totalPages }` | `400` invalid query; `503` persistence. Only positive balances are returned. |

Khata body amounts are rupees with at most two decimal places. Ledger entries are immutable through this API. `paymentMethod`, when supplied, is one of `CASH`, `UPI`, `CARD`, `BANK_TRANSFER`, `OTHER`.

### Invoices, payments, and transactions

| Method and route | Auth | Inputs | Success | Errors and validation |
|---|---|---|---|---|
| `POST /api/invoices` | Yes | JSON `{ customerId?, items:[{ productId, quantity }], additionalCharges?:[{ name, quantity?, unitPrice }], discount?, paymentType }`; optional `Idempotency-Key` header | `201 { invoice }` | `400` unsupported fields, invalid ObjectIds/quantities/amount precision; `404` out-of-scope product/customer; `409 INSUFFICIENT_STOCK`; `503` persistence/transactions. Payment type is `CASH` or `CREDIT`; CREDIT requires customer. Client prices are not accepted. Quantities are positive integers. |
| `GET /api/invoices` | Yes | Query `page`, `limit`, `from`, `to`, `customerId`, `status` | `200 { items, total, page, limit, totalPages }` | `400` invalid date/range/status/ID/pagination; `503` persistence. Status accepts `PAID`, `UNPAID`, `PARTIALLY_PAID`, `DUE`, `CANCELLED`. |
| `GET /api/invoices/number/:invoiceNumber` | Yes | Path invoice number (1–80 letters/digits/hyphens) | `200 { invoice }` | `400 VALIDATION_ERROR`; `404 INVOICE_NOT_FOUND`; `503` persistence. |
| `GET /api/invoices/:id` | Yes | Path ObjectId | `200 { invoice }` | `400 INVALID_ID`; `404 INVOICE_NOT_FOUND`; `503` persistence. |
| `POST /api/invoices/:id/cancel` | Yes | Path ObjectId; optional JSON `{ reason? }` (max 500 chars); no body is also allowed | `200 { invoice }` | `400` invalid ID/body; `404 INVOICE_NOT_FOUND`; `409` already cancelled, any recorded payment, partially settled Khata credit, or concurrent cancellation conflict; `503` transaction unavailable. Cancellation restores stock and is transactional. |
| `POST /api/invoices/:id/payments` | Yes | Path ObjectId; payment JSON below; optional `Idempotency-Key` | `201 { payment }` | `400` invalid payment; `404` invoice/customer out of tenant; `409` not payable or amount exceeds due; `503` persistence/transaction unavailable. |
| `POST /api/customers/:id/payments` | Yes | Path customer ObjectId; same payment JSON, optional `allocations:[{ invoiceId, allocatedAmount }]`; optional `Idempotency-Key` | `201 { payment }` | `400` invalid payment/allocation; `404` customer/invoice not found in tenant; `409` allocation exceeds due/customer due; `503` persistence/transaction unavailable. Without allocations, eligible invoices are paid FIFO. Allocation sum must equal payment amount. |
| `GET /api/payments` | Yes | Query `page`, `limit`, `from`, `to`, `customerId`, `invoiceId`, `paymentMethod` | `200 { items, total, page, limit, totalPages }` | `400` invalid date/range/ID/method/pagination; `503` persistence. |
| `GET /api/payments/:id` | Yes | Path ObjectId | `200 { payment }` | `400 INVALID_ID`; `404 PAYMENT_NOT_FOUND`; `503` persistence. |
| `GET /api/payments/summary` | Yes | Query `from`, `to` | `200` payment totals by method, `outstandingCustomerDues`, invoice status counts, `paymentPeriod`, `outstandingBalanceAsOf` | `400` invalid/reversed range; `503` persistence. Monetary totals are paise integers. |
| `GET /api/transactions` | Yes | Query `page`, `limit`, `from`, `to`, `type`, `customerId`, `invoiceId`, `paymentMethod` | `200 { items, total, page, limit, totalPages }` | `400` invalid date/range/type/ID/method/pagination; `503` persistence. Types: `INVOICE_CREATED`, `INVOICE_CANCELLED`, `PAYMENT_RECEIVED`, `CREDIT_RECORDED`, `KHATA_PAYMENT`. |
| `GET /api/transactions/:id` | Yes | Event ID (max 200 chars), e.g. `payment:<id>`, `invoice:<id>:created`, `ledger:<id>` | `200 { transaction }` | `400 VALIDATION_ERROR`; `404 TRANSACTION_NOT_FOUND`; `503` persistence. |

Payment JSON: `{ "amount": 12.50, "paymentMethod": "UPI", "note": "Part payment", "referenceNumber": "TXN-123" }`. Customer-level allocations are `[{ "invoiceId": "<ObjectId>", "allocatedAmount": 12.50 }]`. Request money is rupees with at most two decimals; persisted payment/invoice amounts and responses are integer paise. Idempotency keys accept 8–128 letters/digits/period/underscore/colon/hyphen. Payment methods are `CASH`, `UPI`, `CARD`, `BANK_TRANSFER`, `OTHER`.

Invoice amounts in responses are paise. Product catalog prices and custom-charge `unitPrice` are rupees; invoice totals are computed from catalog snapshots, additional charges and discount. Stock deductions, invoice sequence, invoice write and credit ledger write share a transaction. Payment updates, payment record and ledger entry share a transaction. Cancelled invoices are excluded from sales/profit analytics; payments do not count as new sales.

### Dashboard and analytics

| Method and route | Auth | Inputs | Success | Errors and validation |
|---|---|---|---|---|
| `GET /api/dashboard/overview` | Yes | Optional query `from`, `to` | `200 { overview }` | `400` invalid date/range; `503` analytics persistence. Range adds `salesRange`; other current metrics remain current. |
| `GET /api/analytics/sales` | Yes | Query `period=daily|weekly|monthly|yearly` (default daily), optional `from`, `to` | `200 { period, from, to, timezone, data:[{ date, totalSales, totalProfit, totalInvoices, totalUnitsSold }] }` | `400` invalid period/dates/reversed or excessive range; `503` persistence. Date-only bounds use business timezone; datetimes require `Z` or numeric offset. |
| `GET /api/analytics/categories` | Yes | Optional `from`, `to` | `200 { from, to, items }` | `400` invalid/reversed range; `503` persistence. Monetary analytics fields are paise. |
| `GET /api/analytics/products` | Yes | Query `page`, `limit` (max 100), `sortBy`, `order=asc|desc`, optional `from`, `to` | `200 { items, total, page, limit, totalPages, sortBy, order, from, to }` | `400` invalid range/pagination/sort; `503` persistence. `sortBy`: `unitsSold`, `totalRevenue`, `totalCost`, `totalProfit`, `invoiceCount`, `profitMarginPercentage`. |
| `GET /api/analytics/inventory` | Yes | None | `200 { inventory }` | `503` persistence. Expiry windows use the resolved business timezone. |

Dashboard and analytics values use integer paise for money; invoice snapshots provide historical product costs/profit. Cancelled invoices do not contribute sales/profit. The database repository uses MongoDB `$dateTrunc`; MongoDB 5.0+ is required for that aggregation operator.

### Business profile, settings, and reset

| Method and route | Auth | Inputs | Success | Errors and validation |
|---|---|---|---|---|
| `GET /api/business/profile` | Yes | None | `200 { profile }` | `404 BUSINESS_PROFILE_NOT_FOUND`; `503` persistence. |
| `PUT /api/business/profile` | Yes | Nonempty subset `{ businessName?, businessType?, phone?, email?, address? }` | `200 { profile }` | `400` invalid/unsupported fields; first profile write requires `businessName`; `503` persistence. |
| `GET /api/business/settings` | Yes | None | `200 { settings: { currency, timezone, lowStockThreshold } }` (defaults INR/UTC/5) | `503` persistence. |
| `PUT /api/business/settings` | Yes | Nonempty subset `{ currency?, timezone?, lowStockThreshold? }` | `200 { settings }` | `400` unsupported currency/timezone/threshold; threshold range 0–1,000,000; `503` persistence. |
| `GET /api/business/reset/preview` | Yes | None | `200 { businessId, counts, snapshotFingerprint, asOf }` | `503` persistence. Business ID is from token. |
| `POST /api/business/reset` | Yes | JSON `{ confirmationText:"RESET MY BUSINESS DATA", counts:<exact preview counts>, snapshotFingerprint:<exact preview fingerprint> }` | `200 { success, businessId, resetAt, deletedCounts, confirmationText }` | `400` invalid/missing confirmation, counts, fingerprint or extra fields; `409 RESET_PREVIEW_STALE` or `RESET_CONFLICT`; `503 BUSINESS_RESET_TRANSACTION_UNAVAILABLE`/persistence. Only the fixed tenant operational collection allowlist is deleted in a transaction. |

Profile rules: business name max 150, business type max 80, phone 8–15 digits optionally prefixed `+`, email normalized lowercase, address max 500. Reset counts and fingerprint must be copied from the current preview; never send a client-chosen business ID or collection name.

## Workflow examples

The requests below use placeholders. Database-backed operations return `503` in the current unintegrated runtime until their repositories are connected.

### 1. Register, then log in

```http
POST /api/auth/register
Content-Type: application/json

{"fullName":"Asha Sharma","email":"asha@example.invalid","password":"Example1234","businessName":"Asha Stores"}
```

Registration returns `{ "user": { "id", "fullName", "email", "businessName", "createdAt" } }`. Login uses `{ "email":"asha@example.invalid", "password":"Example1234" }` and returns `{ "user": {...}, "token":"<JWT>" }`. Set `Authorization: Bearer <JWT>` for the remaining examples.

### 2. Create a product and customer

```http
POST /api/products
Authorization: Bearer <JWT>
Content-Type: application/json

{"name":"Green Tea","sku":"GT-001","purchasePrice":4.25,"sellingPrice":6.50,"stockQuantity":20,"lowStockThreshold":5,"unit":"box"}
```

```http
POST /api/customers
Authorization: Bearer <JWT>
Content-Type: application/json

{"fullName":"Mohan Kumar","phone":"+919876543210","email":"mohan@example.invalid"}
```

### 3. Create a cash invoice or a credit sale

```http
POST /api/invoices
Authorization: Bearer <JWT>
Content-Type: application/json
Idempotency-Key: sale-2026-0001

{"items":[{"productId":"<PRODUCT_OBJECT_ID>","quantity":2}],"paymentType":"CASH"}
```

Credit sale: use `paymentType:"CREDIT"` and include `customerId:"<CUSTOMER_OBJECT_ID>"`. A credit sale adds a linked Khata credit in the same transaction.

### 4. Record payment, then view Khata

```http
POST /api/customers/<CUSTOMER_OBJECT_ID>/payments
Authorization: Bearer <JWT>
Content-Type: application/json
Idempotency-Key: receipt-2026-0001

{"amount":10.00,"paymentMethod":"UPI","note":"Part payment"}
```

```http
GET /api/customers/<CUSTOMER_OBJECT_ID>/khata
Authorization: Bearer <JWT>
```

### 5. Retrieve dashboard analytics

```http
GET /api/dashboard/overview?from=2026-11-01&to=2026-11-30
Authorization: Bearer <JWT>
```

### 6. Update settings and safely preview reset

```http
PUT /api/business/settings
Authorization: Bearer <JWT>
Content-Type: application/json

{"currency":"INR","timezone":"Asia/Kolkata","lowStockThreshold":8}
```

```http
GET /api/business/reset/preview
Authorization: Bearer <JWT>
```

To confirm, send `POST /api/business/reset` with the exact returned `counts` and `snapshotFingerprint`, plus `confirmationText:"RESET MY BUSINESS DATA"`. The fingerprint is intentionally omitted here; it must be copied from a fresh preview.
