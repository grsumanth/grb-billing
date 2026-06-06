-- ═══════════════════════════════════════════════
--  GRB Billing — Supabase Schema
--  Run this in Supabase → SQL Editor
-- ═══════════════════════════════════════════════

-- ── USERS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        VARCHAR(20)  NOT NULL DEFAULT 'user',
  phone       VARCHAR(20),
  profile_pic TEXT,
  username    VARCHAR(50),
  verified    BOOLEAN DEFAULT false,
  reset_token VARCHAR(255),
  reset_token_expiry TIMESTAMP,
  created_at  TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ── CUSTOMERS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  phone       VARCHAR(20)  NOT NULL,
  email       VARCHAR(150),
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

-- ── BILL NUMBER SEQUENCE ─────────────────────────
CREATE SEQUENCE IF NOT EXISTS bill_number_seq START WITH 1 INCREMENT BY 1;

-- ── BILL ID GENERATION FUNCTION ──────────────────
CREATE OR REPLACE FUNCTION public.generate_bill_id()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  RETURN 'B' || nextval('bill_number_seq');
END;
$function$;


-- ── BILLS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bills (
  id            VARCHAR(20)   PRIMARY KEY,
  customer_name VARCHAR(100)  NOT NULL,
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  gst_percent   NUMERIC(5,2)  DEFAULT 0,
  gst_amount    NUMERIC(10,2) DEFAULT 0,
  subtotal      NUMERIC(10,2) NOT NULL,
  total         NUMERIC(10,2) NOT NULL,
  amount_paid   NUMERIC(10,2) DEFAULT 0,
  balance_amount NUMERIC(10,2) DEFAULT 0,
  payment_status VARCHAR(20)  DEFAULT 'unpaid',
  show_balance  BOOLEAN       DEFAULT true,
  pdf_url       TEXT,
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

-- ── BALANCE HISTORY ──────────────────────────────
CREATE TABLE IF NOT EXISTS balance_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id      VARCHAR(20) REFERENCES bills(id) ON DELETE CASCADE,
  old_balance  NUMERIC(10,2),
  new_balance  NUMERIC(10,2),
  old_paid     NUMERIC(10,2),
  new_paid     NUMERIC(10,2),
  note         TEXT,
  changed_at   TIMESTAMP DEFAULT NOW()
);

-- ── INDEXES ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bills_created   ON bills(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bills_payment_status ON bills(payment_status);
CREATE INDEX IF NOT EXISTS idx_bills_balance    ON bills(balance_amount) WHERE balance_amount > 0;
CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_balance_history_bill ON balance_history(bill_id);
CREATE INDEX IF NOT EXISTS idx_customers_name  ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_products_name   ON products(name);

-- ── ROW LEVEL SECURITY (RLS) ─────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow logged-in users to view users" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow logged-in users to view customers" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow logged-in users to view products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow logged-in users to view bills" ON bills FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow logged-in users to view bill items" ON bill_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow logged-in users to view balance history" ON balance_history FOR SELECT TO authenticated USING (true);