const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: `postgresql://postgres.mvbpyvviafxmywubhkaj:${process.env.DB_PASSWORD}@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false }
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌  Supabase connection failed:', err.message);
    console.error('Full error:', err);
  } else {
    console.log('✅  Supabase PostgreSQL connected!');
    release();
  }
});

module.exports = pool;