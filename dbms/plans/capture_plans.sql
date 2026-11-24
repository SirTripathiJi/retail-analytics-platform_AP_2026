-- अर्थ SAATHI — EXPLAIN ANALYZE capture runner
-- Run from dbms/plans so captured_plans/ paths resolve correctly.
-- The seed script assumes a fresh database already loaded with 03_schema.sql.
\set ON_ERROR_STOP on
\ir seed_benchmark_data.sql
\echo Starting plan capture. Each query is executed three times.

\o captured_plans/R01.txt
\echo PLAN FILE R01 | Q2 | READ | Find a user by email during login
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT user_id, full_name, email, password_hash
FROM users
WHERE email = :'seed_email';
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT user_id, full_name, email, password_hash
FROM users
WHERE email = :'seed_email';
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT user_id, full_name, email, password_hash
FROM users
WHERE email = :'seed_email';
\o

\o captured_plans/R02.txt
\echo PLAN FILE R02 | Q5 | READ | List businesses owned by a user, including owner details
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT b.business_id, b.business_name, b.created_at,
       u.user_id, u.full_name AS owner_name, u.email AS owner_email
FROM business_accounts AS b
JOIN users AS u ON u.user_id = b.owner_user_id
WHERE b.owner_user_id = :owner_user_id
ORDER BY b.created_at DESC;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT b.business_id, b.business_name, b.created_at,
       u.user_id, u.full_name AS owner_name, u.email AS owner_email
FROM business_accounts AS b
JOIN users AS u ON u.user_id = b.owner_user_id
WHERE b.owner_user_id = :owner_user_id
ORDER BY b.created_at DESC;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT b.business_id, b.business_name, b.created_at,
       u.user_id, u.full_name AS owner_name, u.email AS owner_email
FROM business_accounts AS b
JOIN users AS u ON u.user_id = b.owner_user_id
WHERE b.owner_user_id = :owner_user_id
ORDER BY b.created_at DESC;
\o

\o captured_plans/R03.txt
\echo PLAN FILE R03 | Q6 | READ | Resolve tenant metadata for an authenticated business
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT b.business_id, b.business_name, t.tenant_id, t.provider,
       t.cluster_reference, t.database_name, t.secret_reference
FROM business_accounts AS b
JOIN tenant_connections AS t ON t.business_id = b.business_id
WHERE b.business_id = :'seed_business_id'::uuid
  AND b.owner_user_id = :owner_user_id;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT b.business_id, b.business_name, t.tenant_id, t.provider,
       t.cluster_reference, t.database_name, t.secret_reference
FROM business_accounts AS b
JOIN tenant_connections AS t ON t.business_id = b.business_id
WHERE b.business_id = :'seed_business_id'::uuid
  AND b.owner_user_id = :owner_user_id;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT b.business_id, b.business_name, t.tenant_id, t.provider,
       t.cluster_reference, t.database_name, t.secret_reference
FROM business_accounts AS b
JOIN tenant_connections AS t ON t.business_id = b.business_id
WHERE b.business_id = :'seed_business_id'::uuid
  AND b.owner_user_id = :owner_user_id;
\o

\o captured_plans/R04.txt
\echo PLAN FILE R04 | Q7 | READ | Get the business profile
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT profile_id, business_name, owner_name, phone, email, address,
       created_at, updated_at
FROM business_profile
ORDER BY profile_id
LIMIT 1;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT profile_id, business_name, owner_name, phone, email, address,
       created_at, updated_at
FROM business_profile
ORDER BY profile_id
LIMIT 1;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT profile_id, business_name, owner_name, phone, email, address,
       created_at, updated_at
FROM business_profile
ORDER BY profile_id
LIMIT 1;
\o

\o captured_plans/R05.txt
\echo PLAN FILE R05 | Q9 | READ | Get business settings
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT settings_id, currency, timezone, low_stock_threshold, updated_at
FROM business_settings
ORDER BY settings_id
LIMIT 1;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT settings_id, currency, timezone, low_stock_threshold, updated_at
FROM business_settings
ORDER BY settings_id
LIMIT 1;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT settings_id, currency, timezone, low_stock_threshold, updated_at
FROM business_settings
ORDER BY settings_id
LIMIT 1;
\o

\o captured_plans/R06.txt
\echo PLAN FILE R06 | Q12 | READ | List all categories
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT category_id, name, description, created_at
FROM categories
ORDER BY name;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT category_id, name, description, created_at
FROM categories
ORDER BY name;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT category_id, name, description, created_at
FROM categories
ORDER BY name;
\o

\o captured_plans/R07.txt
\echo PLAN FILE R07 | Q14 | READ | List active products with their category names
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT p.product_id, p.name AS product_name, p.sku,
       c.name AS category_name, p.selling_price_paise,
       p.stock_quantity, p.expiry_date
FROM products AS p
LEFT JOIN categories AS c ON c.category_id = p.category_id
WHERE p.is_active = TRUE
ORDER BY p.name;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT p.product_id, p.name AS product_name, p.sku,
       c.name AS category_name, p.selling_price_paise,
       p.stock_quantity, p.expiry_date
FROM products AS p
LEFT JOIN categories AS c ON c.category_id = p.category_id
WHERE p.is_active = TRUE
ORDER BY p.name;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT p.product_id, p.name AS product_name, p.sku,
       c.name AS category_name, p.selling_price_paise,
       p.stock_quantity, p.expiry_date
FROM products AS p
LEFT JOIN categories AS c ON c.category_id = p.category_id
WHERE p.is_active = TRUE
ORDER BY p.name;
\o

\o captured_plans/R08.txt
\echo PLAN FILE R08 | Q16 | READ | Find products at or below their configured low-stock threshold
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT p.product_id, p.name AS product_name, p.sku,
       c.name AS category_name, p.stock_quantity,
       COALESCE(p.low_stock_threshold, 5) AS low_stock_threshold
FROM products AS p
LEFT JOIN categories AS c ON c.category_id = p.category_id
WHERE p.is_active = TRUE
  AND p.stock_quantity <= COALESCE(p.low_stock_threshold, 5)
ORDER BY p.stock_quantity ASC, p.name ASC;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT p.product_id, p.name AS product_name, p.sku,
       c.name AS category_name, p.stock_quantity,
       COALESCE(p.low_stock_threshold, 5) AS low_stock_threshold
FROM products AS p
LEFT JOIN categories AS c ON c.category_id = p.category_id
WHERE p.is_active = TRUE
  AND p.stock_quantity <= COALESCE(p.low_stock_threshold, 5)
ORDER BY p.stock_quantity ASC, p.name ASC;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT p.product_id, p.name AS product_name, p.sku,
       c.name AS category_name, p.stock_quantity,
       COALESCE(p.low_stock_threshold, 5) AS low_stock_threshold
FROM products AS p
LEFT JOIN categories AS c ON c.category_id = p.category_id
WHERE p.is_active = TRUE
  AND p.stock_quantity <= COALESCE(p.low_stock_threshold, 5)
ORDER BY p.stock_quantity ASC, p.name ASC;
\o

\o captured_plans/R09.txt
\echo PLAN FILE R09 | Q17 | READ | Find products expiring within the next 30 days
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT p.product_id, p.name AS product_name, c.name AS category_name,
       p.expiry_date, p.stock_quantity
FROM products AS p
LEFT JOIN categories AS c ON c.category_id = p.category_id
WHERE p.is_active = TRUE
  AND p.expiry_date >= CURRENT_DATE
  AND p.expiry_date < CURRENT_DATE + INTERVAL '31 days'
ORDER BY p.expiry_date ASC;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT p.product_id, p.name AS product_name, c.name AS category_name,
       p.expiry_date, p.stock_quantity
FROM products AS p
LEFT JOIN categories AS c ON c.category_id = p.category_id
WHERE p.is_active = TRUE
  AND p.expiry_date >= CURRENT_DATE
  AND p.expiry_date < CURRENT_DATE + INTERVAL '31 days'
ORDER BY p.expiry_date ASC;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT p.product_id, p.name AS product_name, c.name AS category_name,
       p.expiry_date, p.stock_quantity
FROM products AS p
LEFT JOIN categories AS c ON c.category_id = p.category_id
WHERE p.is_active = TRUE
  AND p.expiry_date >= CURRENT_DATE
  AND p.expiry_date < CURRENT_DATE + INTERVAL '31 days'
ORDER BY p.expiry_date ASC;
\o

\o captured_plans/R10.txt
\echo PLAN FILE R10 | Q18 | READ | Find expired products
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT p.product_id, p.name AS product_name, c.name AS category_name,
       p.expiry_date, p.stock_quantity
FROM products AS p
LEFT JOIN categories AS c ON c.category_id = p.category_id
WHERE p.is_active = TRUE
  AND p.expiry_date < CURRENT_DATE
ORDER BY p.expiry_date ASC;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT p.product_id, p.name AS product_name, c.name AS category_name,
       p.expiry_date, p.stock_quantity
FROM products AS p
LEFT JOIN categories AS c ON c.category_id = p.category_id
WHERE p.is_active = TRUE
  AND p.expiry_date < CURRENT_DATE
ORDER BY p.expiry_date ASC;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT p.product_id, p.name AS product_name, c.name AS category_name,
       p.expiry_date, p.stock_quantity
FROM products AS p
LEFT JOIN categories AS c ON c.category_id = p.category_id
WHERE p.is_active = TRUE
  AND p.expiry_date < CURRENT_DATE
ORDER BY p.expiry_date ASC;
\o

\o captured_plans/R11.txt
\echo PLAN FILE R11 | Q19 | READ | Calculate inventory valuation by category at cost price
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT c.category_id,
       COALESCE(c.name, 'Uncategorised') AS category_name,
       COALESCE(SUM(p.stock_quantity * COALESCE(p.cost_price_paise, 0)), 0)
           AS inventory_cost_value_paise
FROM products AS p
LEFT JOIN categories AS c ON c.category_id = p.category_id
WHERE p.is_active = TRUE
GROUP BY c.category_id, c.name
ORDER BY inventory_cost_value_paise DESC;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT c.category_id,
       COALESCE(c.name, 'Uncategorised') AS category_name,
       COALESCE(SUM(p.stock_quantity * COALESCE(p.cost_price_paise, 0)), 0)
           AS inventory_cost_value_paise
FROM products AS p
LEFT JOIN categories AS c ON c.category_id = p.category_id
WHERE p.is_active = TRUE
GROUP BY c.category_id, c.name
ORDER BY inventory_cost_value_paise DESC;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT c.category_id,
       COALESCE(c.name, 'Uncategorised') AS category_name,
       COALESCE(SUM(p.stock_quantity * COALESCE(p.cost_price_paise, 0)), 0)
           AS inventory_cost_value_paise
FROM products AS p
LEFT JOIN categories AS c ON c.category_id = p.category_id
WHERE p.is_active = TRUE
GROUP BY c.category_id, c.name
ORDER BY inventory_cost_value_paise DESC;
\o

\o captured_plans/R12.txt
\echo PLAN FILE R12 | Q21 | READ | Search customers by name or phone
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT customer_id, name, phone, email
FROM customers
WHERE name ILIKE '%' || :'search_text' || '%'
   OR phone ILIKE '%' || :'search_text' || '%'
ORDER BY name;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT customer_id, name, phone, email
FROM customers
WHERE name ILIKE '%' || :'search_text' || '%'
   OR phone ILIKE '%' || :'search_text' || '%'
ORDER BY name;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT customer_id, name, phone, email
FROM customers
WHERE name ILIKE '%' || :'search_text' || '%'
   OR phone ILIKE '%' || :'search_text' || '%'
ORDER BY name;
\o

\o captured_plans/R13.txt
\echo PLAN FILE R13 | Q22 | READ | View a customer invoice history with customer details
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT i.invoice_id, i.invoice_number, i.invoice_type, i.status,
       i.total_paise, i.amount_paid_paise,
       GREATEST(i.total_paise - i.amount_paid_paise, 0) AS amount_due_paise,
       i.created_at, c.name AS customer_name, c.phone AS customer_phone
FROM invoices AS i
JOIN customers AS c ON c.customer_id = i.customer_id
WHERE i.customer_id = :customer_id
ORDER BY i.created_at DESC;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT i.invoice_id, i.invoice_number, i.invoice_type, i.status,
       i.total_paise, i.amount_paid_paise,
       GREATEST(i.total_paise - i.amount_paid_paise, 0) AS amount_due_paise,
       i.created_at, c.name AS customer_name, c.phone AS customer_phone
FROM invoices AS i
JOIN customers AS c ON c.customer_id = i.customer_id
WHERE i.customer_id = :customer_id
ORDER BY i.created_at DESC;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT i.invoice_id, i.invoice_number, i.invoice_type, i.status,
       i.total_paise, i.amount_paid_paise,
       GREATEST(i.total_paise - i.amount_paid_paise, 0) AS amount_due_paise,
       i.created_at, c.name AS customer_name, c.phone AS customer_phone
FROM invoices AS i
JOIN customers AS c ON c.customer_id = i.customer_id
WHERE i.customer_id = :customer_id
ORDER BY i.created_at DESC;
\o

\o captured_plans/R14.txt
\echo PLAN FILE R14 | Q23 | READ | View a customer Khata ledger with customer details
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT c.customer_id, c.name AS customer_name, c.phone AS customer_phone,
       k.khata_entry_id, k.entry_type, k.amount_paise, k.description,
       k.reference_type, k.reference_id, k.created_at
FROM customers AS c
JOIN khata_entries AS k ON k.customer_id = c.customer_id
WHERE c.customer_id = :customer_id
ORDER BY k.created_at ASC, k.khata_entry_id ASC;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT c.customer_id, c.name AS customer_name, c.phone AS customer_phone,
       k.khata_entry_id, k.entry_type, k.amount_paise, k.description,
       k.reference_type, k.reference_id, k.created_at
FROM customers AS c
JOIN khata_entries AS k ON k.customer_id = c.customer_id
WHERE c.customer_id = :customer_id
ORDER BY k.created_at ASC, k.khata_entry_id ASC;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT c.customer_id, c.name AS customer_name, c.phone AS customer_phone,
       k.khata_entry_id, k.entry_type, k.amount_paise, k.description,
       k.reference_type, k.reference_id, k.created_at
FROM customers AS c
JOIN khata_entries AS k ON k.customer_id = c.customer_id
WHERE c.customer_id = :customer_id
ORDER BY k.created_at ASC, k.khata_entry_id ASC;
\o

\o captured_plans/R15.txt
\echo PLAN FILE R15 | Q24 | READ | Calculate a customer outstanding Khata balance
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT c.customer_id, c.name AS customer_name,
       COALESCE(SUM(CASE
           WHEN k.entry_type = 'credit' THEN k.amount_paise
           WHEN k.entry_type = 'payment' THEN -k.amount_paise
           WHEN k.entry_type = 'adjustment' THEN k.amount_paise
           ELSE 0 END), 0) AS outstanding_balance_paise
FROM customers AS c
LEFT JOIN khata_entries AS k ON k.customer_id = c.customer_id
WHERE c.customer_id = :customer_id
GROUP BY c.customer_id, c.name;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT c.customer_id, c.name AS customer_name,
       COALESCE(SUM(CASE
           WHEN k.entry_type = 'credit' THEN k.amount_paise
           WHEN k.entry_type = 'payment' THEN -k.amount_paise
           WHEN k.entry_type = 'adjustment' THEN k.amount_paise
           ELSE 0 END), 0) AS outstanding_balance_paise
FROM customers AS c
LEFT JOIN khata_entries AS k ON k.customer_id = c.customer_id
WHERE c.customer_id = :customer_id
GROUP BY c.customer_id, c.name;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT c.customer_id, c.name AS customer_name,
       COALESCE(SUM(CASE
           WHEN k.entry_type = 'credit' THEN k.amount_paise
           WHEN k.entry_type = 'payment' THEN -k.amount_paise
           WHEN k.entry_type = 'adjustment' THEN k.amount_paise
           ELSE 0 END), 0) AS outstanding_balance_paise
FROM customers AS c
LEFT JOIN khata_entries AS k ON k.customer_id = c.customer_id
WHERE c.customer_id = :customer_id
GROUP BY c.customer_id, c.name;
\o

\o captured_plans/R16.txt
\echo PLAN FILE R16 | Q25 | READ | List customers with a positive outstanding balance
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) WITH customer_balances AS (
    SELECT k.customer_id,
           SUM(CASE
               WHEN k.entry_type = 'credit' THEN k.amount_paise
               WHEN k.entry_type = 'payment' THEN -k.amount_paise
               WHEN k.entry_type = 'adjustment' THEN k.amount_paise
               ELSE 0 END) AS outstanding_balance_paise
    FROM khata_entries AS k
    GROUP BY k.customer_id
)
SELECT c.customer_id, c.name, c.phone, cb.outstanding_balance_paise
FROM customers AS c
JOIN customer_balances AS cb ON cb.customer_id = c.customer_id
WHERE cb.outstanding_balance_paise > 0
ORDER BY cb.outstanding_balance_paise DESC, c.name ASC;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) WITH customer_balances AS (
    SELECT k.customer_id,
           SUM(CASE
               WHEN k.entry_type = 'credit' THEN k.amount_paise
               WHEN k.entry_type = 'payment' THEN -k.amount_paise
               WHEN k.entry_type = 'adjustment' THEN k.amount_paise
               ELSE 0 END) AS outstanding_balance_paise
    FROM khata_entries AS k
    GROUP BY k.customer_id
)
SELECT c.customer_id, c.name, c.phone, cb.outstanding_balance_paise
FROM customers AS c
JOIN customer_balances AS cb ON cb.customer_id = c.customer_id
WHERE cb.outstanding_balance_paise > 0
ORDER BY cb.outstanding_balance_paise DESC, c.name ASC;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) WITH customer_balances AS (
    SELECT k.customer_id,
           SUM(CASE
               WHEN k.entry_type = 'credit' THEN k.amount_paise
               WHEN k.entry_type = 'payment' THEN -k.amount_paise
               WHEN k.entry_type = 'adjustment' THEN k.amount_paise
               ELSE 0 END) AS outstanding_balance_paise
    FROM khata_entries AS k
    GROUP BY k.customer_id
)
SELECT c.customer_id, c.name, c.phone, cb.outstanding_balance_paise
FROM customers AS c
JOIN customer_balances AS cb ON cb.customer_id = c.customer_id
WHERE cb.outstanding_balance_paise > 0
ORDER BY cb.outstanding_balance_paise DESC, c.name ASC;
\o

\o captured_plans/R17.txt
\echo PLAN FILE R17 | Q28 | READ | Get invoice details, customer details, and invoice line items
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT i.invoice_id, i.invoice_number, i.invoice_type, i.status,
       i.subtotal_paise, i.discount_paise, i.total_paise, i.amount_paid_paise,
       GREATEST(i.total_paise - i.amount_paid_paise, 0) AS amount_due_paise,
       i.created_at, c.name AS customer_name, c.phone AS customer_phone,
       ii.invoice_item_id, ii.product_id, ii.product_name_snapshot,
       ii.quantity, ii.unit_price_paise, ii.line_total_paise
FROM invoices AS i
LEFT JOIN customers AS c ON c.customer_id = i.customer_id
LEFT JOIN invoice_items AS ii ON ii.invoice_id = i.invoice_id
WHERE i.invoice_id = :invoice_id
ORDER BY ii.invoice_item_id;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT i.invoice_id, i.invoice_number, i.invoice_type, i.status,
       i.subtotal_paise, i.discount_paise, i.total_paise, i.amount_paid_paise,
       GREATEST(i.total_paise - i.amount_paid_paise, 0) AS amount_due_paise,
       i.created_at, c.name AS customer_name, c.phone AS customer_phone,
       ii.invoice_item_id, ii.product_id, ii.product_name_snapshot,
       ii.quantity, ii.unit_price_paise, ii.line_total_paise
FROM invoices AS i
LEFT JOIN customers AS c ON c.customer_id = i.customer_id
LEFT JOIN invoice_items AS ii ON ii.invoice_id = i.invoice_id
WHERE i.invoice_id = :invoice_id
ORDER BY ii.invoice_item_id;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT i.invoice_id, i.invoice_number, i.invoice_type, i.status,
       i.subtotal_paise, i.discount_paise, i.total_paise, i.amount_paid_paise,
       GREATEST(i.total_paise - i.amount_paid_paise, 0) AS amount_due_paise,
       i.created_at, c.name AS customer_name, c.phone AS customer_phone,
       ii.invoice_item_id, ii.product_id, ii.product_name_snapshot,
       ii.quantity, ii.unit_price_paise, ii.line_total_paise
FROM invoices AS i
LEFT JOIN customers AS c ON c.customer_id = i.customer_id
LEFT JOIN invoice_items AS ii ON ii.invoice_id = i.invoice_id
WHERE i.invoice_id = :invoice_id
ORDER BY ii.invoice_item_id;
\o

\o captured_plans/R18.txt
\echo PLAN FILE R18 | Q29 | READ | List invoices for a date range with customer details
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT i.invoice_id, i.invoice_number, i.invoice_type, i.status,
       i.total_paise, i.amount_paid_paise,
       GREATEST(i.total_paise - i.amount_paid_paise, 0) AS amount_due_paise,
       i.created_at, c.name AS customer_name, c.phone AS customer_phone
FROM invoices AS i
LEFT JOIN customers AS c ON c.customer_id = i.customer_id
WHERE i.created_at >= :'start_timestamp'::timestamptz
  AND i.created_at < :'end_timestamp'::timestamptz
ORDER BY i.created_at DESC;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT i.invoice_id, i.invoice_number, i.invoice_type, i.status,
       i.total_paise, i.amount_paid_paise,
       GREATEST(i.total_paise - i.amount_paid_paise, 0) AS amount_due_paise,
       i.created_at, c.name AS customer_name, c.phone AS customer_phone
FROM invoices AS i
LEFT JOIN customers AS c ON c.customer_id = i.customer_id
WHERE i.created_at >= :'start_timestamp'::timestamptz
  AND i.created_at < :'end_timestamp'::timestamptz
ORDER BY i.created_at DESC;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT i.invoice_id, i.invoice_number, i.invoice_type, i.status,
       i.total_paise, i.amount_paid_paise,
       GREATEST(i.total_paise - i.amount_paid_paise, 0) AS amount_due_paise,
       i.created_at, c.name AS customer_name, c.phone AS customer_phone
FROM invoices AS i
LEFT JOIN customers AS c ON c.customer_id = i.customer_id
WHERE i.created_at >= :'start_timestamp'::timestamptz
  AND i.created_at < :'end_timestamp'::timestamptz
ORDER BY i.created_at DESC;
\o

\o captured_plans/R19.txt
\echo PLAN FILE R19 | Q30 | READ | Calculate remaining amount due on each invoice
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT i.invoice_id, i.invoice_number,
       c.name AS customer_name, c.phone AS customer_phone,
       i.total_paise, i.amount_paid_paise,
       GREATEST(i.total_paise - i.amount_paid_paise, 0) AS remaining_paise
FROM invoices AS i
LEFT JOIN customers AS c ON c.customer_id = i.customer_id
WHERE i.status IN ('unpaid', 'partially_paid')
ORDER BY i.created_at DESC;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT i.invoice_id, i.invoice_number,
       c.name AS customer_name, c.phone AS customer_phone,
       i.total_paise, i.amount_paid_paise,
       GREATEST(i.total_paise - i.amount_paid_paise, 0) AS remaining_paise
FROM invoices AS i
LEFT JOIN customers AS c ON c.customer_id = i.customer_id
WHERE i.status IN ('unpaid', 'partially_paid')
ORDER BY i.created_at DESC;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT i.invoice_id, i.invoice_number,
       c.name AS customer_name, c.phone AS customer_phone,
       i.total_paise, i.amount_paid_paise,
       GREATEST(i.total_paise - i.amount_paid_paise, 0) AS remaining_paise
FROM invoices AS i
LEFT JOIN customers AS c ON c.customer_id = i.customer_id
WHERE i.status IN ('unpaid', 'partially_paid')
ORDER BY i.created_at DESC;
\o

\o captured_plans/R20.txt
\echo PLAN FILE R20 | Q35 | READ | View payment history for a customer with customer details
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT p.payment_id, c.name AS customer_name, c.phone AS customer_phone,
       p.payment_method, p.amount_paise, p.reference_number, p.notes, p.created_at
FROM payments AS p
LEFT JOIN customers AS c ON c.customer_id = p.customer_id
WHERE p.customer_id = :customer_id
ORDER BY p.created_at DESC;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT p.payment_id, c.name AS customer_name, c.phone AS customer_phone,
       p.payment_method, p.amount_paise, p.reference_number, p.notes, p.created_at
FROM payments AS p
LEFT JOIN customers AS c ON c.customer_id = p.customer_id
WHERE p.customer_id = :customer_id
ORDER BY p.created_at DESC;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT p.payment_id, c.name AS customer_name, c.phone AS customer_phone,
       p.payment_method, p.amount_paise, p.reference_number, p.notes, p.created_at
FROM payments AS p
LEFT JOIN customers AS c ON c.customer_id = p.customer_id
WHERE p.customer_id = :customer_id
ORDER BY p.created_at DESC;
\o

\o captured_plans/R21.txt
\echo PLAN FILE R21 | Q36 | READ | View transaction history by combining invoices and payments
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT 'invoice' AS transaction_type, invoice_id AS reference_id,
       invoice_number AS description, total_paise AS amount_paise, created_at
FROM invoices
WHERE status <> 'cancelled'
UNION ALL
SELECT 'payment' AS transaction_type, payment_id AS reference_id,
       payment_method AS description, amount_paise, created_at
FROM payments
ORDER BY created_at DESC;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT 'invoice' AS transaction_type, invoice_id AS reference_id,
       invoice_number AS description, total_paise AS amount_paise, created_at
FROM invoices
WHERE status <> 'cancelled'
UNION ALL
SELECT 'payment' AS transaction_type, payment_id AS reference_id,
       payment_method AS description, amount_paise, created_at
FROM payments
ORDER BY created_at DESC;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT 'invoice' AS transaction_type, invoice_id AS reference_id,
       invoice_number AS description, total_paise AS amount_paise, created_at
FROM invoices
WHERE status <> 'cancelled'
UNION ALL
SELECT 'payment' AS transaction_type, payment_id AS reference_id,
       payment_method AS description, amount_paise, created_at
FROM payments
ORDER BY created_at DESC;
\o

\o captured_plans/R22.txt
\echo PLAN FILE R22 | Q37 | READ | Calculate today sales total, excluding cancelled invoices
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT COALESCE(SUM(total_paise), 0) AS today_sales_paise
FROM invoices
WHERE status <> 'cancelled'
  AND created_at >= CURRENT_DATE
  AND created_at < CURRENT_DATE + INTERVAL '1 day';
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT COALESCE(SUM(total_paise), 0) AS today_sales_paise
FROM invoices
WHERE status <> 'cancelled'
  AND created_at >= CURRENT_DATE
  AND created_at < CURRENT_DATE + INTERVAL '1 day';
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT COALESCE(SUM(total_paise), 0) AS today_sales_paise
FROM invoices
WHERE status <> 'cancelled'
  AND created_at >= CURRENT_DATE
  AND created_at < CURRENT_DATE + INTERVAL '1 day';
\o

\o captured_plans/R23.txt
\echo PLAN FILE R23 | Q38 | READ | Calculate sales grouped by day for a selected period
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT DATE_TRUNC('day', created_at) AS sales_day,
       SUM(total_paise) AS sales_paise, COUNT(*) AS invoice_count
FROM invoices
WHERE status <> 'cancelled'
  AND created_at >= :'start_timestamp'::timestamptz
  AND created_at < :'end_timestamp'::timestamptz
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY sales_day;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT DATE_TRUNC('day', created_at) AS sales_day,
       SUM(total_paise) AS sales_paise, COUNT(*) AS invoice_count
FROM invoices
WHERE status <> 'cancelled'
  AND created_at >= :'start_timestamp'::timestamptz
  AND created_at < :'end_timestamp'::timestamptz
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY sales_day;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT DATE_TRUNC('day', created_at) AS sales_day,
       SUM(total_paise) AS sales_paise, COUNT(*) AS invoice_count
FROM invoices
WHERE status <> 'cancelled'
  AND created_at >= :'start_timestamp'::timestamptz
  AND created_at < :'end_timestamp'::timestamptz
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY sales_day;
\o

\o captured_plans/R24.txt
\echo PLAN FILE R24 | Q39 | READ | Calculate sales by product for a selected period
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT ii.product_id, ii.product_name_snapshot,
       SUM(ii.quantity) AS units_sold, SUM(ii.line_total_paise) AS sales_paise
FROM invoice_items AS ii
JOIN invoices AS i ON i.invoice_id = ii.invoice_id
WHERE i.status <> 'cancelled'
  AND i.created_at >= :'start_timestamp'::timestamptz
  AND i.created_at < :'end_timestamp'::timestamptz
GROUP BY ii.product_id, ii.product_name_snapshot
ORDER BY sales_paise DESC;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT ii.product_id, ii.product_name_snapshot,
       SUM(ii.quantity) AS units_sold, SUM(ii.line_total_paise) AS sales_paise
FROM invoice_items AS ii
JOIN invoices AS i ON i.invoice_id = ii.invoice_id
WHERE i.status <> 'cancelled'
  AND i.created_at >= :'start_timestamp'::timestamptz
  AND i.created_at < :'end_timestamp'::timestamptz
GROUP BY ii.product_id, ii.product_name_snapshot
ORDER BY sales_paise DESC;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT ii.product_id, ii.product_name_snapshot,
       SUM(ii.quantity) AS units_sold, SUM(ii.line_total_paise) AS sales_paise
FROM invoice_items AS ii
JOIN invoices AS i ON i.invoice_id = ii.invoice_id
WHERE i.status <> 'cancelled'
  AND i.created_at >= :'start_timestamp'::timestamptz
  AND i.created_at < :'end_timestamp'::timestamptz
GROUP BY ii.product_id, ii.product_name_snapshot
ORDER BY sales_paise DESC;
\o

\o captured_plans/R25.txt
\echo PLAN FILE R25 | Q40 | READ | Calculate sales by category for a selected period
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT c.category_id, c.name AS category_name,
       SUM(ii.quantity) AS units_sold, SUM(ii.line_total_paise) AS sales_paise
FROM invoice_items AS ii
JOIN invoices AS i ON i.invoice_id = ii.invoice_id
JOIN products AS p ON p.product_id = ii.product_id
JOIN categories AS c ON c.category_id = p.category_id
WHERE i.status <> 'cancelled'
  AND i.created_at >= :'start_timestamp'::timestamptz
  AND i.created_at < :'end_timestamp'::timestamptz
GROUP BY c.category_id, c.name
ORDER BY sales_paise DESC;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT c.category_id, c.name AS category_name,
       SUM(ii.quantity) AS units_sold, SUM(ii.line_total_paise) AS sales_paise
FROM invoice_items AS ii
JOIN invoices AS i ON i.invoice_id = ii.invoice_id
JOIN products AS p ON p.product_id = ii.product_id
JOIN categories AS c ON c.category_id = p.category_id
WHERE i.status <> 'cancelled'
  AND i.created_at >= :'start_timestamp'::timestamptz
  AND i.created_at < :'end_timestamp'::timestamptz
GROUP BY c.category_id, c.name
ORDER BY sales_paise DESC;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT c.category_id, c.name AS category_name,
       SUM(ii.quantity) AS units_sold, SUM(ii.line_total_paise) AS sales_paise
FROM invoice_items AS ii
JOIN invoices AS i ON i.invoice_id = ii.invoice_id
JOIN products AS p ON p.product_id = ii.product_id
JOIN categories AS c ON c.category_id = p.category_id
WHERE i.status <> 'cancelled'
  AND i.created_at >= :'start_timestamp'::timestamptz
  AND i.created_at < :'end_timestamp'::timestamptz
GROUP BY c.category_id, c.name
ORDER BY sales_paise DESC;
\o

\o captured_plans/R26.txt
\echo PLAN FILE R26 | Q41 | READ | Estimate gross profit using current product cost price
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT COALESCE(SUM(ii.line_total_paise), 0) AS sales_paise,
       COALESCE(SUM(ii.quantity * COALESCE(p.cost_price_paise, 0)), 0)
           AS estimated_cost_paise,
       COALESCE(SUM(ii.line_total_paise), 0)
       - COALESCE(SUM(ii.quantity * COALESCE(p.cost_price_paise, 0)), 0)
           AS estimated_gross_profit_paise
FROM invoice_items AS ii
JOIN invoices AS i ON i.invoice_id = ii.invoice_id
LEFT JOIN products AS p ON p.product_id = ii.product_id
WHERE i.status <> 'cancelled'
  AND i.created_at >= :'start_timestamp'::timestamptz
  AND i.created_at < :'end_timestamp'::timestamptz;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT COALESCE(SUM(ii.line_total_paise), 0) AS sales_paise,
       COALESCE(SUM(ii.quantity * COALESCE(p.cost_price_paise, 0)), 0)
           AS estimated_cost_paise,
       COALESCE(SUM(ii.line_total_paise), 0)
       - COALESCE(SUM(ii.quantity * COALESCE(p.cost_price_paise, 0)), 0)
           AS estimated_gross_profit_paise
FROM invoice_items AS ii
JOIN invoices AS i ON i.invoice_id = ii.invoice_id
LEFT JOIN products AS p ON p.product_id = ii.product_id
WHERE i.status <> 'cancelled'
  AND i.created_at >= :'start_timestamp'::timestamptz
  AND i.created_at < :'end_timestamp'::timestamptz;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT COALESCE(SUM(ii.line_total_paise), 0) AS sales_paise,
       COALESCE(SUM(ii.quantity * COALESCE(p.cost_price_paise, 0)), 0)
           AS estimated_cost_paise,
       COALESCE(SUM(ii.line_total_paise), 0)
       - COALESCE(SUM(ii.quantity * COALESCE(p.cost_price_paise, 0)), 0)
           AS estimated_gross_profit_paise
FROM invoice_items AS ii
JOIN invoices AS i ON i.invoice_id = ii.invoice_id
LEFT JOIN products AS p ON p.product_id = ii.product_id
WHERE i.status <> 'cancelled'
  AND i.created_at >= :'start_timestamp'::timestamptz
  AND i.created_at < :'end_timestamp'::timestamptz;
\o

\o captured_plans/R27.txt
\echo PLAN FILE R27 | Q42 | READ | Find best-selling items by units, including custom invoice items
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT ii.product_id, ii.product_name_snapshot, p.sku,
       SUM(ii.quantity) AS units_sold
FROM invoice_items AS ii
JOIN invoices AS i ON i.invoice_id = ii.invoice_id
LEFT JOIN products AS p ON p.product_id = ii.product_id
WHERE i.status <> 'cancelled'
GROUP BY ii.product_id, ii.product_name_snapshot, p.sku
ORDER BY units_sold DESC, ii.product_name_snapshot ASC
LIMIT 10;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT ii.product_id, ii.product_name_snapshot, p.sku,
       SUM(ii.quantity) AS units_sold
FROM invoice_items AS ii
JOIN invoices AS i ON i.invoice_id = ii.invoice_id
LEFT JOIN products AS p ON p.product_id = ii.product_id
WHERE i.status <> 'cancelled'
GROUP BY ii.product_id, ii.product_name_snapshot, p.sku
ORDER BY units_sold DESC, ii.product_name_snapshot ASC
LIMIT 10;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT ii.product_id, ii.product_name_snapshot, p.sku,
       SUM(ii.quantity) AS units_sold
FROM invoice_items AS ii
JOIN invoices AS i ON i.invoice_id = ii.invoice_id
LEFT JOIN products AS p ON p.product_id = ii.product_id
WHERE i.status <> 'cancelled'
GROUP BY ii.product_id, ii.product_name_snapshot, p.sku
ORDER BY units_sold DESC, ii.product_name_snapshot ASC
LIMIT 10;
\o

\o captured_plans/R28.txt
\echo PLAN FILE R28 | Q43 | READ | Find least-selling active products, including zero-sales products
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) WITH product_sales AS (
    SELECT ii.product_id, SUM(ii.quantity) AS units_sold
    FROM invoice_items AS ii
    JOIN invoices AS i ON i.invoice_id = ii.invoice_id
    WHERE i.status <> 'cancelled'
      AND ii.product_id IS NOT NULL
    GROUP BY ii.product_id
)
SELECT p.product_id, p.name, COALESCE(ps.units_sold, 0) AS units_sold
FROM products AS p
LEFT JOIN product_sales AS ps ON ps.product_id = p.product_id
WHERE p.is_active = TRUE
ORDER BY units_sold ASC, p.name ASC
LIMIT 10;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) WITH product_sales AS (
    SELECT ii.product_id, SUM(ii.quantity) AS units_sold
    FROM invoice_items AS ii
    JOIN invoices AS i ON i.invoice_id = ii.invoice_id
    WHERE i.status <> 'cancelled'
      AND ii.product_id IS NOT NULL
    GROUP BY ii.product_id
)
SELECT p.product_id, p.name, COALESCE(ps.units_sold, 0) AS units_sold
FROM products AS p
LEFT JOIN product_sales AS ps ON ps.product_id = p.product_id
WHERE p.is_active = TRUE
ORDER BY units_sold ASC, p.name ASC
LIMIT 10;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) WITH product_sales AS (
    SELECT ii.product_id, SUM(ii.quantity) AS units_sold
    FROM invoice_items AS ii
    JOIN invoices AS i ON i.invoice_id = ii.invoice_id
    WHERE i.status <> 'cancelled'
      AND ii.product_id IS NOT NULL
    GROUP BY ii.product_id
)
SELECT p.product_id, p.name, COALESCE(ps.units_sold, 0) AS units_sold
FROM products AS p
LEFT JOIN product_sales AS ps ON ps.product_id = p.product_id
WHERE p.is_active = TRUE
ORDER BY units_sold ASC, p.name ASC
LIMIT 10;
\o

\o captured_plans/R29.txt
\echo PLAN FILE R29 | Q44 | READ | Preview record counts before a business data reset
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT 'products' AS collection_name, COUNT(*) AS record_count FROM products
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL SELECT 'invoice_items', COUNT(*) FROM invoice_items
UNION ALL SELECT 'khata_entries', COUNT(*) FROM khata_entries
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'payment_allocations', COUNT(*) FROM payment_allocations;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT 'products' AS collection_name, COUNT(*) AS record_count FROM products
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL SELECT 'invoice_items', COUNT(*) FROM invoice_items
UNION ALL SELECT 'khata_entries', COUNT(*) FROM khata_entries
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'payment_allocations', COUNT(*) FROM payment_allocations;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT 'products' AS collection_name, COUNT(*) AS record_count FROM products
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL SELECT 'invoice_items', COUNT(*) FROM invoice_items
UNION ALL SELECT 'khata_entries', COUNT(*) FROM khata_entries
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'payment_allocations', COUNT(*) FROM payment_allocations;
\o

\o captured_plans/R30.txt
\echo PLAN FILE R30 | Q46 | READ | Review recent reset audit events
\echo Dataset: deterministic seed; options: ANALYZE BUFFERS VERBOSE SETTINGS
\echo === RUN 1 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT audit_id, action, affected_counts, performed_at
FROM reset_audit_logs
ORDER BY performed_at DESC
LIMIT 20;
\echo === RUN 2 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT audit_id, action, affected_counts, performed_at
FROM reset_audit_logs
ORDER BY performed_at DESC
LIMIT 20;
\echo === RUN 3 ===
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT audit_id, action, affected_counts, performed_at
FROM reset_audit_logs
ORDER BY performed_at DESC
LIMIT 20;
\o

\o captured_plans/W01.txt
\echo PLAN FILE W01 | Q1 | WRITE | Register a user
\echo Each run is wrapped in BEGIN/ROLLBACK so table data is restored.
\echo Note: PostgreSQL identity sequences are not rolled back.
\echo === RUN 1 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO users (full_name, email, password_hash)
VALUES ('Plan Write User', 'plan-write-user@example.test', 'not-a-real-password-hash')
RETURNING user_id, full_name, email, created_at;
ROLLBACK;
\echo === RUN 2 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO users (full_name, email, password_hash)
VALUES ('Plan Write User', 'plan-write-user@example.test', 'not-a-real-password-hash')
RETURNING user_id, full_name, email, created_at;
ROLLBACK;
\echo === RUN 3 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO users (full_name, email, password_hash)
VALUES ('Plan Write User', 'plan-write-user@example.test', 'not-a-real-password-hash')
RETURNING user_id, full_name, email, created_at;
ROLLBACK;
\o

\o captured_plans/W02.txt
\echo PLAN FILE W02 | Q3 | WRITE | Create a business account for a user
\echo Each run is wrapped in BEGIN/ROLLBACK so table data is restored.
\echo Note: PostgreSQL identity sequences are not rolled back.
\echo === RUN 1 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO business_accounts (business_id, owner_user_id, business_name)
VALUES ('44444444-4444-4444-8444-444444444444'::uuid, :owner_user_id, 'Plan Write Business')
RETURNING business_id, owner_user_id, business_name;
ROLLBACK;
\echo === RUN 2 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO business_accounts (business_id, owner_user_id, business_name)
VALUES ('44444444-4444-4444-8444-444444444444'::uuid, :owner_user_id, 'Plan Write Business')
RETURNING business_id, owner_user_id, business_name;
ROLLBACK;
\echo === RUN 3 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO business_accounts (business_id, owner_user_id, business_name)
VALUES ('44444444-4444-4444-8444-444444444444'::uuid, :owner_user_id, 'Plan Write Business')
RETURNING business_id, owner_user_id, business_name;
ROLLBACK;
\o

\o captured_plans/W03.txt
\echo PLAN FILE W03 | Q4 | WRITE | Save tenant database connection metadata
\echo Each run is wrapped in BEGIN/ROLLBACK so table data is restored.
\echo Note: PostgreSQL identity sequences are not rolled back.
\echo === RUN 1 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO tenant_connections
    (tenant_id, business_id, provider, cluster_reference, database_name, secret_reference)
VALUES
    ('55555555-5555-4555-8555-555555555555'::uuid,
     :'second_business_id'::uuid, 'mongodb', 'plan-cluster', 'plan_tenant_db', 'PLAN_SECRET_REF')
RETURNING tenant_id, business_id, provider, database_name;
ROLLBACK;
\echo === RUN 2 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO tenant_connections
    (tenant_id, business_id, provider, cluster_reference, database_name, secret_reference)
VALUES
    ('55555555-5555-4555-8555-555555555555'::uuid,
     :'second_business_id'::uuid, 'mongodb', 'plan-cluster', 'plan_tenant_db', 'PLAN_SECRET_REF')
RETURNING tenant_id, business_id, provider, database_name;
ROLLBACK;
\echo === RUN 3 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO tenant_connections
    (tenant_id, business_id, provider, cluster_reference, database_name, secret_reference)
VALUES
    ('55555555-5555-4555-8555-555555555555'::uuid,
     :'second_business_id'::uuid, 'mongodb', 'plan-cluster', 'plan_tenant_db', 'PLAN_SECRET_REF')
RETURNING tenant_id, business_id, provider, database_name;
ROLLBACK;
\o

\o captured_plans/W04.txt
\echo PLAN FILE W04 | Q8 | WRITE | Update the business profile
\echo Each run is wrapped in BEGIN/ROLLBACK so table data is restored.
\echo Note: PostgreSQL identity sequences are not rolled back.
\echo === RUN 1 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) UPDATE business_profile
SET business_name = 'Plan Updated Business', owner_name = 'Plan Owner',
    phone = '9999900001', email = 'plan-owner@example.test',
    address = 'Benchmark Address', updated_at = CURRENT_TIMESTAMP
WHERE profile_id = :profile_id
RETURNING *;
ROLLBACK;
\echo === RUN 2 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) UPDATE business_profile
SET business_name = 'Plan Updated Business', owner_name = 'Plan Owner',
    phone = '9999900001', email = 'plan-owner@example.test',
    address = 'Benchmark Address', updated_at = CURRENT_TIMESTAMP
WHERE profile_id = :profile_id
RETURNING *;
ROLLBACK;
\echo === RUN 3 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) UPDATE business_profile
SET business_name = 'Plan Updated Business', owner_name = 'Plan Owner',
    phone = '9999900001', email = 'plan-owner@example.test',
    address = 'Benchmark Address', updated_at = CURRENT_TIMESTAMP
WHERE profile_id = :profile_id
RETURNING *;
ROLLBACK;
\o

\o captured_plans/W05.txt
\echo PLAN FILE W05 | Q10 | WRITE | Update business settings
\echo Each run is wrapped in BEGIN/ROLLBACK so table data is restored.
\echo Note: PostgreSQL identity sequences are not rolled back.
\echo === RUN 1 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) UPDATE business_settings
SET currency = 'INR', timezone = 'Asia/Kolkata', low_stock_threshold = 7,
    updated_at = CURRENT_TIMESTAMP
WHERE settings_id = :settings_id
RETURNING *;
ROLLBACK;
\echo === RUN 2 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) UPDATE business_settings
SET currency = 'INR', timezone = 'Asia/Kolkata', low_stock_threshold = 7,
    updated_at = CURRENT_TIMESTAMP
WHERE settings_id = :settings_id
RETURNING *;
ROLLBACK;
\echo === RUN 3 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) UPDATE business_settings
SET currency = 'INR', timezone = 'Asia/Kolkata', low_stock_threshold = 7,
    updated_at = CURRENT_TIMESTAMP
WHERE settings_id = :settings_id
RETURNING *;
ROLLBACK;
\o

\o captured_plans/W06.txt
\echo PLAN FILE W06 | Q11 | WRITE | Add a category
\echo Each run is wrapped in BEGIN/ROLLBACK so table data is restored.
\echo Note: PostgreSQL identity sequences are not rolled back.
\echo === RUN 1 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO categories (name, description)
VALUES ('Plan Explain Category', 'Temporary row for EXPLAIN ANALYZE')
RETURNING *;
ROLLBACK;
\echo === RUN 2 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO categories (name, description)
VALUES ('Plan Explain Category', 'Temporary row for EXPLAIN ANALYZE')
RETURNING *;
ROLLBACK;
\echo === RUN 3 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO categories (name, description)
VALUES ('Plan Explain Category', 'Temporary row for EXPLAIN ANALYZE')
RETURNING *;
ROLLBACK;
\o

\o captured_plans/W07.txt
\echo PLAN FILE W07 | Q13 | WRITE | Add a product
\echo Each run is wrapped in BEGIN/ROLLBACK so table data is restored.
\echo Note: PostgreSQL identity sequences are not rolled back.
\echo === RUN 1 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO products
    (category_id, name, description, sku, selling_price_paise,
     cost_price_paise, stock_quantity, low_stock_threshold, expiry_date)
VALUES
    (:category_id, 'Plan Explain Product', 'Temporary benchmark product',
     'PLAN-EXPLAIN-SKU-001', 25000, 18000, 25, 5, CURRENT_DATE + 30)
RETURNING *;
ROLLBACK;
\echo === RUN 2 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO products
    (category_id, name, description, sku, selling_price_paise,
     cost_price_paise, stock_quantity, low_stock_threshold, expiry_date)
VALUES
    (:category_id, 'Plan Explain Product', 'Temporary benchmark product',
     'PLAN-EXPLAIN-SKU-001', 25000, 18000, 25, 5, CURRENT_DATE + 30)
RETURNING *;
ROLLBACK;
\echo === RUN 3 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO products
    (category_id, name, description, sku, selling_price_paise,
     cost_price_paise, stock_quantity, low_stock_threshold, expiry_date)
VALUES
    (:category_id, 'Plan Explain Product', 'Temporary benchmark product',
     'PLAN-EXPLAIN-SKU-001', 25000, 18000, 25, 5, CURRENT_DATE + 30)
RETURNING *;
ROLLBACK;
\o

\o captured_plans/W08.txt
\echo PLAN FILE W08 | Q15 | WRITE | Update product details and stock
\echo Each run is wrapped in BEGIN/ROLLBACK so table data is restored.
\echo Note: PostgreSQL identity sequences are not rolled back.
\echo === RUN 1 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) UPDATE products
SET name = 'Plan Updated Product', category_id = :category_id,
    selling_price_paise = 26000, cost_price_paise = 19000,
    stock_quantity = 30, low_stock_threshold = 6,
    expiry_date = CURRENT_DATE + 45, updated_at = CURRENT_TIMESTAMP
WHERE product_id = :product_id
RETURNING *;
ROLLBACK;
\echo === RUN 2 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) UPDATE products
SET name = 'Plan Updated Product', category_id = :category_id,
    selling_price_paise = 26000, cost_price_paise = 19000,
    stock_quantity = 30, low_stock_threshold = 6,
    expiry_date = CURRENT_DATE + 45, updated_at = CURRENT_TIMESTAMP
WHERE product_id = :product_id
RETURNING *;
ROLLBACK;
\echo === RUN 3 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) UPDATE products
SET name = 'Plan Updated Product', category_id = :category_id,
    selling_price_paise = 26000, cost_price_paise = 19000,
    stock_quantity = 30, low_stock_threshold = 6,
    expiry_date = CURRENT_DATE + 45, updated_at = CURRENT_TIMESTAMP
WHERE product_id = :product_id
RETURNING *;
ROLLBACK;
\o

\o captured_plans/W09.txt
\echo PLAN FILE W09 | Q20 | WRITE | Add a customer
\echo Each run is wrapped in BEGIN/ROLLBACK so table data is restored.
\echo Note: PostgreSQL identity sequences are not rolled back.
\echo === RUN 1 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO customers (name, phone, email, address)
VALUES ('Plan Explain Customer', '9999900002', 'plan-customer@example.test', 'Benchmark Address')
RETURNING *;
ROLLBACK;
\echo === RUN 2 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO customers (name, phone, email, address)
VALUES ('Plan Explain Customer', '9999900002', 'plan-customer@example.test', 'Benchmark Address')
RETURNING *;
ROLLBACK;
\echo === RUN 3 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO customers (name, phone, email, address)
VALUES ('Plan Explain Customer', '9999900002', 'plan-customer@example.test', 'Benchmark Address')
RETURNING *;
ROLLBACK;
\o

\o captured_plans/W10.txt
\echo PLAN FILE W10 | Q26 | WRITE | Create an invoice header
\echo Each run is wrapped in BEGIN/ROLLBACK so table data is restored.
\echo Note: PostgreSQL identity sequences are not rolled back.
\echo === RUN 1 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO invoices
    (invoice_number, customer_id, invoice_type, status,
     subtotal_paise, discount_paise, total_paise,
     amount_paid_paise, idempotency_key)
VALUES
    ('PLAN-WRITE-INVOICE-001', :customer_id, 'cash', 'paid',
     50000, 0, 50000, 50000, 'PLAN-WRITE-IDEMPOTENCY-001')
RETURNING *;
ROLLBACK;
\echo === RUN 2 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO invoices
    (invoice_number, customer_id, invoice_type, status,
     subtotal_paise, discount_paise, total_paise,
     amount_paid_paise, idempotency_key)
VALUES
    ('PLAN-WRITE-INVOICE-001', :customer_id, 'cash', 'paid',
     50000, 0, 50000, 50000, 'PLAN-WRITE-IDEMPOTENCY-001')
RETURNING *;
ROLLBACK;
\echo === RUN 3 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO invoices
    (invoice_number, customer_id, invoice_type, status,
     subtotal_paise, discount_paise, total_paise,
     amount_paid_paise, idempotency_key)
VALUES
    ('PLAN-WRITE-INVOICE-001', :customer_id, 'cash', 'paid',
     50000, 0, 50000, 50000, 'PLAN-WRITE-IDEMPOTENCY-001')
RETURNING *;
ROLLBACK;
\o

\o captured_plans/W11.txt
\echo PLAN FILE W11 | Q27 | WRITE | Add a line item to an invoice
\echo Each run is wrapped in BEGIN/ROLLBACK so table data is restored.
\echo Note: PostgreSQL identity sequences are not rolled back.
\echo === RUN 1 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO invoice_items
    (invoice_id, product_id, product_name_snapshot,
     quantity, unit_price_paise, line_total_paise)
VALUES
    (:invoice_id, :product_id, 'Plan Product 00001', 2, 25000, 50000)
RETURNING *;
ROLLBACK;
\echo === RUN 2 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO invoice_items
    (invoice_id, product_id, product_name_snapshot,
     quantity, unit_price_paise, line_total_paise)
VALUES
    (:invoice_id, :product_id, 'Plan Product 00001', 2, 25000, 50000)
RETURNING *;
ROLLBACK;
\echo === RUN 3 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO invoice_items
    (invoice_id, product_id, product_name_snapshot,
     quantity, unit_price_paise, line_total_paise)
VALUES
    (:invoice_id, :product_id, 'Plan Product 00001', 2, 25000, 50000)
RETURNING *;
ROLLBACK;
\o

\o captured_plans/W12.txt
\echo PLAN FILE W12 | Q31 | WRITE | Cancel an eligible invoice (status update only)
\echo Each run is wrapped in BEGIN/ROLLBACK so table data is restored.
\echo Note: PostgreSQL identity sequences are not rolled back.
\echo === RUN 1 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) UPDATE invoices
SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
WHERE invoice_id = :cancel_invoice_id
  AND status IN ('unpaid', 'partially_paid')
RETURNING *;
ROLLBACK;
\echo === RUN 2 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) UPDATE invoices
SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
WHERE invoice_id = :cancel_invoice_id
  AND status IN ('unpaid', 'partially_paid')
RETURNING *;
ROLLBACK;
\echo === RUN 3 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) UPDATE invoices
SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
WHERE invoice_id = :cancel_invoice_id
  AND status IN ('unpaid', 'partially_paid')
RETURNING *;
ROLLBACK;
\o

\o captured_plans/W13.txt
\echo PLAN FILE W13 | Q32 | WRITE | Record a payment for an existing customer
\echo Each run is wrapped in BEGIN/ROLLBACK so table data is restored.
\echo Note: PostgreSQL identity sequences are not rolled back.
\echo === RUN 1 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO payments
    (customer_id, payment_method, amount_paise, reference_number, notes)
SELECT c.customer_id, 'upi', 25000, 'PLAN-PAY-REF-001', 'Plan payment test'
FROM customers AS c
WHERE c.customer_id = :customer_id
  AND 25000 > 0
RETURNING *;
ROLLBACK;
\echo === RUN 2 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO payments
    (customer_id, payment_method, amount_paise, reference_number, notes)
SELECT c.customer_id, 'upi', 25000, 'PLAN-PAY-REF-001', 'Plan payment test'
FROM customers AS c
WHERE c.customer_id = :customer_id
  AND 25000 > 0
RETURNING *;
ROLLBACK;
\echo === RUN 3 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO payments
    (customer_id, payment_method, amount_paise, reference_number, notes)
SELECT c.customer_id, 'upi', 25000, 'PLAN-PAY-REF-001', 'Plan payment test'
FROM customers AS c
WHERE c.customer_id = :customer_id
  AND 25000 > 0
RETURNING *;
ROLLBACK;
\o

\o captured_plans/W14.txt
\echo PLAN FILE W14 | Q33 | WRITE | Allocate a payment to a matching outstanding credit invoice
\echo Each run is wrapped in BEGIN/ROLLBACK so table data is restored.
\echo Note: PostgreSQL identity sequences are not rolled back.
\echo === RUN 1 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO payment_allocations (payment_id, invoice_id, allocated_amount_paise)
SELECT p.payment_id, i.invoice_id, 50000
FROM payments AS p
JOIN invoices AS i
  ON i.invoice_id = :allocation_invoice_id
 AND i.customer_id = p.customer_id
WHERE p.payment_id = :allocation_payment_id
  AND p.customer_id IS NOT NULL
  AND i.invoice_type = 'credit'
  AND i.status IN ('unpaid', 'partially_paid')
  AND 50000 > 0
  AND 50000 <= (i.total_paise - i.amount_paid_paise)
  AND 50000 <= (p.amount_paise - COALESCE(
      (SELECT SUM(existing.allocated_amount_paise)
       FROM payment_allocations AS existing
       WHERE existing.payment_id = p.payment_id), 0))
  AND NOT EXISTS (
      SELECT 1 FROM payment_allocations AS existing
      WHERE existing.payment_id = p.payment_id
        AND existing.invoice_id = i.invoice_id)
RETURNING *;
ROLLBACK;
\echo === RUN 2 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO payment_allocations (payment_id, invoice_id, allocated_amount_paise)
SELECT p.payment_id, i.invoice_id, 50000
FROM payments AS p
JOIN invoices AS i
  ON i.invoice_id = :allocation_invoice_id
 AND i.customer_id = p.customer_id
WHERE p.payment_id = :allocation_payment_id
  AND p.customer_id IS NOT NULL
  AND i.invoice_type = 'credit'
  AND i.status IN ('unpaid', 'partially_paid')
  AND 50000 > 0
  AND 50000 <= (i.total_paise - i.amount_paid_paise)
  AND 50000 <= (p.amount_paise - COALESCE(
      (SELECT SUM(existing.allocated_amount_paise)
       FROM payment_allocations AS existing
       WHERE existing.payment_id = p.payment_id), 0))
  AND NOT EXISTS (
      SELECT 1 FROM payment_allocations AS existing
      WHERE existing.payment_id = p.payment_id
        AND existing.invoice_id = i.invoice_id)
RETURNING *;
ROLLBACK;
\echo === RUN 3 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO payment_allocations (payment_id, invoice_id, allocated_amount_paise)
SELECT p.payment_id, i.invoice_id, 50000
FROM payments AS p
JOIN invoices AS i
  ON i.invoice_id = :allocation_invoice_id
 AND i.customer_id = p.customer_id
WHERE p.payment_id = :allocation_payment_id
  AND p.customer_id IS NOT NULL
  AND i.invoice_type = 'credit'
  AND i.status IN ('unpaid', 'partially_paid')
  AND 50000 > 0
  AND 50000 <= (i.total_paise - i.amount_paid_paise)
  AND 50000 <= (p.amount_paise - COALESCE(
      (SELECT SUM(existing.allocated_amount_paise)
       FROM payment_allocations AS existing
       WHERE existing.payment_id = p.payment_id), 0))
  AND NOT EXISTS (
      SELECT 1 FROM payment_allocations AS existing
      WHERE existing.payment_id = p.payment_id
        AND existing.invoice_id = i.invoice_id)
RETURNING *;
ROLLBACK;
\o

\o captured_plans/W15.txt
\echo PLAN FILE W15 | Q34 | WRITE | Recalculate an invoice paid amount and status after allocations
\echo Each run is wrapped in BEGIN/ROLLBACK so table data is restored.
\echo Note: PostgreSQL identity sequences are not rolled back.
\echo === RUN 1 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) WITH allocation_totals AS (
    SELECT invoice_id, SUM(allocated_amount_paise) AS total_paid
    FROM payment_allocations
    WHERE invoice_id = :invoice_id
    GROUP BY invoice_id
)
UPDATE invoices AS i
SET amount_paid_paise = COALESCE(a.total_paid, 0),
    status = CASE
        WHEN i.status = 'cancelled' THEN 'cancelled'
        WHEN COALESCE(a.total_paid, 0) = 0 THEN 'unpaid'
        WHEN COALESCE(a.total_paid, 0) < i.total_paise THEN 'partially_paid'
        ELSE 'paid'
    END
FROM (SELECT invoice_id FROM invoices WHERE invoice_id = :invoice_id) AS target
LEFT JOIN allocation_totals AS a ON a.invoice_id = target.invoice_id
WHERE i.invoice_id = target.invoice_id
RETURNING i.*;
ROLLBACK;
\echo === RUN 2 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) WITH allocation_totals AS (
    SELECT invoice_id, SUM(allocated_amount_paise) AS total_paid
    FROM payment_allocations
    WHERE invoice_id = :invoice_id
    GROUP BY invoice_id
)
UPDATE invoices AS i
SET amount_paid_paise = COALESCE(a.total_paid, 0),
    status = CASE
        WHEN i.status = 'cancelled' THEN 'cancelled'
        WHEN COALESCE(a.total_paid, 0) = 0 THEN 'unpaid'
        WHEN COALESCE(a.total_paid, 0) < i.total_paise THEN 'partially_paid'
        ELSE 'paid'
    END
FROM (SELECT invoice_id FROM invoices WHERE invoice_id = :invoice_id) AS target
LEFT JOIN allocation_totals AS a ON a.invoice_id = target.invoice_id
WHERE i.invoice_id = target.invoice_id
RETURNING i.*;
ROLLBACK;
\echo === RUN 3 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) WITH allocation_totals AS (
    SELECT invoice_id, SUM(allocated_amount_paise) AS total_paid
    FROM payment_allocations
    WHERE invoice_id = :invoice_id
    GROUP BY invoice_id
)
UPDATE invoices AS i
SET amount_paid_paise = COALESCE(a.total_paid, 0),
    status = CASE
        WHEN i.status = 'cancelled' THEN 'cancelled'
        WHEN COALESCE(a.total_paid, 0) = 0 THEN 'unpaid'
        WHEN COALESCE(a.total_paid, 0) < i.total_paise THEN 'partially_paid'
        ELSE 'paid'
    END
FROM (SELECT invoice_id FROM invoices WHERE invoice_id = :invoice_id) AS target
LEFT JOIN allocation_totals AS a ON a.invoice_id = target.invoice_id
WHERE i.invoice_id = target.invoice_id
RETURNING i.*;
ROLLBACK;
\o

\o captured_plans/W16.txt
\echo PLAN FILE W16 | Q45 | WRITE | Record a reset audit event after a successful reset
\echo Each run is wrapped in BEGIN/ROLLBACK so table data is restored.
\echo Note: PostgreSQL identity sequences are not rolled back.
\echo === RUN 1 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO reset_audit_logs (action, affected_counts, fingerprint)
VALUES ('business_data_reset',
        '{"products":5000,"categories":50,"customers":2000}'::jsonb,
        'PLAN-RESET-FINGERPRINT-001')
RETURNING *;
ROLLBACK;
\echo === RUN 2 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO reset_audit_logs (action, affected_counts, fingerprint)
VALUES ('business_data_reset',
        '{"products":5000,"categories":50,"customers":2000}'::jsonb,
        'PLAN-RESET-FINGERPRINT-001')
RETURNING *;
ROLLBACK;
\echo === RUN 3 ===
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) INSERT INTO reset_audit_logs (action, affected_counts, fingerprint)
VALUES ('business_data_reset',
        '{"products":5000,"categories":50,"customers":2000}'::jsonb,
        'PLAN-RESET-FINGERPRINT-001')
RETURNING *;
ROLLBACK;
\o

\echo Plan capture complete. Review captured_plans/*.txt and run ./validate_capture.sh.
