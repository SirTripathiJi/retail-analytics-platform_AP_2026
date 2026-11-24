-- अर्थ SAATHI — deterministic benchmark seed data
-- Run ONLY after dbms/03_schema.sql has been loaded into a NEW dedicated DB.
-- This script uses explicit identity values so capture_plans.sql can use
-- stable psql variables. It is not application production data.

\set ON_ERROR_STOP on

-- Stable central-account rows used by Q2, Q5, Q6 and write-plan examples.
INSERT INTO users (user_id, full_name, email, password_hash)
OVERRIDING SYSTEM VALUE
VALUES (1, 'Plan Seed Owner', 'plan-seed-owner@example.test', 'benchmark-only-not-a-login-hash')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO business_accounts (business_id, owner_user_id, business_name)
VALUES
 ('11111111-1111-4111-8111-111111111111'::uuid, 1, 'Plan Seed Business'),
 ('22222222-2222-4222-8222-222222222222'::uuid, 1, 'Plan Second Business')
ON CONFLICT (business_id) DO NOTHING;

INSERT INTO tenant_connections
 (tenant_id, business_id, provider, cluster_reference, database_name, secret_reference)
VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  'mongodb', 'plan-seed-cluster', 'plan_seed_tenant', 'PLAN_SEED_SECRET_REF')
ON CONFLICT (tenant_id) DO NOTHING;

-- One profile and one settings row are sufficient for single-record reads.
INSERT INTO business_profile
 (profile_id, business_name, owner_name, phone, email, address)
OVERRIDING SYSTEM VALUE
VALUES (1, 'Plan Seed Retail Store', 'Plan Seed Owner', '9999900000',
        'plan-seed-owner@example.test', 'Benchmark Avenue')
ON CONFLICT (profile_id) DO NOTHING;

INSERT INTO business_settings
 (settings_id, currency, timezone, low_stock_threshold)
OVERRIDING SYSTEM VALUE
VALUES (1, 'INR', 'Asia/Kolkata', 5)
ON CONFLICT (settings_id) DO NOTHING;

-- Moderate synthetic volume makes scan and join plans more informative than
-- an empty database. The dataset is intentionally deterministic.
INSERT INTO categories (category_id, name, description)
OVERRIDING SYSTEM VALUE
SELECT g, 'Plan Category ' || LPAD(g::text, 3, '0'), 'Benchmark category ' || g
FROM generate_series(1, 50) AS g
ON CONFLICT (category_id) DO NOTHING;

INSERT INTO products
 (product_id, category_id, name, description, sku, selling_price_paise,
  cost_price_paise, stock_quantity, low_stock_threshold, expiry_date,
  is_active, created_at, updated_at)
OVERRIDING SYSTEM VALUE
SELECT g,
       ((g - 1) % 50) + 1,
       'Plan Product ' || LPAD(g::text, 5, '0'),
       'Synthetic benchmark product ' || g,
       'PLAN-SKU-' || LPAD(g::text, 5, '0'),
       10000 + ((g * 37) % 90000),
       7000 + ((g * 23) % 60000),
       (g * 7) % 80,
       CASE WHEN g % 4 = 0 THEN 5 ELSE 10 END,
       CASE WHEN g % 5 = 0 THEN CURRENT_DATE - ((g % 20) + 1)
            WHEN g % 5 = 1 THEN CURRENT_DATE + ((g % 30) + 1)
            ELSE CURRENT_DATE + 90 END,
       (g % 13) <> 0,
       CURRENT_TIMESTAMP - (g % 300) * INTERVAL '1 day',
       CURRENT_TIMESTAMP
FROM generate_series(1, 5000) AS g
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO customers (customer_id, name, phone, email, address, created_at, updated_at)
OVERRIDING SYSTEM VALUE
SELECT g,
       'Plan Customer ' || LPAD(g::text, 5, '0'),
       '98' || LPAD(g::text, 8, '0'),
       'plan-customer-' || g || '@example.test',
       'Benchmark Customer Address ' || g,
       CURRENT_TIMESTAMP - (g % 500) * INTERVAL '1 day',
       CURRENT_TIMESTAMP
FROM generate_series(1, 2000) AS g
ON CONFLICT (customer_id) DO NOTHING;

INSERT INTO invoices
 (invoice_id, invoice_number, customer_id, invoice_type, status,
  subtotal_paise, discount_paise, total_paise, amount_paid_paise,
  notes, idempotency_key, created_at, cancelled_at)
OVERRIDING SYSTEM VALUE
SELECT g,
       'PLAN-INV-' || LPAD(g::text, 6, '0'),
       ((g - 1) % 2000) + 1,
       CASE WHEN g % 2 = 0 THEN 'credit' ELSE 'cash' END,
       CASE WHEN g IN (9999, 10000) THEN 'unpaid'
            WHEN g % 17 = 0 THEN 'cancelled'
            WHEN g % 3 = 0 THEN 'partially_paid'
            WHEN g % 2 = 0 THEN 'paid'
            ELSE 'unpaid' END,
       100000 + (g % 90000),
       (g % 5000),
       100000 + (g % 90000),
       CASE WHEN g % 17 = 0 OR g IN (9999,10000) THEN 0
            WHEN g % 3 = 0 THEN (100000 + (g % 90000)) / 2
            WHEN g % 2 = 0 THEN 100000 + (g % 90000)
            ELSE 0 END,
       'Synthetic invoice ' || g,
       'PLAN-IDEM-' || LPAD(g::text, 6, '0'),
       CURRENT_TIMESTAMP - (g % 365) * INTERVAL '1 day',
       CASE WHEN g % 17 = 0 THEN CURRENT_TIMESTAMP - INTERVAL '2 days' ELSE NULL END
FROM generate_series(1, 10000) AS g
ON CONFLICT (invoice_id) DO NOTHING;

INSERT INTO invoice_items
 (invoice_item_id, invoice_id, product_id, product_name_snapshot,
  quantity, unit_price_paise, line_total_paise)
OVERRIDING SYSTEM VALUE
SELECT g,
       ((g - 1) / 2) + 1,
       ((g * 13 - 1) % 5000) + 1,
       'Plan Product ' || LPAD((((g * 13 - 1) % 5000) + 1)::text, 5, '0'),
       (g % 5) + 1,
       10000 + (g % 50000),
       ((g % 5) + 1) * (10000 + (g % 50000))
FROM generate_series(1, 20000) AS g
ON CONFLICT (invoice_item_id) DO NOTHING;

INSERT INTO khata_entries
 (khata_entry_id, customer_id, entry_type, amount_paise, description,
  reference_type, reference_id, created_at)
OVERRIDING SYSTEM VALUE
SELECT g,
       ((g - 1) % 2000) + 1,
       CASE WHEN g % 3 = 0 THEN 'payment'
            WHEN g % 3 = 1 THEN 'credit'
            ELSE 'adjustment' END,
       1000 + (g % 20000),
       'Synthetic Khata entry ' || g,
       'invoice', ((g - 1) % 10000) + 1,
       CURRENT_TIMESTAMP - (g % 365) * INTERVAL '1 day'
FROM generate_series(1, 10000) AS g
ON CONFLICT (khata_entry_id) DO NOTHING;

INSERT INTO payments
 (payment_id, customer_id, payment_method, amount_paise,
  reference_number, notes, created_at)
OVERRIDING SYSTEM VALUE
SELECT g,
       CASE WHEN g = 5000 THEN 2000 ELSE ((g - 1) % 2000) + 1 END,
       CASE WHEN g % 4 = 0 THEN 'upi'
            WHEN g % 4 = 1 THEN 'cash'
            WHEN g % 4 = 2 THEN 'card'
            ELSE 'bank_transfer' END,
       CASE WHEN g = 5000 THEN 1000000 ELSE 20000 + (g % 100000) END,
       'PLAN-PAY-' || LPAD(g::text, 6, '0'),
       'Synthetic payment ' || g,
       CURRENT_TIMESTAMP - (g % 365) * INTERVAL '1 day'
FROM generate_series(1, 5000) AS g
ON CONFLICT (payment_id) DO NOTHING;

-- Keep payment 5000 available for W14 (Q33): it belongs to customer 2000,
-- matches invoice 10000, and has no existing allocation.
INSERT INTO payment_allocations
 (allocation_id, payment_id, invoice_id, allocated_amount_paise, created_at)
OVERRIDING SYSTEM VALUE
SELECT g, g, g, 1000 + (g % 10000), CURRENT_TIMESTAMP - (g % 300) * INTERVAL '1 day'
FROM generate_series(1, 4000) AS g
ON CONFLICT (allocation_id) DO NOTHING;

INSERT INTO reset_audit_logs (audit_id, action, affected_counts, fingerprint, performed_at)
OVERRIDING SYSTEM VALUE
SELECT g, 'benchmark_seed',
       jsonb_build_object('seed_record', g),
       'PLAN-SEED-' || g,
       CURRENT_TIMESTAMP - (g % 100) * INTERVAL '1 day'
FROM generate_series(1, 100) AS g
ON CONFLICT (audit_id) DO NOTHING;

-- Advance identity sequences past the explicitly inserted values.
SELECT setval(pg_get_serial_sequence('users','user_id'), (SELECT GREATEST(COALESCE(MAX(user_id),1),1) FROM users), true);
SELECT setval(pg_get_serial_sequence('business_profile','profile_id'), (SELECT GREATEST(COALESCE(MAX(profile_id),1),1) FROM business_profile), true);
SELECT setval(pg_get_serial_sequence('business_settings','settings_id'), (SELECT GREATEST(COALESCE(MAX(settings_id),1),1) FROM business_settings), true);
SELECT setval(pg_get_serial_sequence('categories','category_id'), (SELECT GREATEST(COALESCE(MAX(category_id),1),1) FROM categories), true);
SELECT setval(pg_get_serial_sequence('products','product_id'), (SELECT GREATEST(COALESCE(MAX(product_id),1),1) FROM products), true);
SELECT setval(pg_get_serial_sequence('customers','customer_id'), (SELECT GREATEST(COALESCE(MAX(customer_id),1),1) FROM customers), true);
SELECT setval(pg_get_serial_sequence('invoices','invoice_id'), (SELECT GREATEST(COALESCE(MAX(invoice_id),1),1) FROM invoices), true);
SELECT setval(pg_get_serial_sequence('invoice_items','invoice_item_id'), (SELECT GREATEST(COALESCE(MAX(invoice_item_id),1),1) FROM invoice_items), true);
SELECT setval(pg_get_serial_sequence('khata_entries','khata_entry_id'), (SELECT GREATEST(COALESCE(MAX(khata_entry_id),1),1) FROM khata_entries), true);
SELECT setval(pg_get_serial_sequence('payments','payment_id'), (SELECT GREATEST(COALESCE(MAX(payment_id),1),1) FROM payments), true);
SELECT setval(pg_get_serial_sequence('payment_allocations','allocation_id'), (SELECT GREATEST(COALESCE(MAX(allocation_id),1),1) FROM payment_allocations), true);
SELECT setval(pg_get_serial_sequence('reset_audit_logs','audit_id'), (SELECT GREATEST(COALESCE(MAX(audit_id),1),1) FROM reset_audit_logs), true);

ANALYZE;

-- psql variables used by capture_plans.sql. These are benchmark-only values.
\set owner_user_id 1
\set seed_email 'plan-seed-owner@example.test'
\set seed_business_id '11111111-1111-4111-8111-111111111111'
\set second_business_id '22222222-2222-4222-8222-222222222222'
\set profile_id 1
\set settings_id 1
\set category_id 1
\set product_id 1
\set customer_id 1
\set invoice_id 1
\set cancel_invoice_id 9999
\set allocation_payment_id 5000
\set allocation_invoice_id 10000
\set search_text 'Customer 00001'
\set start_timestamp '2000-01-01 00:00:00+00'
\set end_timestamp '2099-01-01 00:00:00+00'
