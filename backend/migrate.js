const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const sanitizeEnv = (value, fallback = '') => {
  if (value == null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
};

const migrateDatabase = async () => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: sanitizeEnv(process.env.DB_HOST, '127.0.0.1'),
      user: sanitizeEnv(process.env.DB_USER, 'root'),
      password: sanitizeEnv(process.env.DB_PASSWORD, ''),
    });

    // Create database if it doesn't exist
    await connection.query('CREATE DATABASE IF NOT EXISTS ipes_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    console.log('✓ Database created or already exists');

    // Read and execute the full database.sql
    const sqlFilePath = path.join(__dirname, 'database.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    // Split the SQL by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);

    for (const statement of statements) {
      try {
        await connection.query(statement);
      } catch (error) {
        // Log but don't fail on duplicate table errors
        if (!error.message.includes('already exists')) {
          console.warn(`Warning executing statement: ${error.message.substring(0, 100)}`);
        }
      }
    }

    console.log('✓ Database migration completed successfully');
  } catch (error) {
    console.error('Database migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

migrateDatabase().then(() => {
  console.log('Migration complete!');
  process.exit(0);
});
