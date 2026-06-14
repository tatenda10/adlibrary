const pool = require('../db/connection');

const LOGIN_TOUCH_MS = 15 * 60 * 1000;
const recentLoginTouches = new Map();

const CREATE_TABLES = [
  `CREATE TABLE IF NOT EXISTS product_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) DEFAULT NULL,
    event_name VARCHAR(128) NOT NULL,
    page_path VARCHAR(512) DEFAULT NULL,
    element_label VARCHAR(255) DEFAULT NULL,
    session_id VARCHAR(64) DEFAULT NULL,
    props_json JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_product_events_name (event_name),
    INDEX idx_product_events_user (user_id),
    INDEX idx_product_events_created (created_at)
  )`,
  `CREATE TABLE IF NOT EXISTS api_incidents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) DEFAULT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'error',
    source VARCHAR(128) NOT NULL,
    endpoint VARCHAR(255) DEFAULT NULL,
    message TEXT NOT NULL,
    meta_json JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_api_incidents_severity (severity),
    INDEX idx_api_incidents_source (source),
    INDEX idx_api_incidents_user (user_id),
    INDEX idx_api_incidents_created (created_at)
  )`,
];

const USER_COLUMNS = [
  ['last_login_at', 'ALTER TABLE users ADD COLUMN last_login_at DATETIME DEFAULT NULL'],
  ['login_count', 'ALTER TABLE users ADD COLUMN login_count INT NOT NULL DEFAULT 0'],
];

async function ensureColumn(tableName, columnName, alterSql) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tableName, columnName]
  );
  if (Number(rows[0]?.total || 0) === 0) {
    await pool.query(alterSql);
  }
}

async function ensureObservabilityTables() {
  for (const query of CREATE_TABLES) {
    await pool.query(query);
  }
  for (const [columnName, alterSql] of USER_COLUMNS) {
    await ensureColumn('users', columnName, alterSql);
  }
}

async function touchUserLogin(userId) {
  if (!userId) return;
  const now = Date.now();
  const last = recentLoginTouches.get(userId) || 0;
  if (now - last < LOGIN_TOUCH_MS) return;
  recentLoginTouches.set(userId, now);

  await pool.query(
    `UPDATE users
     SET last_login_at = NOW(), login_count = COALESCE(login_count, 0) + 1
     WHERE id = ?`,
    [userId]
  );
}

async function recordProductEvent({
  userId = null,
  eventName,
  pagePath = null,
  elementLabel = null,
  sessionId = null,
  props = null,
}) {
  const name = String(eventName || '').trim().slice(0, 128);
  if (!name) return;

  await pool.query(
    `INSERT INTO product_events (user_id, event_name, page_path, element_label, session_id, props_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId || null,
      name,
      pagePath ? String(pagePath).slice(0, 512) : null,
      elementLabel ? String(elementLabel).slice(0, 255) : null,
      sessionId ? String(sessionId).slice(0, 64) : null,
      props && typeof props === 'object' ? JSON.stringify(props) : null,
    ]
  );
}

async function recordApiIncident({
  userId = null,
  severity = 'error',
  source,
  endpoint = null,
  message,
  meta = null,
}) {
  const src = String(source || 'unknown').slice(0, 128);
  const msg = String(message || 'Unknown incident').slice(0, 4000);
  const sev = ['info', 'warn', 'error'].includes(severity) ? severity : 'error';

  const enrichedMeta =
    meta && typeof meta === 'object'
      ? {
          ...meta,
          failure_type: meta.failure_type || inferFailureType(msg, meta),
        }
      : null;

  await pool.query(
    `INSERT INTO api_incidents (user_id, severity, source, endpoint, message, meta_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId || null,
      sev,
      src,
      endpoint ? String(endpoint).slice(0, 255) : null,
      msg,
      enrichedMeta ? JSON.stringify(enrichedMeta) : null,
    ]
  );
}

function inferFailureType(message, meta = {}) {
  if (meta.failure_type) return meta.failure_type;
  if (Number(meta.itemCount ?? meta.item_count) === 0) return 'zero_items';
  if (/0 items/i.test(String(message || ''))) return 'zero_items';
  if (/unhealthy|failed|error/i.test(String(message || ''))) return 'api_error';
  return 'unknown';
}

async function listAdminUsers({ limit = 100, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const [rows] = await pool.query(
    `SELECT
       u.id,
       u.email,
       u.username,
       u.created_at,
       u.last_login_at,
       COALESCE(u.login_count, 0) AS login_count,
       s.plan_key,
       s.status AS subscription_status,
       s.current_period_end
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     ORDER BY COALESCE(u.last_login_at, u.created_at) DESC
     LIMIT ? OFFSET ?`,
    [safeLimit, safeOffset]
  );

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM users`);
  return {
    users: rows || [],
    total: Number(countRows[0]?.total || 0),
  };
}

async function getProductEventSummary({ days = 7 } = {}) {
  const safeDays = Math.min(Math.max(Number(days) || 7, 1), 90);

  const [byEvent] = await pool.query(
    `SELECT event_name, COUNT(*) AS total
     FROM product_events
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY event_name
     ORDER BY total DESC
     LIMIT 50`,
    [safeDays]
  );

  const [byPage] = await pool.query(
    `SELECT page_path, COUNT(*) AS total
     FROM product_events
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND page_path IS NOT NULL AND page_path != ''
     GROUP BY page_path
     ORDER BY total DESC
     LIMIT 30`,
    [safeDays]
  );

  const [recent] = await pool.query(
    `SELECT id, user_id, event_name, page_path, element_label, props_json, created_at
     FROM product_events
     ORDER BY created_at DESC
     LIMIT 100`
  );

  return {
    days: safeDays,
    by_event: byEvent || [],
    by_page: byPage || [],
    recent: (recent || []).map(normalizeEventRow),
  };
}

async function listApiIncidents({ limit = 100, severity = '', source = '' } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const filters = [];
  const params = [];

  if (severity) {
    filters.push('severity = ?');
    params.push(String(severity));
  }
  if (source) {
    filters.push('source LIKE ?');
    params.push(`%${String(source).slice(0, 64)}%`);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT id, user_id, severity, source, endpoint, message, meta_json, created_at
     FROM api_incidents
     ${where}
     ORDER BY created_at DESC
     LIMIT ?`,
    [...params, safeLimit]
  );

  return (rows || []).map(normalizeIncidentRow);
}

async function getIncidentById(id) {
  const incidentId = Number(id);
  if (!incidentId) return null;

  const [rows] = await pool.query(
    `SELECT id, user_id, severity, source, endpoint, message, meta_json, created_at
     FROM api_incidents
     WHERE id = ?
     LIMIT 1`,
    [incidentId]
  );

  if (!rows?.length) return null;
  return normalizeIncidentRow(rows[0]);
}

async function getIncidentsSummary({ hours = 24, sinceId = 0 } = {}) {
  const safeHours = Math.min(Math.max(Number(hours) || 24, 1), 168);
  const safeSinceId = Math.max(Number(sinceId) || 0, 0);

  const [countRows] = await pool.query(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN severity = 'error' THEN 1 ELSE 0 END) AS errors,
       SUM(CASE WHEN severity = 'warn' THEN 1 ELSE 0 END) AS warnings,
       SUM(CASE WHEN message LIKE '%0 items%' THEN 1 ELSE 0 END) AS zero_items
     FROM api_incidents
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
    [safeHours]
  );

  let newCount = 0;
  if (safeSinceId > 0) {
    const [newRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM api_incidents
       WHERE id > ? AND severity IN ('error', 'warn')`,
      [safeSinceId]
    );
    newCount = Number(newRows[0]?.total || 0);
  }

  const [latestRows] = await pool.query(
    `SELECT id, created_at
     FROM api_incidents
     ORDER BY id DESC
     LIMIT 1`
  );

  const counts = countRows[0] || {};

  return {
    hours: safeHours,
    total: Number(counts.total || 0),
    errors: Number(counts.errors || 0),
    warnings: Number(counts.warnings || 0),
    zero_items: Number(counts.zero_items || 0),
    new_since_id: newCount,
    latest_id: Number(latestRows[0]?.id || 0),
    latest_at: latestRows[0]?.created_at || null,
  };
}

function normalizeEventRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    event_name: row.event_name,
    page_path: row.page_path,
    element_label: row.element_label,
    props: parseJson(row.props_json),
    created_at: row.created_at,
  };
}

function normalizeIncidentRow(row) {
  const meta = parseJson(row.meta_json);
  const failureType = inferFailureType(row.message, meta || {});

  return {
    id: row.id,
    user_id: row.user_id,
    severity: row.severity,
    source: row.source,
    endpoint: row.endpoint,
    message: row.message,
    meta,
    failure_type: failureType,
    item_count: meta?.itemCount ?? meta?.item_count ?? null,
    run_status: meta?.runStatus ?? meta?.run_status ?? null,
    created_at: row.created_at,
  };
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

module.exports = {
  ensureObservabilityTables,
  touchUserLogin,
  recordProductEvent,
  recordApiIncident,
  listAdminUsers,
  getProductEventSummary,
  listApiIncidents,
  getIncidentById,
  getIncidentsSummary,
};
