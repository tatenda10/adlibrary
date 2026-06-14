const { createClerkClient } = require('@clerk/backend');
const pool = require('../db/connection');

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

function pickPrimaryEmail(user) {
  const directEmail = String(user?.email || '').trim();
  if (directEmail && !directEmail.endsWith('@clerk.local')) return directEmail;

  const primaryEmail =
    user?.primaryEmailAddress?.emailAddress ||
    user?.primary_email_address?.email_address ||
    user?.primary_email_address?.emailAddress ||
    null;
  if (primaryEmail) return String(primaryEmail).trim();

  const primaryId = user?.primaryEmailAddressId || user?.primary_email_address_id;
  const emailObjects = user?.emailAddresses || user?.email_addresses || [];
  if (primaryId && Array.isArray(emailObjects)) {
    const match = emailObjects.find((entry) => entry.id === primaryId);
    const matchedEmail = match?.emailAddress || match?.email_address;
    if (matchedEmail) return String(matchedEmail).trim();
  }

  const firstEmailObject = Array.isArray(emailObjects) ? emailObjects[0] : null;
  const fallbackEmail =
    firstEmailObject?.emailAddress || firstEmailObject?.email_address || null;

  return fallbackEmail ? String(fallbackEmail).trim() : '';
}

function clerkCreatedAtIso(user) {
  const raw = user?.createdAt ?? user?.created_at;
  if (!raw) return null;
  const date = typeof raw === 'number' ? new Date(raw) : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

async function getFullClerkUser(userId) {
  const user = await clerkClient.users.getUser(userId);
  const email = pickPrimaryEmail(user);

  return {
    id: user.id,
    email: email || `${user.id}@clerk.local`,
    username: user.username || null,
    firstName: user.firstName || user.first_name || null,
    lastName: user.lastName || user.last_name || null,
    createdAt: clerkCreatedAtIso(user),
  };
}

async function getRegistrationMetrics() {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const [all, year, month] = await Promise.all([
    clerkClient.users.getUserList({ limit: 1 }),
    clerkClient.users.getUserList({ limit: 1, createdAtAfter: yearStart }),
    clerkClient.users.getUserList({ limit: 1, createdAtAfter: monthStart }),
  ]);

  return {
    total: Number(all.totalCount || 0),
    newThisYear: Number(year.totalCount || 0),
    newThisMonth: Number(month.totalCount || 0),
  };
}

async function listAdminUsersFromClerk({ limit = 100, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const [{ data: clerkUsers, totalCount }, metrics] = await Promise.all([
    clerkClient.users.getUserList({
      limit: safeLimit,
      offset: safeOffset,
      orderBy: '-created_at',
    }),
    getRegistrationMetrics(),
  ]);

  if (!clerkUsers?.length) {
    return { users: [], total: Number(totalCount || 0), metrics };
  }

  const ids = clerkUsers.map((user) => user.id);
  const placeholders = ids.map(() => '?').join(',');
  const [localRows] = await pool.query(
    `SELECT
       u.id,
       u.last_login_at,
       COALESCE(u.login_count, 0) AS login_count,
       s.plan_key,
       s.status AS subscription_status
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     WHERE u.id IN (${placeholders})`,
    ids
  );

  const localById = new Map((localRows || []).map((row) => [row.id, row]));

  const users = clerkUsers.map((clerkUser) => {
    const local = localById.get(clerkUser.id) || {};
    const email = pickPrimaryEmail(clerkUser);
    const firstName = clerkUser.firstName || clerkUser.first_name || null;
    const lastName = clerkUser.lastName || clerkUser.last_name || null;

    return {
      id: clerkUser.id,
      email: email || '—',
      username: clerkUser.username || null,
      first_name: firstName,
      last_name: lastName,
      created_at: clerkCreatedAtIso(clerkUser),
      last_login_at: local.last_login_at || null,
      login_count: Number(local.login_count || 0),
      plan_key: local.plan_key || 'unsubscribed',
      subscription_status: local.subscription_status || null,
    };
  });

  for (const clerkUser of clerkUsers) {
    const email = pickPrimaryEmail(clerkUser);
    if (!email) continue;
    pool
      .query(
        `INSERT INTO users (id, email, username)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE email = VALUES(email), username = VALUES(username)`,
        [clerkUser.id, email, clerkUser.username || null]
      )
      .catch(() => {});
  }

  return {
    users,
    total: Number(totalCount || 0),
    metrics,
  };
}

module.exports = {
  clerkClient,
  pickPrimaryEmail,
  getFullClerkUser,
  getRegistrationMetrics,
  listAdminUsersFromClerk,
};
