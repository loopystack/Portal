import { pool } from './pool';

const migrations = [
  // 0: schema_migrations (must exist first)
  `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  // 1: users
  `
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  `,
  // 2: time_blocks
  `
  CREATE TABLE IF NOT EXISTS time_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_time_block_end_after_start CHECK (end_at > start_at)
  );
  CREATE INDEX IF NOT EXISTS idx_time_blocks_user_start ON time_blocks(user_id, start_at);
  CREATE INDEX IF NOT EXISTS idx_time_blocks_user_end ON time_blocks(user_id, end_at);
  `,
  // 3: revenue_entries
  `
  CREATE TABLE IF NOT EXISTS revenue_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    date DATE NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_revenue_entries_user_date ON revenue_entries(user_id, date);
  `,
  // 4: expected_revenue
  `
  CREATE TABLE IF NOT EXISTS expected_revenue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month SMALLINT NOT NULL CHECK (month >= 1 AND month <= 12),
    year SMALLINT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, month, year)
  );
  CREATE INDEX IF NOT EXISTS idx_expected_revenue_user_year_month ON expected_revenue(user_id, year, month);
  `,
];

async function run() {
  const client = await pool.connect();
  try {
    for (let i = 0; i < migrations.length; i++) {
      const version = i;
      try {
        const { rows } = await client.query(
          'SELECT 1 FROM schema_migrations WHERE version = $1',
          [version]
        );
        if (rows.length > 0) {
          console.log(`Migration ${version} already applied, skipping.`);
          continue;
        }
      } catch {
        // schema_migrations may not exist yet (version 0); run migration to create it
      }
      await client.query('BEGIN');
      try {
        await client.query(migrations[i]);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        await client.query('COMMIT');
        console.log(`Migration ${version} applied.`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
    console.log('All migrations done.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
