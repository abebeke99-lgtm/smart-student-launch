const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const sanitizeEnv = (value, fallback = '') => {
  if (value == null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
};

const sslCa = sanitizeEnv(process.env.DB_SSL_CA).replace(/\\n/g, '\n');

const pool = mysql.createPool({
  host: sanitizeEnv(process.env.DB_HOST, '127.0.0.1'),
  port: Number(sanitizeEnv(process.env.DB_PORT, '3306')),
  user: sanitizeEnv(process.env.DB_USER, 'root'),
  password: sanitizeEnv(process.env.DB_PASSWORD, ''),
  database: sanitizeEnv(process.env.DB_NAME, 'ipes_db'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  ssl: process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: true, ...(sslCa ? { ca: sslCa } : {}) }
    : false,
});

module.exports = pool;