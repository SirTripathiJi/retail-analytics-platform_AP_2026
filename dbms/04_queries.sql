-- अर्थ SAATHI - SQL Query Reference
-- Companion file for schema.sql.
--
-- IMPORTANT:
-- The application uses MongoDB with a BYOD tenant architecture.
-- These are PostgreSQL-compatible reference queries for academic
-- documentation and demonstration. They are NOT executed against MongoDB.
--
-- Run CENTRAL DATABASE queries against the central account database.
-- Run TENANT DATABASE queries against the selected shopkeeper database.
-- Replace :parameter placeholders with values supplied by your SQL client
-- or application. They are illustrative named parameters.

-- =====================================================================
-- 1. CENTRAL DATABASE QUERIES
-- =====================================================================

-- Q1. Register a user (illustrative insert)
INSERT INTO users (full_name, email, password_hash)
VALUES (:full_name, :email, :password_hash)
RETURNING user_id, full_name, email, created_at;

-- Q2. Find a user by email during login
SELECT user_id, full_name, email, password_hash
FROM users
WHERE email = :email;

-- Q3. Create a business account for a user
INSERT INTO business_accounts (business_id, owner_user_id, business_name)
VALUES (:business_id, :owner_user_id, :business_name)
RETURNING business_id, owner_user_id, business_name;

-- Q4. Save tenant database connection metadata
-- Store a secret reference, not a raw database password/URI.
INSERT INTO tenant_connections
    (tenant_id, business_id, provider, cluster_reference, database_name, secret_reference)
VALUES
    (:tenant_id, :business_id, 'mongodb', :cluster_reference, :database_name, :secret_reference)
RETURNING tenant_id, business_id, provider, database_name;

-- Q5. List businesses owned by a user
SELECT business_id, business_name, created_at
FROM business_accounts
WHERE owner_user_id = :owner_user_id
ORDER BY created_at DESC;

-- Q6. Resolve tenant metadata for an authenticated business
SELECT
    b.business_id,
    b.business_name,
    t.tenant_id,
    t.provider,
    t.cluster_reference,
    t.database_name,
    t.secret_reference
FROM business_accounts AS b
JOIN tenant_connections AS t
    ON t.business_id = b.business_id
WHERE b.business_id = :business_id
  AND b.owner_user_id = :authenticated_user_id;

-- =====================================================================
-- 2. TENANT DATABASE: BUSINESS PROFILE AND SETTINGS
-- =====================================================================

-- Q7. Get business profile
SELECT *
FROM business_profile
ORDER BY profile_id
LIMIT 1;

-- Q8. Update business profile
UPDATE business_profile
SET business_name = :business_name,
    owner_name = :owner_name,
    phone = :phone,
    email = :email,
    address = :address,
    updated_at = CURRENT_TIMESTAMP
WHERE profile_id = :profile_id
RETURNING *;

-- Q9. Get business settings
SELECT *
FROM business_settings
ORDER BY settings_id
LIMIT 1;

-- Q10. Update business settings
UPDATE business_settings
SET currency = :currency,
    timezone = :timezone,
    low_stock_threshold = :low_stock_threshold,
    updated_at = CURRENT_TIMESTAMP
WHERE settings_id = :settings_id
RETURNING *;

-- =====================================================================
-- 3. CATEGORIES AND INVENTORY
-- =====================================================================

-- Q11. Add a category
INSERT INTO categories (name, description)
VALUES (:name, :description)
RETURNING *;

-- Q12. List all categories
SELECT category_id, name, description, created_at
FROM categories
ORDER BY name;

-- Q13. Add a product
INSERT INTO products
    (category_id, name, description, sku, selling_price_paise,
     cost_price_paise, stock_quantity, low_stock_threshold, expiry_date)
VALUES
    (:category_id, :name, :description, :sku, :selling_price_paise,
     :cost_price_paise, :stock_quantity, :low_stock_threshold, :expiry_date)
RETURNING *;

-- Q14. List products with their category names
SELECT
    p.product_id,
    p.name AS product_name,
    p.sku,
    c.name AS category_name,
    p.selling_price_paise,
    p.stock_quantity,
    p.expiry_date
FROM products AS p
LEFT JOIN categories AS c
    ON c.category_id = p.category_id
WHERE p.is_active = TRUE
ORDER BY p.name;

-- Q15. Update product details and stock
UPDATE products
SET name = :name,
    category_id = :category_id,
    selling_price_paise = :selling_price_paise,
    cost_price_paise = :cost_price_paise,
    stock_quantity = :stock_quantity,
    low_stock_threshold = :low_stock_threshold,
    expiry_date = :expiry_date,
    updated_at = CURRENT_TIMESTAMP
WHERE product_id = :product_id
RETURNING *;

-- Q16. Find products below their configured low-stock threshold
SELECT product_id, name, stock_quantity, low_stock_threshold
FROM products
WHERE is_active = TRUE
  AND stock_quantity < COALESCE(low_stock_threshold, 5)
ORDER BY stock_quantity ASC;

-- Q17. Find products that are expiring within the next 30 days
SELECT product_id, name, expiry_date, stock_quantity
FROM products
WHERE is_active = TRUE
  AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
ORDER BY expiry_date ASC;

-- Q18. Find expired products
SELECT product_id, name, expiry_date, stock_quantity
FROM products
WHERE is_active = TRUE
  AND expiry_date < CURRENT_DATE
ORDER BY expiry_date ASC;

-- Q19. Inventory valuation at cost price (paise)
SELECT
    COALESCE(SUM(stock_quantity * COALESCE(cost_price_paise, 0)), 0)
        AS inventory_cost_value_paise
FROM products
WHERE is_active = TRUE;

-- =====================================================================
-- 4. CUSTOMERS AND KHATA
-- =====================================================================

-- Q20. Add a customer
INSERT INTO customers (name, phone, email, address)
VALUES (:name, :phone, :email, :address)
RETURNING *;

-- Q21. Search customers by name or phone
SELECT customer_id, name, phone, email
FROM customers
WHERE name ILIKE '%' || :search_text || '%'
   OR phone ILIKE '%' || :search_text || '%'
ORDER BY name;

-- Q22. View a customer's invoice history
SELECT
    invoice_id,
    invoice_number,
    invoice_type,
    status,
    total_paise,
    amount_paid_paise,
    created_at
FROM invoices
WHERE customer_id = :customer_id
ORDER BY created_at DESC;

-- Q23. Customer Khata ledger
SELECT
    khata_entry_id,
    entry_type,
    amount_paise,
    description,
    reference_type,
    reference_id,
    created_at
FROM khata_entries
WHERE customer_id = :customer_id
ORDER BY created_at ASC, khata_entry_id ASC;

-- Q24. Calculate outstanding Khata balance.
-- This reference calculation treats credit as an increase in dues and
-- payment as a decrease. Adjustments should follow the application's
-- documented sign convention.
SELECT
    customer_id,
    SUM(
        CASE
            WHEN entry_type = 'credit' THEN amount_paise
            WHEN entry_type = 'payment' THEN -amount_paise
            ELSE amount_paise
        END
    ) AS outstanding_balance_paise
FROM khata_entries
WHERE customer_id = :customer_id
GROUP BY customer_id;

-- Q25. List customers with a positive outstanding balance
SELECT
    c.customer_id,
    c.name,
    c.phone,
    SUM(
        CASE
            WHEN k.entry_type = 'credit' THEN k.amount_paise
            WHEN k.entry_type = 'payment' THEN -k.amount_paise
            ELSE k.amount_paise
        END
    ) AS outstanding_balance_paise
FROM customers AS c
JOIN khata_entries AS k
    ON k.customer_id = c.customer_id
GROUP BY c.customer_id, c.name, c.phone
HAVING SUM(
    CASE
        WHEN k.entry_type = 'credit' THEN k.amount_paise
        WHEN k.entry_type = 'payment' THEN -k.amount_paise
        ELSE k.amount_paise
    END
) > 0
ORDER BY outstanding_balance_paise DESC;

-- =====================================================================
-- 5. BILLING AND INVOICES
-- =====================================================================

-- Q26. Create an invoice header.
-- In production, create the invoice, invoice items, stock changes and
-- related Khata entries atomically in a database transaction.
INSERT INTO invoices
    (invoice_number, customer_id, invoice_type, status,
     subtotal_paise, discount_paise, total_paise,
     amount_paid_paise, idempotency_key)
VALUES
    (:invoice_number, :customer_id, :invoice_type, :status,
     :subtotal_paise, :discount_paise, :total_paise,
     :amount_paid_paise, :idempotency_key)
RETURNING *;

-- Q27. Add a line item to an invoice
INSERT INTO invoice_items
    (invoice_id, product_id, product_name_snapshot,
     quantity, unit_price_paise, line_total_paise)
VALUES
    (:invoice_id, :product_id, :product_name_snapshot,
     :quantity, :unit_price_paise, :line_total_paise)
RETURNING *;

-- Q28. Get invoice details with line items
SELECT
    i.invoice_id,
    i.invoice_number,
    i.invoice_type,
    i.status,
    i.subtotal_paise,
    i.discount_paise,
    i.total_paise,
    i.amount_paid_paise,
    i.created_at,
    ii.invoice_item_id,
    ii.product_name_snapshot,
    ii.quantity,
    ii.unit_price_paise,
    ii.line_total_paise
FROM invoices AS i
LEFT JOIN invoice_items AS ii
    ON ii.invoice_id = i.invoice_id
WHERE i.invoice_id = :invoice_id
ORDER BY ii.invoice_item_id;

-- Q29. List invoices for a date range
SELECT invoice_id, invoice_number, customer_id, status,
       total_paise, amount_paid_paise, created_at
FROM invoices
WHERE created_at >= :start_timestamp
  AND created_at < :end_timestamp
ORDER BY created_at DESC;

-- Q30. Calculate remaining amount due on each invoice
SELECT
    invoice_id,
    invoice_number,
    total_paise,
    amount_paid_paise,
    GREATEST(total_paise - amount_paid_paise, 0) AS remaining_paise
FROM invoices
WHERE status IN ('unpaid', 'partially_paid')
ORDER BY created_at DESC;

-- Q31. Cancel an eligible invoice (illustrative only).
-- The application must first validate cancellation rules and perform
-- stock restoration/ledger reversal in the same transaction.
UPDATE invoices
SET status = 'cancelled',
    cancelled_at = CURRENT_TIMESTAMP
WHERE invoice_id = :invoice_id
  AND status IN ('unpaid', 'partially_paid')
RETURNING *;

-- =====================================================================
-- 6. PAYMENTS AND TRANSACTION HISTORY
-- =====================================================================

-- Q32. Record a payment
INSERT INTO payments
    (customer_id, payment_method, amount_paise, reference_number, notes)
VALUES
    (:customer_id, :payment_method, :amount_paise, :reference_number, :notes)
RETURNING *;

-- Q33. Allocate a payment to an invoice
INSERT INTO payment_allocations
    (payment_id, invoice_id, allocated_amount_paise)
VALUES
    (:payment_id, :invoice_id, :allocated_amount_paise)
RETURNING *;

-- Q34. Recalculate an invoice's paid amount and status after allocations
-- Execute within the same transaction as the payment allocation.
UPDATE invoices AS i
SET amount_paid_paise = COALESCE((
        SELECT SUM(pa.allocated_amount_paise)
        FROM payment_allocations AS pa
        WHERE pa.invoice_id = i.invoice_id
    ), 0),
    status = CASE
        WHEN i.status = 'cancelled' THEN 'cancelled'
        WHEN COALESCE((
            SELECT SUM(pa.allocated_amount_paise)
            FROM payment_allocations AS pa
            WHERE pa.invoice_id = i.invoice_id
        ), 0) = 0 THEN 'unpaid'
        WHEN COALESCE((
            SELECT SUM(pa.allocated_amount_paise)
            FROM payment_allocations AS pa
            WHERE pa.invoice_id = i.invoice_id
        ), 0) < i.total_paise THEN 'partially_paid'
        ELSE 'paid'
    END
WHERE i.invoice_id = :invoice_id
RETURNING *;

-- Q35. Payment history for a customer
SELECT payment_id, payment_method, amount_paise,
       reference_number, notes, created_at
FROM payments
WHERE customer_id = :customer_id
ORDER BY created_at DESC;

-- Q36. Transaction history combining invoices and payments.
-- This is a derived view of source records, not a separate base table.
SELECT
    'invoice' AS transaction_type,
    invoice_id AS reference_id,
    invoice_number AS description,
    total_paise AS amount_paise,
    created_at
FROM invoices
WHERE status <> 'cancelled'
UNION ALL
SELECT
    'payment' AS transaction_type,
    payment_id AS reference_id,
    payment_method AS description,
    amount_paise,
    created_at
FROM payments
ORDER BY created_at DESC;

-- =====================================================================
-- 7. DASHBOARD AND ANALYTICS
-- =====================================================================

-- Q37. Today's sales total (excluding cancelled invoices)
SELECT COALESCE(SUM(total_paise), 0) AS today_sales_paise
FROM invoices
WHERE status <> 'cancelled'
  AND created_at >= CURRENT_DATE
  AND created_at < CURRENT_DATE + INTERVAL '1 day';

-- Q38. Sales grouped by day for a selected period
SELECT
    DATE_TRUNC('day', created_at) AS sales_day,
    SUM(total_paise) AS sales_paise,
    COUNT(*) AS invoice_count
FROM invoices
WHERE status <> 'cancelled'
  AND created_at >= :start_timestamp
  AND created_at < :end_timestamp
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY sales_day;

-- Q39. Sales by product
SELECT
    ii.product_id,
    ii.product_name_snapshot,
    SUM(ii.quantity) AS units_sold,
    SUM(ii.line_total_paise) AS sales_paise
FROM invoice_items AS ii
JOIN invoices AS i
    ON i.invoice_id = ii.invoice_id
WHERE i.status <> 'cancelled'
  AND i.created_at >= :start_timestamp
  AND i.created_at < :end_timestamp
GROUP BY ii.product_id, ii.product_name_snapshot
ORDER BY sales_paise DESC;

-- Q40. Sales by category
SELECT
    c.category_id,
    c.name AS category_name,
    SUM(ii.quantity) AS units_sold,
    SUM(ii.line_total_paise) AS sales_paise
FROM invoice_items AS ii
JOIN invoices AS i
    ON i.invoice_id = ii.invoice_id
JOIN products AS p
    ON p.product_id = ii.product_id
JOIN categories AS c
    ON c.category_id = p.category_id
WHERE i.status <> 'cancelled'
  AND i.created_at >= :start_timestamp
  AND i.created_at < :end_timestamp
GROUP BY c.category_id, c.name
ORDER BY sales_paise DESC;

-- Q41. Gross profit estimate from current product cost.
-- Historical profit should use a cost-price snapshot on invoice items;
-- that field is not present in this reference schema.
SELECT
    SUM(ii.line_total_paise) AS sales_paise,
    SUM(ii.quantity * COALESCE(p.cost_price_paise, 0)) AS estimated_cost_paise,
    SUM(ii.line_total_paise)
      - SUM(ii.quantity * COALESCE(p.cost_price_paise, 0)) AS estimated_gross_profit_paise
FROM invoice_items AS ii
JOIN invoices AS i ON i.invoice_id = ii.invoice_id
LEFT JOIN products AS p ON p.product_id = ii.product_id
WHERE i.status <> 'cancelled'
  AND i.created_at >= :start_timestamp
  AND i.created_at < :end_timestamp;

-- Q42. Best-selling products by units
SELECT
    ii.product_name_snapshot,
    SUM(ii.quantity) AS units_sold
FROM invoice_items AS ii
JOIN invoices AS i ON i.invoice_id = ii.invoice_id
WHERE i.status <> 'cancelled'
GROUP BY ii.product_name_snapshot
ORDER BY units_sold DESC
LIMIT 10;

-- Q43. Least-selling products, including products with zero sales
SELECT
    p.product_id,
    p.name,
    COALESCE(SUM(ii.quantity), 0) AS units_sold
FROM products AS p
LEFT JOIN invoice_items AS ii ON ii.product_id = p.product_id
LEFT JOIN invoices AS i
    ON i.invoice_id = ii.invoice_id
   AND i.status <> 'cancelled'
WHERE p.is_active = TRUE
GROUP BY p.product_id, p.name
ORDER BY units_sold ASC, p.name ASC
LIMIT 10;

-- =====================================================================
-- 8. RESET AND AUDIT
-- =====================================================================

-- Q44. Preview counts before a business data reset
SELECT 'products' AS collection_name, COUNT(*) AS record_count FROM products
UNION ALL
SELECT 'categories', COUNT(*) FROM categories
UNION ALL
SELECT 'customers', COUNT(*) FROM customers
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'invoice_items', COUNT(*) FROM invoice_items
UNION ALL
SELECT 'khata_entries', COUNT(*) FROM khata_entries
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'payment_allocations', COUNT(*) FROM payment_allocations;

-- Q45. Record a reset audit event after a successful reset
INSERT INTO reset_audit_logs (action, affected_counts, fingerprint)
VALUES ('business_data_reset', :affected_counts_json, :fingerprint)
RETURNING *;

-- Q46. Review recent reset audit events
SELECT audit_id, action, affected_counts, performed_at
FROM reset_audit_logs
ORDER BY performed_at DESC
LIMIT 20;

-- =====================================================================
-- END OF QUERY REFERENCE
-- =====================================================================
