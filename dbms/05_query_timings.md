# अर्थ SAATHI — Query Timings

## 1. Purpose

This document records the execution time of the SQL reference queries defined in
`queries.sql`. It is intended for academic benchmarking and performance analysis.

**Important:** अर्थ SAATHI is designed to use MongoDB with a BYOD tenant
architecture. The accompanying `queries.sql` contains PostgreSQL-compatible
reference queries for documentation. The timings in this document must therefore
be measured only when those reference queries are executed against a configured
PostgreSQL test database. They are not MongoDB performance measurements.

No measured benchmark results have been supplied yet. All result fields below
are intentionally marked **Not measured** rather than using fabricated timings.

## 2. Test Environment

Complete this section when the benchmark is run.

| Parameter | Value |
|---|---|
| Database engine | PostgreSQL (for SQL reference-query benchmark) |
| Database version | Not measured |
| Operating system | Not recorded |
| CPU | Not recorded |
| RAM | Not recorded |
| Storage type | Not recorded |
| Dataset size | Not measured |
| Number of users/businesses | Not measured |
| Benchmark date | Not measured |
| Measurement tool | `EXPLAIN (ANALYZE, BUFFERS)` / benchmark script |
| Cache condition | Not recorded |
| Concurrent clients | Not measured |

## 3. Measurement Methodology

1. Create a test database using the relational reference structure in `schema.sql`.
2. Load a representative dataset covering users, businesses, products,
   categories, customers, invoices, invoice items, Khata entries and payments.
3. Execute each selected query from `queries.sql` using realistic parameter values.
4. Run each query multiple times. Record the first run separately from subsequent
   runs because database cache can affect execution time.
5. Use PostgreSQL's `EXPLAIN (ANALYZE, BUFFERS)` to capture execution time and
   buffer activity. `EXPLAIN ANALYZE` actually executes the query.
6. Record the median execution time across repeated runs. Keep dataset size,
   parameter values and cache conditions consistent when comparing results.

Example:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT product_id, name, stock_quantity
FROM products
WHERE stock_quantity < COALESCE(low_stock_threshold, 5)
ORDER BY stock_quantity ASC;
```

For write queries (`INSERT`, `UPDATE`, `DELETE`), use a dedicated test database
or roll back the transaction after measurement so that repeated runs do not
change the benchmark dataset.

## 4. Query Timing Results

Record execution time in milliseconds (ms). Use the median of at least five
measured runs for the final comparison.

| Query ID | Query / Operation | Dataset Size | Runs | Median (ms) | Notes |
|---|---|---:|---:|---:|---|
| Q1 | Register user | Not measured | — | Not measured | Write query |
| Q2 | Find user by email | Not measured | — | Not measured | Login lookup |
| Q5 | List businesses by owner | Not measured | — | Not measured | Central database |
| Q6 | Resolve tenant metadata | Not measured | — | Not measured | Central database join |
| Q13 | Add product | Not measured | — | Not measured | Write query |
| Q14 | List products with category | Not measured | — | Not measured | Join |
| Q16 | Find low-stock products | Not measured | — | Not measured | Inventory alert |
| Q17 | Find products expiring soon | Not measured | — | Not measured | Date filter |
| Q21 | Search customers | Not measured | — | Not measured | Text search |
| Q23 | Customer Khata ledger | Not measured | — | Not measured | Customer history |
| Q24 | Calculate customer outstanding balance | Not measured | — | Not measured | Aggregation |
| Q28 | Invoice details with line items | Not measured | — | Not measured | Join |
| Q29 | List invoices by date range | Not measured | — | Not measured | Date filter |
| Q35 | Customer payment history | Not measured | — | Not measured | Customer history |
| Q36 | Combined transaction history | Not measured | — | Not measured | `UNION ALL` |
| Q37 | Today's sales total | Not measured | — | Not measured | Dashboard aggregate |
| Q38 | Daily sales for a period | Not measured | — | Not measured | Grouping |
| Q39 | Sales by product | Not measured | — | Not measured | Multi-table aggregation |
| Q40 | Sales by category | Not measured | — | Not measured | Multi-table aggregation |
| Q43 | Least-selling products | Not measured | — | Not measured | Includes zero-sales products |

The table is a suggested representative benchmark set, not a claim that these
queries have already been executed.

## 5. Summary

| Metric | Result |
|---|---|
| Queries selected for timing | 20 |
| Queries successfully benchmarked | 0 |
| Fastest query | Not available |
| Slowest query | Not available |
| Overall median | Not available |
| Benchmark status | Pending measurement |

## 6. Performance Considerations

The following indexes are included in `schema.sql` to support common filters,
joins and sort operations:

- `business_accounts(owner_user_id)` for listing a user's businesses.
- `products(category_id)` for category-based product retrieval.
- `products(stock_quantity)` and `products(expiry_date)` for inventory alerts.
- `invoices(customer_id, created_at)` and `invoices(created_at)` for invoice history
  and date-range reporting.
- `khata_entries(customer_id, created_at)` for Khata ledger history.
- `payments(customer_id, created_at)` for customer payment history.
- `invoice_items(invoice_id)` and `payment_allocations(invoice_id)` for joins.

Indexes do not guarantee faster execution in every situation. Their benefit
must be verified with the actual dataset and query plan. Indexes also add storage
overhead and can increase the cost of writes.

## 7. MongoDB Implementation Note

The production application uses MongoDB, not PostgreSQL. The SQL query timings
measured against this reference schema must not be presented as MongoDB timings.

For a MongoDB performance benchmark, use the actual MongoDB collections,
indexes, tenant database selection and representative documents. Record
execution statistics using MongoDB's `explain("executionStats")`, including
`executionTimeMillis`, `totalDocsExamined` and `totalKeysExamined`.

A valid comparison should clearly identify:
- Database engine and version
- Tenant/database and collection names
- Dataset size and document distribution
- Indexes present
- Query/filter and aggregation pipeline
- Number of repetitions and cache conditions
- Median execution time and examined-document/key counts

## 8. Conclusion

Query timing results are **pending** until the reference SQL queries are run
against a populated PostgreSQL test database. This document provides the
benchmarking procedure and reporting format; it does not claim measured
performance or imply that the production MongoDB database has been benchmarked.
