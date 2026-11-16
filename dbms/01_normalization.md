# Retail Analytics Platform: Database Normalization

## Scope

This document describes a normalized relational model for the retail operations implemented in this repository. The current app stores a per-user JSON object in browser `localStorage` (`products`, `sales`, `customers`, and `settlements`); it does not currently use a relational database. The relations below are a proposed relational representation of that app data. `DE_Project_2026/docs/02_schema_design.md` and `sql/01_schema.sql` were used as a format/reference for documenting keys and functional dependencies, not as a source of retail entities.

The implementation supports inventory products, customer profiles, invoices with repeating item lines, and later customer payments. Sales may include custom items without an inventory product. Stock is decremented for linked inventory items. The app currently stores settlement events separately and updates the paid amount/status on affected sales.

## Business assumptions

- Product IDs, customer IDs, sale IDs, invoice IDs and settlement IDs identify their respective records.
- Product name is unique case-insensitively in the current local data; customer phone is unique when supplied.
- One sale has one customer or no customer (walk-in), and one or more lines. Credit/outstanding sales require a saved customer.
- A sale line can refer to a product or be a custom item. Sale line description and rate describe the transaction at sale time.
- Customer settlements are recorded as events and applied oldest-sale-first. The current record stores settlement amount/method/time and customer, but does not preserve an explicit allocation per sale.
- Product quantity is current on-hand stock. The app does not yet record a stock-movement ledger.
- Current data is browser-local and account-keyed; a production multi-tenant database should include an account/shop key on each owned entity.

## Unnormalized form (UNF)

The app's persisted state is a single JSON-shaped object with arrays. An invoice embeds a repeating `items` array, so a flat relational table cannot treat the invoice as atomic:

```text
RETAIL_DATA(
  products[{product fields}], customers[{customer fields}],
  sales[{sale fields, items[{productId, name, quantity, rate}]}],
  settlements[{customerId, amount, method, createdAt}], dashboardOrder
)
```

Embedding arrays is convenient for browser storage, but creates repeating groups and mixes independent entities in one document.

## First Normal Form (1NF)

**Rule:** each field is atomic and each row represents one entity/line. Expand the repeating invoice items into individual rows. A flat 1NF relation is:

```text
SALE_LINE_1NF(
  sale_id, line_no, invoice_id, created_at, customer_id,
  item_name, product_id, quantity, rate, line_total,
  discount_percent, tax_percent, total, paid, payment_method, status
)
PK (sale_id, line_no)
```

Each item is now a row and each value is scalar. Sale-level values such as invoice ID, customer, tax and payment repeat across all the sale's lines, so this relation has partial dependencies and is not in 2NF.

## Second Normal Form (2NF)

**Rule:** be in 1NF and every non-key attribute depends on the whole key. In `SALE_LINE_1NF`, sale-level values depend only on `sale_id`, not on the full `(sale_id, line_no)` key. Separate invoice header and line data:

```text
SALE(
  sale_id PK, invoice_id UNIQUE, created_at, customer_id FK NULL,
  discount_percent, tax_percent, subtotal, discount, tax,
  total, paid, payment_method, status
)

SALE_ITEM(
  sale_id FK, line_no, product_id FK NULL,
  item_name_snapshot, quantity, rate, line_total,
  PK (sale_id, line_no)
)
```

Header attributes now depend on the sale key; each line's attributes depend on the full composite line key. `product_id` can be NULL for custom items. Product/customer descriptive attributes should be separated as master data to remove transitive dependencies.

## Third Normal Form (3NF)

**Rule:** be in 2NF and avoid non-key attributes depending transitively on a key. Store current product and customer details in their own relations:

```text
PRODUCT(
  product_id PK, name, category, description, cost_price,
  selling_price, quantity, low_stock_threshold, expiry_date,
  created_at
)

CUSTOMER(
  customer_id PK, name, phone UNIQUE NULL, email, address,
  notes, created_at
)

SALE(
  sale_id PK, invoice_id UNIQUE, created_at, customer_id FK NULL,
  discount_percent, tax_percent, subtotal, discount, tax,
  total, paid, payment_method, status
)

SALE_ITEM(
  sale_id FK, line_no, product_id FK NULL,
  item_name_snapshot, quantity, rate, line_total,
  PK (sale_id, line_no)
)

SETTLEMENT(
  settlement_id PK, customer_id FK, amount, method, created_at
)
```

Customer names/contact details are no longer repeated as authoritative values on each sale. Product master values likewise live in `PRODUCT`; the line keeps `item_name_snapshot` and `rate` as the sale-time receipt description and price. These snapshots intentionally preserve history if the current product is renamed or repriced. `line_total`, header totals, `paid` and `status` are derived/maintained values and should be recalculated or validated from line and payment data.

The current settlement model does not store which sale(s) each settlement amount was applied to. For a fully auditable relational design, add an allocation relation:

```text
SETTLEMENT_ALLOCATION(
  settlement_id FK, sale_id FK, amount_applied,
  PK (settlement_id, sale_id)
)
```

This makes the oldest-first application explicit and allows paid balances to be derived as the sum of initial sale payment and allocations. It is a proposed extension rather than a field currently persisted by the app.

Optional category normalization, if categories need their own metadata or controlled names:

```text
CATEGORY(category_id PK, name UNIQUE)
PRODUCT(product_id PK, ..., category_id FK, ...)
```

The current app stores category as a product text field, so a category table is not required by the existing behavior.

## Boyce–Codd Normal Form (BCNF)

**Rule:** every determinant in a non-trivial functional dependency must be a superkey. Under the uniqueness rules above, the core relations can satisfy BCNF:

| Relation | Functional dependency / candidate key | BCNF rationale |
|---|---|---|
| `PRODUCT` | `product_id → all other product attributes`; normalized product name is unique | Each determinant is a candidate key. |
| `CUSTOMER` | `customer_id → profile`; `phone → profile` only when phone is present and unique | Enforce phone uniqueness for non-empty values; otherwise only customer ID is guaranteed. |
| `SALE` | `sale_id → invoice_id, date, customer, totals, payment fields`; `invoice_id → sale_id, ...` | Sale ID and unique invoice ID are candidate keys. |
| `SALE_ITEM` | `(sale_id, line_no) → product, snapshot, quantity, price` | Composite primary key is the determinant. |
| `SETTLEMENT` | `settlement_id → customer, amount, method, date` | Settlement ID is the determinant/candidate key. |
| `SETTLEMENT_ALLOCATION` | `(settlement_id, sale_id) → amount_applied` | Composite primary key is the determinant. |
| `CATEGORY` (optional) | `category_id → name`; `name → category_id` if unique | Both determinants are candidate keys when names are unique. |

With multiple shops/accounts, use `(shop_id, normalized_name)` and `(shop_id, invoice_id)` as scoped alternate keys. Keep surrogate IDs as primary keys and include ownership foreign keys so data is isolated by shop.

## Relationships and integrity

```text
CUSTOMER 1 ─── 0..* SALE 1 ─── 1..* SALE_ITEM * ─── 0..1 PRODUCT
CUSTOMER 1 ─── 0..* SETTLEMENT 1 ─── 0..* SETTLEMENT_ALLOCATION * ─── 1 SALE
```

Use non-negative constraints for stock, quantity, prices and payment amounts; positive checks for item quantity and rate; discount/tax percentages between 0 and 100; and foreign keys across sale, line, customer, product and settlement records. Sale creation and stock decrements should be atomic. A product referenced by a completed sale should be retained or soft-deleted so invoice history remains available, consistent with the current app's deletion guard.

## Reference files

- `src/retail/RetailDataProvider.jsx` — local-storage state and uniqueness/deletion rules.
- `src/retail/retailOperations.js` — invoice creation, stock update and customer settlement behavior.
- `src/retail/retailUtils.js` — persisted retail data shape and invoice calculations.
- `DE_Project_2026/docs/02_schema_design.md` and `DE_Project_2026/sql/01_schema.sql` — documentation and normalization reference.
