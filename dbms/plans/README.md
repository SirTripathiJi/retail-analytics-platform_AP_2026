# अर्थ SAATHI — `dbms/plans/`

This folder captures PostgreSQL execution plans for all **46** reference queries in `dbms/04_queries.sql`: **30 READ** plans (`R01`–`R30`) and **16 WRITE** plans (`W01`–`W16`). Each plan file is designed to contain three real executions of `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)`.

## Important project distinction

The application runtime uses MongoDB with a tenant-oriented/BYOD design. `dbms/03_schema.sql` and `dbms/04_queries.sql` are PostgreSQL-compatible **academic relational reference files**. The plans produced here are PostgreSQL benchmark evidence for that reference workload; they are **not MongoDB execution plans** and must not be described as production application timings.

For convenient academic benchmarking, the supplied schema file creates both central-account and tenant-reference tables in the same `public` schema. The capture run therefore uses one isolated benchmark database. This is only a test convenience and does not change the conceptual central/tenant separation described in the schema comments.

## Folder contents

```text
plans/
├── README.md
├── plan_mapping.csv
├── seed_benchmark_data.sql
├── capture_plans.sql
├── plan_observations_template.md
├── validate_capture.sh
└── captured_plans/
    ├── README.md
    ├── R01.txt ... R30.txt
    └── W01.txt ... W16.txt
```

- `plan_mapping.csv` maps every output file to the original query ID and operation type.
- `seed_benchmark_data.sql` inserts a deterministic synthetic dataset and runs `ANALYZE`.
- `capture_plans.sql` runs every selected query three times and writes one output file per query.
- `captured_plans/*.txt` are intentionally marked **NOT CAPTURED** in this package. They become actual PostgreSQL plan outputs only after you run the capture script on your machine.
- `plan_observations_template.md` is for the analysis of the captured plans.
- `validate_capture.sh` checks that all 46 files contain three `Execution Time` records.

## How to run on macOS / Postgres.app

Run these commands from your repository root. Use a new, dedicated database; do not run the write workload against your application or production data.

```bash
createdb arth_saathi_plans
psql -d arth_saathi_plans -v ON_ERROR_STOP=1 -f dbms/03_schema.sql
cd dbms/plans
mkdir -p captured_plans
psql -d arth_saathi_plans -v ON_ERROR_STOP=1 -f capture_plans.sql
./validate_capture.sh
```

If `createdb` is not on your PATH, create a database named `arth_saathi_plans` through Postgres.app / pgAdmin, then continue from the `psql -f` command. Confirm `psql --version` and `SELECT version();` for your report.

The capture script includes `\ir seed_benchmark_data.sql`, so the deterministic data is loaded automatically when capture starts. The seed file is intended for a **fresh database** after the schema has been loaded. If you need to start over, create a new empty benchmark database and load the schema again rather than repeatedly seeding the same database.

## What the seed data contains

| Table | Approximate rows inserted |
|---|---:|
| users | 1 |
| business_accounts | 2 |
| tenant_connections | 1 |
| business_profile / business_settings | 1 each |
| categories | 50 |
| products | 5,000 |
| customers | 2,000 |
| invoices | 10,000 |
| invoice_items | 20,000 |
| khata_entries | 10,000 |
| payments | 5,000 |
| payment_allocations | 4,000 |
| reset_audit_logs | 100 |

These rows are synthetic and generated only for repeatable academic benchmarking. They are not real customer or shop data.

## Safety and measurement notes

1. `EXPLAIN ANALYZE` executes the statement. The 16 write queries are each wrapped in `BEGIN` and `ROLLBACK`, so table changes are not persisted.
2. PostgreSQL sequence increments are **not** rolled back. The test database may therefore have gaps in identity values after write-plan capture; this is expected.
3. Do not remove the transaction boundaries around WRITE queries.
4. Capture runs are sequential in one psql session. The first run may have different cache conditions from later runs; report the environment and avoid claiming a controlled cold-cache benchmark unless you explicitly controlled it.
5. The READ queries use benchmark-only parameter values established in `seed_benchmark_data.sql`. WRITE statements use fixed, rollback-safe test values.
6. The supplied `dbms/05_query_timings.md` currently labels its figures as simulated. After capture, replace its Run 1 / Run 2 / Run 3 values with the `Execution Time` values shown in these files, and recompute the averages. Never relabel simulated numbers as measured.
7. The `SETTINGS` option requires a reasonably recent PostgreSQL version (PostgreSQL 12+). If your server rejects it, remove `SETTINGS` from the `EXPLAIN` options and document that change.

## Interpreting each file

Each output file should contain:

- the plan ID and original `Q` number;
- `RUN 1`, `RUN 2`, and `RUN 3` headings;
- the complete PostgreSQL plan tree;
- planning and execution time;
- buffer information where PostgreSQL reports it.

After capture, run `./validate_capture.sh`. It should report 46 files checked and three `Execution Time` records per file. Then complete `plan_observations_template.md` using evidence from the output; do not guess scan types or index usage.

## Query-to-file ranges

- READ: `R01`–`R30` map to `Q2, Q5, Q6, Q7, Q9, Q12, Q14, Q16–Q19, Q21–Q25, Q28–Q30, Q35–Q44, Q46` in ascending order as recorded in `plan_mapping.csv`.
- WRITE: `W01`–`W16` map to `Q1, Q3, Q4, Q8, Q10, Q11, Q13, Q15, Q20, Q26, Q27, Q31–Q34, Q45` in ascending order.

