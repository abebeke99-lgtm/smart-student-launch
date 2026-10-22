const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const pool = require('../config/db');

dotenv.config();

const username = String(process.env.ADMIN_USERNAME || '').trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || '');

if (!username || !password) {
  throw new Error('Set ADMIN_USERNAME and ADMIN_PASSWORD before running the admin import.');
}

if (password.length < 8) {
  throw new Error('ADMIN_PASSWORD must contain at least 8 characters.');
}

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(username)) {
  throw new Error('ADMIN_USERNAME must be a valid email address.');
}

async function importAdmin() {
  const passwordHash = await bcrypt.hash(password, 12);

  await pool.query(
    `INSERT INTO users
      (username, password_hash, role, status, is_first_login)
     VALUES (?, ?, 'admin', 'active', TRUE)
     ON DUPLICATE KEY UPDATE
       password_hash = VALUES(password_hash),
       role = 'admin',
       status = 'active',
       is_first_login = TRUE`,
    [username, passwordHash],
  );

  console.log(`Admin account imported: ${username}`);
}

importAdmin()
  .catch((error) => {
    console.error(`Admin import failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
