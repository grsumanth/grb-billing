-- ═══════════════════════════════════════════════
--  GRB Billing — Supabase Schema
--  Run this in Supabase → SQL Editor
-- ═══════════════════════════════════════════════

-- ── CUSTOMERS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  phone       VARCHAR(20)  NOT NULL,
  address     TEXT,
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ── PRODUCTS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) NOT NULL,
  type        VARCHAR(50)  NOT NULL DEFAULT 'Piece',
  price       NUMERIC(10,2) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ── BILLS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bills (
  id            VARCHAR(20)   PRIMARY KEY,
  customer_name VARCHAR(100)  NOT NULL,
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  gst_percent   NUMERIC(5,2)  DEFAULT 0,
  gst_amount    NUMERIC(10,2) DEFAULT 0,
  subtotal      NUMERIC(10,2) NOT NULL,
  total         NUMERIC(10,2) NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ── BILL ITEMS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS bill_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id      VARCHAR(20) REFERENCES bills(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(150) NOT NULL,
  type         VARCHAR(50),
  quantity     INTEGER       NOT NULL,
  price        NUMERIC(10,2) NOT NULL,
  total        NUMERIC(10,2) NOT NULL
);

-- ── INDEXES ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bills_created   ON bills(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_customers_name  ON customers(name);
CREATE INDEX IF NOT EXISTS idx_products_name   ON products(name);