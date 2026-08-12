const { Pool } = require('pg');
const { newDb, DataType } = require('pg-mem');
const crypto = require('crypto');
require('dotenv').config();

const poolConfig = {
  statement_timeout: 30000,
  query_timeout: 30000,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 5,
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

let host = poolConfig.host || '';
if (!host && poolConfig.connectionString) {
  try {
    const urlObj = new URL(poolConfig.connectionString);
    host = urlObj.hostname;
  } catch (e) {
    const match = poolConfig.connectionString.match(/@([^/:]+)/);
    if (match) host = match[1];
  }
}

const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '';
if (!isLocal) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

let realPool = null;
let inMemoryPool = null;
let useInMemory = process.env.NODE_ENV === 'test' || !process.env.DATABASE_URL;

function setupInMemoryDb() {
  if (inMemoryPool) return inMemoryPool;
  console.log('⚡ Initializing in-memory PostgreSQL engine (pg-mem)...');
  const db = newDb();

  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: () => {
      // Use explicit randomness to avoid pg-mem caching issues
      const bytes = crypto.randomBytes(16);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
      const hex = bytes.toString('hex');
      return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }
  });

  const dateFn = (val) => val ? new Date(val) : null;
  db.public.registerFunction({
    name: 'date',
    args: [DataType.timestamp],
    returns: DataType.date,
    implementation: dateFn
  });
  db.public.registerFunction({
    name: 'date',
    args: [DataType.timestamptz],
    returns: DataType.date,
    implementation: dateFn
  });
  db.public.registerFunction({
    name: 'current_date',
    returns: DataType.date,
    implementation: () => new Date()
  });

  db.public.registerFunction({
    name: 'make_interval',
    implementation: (days) => `${days} days`
  });

  const pgMemory = db.adapters.createPg();
  inMemoryPool = new pgMemory.Pool();

  const initSql = `
    CREATE TABLE IF NOT EXISTS users (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(100) NOT NULL,
      email       VARCHAR(150) UNIQUE,
      password    VARCHAR(255) NOT NULL,
      role        VARCHAR(20)  NOT NULL DEFAULT 'user',
      phone       VARCHAR(20),
      profile_pic TEXT,
      username    VARCHAR(50) UNIQUE,
      verified    BOOLEAN DEFAULT false,
      reset_token VARCHAR(255),
      reset_token_expiry TIMESTAMP,
      created_at  TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS customers (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(100) NOT NULL,
      phone       VARCHAR(20)  NOT NULL,
      email       VARCHAR(150),
      address     TEXT,
      notes       TEXT,
      created_at  TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_name VARCHAR(150) NOT NULL,
      type         VARCHAR(50)  NOT NULL DEFAULT 'Piece',
      price        NUMERIC(10,2) NOT NULL,
      created_at   TIMESTAMP DEFAULT NOW(),
      updated_at   TIMESTAMP DEFAULT NOW()
    );

    CREATE SEQUENCE IF NOT EXISTS bill_number_seq START WITH 1 INCREMENT BY 1;

    CREATE TABLE IF NOT EXISTS bills (
      id               VARCHAR(20) PRIMARY KEY,
      customer_name    VARCHAR(100) NOT NULL,
      customer_id      UUID REFERENCES customers(id) ON DELETE SET NULL,
      gst_percent      NUMERIC(5,2) DEFAULT 0,
      gst_amount       NUMERIC(10,2) DEFAULT 0,
      subtotal         NUMERIC(10,2) NOT NULL,
      total            NUMERIC(10,2) NOT NULL,
      amount_paid      NUMERIC(10,2) DEFAULT 0,
      balance_amount   NUMERIC(10,2) DEFAULT 0,
      payment_status   VARCHAR(20) DEFAULT 'unpaid',
      show_balance     BOOLEAN DEFAULT true,
      pdf_url          TEXT,
      previous_balance NUMERIC(10,2) DEFAULT 0,
      backup_status    VARCHAR(50) DEFAULT 'Pending (Waiting for Payment)',
      backup_date_time TIMESTAMP,
      gd_file_id       TEXT,
      gd_file_link     TEXT,
      created_at       TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bill_items (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bill_id      VARCHAR(20) REFERENCES bills(id) ON DELETE CASCADE,
      product_id   UUID REFERENCES products(id) ON DELETE SET NULL,
      product_name VARCHAR(150) NOT NULL,
      type         VARCHAR(50),
      quantity     INTEGER NOT NULL,
      price        NUMERIC(10,2) NOT NULL,
      total        NUMERIC(10,2) NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS gallery (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(150) NOT NULL,
      price       NUMERIC(10,2) NOT NULL DEFAULT 0,
      images      JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at  TIMESTAMP DEFAULT NOW()
    );
  `;

  inMemoryPool.query(initSql, (err) => {
    if (err) {
      console.error('❌ Failed to initialize in-memory DB tables:', err.message);
    } else {
      console.log('✅ Connected to In-Memory Database successfully (Offline Fallback Ready)');
    }
  });

  return inMemoryPool;
}

if (!useInMemory && (process.env.DATABASE_URL || process.env.DB_HOST)) {
  realPool = new Pool(poolConfig);
  realPool.connect((err, client, release) => {
    if (err) {
      console.warn(`⚠️ Remote Database connection failed (${err.message}). Falling back to In-Memory Database.`);
      useInMemory = true;
      setupInMemoryDb();
    } else {
      console.log('✅ Connected to Remote Database successfully');
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
      `;
      client.query(migrationSql, (migrationErr) => {
        release();
        if (migrationErr) {
          console.error('❌ Migration failed:', migrationErr.message);
        } else {
          console.log('✅ Migration complete.');
        }
      });
    }
  });
} else {
  useInMemory = true;
  setupInMemoryDb();
}

const activePoolProxy = {
  query: (...args) => {
    const active = (useInMemory || !realPool) ? setupInMemoryDb() : realPool;
    return active.query(...args);
  },
  connect: (...args) => {
    const active = (useInMemory || !realPool) ? setupInMemoryDb() : realPool;
    return active.connect(...args);
  },
  on: (...args) => {
    const active = (useInMemory || !realPool) ? setupInMemoryDb() : realPool;
    return active.on(...args);
  },
  end: (...args) => {
    if (inMemoryPool) {
      try { inMemoryPool.end(...args); } catch(e){}
    }
    if (realPool) {
      try { return realPool.end(...args); } catch(e){}
    }
    return Promise.resolve();
  }
};

module.exports = activePoolProxy;