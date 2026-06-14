const pool = require('../db/connection');
const { getFullClerkUser } = require('./clerkUsers');

async function ensureUser(user) {
  let email = String(user.email || '').trim();
  let username = user.username || null;

  if (!email || email.endsWith('@clerk.local')) {
    try {
      const profile = await getFullClerkUser(user.id);
      if (profile.email && !profile.email.endsWith('@clerk.local')) {
        email = profile.email;
      }
      username = profile.username || username;
    } catch (error) {
      console.warn('[users] Clerk lookup failed:', user.id, error?.message || error);
    }
  }

  if (!email) email = `${user.id}@clerk.local`;

  await pool.query(
    `INSERT INTO users (id, email, username)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE email = VALUES(email), username = VALUES(username)`,
    [user.id, email, username]
  );
}

module.exports = { ensureUser };
