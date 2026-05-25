require('dotenv').config();
const pool = require('./connection');
const { hashAdminPassword } = require('../utils/adminAuth');

async function seedAdmin() {
  const username = String(process.env.ADMIN_USERNAME || '').trim();
  const password = String(process.env.ADMIN_PASSWORD || '').trim();

  if (!username || !password) {
    throw new Error('Missing ADMIN_USERNAME or ADMIN_PASSWORD in server environment');
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );

  const passwordHash = hashAdminPassword(password);

  await pool.query(
    `INSERT INTO admins (username, password_hash, is_active)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE
       password_hash = VALUES(password_hash),
       is_active = 1`,
    [username, passwordHash]
  );

  console.log(`Admin user '${username}' seeded/updated successfully.`);
  await pool.end();
}

seedAdmin().catch(async (error) => {
  console.error('Admin seed failed:', error.message);
  try {
    await pool.end();
  } catch {
    // ignore close errors
  }
  process.exit(1);
});
