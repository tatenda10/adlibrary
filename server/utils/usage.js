const pool = require('../db/connection');

const METRICS = {
  TIKTOK_SEARCH: 'tiktok_searches',
  TIKTOK_WORKSPACE_VIDEO: 'tiktok_workspace_videos',
  FACEBOOK_SEARCH: 'facebook_searches',
  INSTAGRAM_SEARCH: 'instagram_searches',
  AI_ANALYSIS: 'ai_analyses',
  CRO_AUDIT: 'cro_audits',
};

const PLAN_LIMITS = {
  unsubscribed: {
    [METRICS.TIKTOK_SEARCH]: 0,
    [METRICS.TIKTOK_WORKSPACE_VIDEO]: 0,
    [METRICS.FACEBOOK_SEARCH]: 0,
    [METRICS.INSTAGRAM_SEARCH]: 0,
    [METRICS.AI_ANALYSIS]: 0,
    [METRICS.CRO_AUDIT]: 0,
    active_watchlist: 0,
    active_collections: 0,
  },
  starter: {
    [METRICS.TIKTOK_SEARCH]: 15,
    [METRICS.FACEBOOK_SEARCH]: 8,
    [METRICS.INSTAGRAM_SEARCH]: 12,
    [METRICS.AI_ANALYSIS]: 8,
    [METRICS.CRO_AUDIT]: 1,
    active_watchlist: 0,
    active_collections: 25,
  },
  pro: {
    [METRICS.TIKTOK_SEARCH]: 40,
    [METRICS.TIKTOK_WORKSPACE_VIDEO]: 200,
    [METRICS.FACEBOOK_SEARCH]: 20,
    [METRICS.INSTAGRAM_SEARCH]: 24,
    [METRICS.AI_ANALYSIS]: 30,
    [METRICS.CRO_AUDIT]: 4,
    active_watchlist: 10,
    active_collections: 100,
  },
  agency: {
    [METRICS.TIKTOK_SEARCH]: 150,
    [METRICS.FACEBOOK_SEARCH]: 75,
    [METRICS.INSTAGRAM_SEARCH]: 90,
    [METRICS.AI_ANALYSIS]: 120,
    [METRICS.CRO_AUDIT]: 15,
    active_watchlist: 50,
    active_collections: 500,
  },
};

function getPlanKey(subscription = {}) {
  return String(subscription?.plan_key || subscription?.current_plan || 'unsubscribed').toLowerCase();
}

function getCycleKey(subscription = {}) {
  const anchor = subscription?.current_period_start || new Date().toISOString();
  const date = new Date(anchor);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getLimitsForSubscription(subscription = {}) {
  const planKey = getPlanKey(subscription);
  return PLAN_LIMITS[planKey] || PLAN_LIMITS.unsubscribed;
}

function getLimitForMetric(subscription = {}, metricKey) {
  const limits = getLimitsForSubscription(subscription);
  return Number(limits?.[metricKey] ?? 0);
}

async function getUsageRows(userId, cycleKey) {
  const [rows] = await pool.query(
    `SELECT metric_key, usage_count
     FROM user_usage_counters
     WHERE user_id = ? AND cycle_key = ?`,
    [userId, cycleKey]
  );
  return rows || [];
}

async function getUsageSummaryByUserId(userId, subscription = {}) {
  const cycleKey = getCycleKey(subscription);
  const limits = getLimitsForSubscription(subscription);
  const rows = await getUsageRows(userId, cycleKey);
  const usage = {};
  for (const [metricKey] of Object.entries(limits)) {
    usage[metricKey] = { used: 0, limit: Number(limits[metricKey] ?? 0), remaining: Number(limits[metricKey] ?? 0) };
  }
  for (const row of rows) {
    if (!usage[row.metric_key]) {
      usage[row.metric_key] = { used: 0, limit: 0, remaining: 0 };
    }
    usage[row.metric_key].used = Number(row.usage_count || 0);
    usage[row.metric_key].remaining = Math.max(0, Number(usage[row.metric_key].limit || 0) - usage[row.metric_key].used);
  }
  return {
    cycle_key: cycleKey,
    plan_key: getPlanKey(subscription),
    usage,
  };
}

async function incrementUsage(userId, subscription = {}, metricKey, amount = 1) {
  const cycleKey = getCycleKey(subscription);
  await pool.query(
    `INSERT INTO user_usage_counters (user_id, cycle_key, metric_key, usage_count)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE usage_count = usage_count + VALUES(usage_count), updated_at = CURRENT_TIMESTAMP`,
    [userId, cycleKey, metricKey, Number(amount) || 1]
  );
  return getUsageSummaryByUserId(userId, subscription);
}

function buildQuotaErrorPayload(subscription = {}, metricKey, summary, extra = {}) {
  return {
    error: extra.message || 'Usage limit reached for this billing cycle.',
    code: 'quota_exceeded',
    metric: metricKey,
    subscription: {
      plan_key: getPlanKey(subscription),
      is_active: Boolean(subscription?.is_active),
      is_pro: Boolean(subscription?.is_pro),
    },
    usage: summary,
    upgrade_prompt: extra.upgrade_prompt || 'Upgrade your plan or wait for the next billing cycle to continue.',
  };
}

module.exports = {
  METRICS,
  PLAN_LIMITS,
  buildQuotaErrorPayload,
  getCycleKey,
  getLimitForMetric,
  getLimitsForSubscription,
  getPlanKey,
  getUsageSummaryByUserId,
  incrementUsage,
};
