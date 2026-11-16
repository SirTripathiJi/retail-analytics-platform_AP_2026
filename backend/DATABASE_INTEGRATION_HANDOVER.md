# Database Integration Handover

This document describes the current repository boundaries and the remaining work for the BYOD integration owner. No MongoDB client is created by the runtime, no URI is read, and no collection/index/transaction behavior has been verified against a live database.

## Current architecture and the missing tenant provider

`src/config/database.js` is only a central-connection registration boundary (`registerCentralDatabase({ database, close })`, `getDatabase()`, `closeDatabaseConnection()`). It does not create a `MongoClient` or read environment settings. `src/server.js` calls the close boundary on shutdown, but nothing registers a connection today.

`createApp({...})` receives static repositories: `userRepository`, `inventoryProductRepository`, `inventoryCategoryRepository`, `customerDataRepository`, `customerLedgerRepository`, `invoiceDataRepository`, `businessDataRepository`, and `analyticsDataRepository`. `src/repositories/unavailable*.js` are the production defaults and deliberately throw safe `503 PERSISTENCE_UNAVAILABLE` errors. Test-only in-memory implementations live under `test/helpers`; they are never wired into the default server.

Mongo adapters accept an official-driver `Db` in their constructors:

| Factory | Current collections / boundary |
|---|---|
| `createMongoUserRepository(Db)` | Central `users` |
| `createMongoProductRepository(Db)` | Tenant `products` |
| `createMongoCategoryRepository(Db)` | Tenant `categories` |
| `createMongoCustomerRepository(Db)` | Tenant `customers` |
| `createMongoLedgerRepository(Db)` | Tenant `customerLedger`, plus customer revision updates |
| `createMongoInvoiceRepository(Db)` | Tenant `invoices`, `products`, `categories`, `customers`, `customerLedger`, `payments`, `invoiceSequences`; it also implements payment and derived transaction-history repository operations |
| `createMongoBusinessRepository(Db)` | Tenant `businessProfiles`, `businessSettings`, `businessResetAudits`, products/categories/customers/customerLedger/invoices/payments and `invoiceSequences` for reset |
| `createMongoAnalyticsRepository(Db)` | Tenant `invoices`, `products`, `categories`, `customers`, `customerLedger`, `payments` |

Invoice item snapshots are embedded in `invoices.items`; transactions are derived from invoices, payments and ledger rows and have no separate collection. No central business mapping or BYOD connection-metadata repository exists yet. The `businessResetAudits` collection records resets in the tenant database. No adapter currently persists connection metadata.

### Exact gap for BYOD repository injection

The current `createApp` injection is process-static. It has no callback/provider that resolves the authenticated user's tenant `Db` per request. Constructing one adapter per tenant and selecting it from a client-supplied value would be unsafe, and passing one static tenant `Db` to all requests would not implement BYOD.

Smallest safe integration change: add an authenticated tenant-context middleware/provider that takes only `request.auth.businessId` (set after JWT verification), resolves the account-to-business mapping from the trusted central store, obtains the tenant `Db` from server-side BYOD metadata/secret storage, constructs or reuses that tenant's repository bundle, and attaches the bundle to request-local context. Controllers/services should consume that request-local bundle. Do not select a tenant database from body, query, header, `businessId` token field without checking current central mapping, or a client MongoDB URI. Keep a narrow provider interface and test it with distinct fake Db handles for two businesses. This per-request/per-tenant provider is not implemented in the current code; the existing static `createApp` injection is suitable for unit tests or a single fixed adapter only.

The auth service currently signs `businessId` from `user.businessId` when present, otherwise from the user's `_id`/`id`. The central account integration must define stable user-to-business membership and tenant authorization, decide whether one user can belong to multiple businesses, and issue/refresh claims accordingly. A signed old claim alone should not override an updated central membership mapping if revocation or membership changes are required.

## Database responsibilities and data placement

### Central database

- Store application account documents in `users`, including password hash and normalized email. Never store shop inventory, customers, invoices, Khata entries or payments here.
- Enforce a unique normalized email index; registration also handles a Mongo duplicate-key race.
- Implement trusted business-to-user membership and BYOD connection metadata. These collections/services are currently absent; agree their schema and lifecycle with the integration owner.
- Store only secrets or references to secrets in a protected secret manager/KMS-backed store. Avoid embedding raw database URIs in JWTs, logs, API responses or tenant documents accessible to the client.
- Resolve the tenant mapping from the authenticated account and central authorization state before choosing a tenant database.

### Each shopkeeper tenant database

| Collection | Contents |
|---|---|
| `products` | Product catalog and current stock, including rupee-denominated catalog prices |
| `categories` | Business-local category documents |
| `customers` | Customer profile plus the internal `ledgerRevision` serialization marker |
| `customerLedger` | Immutable CREDIT/PAYMENT entries for Khata; API calculations convert rupees to paise |
| `invoices` | Invoice header, embedded `items` snapshots, totals/status, cancellation metadata, idempotency key |
| `payments` | Payment records and embedded invoice allocations, written with invoice and ledger updates |
| `invoiceSequences` | Per-business invoice sequence document; `_id` is the authenticated stable business ID |
| `businessProfiles` | Business profile fields keyed by `businessId` |
| `businessSettings` | Settings document keyed by `businessId` |
| `businessResetAudits` | Preserved audit events for successful reset operations |

There is no standalone `transactions` collection: transaction history is a derived view over invoices, payments and qualifying `customerLedger` entries. The fixed reset deletion allowlist contains products, categories, customers, `customerLedger`, invoices, payments and `invoiceSequences`; it intentionally preserves central account/mapping data, BYOD metadata, profile, settings and reset audits.

## Repository wiring sequence

1. Configure/connect a central `MongoClient` with approved secret-manager configuration; register its `Db` and close callback with `registerCentralDatabase`. Keep connection construction in the integration adapter, not route/service code.
2. Implement central account lookup, membership/authorization and BYOD metadata retrieval. Resolve the current business from trusted account membership after JWT verification.
3. Obtain the tenant `Db` only from trusted server-side metadata. Cache tenant clients safely with bounded lifecycle, rotation/close behavior and no cross-tenant cache-key confusion.
4. Construct Mongo adapters with that tenant Db and provide a repository bundle to the request's service/controller context. All adapters must be given the same tenant Db for a request's cross-collection transaction.
5. Inject the central user repository only into auth services. Tenant business repositories must not use the central Db.
6. Until the tenant-context provider is implemented and reviewed, keep default unavailable repositories enabled. Do not replace them with process memory or use a single tenant Db for multiple businesses.

## Transaction-capable deployment requirements

The following business operations use `MongoClient.startSession()` and `session.withTransaction()`; do not provide non-transactional fallbacks:

- Invoice creation: sequence increment, scoped stock deductions, invoice insert and (for CREDIT) ledger insert.
- Invoice cancellation: scoped invoice state, stock restoration and credit Khata reversal.
- Invoice/customer payment: payment allocation, invoice amount/status updates, payment insert and customer ledger update.
- Khata credit/payment and customer deletion: customer revision marker plus scoped ledger/customer writes.
- Business data reset: stale-preview recheck, fixed allowlist deletions and reset audit insert.

Use a MongoDB replica set or sharded cluster with transaction support and compatible deployment configuration. The adapters pass sessions to collection operations. A standalone `mongod` is not sufficient. Verify retries, transient transaction errors, transaction limits, write concerns, timeout behavior and concurrent stock/payment operations using the actual deployment. Reset fingerprinting scans all reset-eligible BSON documents both at preview and within the transaction; its time/transaction cost grows with tenant size.

Analytics aggregation uses `$dateTrunc`, which requires MongoDB 5.0 or later. `$unionWith` is also used. The tenant and central server versions should be pinned and tested; no database-version check is currently performed by the app.

## Required index plan

These are required/recommended query indexes inferred from the repository filters, sort orders and existing README TODOs. They are **not created or verified** by this project. Include `businessId` as a leading field for tenant collections unless the index uses the invoice sequence `_id` key.

| Collection | Index | Unique? | Purpose / notes |
|---|---|---:|---|
| Central `users` | `{ email: 1 }` | Yes | Normalized login lookup and duplicate-registration race protection. |
| Tenant `products` | `{ businessId: 1, name: 1, _id: 1 }` | No | Tenant product list ordering and pagination. |
| Tenant `products` | `{ businessId: 1, sku: 1 }` | No | Tenant SKU lookup/search. SKU duplicates are not currently rejected by service logic; make this unique only after deciding that contract and cleaning duplicates. Case-insensitive unanchored regex search may not use this efficiently. |
| Tenant `products` | `{ businessId: 1, categoryId: 1 }` | No | Category filter and category reference count before deletion. |
| Tenant `products` | `{ businessId: 1, expiryDate: 1 }` | No | Expiring/expired date range filters. |
| Tenant `products` | `{ businessId: 1, stockQuantity: 1 }` | No | Inventory/low-stock reporting; `$expr` threshold comparison may reduce index selectivity. |
| Tenant `categories` | `{ businessId: 1, normalizedName: 1 }` | Yes | Business-local duplicate category prevention under concurrent creates. |
| Tenant `categories` | `{ businessId: 1, name: 1, _id: 1 }` | No | Paginated category listing order. |
| Tenant `customers` | `{ businessId: 1, normalizedName: 1, phone: 1 }` | Yes | Customer duplicate-candidate rule. Phone alone must not be unique. |
| Tenant `customers` | `{ businessId: 1, fullName: 1, _id: 1 }` | No | Customer list/outstanding search ordering. |
| Tenant `customerLedger` | `{ businessId: 1, customerId: 1, createdAt: 1, _id: 1 }` | No | Per-customer summary scans, chronological transaction reads, bounded ledger paging and customer deletion history checks. |
| Tenant `invoices` | `{ businessId: 1, invoiceNumber: 1 }` | Yes | Tenant-local invoice-number lookup and uniqueness. |
| Tenant `invoices` | `{ businessId: 1, idempotencyKey: 1 }` | Yes, partial | Unique only when `idempotencyKey` is a string/non-null; prevents duplicate invoice creation retries. |
| Tenant `invoices` | `{ businessId: 1, createdAt: -1, _id: -1 }` | No | Invoice list and date range queries. |
| Tenant `invoices` | `{ businessId: 1, customerId: 1, createdAt: -1, _id: -1 }` | No | Customer purchase history. |
| Tenant `invoices` | `{ businessId: 1, status: 1, createdAt: 1 }` | No | Dashboard/status and date analytics. |
| Tenant `invoices` | `{ businessId: 1, "items.productId": 1 }` | No (multikey) | Product performance/history lookups. |
| Tenant `invoices` | `{ businessId: 1, "items.categoryId": 1 }` | No (multikey) | Category performance/history lookups. |
| Tenant `payments` | `{ businessId: 1, paymentId: 1 }` | Yes | Payment identity lookup if exposed ID differs from `_id`; verify the deployed schema and avoid redundant index if paymentId is always `_id`. |
| Tenant `payments` | `{ businessId: 1, idempotencyKey: 1 }` | Yes, partial | Payment retry protection for string/non-null keys. |
| Tenant `payments` | `{ businessId: 1, createdAt: -1, _id: -1 }` | No | Payment list, summary date filter and recent analytics. |
| Tenant `payments` | `{ businessId: 1, customerId: 1, createdAt: -1 }` | No | Customer-scoped payment reads. |
| Tenant `payments` | `{ businessId: 1, "allocations.invoiceId": 1 }` | No (multikey) | Payment history filtered by invoice allocation. |
| Tenant `businessProfiles` | `{ businessId: 1 }` | Yes | Single profile read/upsert per business. |
| Tenant `businessSettings` | `{ businessId: 1 }` | Yes | Single settings read/upsert per business. |
| Tenant `businessResetAudits` | `{ businessId: 1, resetAt: -1 }` | No | Tenant reset audit history. |
| Tenant `invoiceSequences` | `{ _id: 1 }` | Yes (built in) | `_id` is the stable business identifier; MongoDB creates this index. |

Case-insensitive unanchored regex search across product name/SKU and customer name/phone may require a dedicated normalized search design if it becomes slow. Current payment summary, derived transaction history and outstanding Khata service calculations scan tenant data into memory; indexes do not remove those application-level scan costs. Benchmark with realistic tenant volumes before production scale.

## Tenant security and credential handling

- `requireAuthentication` verifies the Bearer JWT using only configured `JWT_SECRET` and puts `{ userId, businessId, email }` on `request.auth`. Invalid and expired JWTs return 401. There is no development signing-secret fallback.
- Only verified `request.auth.businessId`, after checking central user membership, may drive tenant selection. Body/query/header values are data, never a tenant selector.
- Never accept arbitrary MongoDB URIs, database names or cluster hosts from a client. This would permit SSRF/credential exfiltration and cross-tenant access.
- Store credentials in a managed secret store, use least-privileged database users, TLS, rotation, network access controls and encrypted backups. Never log URI strings, passwords, JWTs, password hashes or tenant connection metadata.
- Tenant clients/repositories must be keyed by trusted stable business ID and have lifecycle/eviction behavior. Do not reuse a cached Db under a different business key.
- Keep tenant scoping in the repository queries even when each business has a separate database; it is defense in depth and supports test adapters.
- Maintain two-business tests for list, detail, update, delete, invoices, payments, analytics, profile/settings and reset; add repository-level assertions that filters include business scope and provider-level tests that each authenticated business gets a distinct Db.

## Environment, local use and deployment

Variables actually read by runtime code:

| Variable | Required? | Default/meaning |
|---|---:|---|
| `PORT` | No | `3001`; server listens on this port. |
| `NODE_ENV` | No | If `production` and `CORS_ORIGIN` is absent, no browser origins are allowed. |
| `CORS_ORIGIN` | Deployment configuration | Comma-separated exact browser origins. Development fallback is `http://localhost:5173,http://localhost:4173`. Wildcard `*` is rejected. Configure the real frontend origins for deployment. |
| `JWT_SECRET` | Yes for auth tokens and protected routes | No fallback. Supply a high-entropy deployment secret via secret manager; no value belongs in source control. Missing signing/verification config returns 503 while health remains available. |
| `JWT_EXPIRES_IN` | No | `1h`; accepted by `jsonwebtoken` (e.g. `15m`, `1h`, `1d`). |
| `BUSINESS_TIME_ZONE` | No | `UTC`; global analytics fallback until tenant settings are injected. Use a valid IANA timezone. |
| `CENTRAL_MONGODB_URI` | Not used yet | Blank TODO placeholder in `.env.example`; the integration adapter does not read it. |
| `CENTRAL_MONGODB_DATABASE` | Not used yet | Blank TODO placeholder in `.env.example`; the integration adapter does not read it. |

`src/server.js` loads dotenv. For local setup, copy `.env.example` to `.env`, set a local-only JWT secret through an approved secret mechanism, leave MongoDB placeholders blank, then run `npm install`, `npm run dev`, and `npm test`. Production start command is `npm start`; supply `NODE_ENV=production`, explicit `CORS_ORIGIN`, `JWT_SECRET`, and any desired `PORT`, `JWT_EXPIRES_IN`, and `BUSINESS_TIME_ZONE` through the deployment environment. MongoDB runtime configuration, client initialization, central DB registration, and tenant provider are still pending; do not treat blank placeholders as a functioning connection.

## Explicit integration checklist

- [ ] Agree stable central account/business membership and support for multi-business users.
- [ ] Implement central MongoClient creation, secure configuration, registration in `src/config/database.js`, and graceful close.
- [ ] Define and protect BYOD connection metadata and credential lookup; implement rotation and tenant-client lifecycle.
- [ ] Implement authenticated tenant repository provider; prevent client fields from selecting a tenant Db.
- [ ] Inject the central user repo and the complete tenant repository bundle in request-local tenant context.
- [ ] Provision the index plan above, resolve existing duplicates before unique indexes, and verify query plans.
- [ ] Verify replica-set/sharded transactions for billing, payments, Khata, cancellation and reset; no fallback writes.
- [ ] Test two tenant Db handles and attempt cross-business reads/writes/reset using tampered body/query IDs.
- [ ] Load-test large outstanding balances, payment summaries, transaction history and reset fingerprint scans; optimize before scale as required.
- [ ] Set production CORS origins and strong JWT secret; verify secret storage/rotation, TLS, database least privilege, backups and log redaction.
- [ ] Keep health checks separate from readiness checks; `/api/health` currently only says the API is running and database is not configured.
- [ ] Re-run syntax checks and the full test suite after wiring; only claim database readiness after deployment-specific integration tests pass.
