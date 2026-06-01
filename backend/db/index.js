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
    // Ensure pdf_url column exists in bills table
    client.query('ALTER TABLE bills ADD COLUMN IF NOT EXISTS pdf_url TEXT;', (migrationErr) => {
      release();
      if (migrationErr) {
        console.error('❌ Migration failed (pdf_url column):', migrationErr.message);
      } else {
        console.log('✅ Migration: pdf_url column ensured on bills table');
      }
    });
  }
});

module.exports = pool;