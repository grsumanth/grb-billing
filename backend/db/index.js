const { Pool } = require('pg');
require('dotenv').config();

const poolConfig = {
  statement_timeout: 10000,        // Terminate any query that takes more than 10 seconds
  query_timeout: 10000,            // Terminate any query that takes more than 10 seconds
  connectionTimeoutMillis: 5000,   // Fail connection attempt after 5 seconds
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
      ALTER TABLE bills ADD COLUMN IF NOT EXISTS pdf_url TEXT;
      ALTER TABLE bills ADD COLUMN IF NOT EXISTS previous_balance NUMERIC(10,2) DEFAULT 0;
      ALTER TABLE bills ADD COLUMN IF NOT EXISTS carried_to_bill_id VARCHAR(20) REFERENCES bills(id) ON DELETE SET NULL;
      
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
    `;

    client.query(migrationSql, (migrationErr) => {
      release();
      if (migrationErr) {
        console.error('❌ Migration failed (balance columns & tables):', migrationErr.message);
      } else {
        console.log('✅ Migration: Balance tracking columns, tables, and indexes ensured.');
      }
    });
  }
});

module.exports = pool;