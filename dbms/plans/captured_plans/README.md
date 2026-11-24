# Captured plan outputs

The `.txt` files in this directory are placeholders in the supplied package. They deliberately do not contain invented PostgreSQL plans.

After loading `dbms/03_schema.sql` into a dedicated benchmark database, run `capture_plans.sql` from the parent `plans/` directory. The script overwrites each placeholder with the real output from three `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)` executions.

A valid captured file should show three `Execution Time:` lines. Verify the complete set by running `./validate_capture.sh` from the parent `plans/` directory.
