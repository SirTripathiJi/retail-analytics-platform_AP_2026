-- अर्थ SAATHI - Relational Schema Reference (Submission Copy)
-- This is a SQL representation of the application's logical data model.
-- IMPORTANT: The application uses MongoDB with a BYOD tenant architecture.
-- This file is for academic documentation/ER modelling only. It is NOT
-- executed by MongoDB and is NOT the physical MongoDB collection schema.
--
-- Architecture:
--   CENTRAL DATABASE: users, business_accounts, tenant_connections
--   TENANT DATABASE: business_profile, settings, inventory, customers,
--                    invoices, Khata, payments and audit records.
-- PostgreSQL-compatible reference DDL.

-- ========================= CENTRAL DATABASE =========================

CREATE TABLE users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE business_accounts (
    business_id UUID PRIMARY KEY,
    owner_user_id BIGINT NOT NULL REFERENCES users(user_id),
    business_name VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tenant_connections (
    tenant_id UUID PRIMARY KEY,
    business_id UUID NOT NULL UNIQUE
        REFERENCES business_accounts(business_id) ON DELETE CASCADE,
    provider VARCHAR(40) NOT NULL DEFAULT 'mongodb',
    cluster_reference TEXT NOT NULL,
    database_name VARCHAR(120) NOT NULL,
    secret_reference TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================== TENANT DATABASE =========================
-- These tables represent the data inside one shopkeeper's database.
-- Tenant isolation is provided by selecting the correct tenant database.

CREATE TABLE business_profile (
    profile_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_name VARCHAR(160) NOT NULL,
    owner_name VARCHAR(120),
    phone VARCHAR(30),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE business_settings (
    settings_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    timezone VARCHAR(80) NOT NULL DEFAULT 'UTC',
    low_stock_threshold INTEGER NOT NULL DEFAULT 5
        CHECK (low_stock_threshold >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    category_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    product_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id BIGINT REFERENCES categories(category_id) ON DELETE SET NULL,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    sku VARCHAR(80) UNIQUE,
    selling_price_paise BIGINT NOT NULL CHECK (selling_price_paise >= 0),
    cost_price_paise BIGINT CHECK (cost_price_paise IS NULL OR cost_price_paise >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    low_stock_threshold INTEGER CHECK (low_stock_threshold IS NULL OR low_stock_threshold >= 0),
    expiry_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customers (
    customer_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    phone VARCHAR(30),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invoices (
    invoice_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_number VARCHAR(60) NOT NULL UNIQUE,
    customer_id BIGINT REFERENCES customers(customer_id) ON DELETE SET NULL,
    invoice_type VARCHAR(20) NOT NULL CHECK (invoice_type IN ('cash', 'credit')),
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'cancelled')),
    subtotal_paise BIGINT NOT NULL CHECK (subtotal_paise >= 0),
    discount_paise BIGINT NOT NULL DEFAULT 0 CHECK (discount_paise >= 0),
    total_paise BIGINT NOT NULL CHECK (total_paise >= 0),
    amount_paid_paise BIGINT NOT NULL DEFAULT 0 CHECK (amount_paid_paise >= 0),
    notes TEXT,
    idempotency_key VARCHAR(160) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMPTZ
);

-- Relational view of invoice line items. In MongoDB, these can be
-- embedded as an array of item snapshots inside each invoice document.
CREATE TABLE invoice_items (
    invoice_item_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_id BIGINT NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES products(product_id) ON DELETE SET NULL,
    product_name_snapshot VARCHAR(160) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_paise BIGINT NOT NULL CHECK (unit_price_paise >= 0),
    line_total_paise BIGINT NOT NULL CHECK (line_total_paise >= 0)
);

CREATE TABLE khata_entries (
    khata_entry_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(customer_id),
    entry_type VARCHAR(20) NOT NULL
        CHECK (entry_type IN ('credit', 'payment', 'adjustment')),
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    description TEXT,
    reference_type VARCHAR(30),
    reference_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments (
    payment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id BIGINT REFERENCES customers(customer_id) ON DELETE SET NULL,
    payment_method VARCHAR(30) NOT NULL
        CHECK (payment_method IN ('cash', 'upi', 'card', 'bank_transfer', 'other')),
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    reference_number VARCHAR(120),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payment_allocations (
    allocation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payment_id BIGINT NOT NULL REFERENCES payments(payment_id),
    invoice_id BIGINT NOT NULL REFERENCES invoices(invoice_id),
    allocated_amount_paise BIGINT NOT NULL CHECK (allocated_amount_paise > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (payment_id, invoice_id)
);

CREATE TABLE reset_audit_logs (
    audit_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    action VARCHAR(60) NOT NULL,
    affected_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    fingerprint VARCHAR(128),
    performed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ================================ INDEXES ================================

CREATE INDEX idx_business_accounts_owner ON business_accounts(owner_user_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_stock ON products(stock_quantity);
CREATE INDEX idx_products_expiry ON products(expiry_date);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_invoices_customer_created ON invoices(customer_id, created_at DESC);
CREATE INDEX idx_invoices_created ON invoices(created_at DESC);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_khata_customer_created ON khata_entries(customer_id, created_at DESC);
CREATE INDEX idx_payments_customer_created ON payments(customer_id, created_at DESC);
CREATE INDEX idx_payment_allocations_invoice ON payment_allocations(invoice_id);

-- ============================ DESIGN NOTES ============================
-- 1. Monetary amounts are stored as integer paise to avoid floating-point
--    rounding errors.
-- 2. Invoice item snapshots preserve the billed product name and price.
-- 3. Khata entries and payment records are ledger-style records and should
--    be append-only in application logic.
-- 4. Dashboard analytics and transaction history are derived from invoices,
--    invoice items, payments and related records; they are not base tables.
-- 5. SQL foreign keys are conceptual here. MongoDB does not enforce SQL
--    foreign keys; references, validation, indexes and transaction rules
--    must be implemented by the MongoDB application.
-- 6. Confirm exact field/collection names against the final MongoDB
--    implementation before treating this as a physical database spec.
