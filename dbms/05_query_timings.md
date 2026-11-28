# अर्थ SAATHI — Query Timings (Simulated Dataset)

> **Important — simulated values, not measured benchmark results.** The three runs below are synthetic illustrative timings created to complete the evaluation format. No PostgreSQL server was run, no SQL query was executed, and no `EXPLAIN ANALYZE` output was collected for these values. Do not describe these numbers as actual measured performance. Replace them with real runs when a PostgreSQL test database is available.

## 1. Purpose and scope

This document provides a timing table for all 46 PostgreSQL-compatible reference queries in `dbms/04_queries.sql`. `READ` and `WRITE` identify the primary operation of each query. Timings are expressed in milliseconds (ms).

The application itself uses MongoDB with a tenant-oriented design. These SQL statements are an academic relational reference and are not executed by the application against MongoDB. The simulated values below are therefore only a documentation/demo exercise for the requested Run 1, Run 2, Run 3 and Average columns; they are not MongoDB measurements or PostgreSQL benchmark evidence.

## 2. Simulation assumptions

The values were generated from a transparent synthetic workload model. The model assigns lower illustrative latency to indexed point lookups and simple writes, and higher latency to multi-table joins, full-range aggregates, `UNION ALL`, and multi-table count operations. Run 1 is modelled as slightly colder; Runs 2 and 3 are modelled as warmed repeat executions with small timing variation.

| Assumption | Simulated profile |
|---|---|
| SQL dialect | PostgreSQL-compatible reference SQL |
| Database engine/version | Not actually instantiated; simulation only |
| Central records | 2,000 users; 1,000 business accounts; 1,000 tenant mappings |
| Tenant records | 10,000 products; 250 categories; 8,000 customers |
| Sales records | 50,000 invoices; 150,000 invoice items |
| Payment/Khata records | 30,000 payments; 45,000 allocations; 40,000 Khata entries |
| Reset audit records | 200 |
| Index assumption | Indexes declared in `dbms/03_schema.sql` are assumed present |
| Concurrent clients | 1 (model assumption) |
| Cache | Run 1 mildly cold; Runs 2–3 warm (model assumption) |
| Hardware / OS / PostgreSQL version | Not measured / not applicable to this simulation |
| Simulation seed | Fixed seed for repeatable generated values |

**How to read this profile:** these row counts and cache conditions are assumptions used to produce plausible relative numbers. They are not a dataset that was loaded into PostgreSQL.

## 3. Timing calculation

For every query, three synthetic run values are provided. The average is calculated arithmetically:

`Average (ms) = (Run 1 + Run 2 + Run 3) / 3`

All run values and averages are rounded to two decimal places. The average is calculated from the displayed two-decimal run values.

## 4. Query timing results — all 46 queries

| Query ID | Query / Operation | Type | Run 1 (ms) | Run 2 (ms) | Run 3 (ms) | Average (ms) |
|---|---|---:|---:|---:|---:|---:|
| Q1 | Register a user (illustrative insert) | WRITE | 1.97 | 1.80 | 1.70 | 1.82 |
| Q2 | Find a user by email during login | READ | 0.41 | 0.38 | 0.36 | 0.38 |
| Q3 | Create a business account for a user | WRITE | 0.99 | 0.91 | 0.88 | 0.93 |
| Q4 | Save tenant database connection metadata | WRITE | 1.16 | 1.08 | 1.05 | 1.10 |
| Q5 | List businesses owned by a user, including owner details | READ | 0.76 | 0.72 | 0.70 | 0.73 |
| Q6 | Resolve tenant metadata for an authenticated business | READ | 0.94 | 0.87 | 0.84 | 0.88 |
| Q7 | Get the business profile | READ | 0.27 | 0.24 | 0.25 | 0.25 |
| Q8 | Update the business profile | WRITE | 0.64 | 0.58 | 0.58 | 0.60 |
| Q9 | Get business settings | READ | 0.25 | 0.22 | 0.22 | 0.23 |
| Q10 | Update business settings | WRITE | 0.57 | 0.51 | 0.51 | 0.53 |
| Q11 | Add a category | WRITE | 0.81 | 0.76 | 0.74 | 0.77 |
| Q12 | List all categories | READ | 1.00 | 0.92 | 0.92 | 0.95 |
| Q13 | Add a product | WRITE | 1.31 | 1.18 | 1.16 | 1.22 |
| Q14 | List active products with their category names | READ | 5.06 | 4.66 | 4.47 | 4.73 |
| Q15 | Update product details and stock | WRITE | 0.78 | 0.72 | 0.70 | 0.73 |
| Q16 | Find products at or below their configured low-stock threshold | READ | 1.60 | 1.48 | 1.41 | 1.50 |
| Q17 | Find products expiring within the next 30 days | READ | 1.38 | 1.27 | 1.20 | 1.28 |
| Q18 | Find expired products | READ | 1.20 | 1.15 | 1.11 | 1.15 |
| Q19 | Calculate inventory valuation by category at cost price (paise) | READ | 4.07 | 3.88 | 3.72 | 3.89 |
| Q20 | Add a customer | WRITE | 1.14 | 1.05 | 1.00 | 1.06 |
| Q21 | Search customers by name or phone | READ | 5.47 | 5.03 | 5.11 | 5.20 |
| Q22 | View a customer's invoice history with customer details | READ | 1.77 | 1.65 | 1.63 | 1.68 |
| Q23 | View a customer's Khata ledger with customer details | READ | 1.80 | 1.70 | 1.67 | 1.72 |
| Q24 | Calculate a customer's outstanding Khata balance | READ | 1.38 | 1.28 | 1.27 | 1.31 |
| Q25 | List customers with a positive outstanding balance | READ | 6.87 | 6.39 | 6.06 | 6.44 |
| Q26 | Create an invoice header | WRITE | 1.48 | 1.33 | 1.34 | 1.38 |
| Q27 | Add a line item to an invoice | WRITE | 0.89 | 0.82 | 0.78 | 0.83 |
| Q28 | Get invoice details, customer details, and invoice line items | READ | 1.18 | 1.11 | 1.07 | 1.12 |
| Q29 | List invoices for a date range with customer details | READ | 5.78 | 5.26 | 5.26 | 5.43 |
| Q30 | Calculate remaining amount due on each invoice | READ | 5.18 | 4.84 | 4.65 | 4.89 |
| Q31 | Cancel an eligible invoice (illustrative status update only) | WRITE | 0.94 | 0.86 | 0.85 | 0.88 |
| Q32 | Record a payment for an existing customer | WRITE | 1.01 | 0.95 | 0.94 | 0.97 |
| Q33 | Allocate a payment to a matching customer's outstanding credit invoice | WRITE | 1.43 | 1.36 | 1.29 | 1.36 |
| Q34 | Recalculate an invoice's paid amount and status after allocations | WRITE | 7.25 | 6.69 | 6.77 | 6.90 |
| Q35 | View payment history for a customer with customer details | READ | 1.65 | 1.50 | 1.50 | 1.55 |
| Q36 | View transaction history by combining invoices and payments | READ | 17.06 | 15.77 | 14.95 | 15.93 |
| Q37 | Calculate today's sales total, excluding cancelled invoices | READ | 1.70 | 1.54 | 1.52 | 1.59 |
| Q38 | Calculate sales grouped by day for a selected period | READ | 5.77 | 5.41 | 5.19 | 5.46 |
| Q39 | Calculate sales by product for a selected period | READ | 11.05 | 10.14 | 10.01 | 10.40 |
| Q40 | Calculate sales by category for a selected period | READ | 14.73 | 13.15 | 13.28 | 13.72 |
| Q41 | Estimate gross profit using the product's current cost price | READ | 12.67 | 11.74 | 11.73 | 12.05 |
| Q42 | Find the best-selling items by units, including custom invoice items | READ | 13.12 | 12.51 | 11.77 | 12.47 |
| Q43 | Find least-selling active products, including products with zero sales | READ | 15.94 | 14.48 | 14.52 | 14.98 |
| Q44 | Preview record counts before a business data reset | READ | 21.23 | 18.96 | 19.22 | 19.80 |
| Q45 | Record a reset audit event after a successful reset | WRITE | 0.86 | 0.75 | 0.76 | 0.79 |
| Q46 | Review recent reset audit events | READ | 0.66 | 0.61 | 0.61 | 0.63 |

## 5. Simulation summary

| Metric | Simulated result |
|---|---:|
| Total queries | 46 |
| READ queries | 30 |
| WRITE queries | 16 |
| Runs per query | 3 |
| Lowest simulated average | Q9 — 0.23 ms |
| Highest simulated average | Q44 — 19.80 ms |
| Mean of all 46 query averages | 3.79 ms |
| Actual queries executed | 0 |
| Actual benchmark status | Not measured |

**Interpretation:** point lookups and small writes are assigned lower model values. Joins and analytics over invoice/invoice-item data are assigned higher values because the assumed dataset is larger and those operations process more rows. This is a modelled relationship, not a measured performance conclusion.

## 6. Reproducible real measurement procedure

To replace the simulation with genuine measurements:

1. Create a dedicated PostgreSQL test database using `dbms/03_schema.sql`.
2. Load a documented synthetic dataset with the same or explicitly updated row counts.
3. Ensure the indexes in the schema were created successfully.
4. Substitute each named placeholder (for example, `:customer_id`) with valid test values using a compatible SQL client or prepared statement. The named-placeholder syntax in `04_queries.sql` is illustrative and may need conversion for `psql`.
5. For each query, execute three times under a documented cache policy. For write queries, use a disposable database or wrap each run in a transaction that is rolled back, except where the query requires a multi-statement transaction test.
6. Capture the plan and actual execution statistics using PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)`; remember that `EXPLAIN ANALYZE` executes the statement.
7. Record the actual elapsed time for each run, recompute the average, and replace the synthetic values in Section 4.
8. Record PostgreSQL version, OS, CPU, RAM, storage, dataset generator/seed, concurrency and cache conditions so the results can be reproduced.

Example:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT product_id, name, stock_quantity
FROM products
WHERE stock_quantity < COALESCE(low_stock_threshold, 5)
ORDER BY stock_quantity ASC;
```

For `INSERT`, `UPDATE` and `DELETE`, use a disposable benchmark database or reset the data between repetitions. Do not accidentally benchmark different data states across Run 1, Run 2 and Run 3.

## 7. Performance considerations

The relational reference schema defines indexes intended to support common lookups and joins, including:

- `business_accounts(owner_user_id)` for listing a user’s businesses.
- `products(category_id)`, `products(stock_quantity)` and `products(expiry_date)` for category and inventory queries.
- `customers(name)` for customer lookup (a leading-wildcard `ILIKE` may still require a sequential scan or a suitable trigram index).
- `invoices(customer_id, created_at)` and `invoices(created_at)` for customer history and date filtering.
- `invoice_items(invoice_id)` for invoice line retrieval.
- `khata_entries(customer_id, created_at)` for ledger history.
- `payments(customer_id, created_at)` for customer payment history.
- `payment_allocations(invoice_id)` for invoice payment aggregation.

Indexes can improve reads but consume storage and add write overhead. The actual benefit must be confirmed with query plans and representative data; the simulated timings cannot prove index effectiveness.

