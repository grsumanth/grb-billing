const { Pool } = require('pg');
require('dotenv').config();

const poolConfig = {
  statement_timeout: 30000,        // Terminate any query that takes more than 30 seconds
  query_timeout: 30000,            // Terminate any query that takes more than 30 seconds
  connectionTimeoutMillis: 15000,  // Fail connection attempt after 15 seconds (handles Render cold starts)
  idleTimeoutMillis: 30000,        // Close idle connections after 30 seconds
  max: 5,                          // Limit pool size for Supabase session pooler compatibility
};

if (process.env.DATABASE_URL) {
  poolConfig.connectionString = process.env.DATABASE_URL;
} else if (process.env.DB_HOST) {
  poolConfig.host = process.env.DB_HOST;
  poolConfig.port = process.env.DB_PORT;
  poolConfig.database = process.env.DB_NAME;
  poolConfig.user = process.env.DB_USER;
  poolConfig.password = process.env.DB_PASSWORD;
}

// Enable SSL if target is not localhost (or if DATABASE_URL doesn't indicate local)
let host = poolConfig.host || '';
if (!host && poolConfig.connectionString) {
  try {
    const urlObj = new URL(poolConfig.connectionString);
    host = urlObj.hostname;
  } catch (e) {
    const match = poolConfig.connectionString.match(/@([^/:]+)/);
    if (match) {
      host = match[1];
    }
  }
}

const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '';

if (!isLocal) {
  poolConfig.ssl = {
    rejectUnauthorized: false  // Required for Supabase / remote DBs
  };
}

const pool = new Pool(poolConfig);

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
      console.error('Neither DATABASE_URL nor DB_HOST environment variables are configured.');
    } else {
      console.error('Please check your database configuration in the .env file');
    }
  } else {
    console.log('✅ Connected to Database successfully');
    
    const migrationSql = `
      CREATE SEQUENCE IF NOT EXISTS bill_number_seq START 1;

      ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50);
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key') THEN
          ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
        END IF;
      END $$;

      ALTER TABLE bills ADD COLUMN IF NOT EXISTS pdf_url TEXT;
      ALTER TABLE bills ADD COLUMN IF NOT EXISTS previous_balance NUMERIC(10,2) DEFAULT 0;
      ALTER TABLE bills ADD COLUMN IF NOT EXISTS carried_to_bill_id VARCHAR(20) REFERENCES bills(id) ON DELETE SET NULL;
      ALTER TABLE bills ADD COLUMN IF NOT EXISTS gd_file_id TEXT;
      ALTER TABLE bills ADD COLUMN IF NOT EXISTS gd_file_link TEXT;
      ALTER TABLE bills ADD COLUMN IF NOT EXISTS backup_status VARCHAR(50) DEFAULT 'Pending (Waiting for Payment)';
      ALTER TABLE bills ALTER COLUMN backup_status TYPE VARCHAR(50);
      ALTER TABLE bills ALTER COLUMN backup_status SET DEFAULT 'Pending (Waiting for Payment)';
      ALTER TABLE bills ADD COLUMN IF NOT EXISTS backup_date_time TIMESTAMP;

      
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bills' AND column_name='amount_paid') THEN
          ALTER TABLE bills ADD COLUMN amount_paid NUMERIC(10,2) DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bills' AND column_name='balance_amount') THEN
          ALTER TABLE bills ADD COLUMN balance_amount NUMERIC(10,2) DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bills' AND column_name='payment_status') THEN
          ALTER TABLE bills ADD COLUMN payment_status VARCHAR(20) DEFAULT 'unpaid';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bills' AND column_name='show_balance') THEN
          ALTER TABLE bills ADD COLUMN show_balance BOOLEAN DEFAULT true;
        END IF;
      END $$;

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

      CREATE INDEX IF NOT EXISTS idx_bills_payment_status ON bills(payment_status);
      CREATE INDEX IF NOT EXISTS idx_bills_balance ON bills(balance_amount) WHERE balance_amount > 0;
      CREATE INDEX IF NOT EXISTS idx_balance_history_bill ON balance_history(bill_id);

      CREATE TABLE IF NOT EXISTS gallery (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(150) NOT NULL,
        price       NUMERIC(10,2) NOT NULL DEFAULT 0,
        images      JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at  TIMESTAMP DEFAULT NOW()
      );

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies 
          WHERE tablename = 'gallery' 
            AND policyname = 'Allow logged-in users to view gallery'
        ) THEN
          ALTER TABLE gallery ENABLE ROW LEVEL SECURITY;
          CREATE POLICY "Allow logged-in users to view gallery" 
            ON gallery FOR SELECT TO authenticated USING (true);
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies 
          WHERE tablename = 'balance_history' 
            AND policyname = 'Allow logged-in users to view balance history'
        ) THEN
          ALTER TABLE balance_history ENABLE ROW LEVEL SECURITY;
          CREATE POLICY "Allow logged-in users to view balance history" 
            ON balance_history FOR SELECT TO authenticated USING (true);
        END IF;
      END $$;

      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='name') THEN
          ALTER TABLE products RENAME COLUMN name TO product_name;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='updated_at') THEN
          ALTER TABLE products ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_products_product_name ON products(product_name);

      UPDATE products SET type = 'Piece' WHERE type NOT IN ('Piece', 'Box', 'Pack') OR type IS NULL;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_type'
        ) THEN
          ALTER TABLE products ADD CONSTRAINT chk_products_type CHECK (type IN ('Piece', 'Box', 'Pack'));
        END IF;
      END $$;

      UPDATE bill_items
      SET product_name = products.product_name
      FROM products
      WHERE bill_items.product_id = products.id
        AND (bill_items.product_name LIKE '₹%' OR bill_items.product_name = '' OR bill_items.product_name IS NULL);
    `;

    client.query(migrationSql, (migrationErr) => {
      release();
      if (migrationErr) {
        console.error('❌ Migration failed (balance columns & tables):', migrationErr.message);
      } else {
        console.log('✅ Migration: Balance tracking, product_name, and index ensured.');
      }
    });
  }
});

module.exports = pool;