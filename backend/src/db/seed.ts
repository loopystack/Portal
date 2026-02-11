import bcrypt from 'bcrypt';
import { pool } from './pool';

async function seed() {
  const client = await pool.connect();
  try {
    const adminEmail = 'admin@pyce.com';
    const { rows } = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (rows.length > 0) {
      console.log('Admin user already exists.');
      return;
    }
    const hash = await bcrypt.hash('admin123', 10);
    await client.query(
      `INSERT INTO users (email, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4)`,
      [adminEmail, hash, 'PYCE Admin', 'admin']
    );
    console.log('Seeded admin user: admin@pyce.com / admin123');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
