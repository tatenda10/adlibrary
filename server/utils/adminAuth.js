const crypto = require('crypto');
const pool = require('../db/connection');

function toBase64Url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function getAdminSecret() {
  return process.env.ADMIN_AUTH_SECRET || process.env.CLERK_SECRET_KEY || 'dev-admin-secret';
}

function signPayload(payload) {
  return crypto.createHmac('sha256', getAdminSecret()).update(payload).digest('base64url');
}

function createAdminToken(username) {
  const payload = JSON.stringify({
    username,
    role: 'admin',
    iat: Date.now(),
  });
  const encodedPayload = toBase64Url(payload);
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    throw new Error('Invalid admin token');
  }
  const [encodedPayload, signature] = token.split('.');
  const expected = signPayload(encodedPayload);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Invalid admin token signature');
  }
  const payload = JSON.parse(fromBase64Url(encodedPayload));
  if (payload?.role !== 'admin' || !payload?.username) {
    throw new Error('Invalid admin token payload');
  }
  return payload;
}

function hashAdminPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyAdminPassword(password, passwordHash) {
  if (!passwordHash || typeof passwordHash !== 'string') return false;
  const [scheme, salt, storedHash] = passwordHash.split('$');
  if (scheme !== 'scrypt' || !salt || !storedHash) return false;
  const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(computedHash, 'hex'));
  } catch {
    return false;
  }
}

async function validateAdminCredentials(username, password) {
  const [rows] = await pool.query(
    `SELECT username, password_hash
     FROM admins
     WHERE username = ? AND is_active = 1
     LIMIT 1`,
    [username]
  );
  if (!rows.length) return false;
  return verifyAdminPassword(password, rows[0].password_hash);
}

module.exports = {
  createAdminToken,
  hashAdminPassword,
  validateAdminCredentials,
  verifyAdminPassword,
  verifyAdminToken,
};
