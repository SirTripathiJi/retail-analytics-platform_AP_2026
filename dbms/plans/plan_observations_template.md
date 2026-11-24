# Query Plan Observations — अर्थ SAATHI

> Fill this document only after collecting actual `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)` output. Do not infer plan nodes or index usage from the SQL text alone.

## Environment

| Field | Actual value |
|---|---|
| PostgreSQL version (`SELECT version();`) | Pending capture |
| OS / machine | Pending capture |
| Database | `arth_saathi_plans` (recommended isolated benchmark DB) |
| Dataset | `seed_benchmark_data.sql` — 5,000 products, 2,000 customers, 10,000 invoices, 20,000 invoice items, 10,000 Khata entries, 5,000 payments |
| Cache policy | Run 1 / Runs 2–3 as captured; do not label runs cold/warm unless cache state was controlled |
| Concurrent clients | 1 (single-session capture) |
| Capture command | `psql -d arth_saathi_plans -v ON_ERROR_STOP=1 -f capture_plans.sql` |

## Per-query observations

Record the actual plan node(s), join type, index names, estimated and actual rows, shared buffer hits/reads, planning time, and execution time. For write plans also note affected rows and confirm the transaction was rolled back.

| File | Query | Main scan / join nodes | Indexes used | Estimated rows | Actual rows | Buffers (hit/read) | Avg execution (ms) | Observation / possible improvement |
|---|---|---|---|---:|---:|---|---:|---|
| R01 | Q2 | Pending | Pending | | | | | |
| R02 | Q5 | Pending | Pending | | | | | |
| R03 | Q6 | Pending | Pending | | | | | |
| R04–R30 | Q7, Q9, Q12, Q14, Q16–Q25, Q28–Q30, Q35–Q44, Q46 | Fill one row per file after capture | | | | | | |
| W01–W16 | Q1, Q3, Q4, Q8, Q10, Q11, Q13, Q15, Q20, Q26, Q27, Q31–Q34, Q45 | Fill one row per file after capture | | | | | | |

## Interpretation checklist

- Compare estimated rows with actual rows; large differences may indicate stale statistics or skew.
- Distinguish `Seq Scan`, `Index Scan`, `Index Only Scan`, `Bitmap Heap Scan`, and join algorithms as actually shown.
- Inspect `Rows Removed by Filter` and buffer reads/hits where present.
- Do not assume an index is beneficial merely because it exists in `03_schema.sql`.
- A leading-wildcard `ILIKE '%term%'` search may not use the ordinary B-tree index on `customers(name)`.
- `EXPLAIN ANALYZE` executes a statement. The write-plan runner wraps each write in `BEGIN` / `ROLLBACK`; do not remove those boundaries on a real dataset.
- PostgreSQL sequence increments are not rolled back, so identity values can advance even when write rows are rolled back.

