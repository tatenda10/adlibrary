const pool = require('../db/connection');

const ONBOARDING_MILESTONES = [
  { key: 'onboarding_started', label: 'Started onboarding' },
  { key: 'onboarding_step_view', label: 'Viewed a step', propKey: 'step_key' },
  { key: 'onboarding_website_analyzed', label: 'Website analyzed' },
  { key: 'onboarding_website_skipped', label: 'Skipped website step' },
  { key: 'onboarding_continue_to_workspace', label: 'Completed onboarding' },
  { key: 'onboarding_billing_viewed', label: 'Viewed billing' },
  { key: 'onboarding_billing_checkout_started', label: 'Started checkout' },
];

function safeDays(raw) {
  return Math.min(Math.max(Number(raw) || 7, 1), 90);
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeEventRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    event_name: row.event_name,
    page_path: row.page_path,
    element_label: row.element_label,
    props: parseJson(row.props_json),
    session_id: row.session_id || null,
    created_at: row.created_at,
  };
}

async function listAllEvents({ days = 7 } = {}) {
  const safeDaysVal = safeDays(days);

  const [rows] = await pool.query(
    `SELECT
       event_name,
       COUNT(*) AS total,
       COUNT(DISTINCT user_id) AS unique_users,
       COUNT(DISTINCT session_id) AS unique_sessions,
       MAX(created_at) AS last_seen
     FROM product_events
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY event_name
     ORDER BY total DESC`,
    [safeDaysVal]
  );

  return { days: safeDaysVal, events: rows || [] };
}

async function getEventDetail({ eventName, days = 7 } = {}) {
  const name = String(eventName || '').trim().slice(0, 128);
  if (!name) return null;

  const safeDaysVal = safeDays(days);

  const [summaryRows] = await pool.query(
    `SELECT
       COUNT(*) AS total,
       COUNT(DISTINCT user_id) AS unique_users,
       COUNT(DISTINCT session_id) AS unique_sessions,
       MIN(created_at) AS first_seen,
       MAX(created_at) AS last_seen
     FROM product_events
     WHERE event_name = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [name, safeDaysVal]
  );

  const [byDay] = await pool.query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS total, COUNT(DISTINCT user_id) AS unique_users
     FROM product_events
     WHERE event_name = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)
     ORDER BY day ASC`,
    [name, safeDaysVal]
  );

  const [byPage] = await pool.query(
    `SELECT page_path, COUNT(*) AS total
     FROM product_events
     WHERE event_name = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND page_path IS NOT NULL AND page_path != ''
     GROUP BY page_path
     ORDER BY total DESC
     LIMIT 20`,
    [name, safeDaysVal]
  );

  const [recent] = await pool.query(
    `SELECT id, user_id, event_name, page_path, element_label, session_id, props_json, created_at
     FROM product_events
     WHERE event_name = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     ORDER BY created_at DESC
     LIMIT 100`,
    [name, safeDaysVal]
  );

  const [rawProps] = await pool.query(
    `SELECT props_json
     FROM product_events
     WHERE event_name = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND props_json IS NOT NULL
     LIMIT 500`,
    [name, safeDaysVal]
  );

  const propBreakdown = buildPropBreakdown(rawProps || []);

  return {
    days: safeDaysVal,
    event_name: name,
    summary: summaryRows[0] || {},
    by_day: byDay || [],
    by_page: byPage || [],
    prop_breakdown: propBreakdown,
    recent: (recent || []).map(normalizeEventRow),
  };
}

function buildPropBreakdown(rows) {
  const counts = new Map();

  for (const row of rows) {
    const props = parseJson(row.props_json);
    if (!props || typeof props !== 'object') continue;

    for (const [key, value] of Object.entries(props)) {
      if (['page_path', 'route', 'query'].includes(key)) continue;
      if (value === undefined || value === null || value === '') continue;
      const bucketKey = `${key}=${String(value).slice(0, 80)}`;
      counts.set(bucketKey, (counts.get(bucketKey) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([key, total]) => {
      const [prop, ...rest] = key.split('=');
      return { prop, value: rest.join('='), total };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 25);
}

async function getOnboardingAnalytics({ days = 30 } = {}) {
  const safeDaysVal = safeDays(days);

  const [milestoneRows] = await pool.query(
    `SELECT event_name, COUNT(*) AS total, COUNT(DISTINCT user_id) AS unique_users
     FROM product_events
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND event_name LIKE 'onboarding_%'
     GROUP BY event_name
     ORDER BY total DESC`,
    [safeDaysVal]
  );

  const countsByEvent = new Map((milestoneRows || []).map((row) => [row.event_name, row]));

  const funnel = ONBOARDING_MILESTONES.map((step) => {
    const row = countsByEvent.get(step.key) || {};
    return {
      key: step.key,
      label: step.label,
      total: Number(row.total || 0),
      unique_users: Number(row.unique_users || 0),
    };
  });

  const [stepViews] = await pool.query(
    `SELECT props_json, user_id, session_id
     FROM product_events
     WHERE event_name = 'onboarding_step_view'
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     LIMIT 2000`,
    [safeDaysVal]
  );

  const stepBreakdown = new Map();
  for (const row of stepViews || []) {
    const props = parseJson(row.props_json) || {};
    const stepKey = String(props.step_key || props.step_index || 'unknown');
    const entry = stepBreakdown.get(stepKey) || { step_key: stepKey, views: 0, users: new Set(), sessions: new Set() };
    entry.views += 1;
    if (row.user_id) entry.users.add(row.user_id);
    if (row.session_id) entry.sessions.add(row.session_id);
    stepBreakdown.set(stepKey, entry);
  }

  const steps = [...stepBreakdown.values()]
    .map((entry) => ({
      step_key: entry.step_key,
      views: entry.views,
      unique_users: entry.users.size,
      unique_sessions: entry.sessions.size,
    }))
    .sort((a, b) => b.views - a.views);

  const [dropoffs] = await pool.query(
    `SELECT props_json, COUNT(*) AS total
     FROM product_events
     WHERE event_name = 'onboarding_dropoff'
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY props_json
     ORDER BY total DESC
     LIMIT 20`,
    [safeDaysVal]
  );

  const [recent] = await pool.query(
    `SELECT id, user_id, event_name, page_path, props_json, created_at
     FROM product_events
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND event_name LIKE 'onboarding_%'
     ORDER BY created_at DESC
     LIMIT 50`,
    [safeDaysVal]
  );

  const started = Number(countsByEvent.get('onboarding_started')?.unique_users || 0);
  const completed = Number(countsByEvent.get('onboarding_continue_to_workspace')?.unique_users || 0);
  const completionRate = started > 0 ? Math.round((completed / started) * 1000) / 10 : 0;

  return {
    days: safeDaysVal,
    funnel,
    step_breakdown: steps,
    dropoffs: (dropoffs || []).map((row) => ({
      total: row.total,
      props: parseJson(row.props_json),
    })),
    completion_rate: completionRate,
    recent: (recent || []).map(normalizeEventRow),
  };
}

async function getSignInAnalytics({ days = 30 } = {}) {
  const safeDaysVal = safeDays(days);

  const [loginEvents] = await pool.query(
    `SELECT
       COUNT(*) AS total,
       COUNT(DISTINCT user_id) AS unique_users,
       COUNT(DISTINCT session_id) AS unique_sessions
     FROM product_events
     WHERE event_name IN ('user_signed_in', 'session_started')
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [safeDaysVal]
  );

  const [loginByDay] = await pool.query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS total, COUNT(DISTINCT user_id) AS unique_users
     FROM product_events
     WHERE event_name = 'user_signed_in'
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)
     ORDER BY day ASC`,
    [safeDaysVal]
  );

  const [recentLogins] = await pool.query(
    `SELECT id, user_id, session_id, props_json, created_at
     FROM product_events
     WHERE event_name = 'user_signed_in'
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     ORDER BY created_at DESC
     LIMIT 50`,
    [safeDaysVal]
  );

  const [activeUsers] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM users
     WHERE last_login_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [safeDaysVal]
  );

  const [recentDbLogins] = await pool.query(
    `SELECT id, email, username, last_login_at, login_count, created_at
     FROM users
     WHERE last_login_at IS NOT NULL
     ORDER BY last_login_at DESC
     LIMIT 30`
  );

  return {
    days: safeDaysVal,
    client_events: loginEvents[0] || {},
    by_day: loginByDay || [],
    recent_client_logins: (recentLogins || []).map(normalizeEventRow),
    active_users_server: Number(activeUsers[0]?.total || 0),
    recent_server_logins: recentDbLogins || [],
  };
}

module.exports = {
  listAllEvents,
  getEventDetail,
  getOnboardingAnalytics,
  getSignInAnalytics,
};
