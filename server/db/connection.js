require('dotenv').config();
const mysql = require('mysql2/promise');

const TRANSIENT_DB_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
  'PROTOCOL_ENQUEUE_AFTER_QUIT',
]);

function isTransientDbError(error) {
  if (!error) return false;
  if (TRANSIENT_DB_ERROR_CODES.has(error.code)) return true;
  return String(error.message || '').includes('ECONNRESET');
}

const basePool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_LIMIT || 10),
  queueLimit: 0,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 30000),
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  maxIdle: Number(process.env.DB_POOL_MAX_IDLE || 5),
  idleTimeout: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS || 60000),
});

basePool.on('connection', (connection) => {
  connection.on('error', () => {
    // Pool drops broken connections; queries retry on transient failures.
  });
});

async function query(sql, params, attempt = 0) {
  try {
    return await basePool.query(sql, params);
  } catch (error) {
    if (attempt < 2 && isTransientDbError(error)) {
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
      return query(sql, params, attempt + 1);
    }
    throw error;
  }
}

const pool = new Proxy(basePool, {
  get(target, prop) {
    if (prop === 'query') return query;
    const value = target[prop];
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

module.exports = pool;
