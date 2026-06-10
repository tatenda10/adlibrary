const pool = require('../db/connection');

const METRICS = {
  TIKTOK_SEARCH: 'tiktok_searches',
  TIKTOK_WORKSPACE_VIDEO: 'tiktok_workspace_videos',
  FACEBOOK_SEARCH: 'facebook_searches',
  INSTAGRAM_SEARCH: 'instagram_searches',
  AI_ANALYSIS: 'ai_analyses',
  CRO_AUDIT: 'cro_audits',
  WORKSPACE_FOLDERS: 'workspace_folders',
  WORKSPACE_ITEMS: 'workspace_items',
};

const PLAN_LIMITS = {
  unsubscribed: {
    [METRICS.TIKTOK_SEARCH]: 5,
    [METRICS.TIKTOK_WORKSPACE_VIDEO]: 2,
    [METRICS.FACEBOOK_SEARCH]: 5,
    [METRICS.INSTAGRAM_SEARCH]: 5,
    [METRICS.AI_ANALYSIS]: 1,
    [METRICS.CRO_AUDIT]: 0,
    [METRICS.WORKSPACE_FOLDERS]: 1,
    [METRICS.WORKSPACE_ITEMS]: 2,
    active_watchlist: 0,
    active_collections: 1,
  },
  starter: {
    [METRICS.TIKTOK_SEARCH]: 15,
    [METRICS.TIKTOK_WORKSPACE_VIDEO]: 100,
    [METRICS.FACEBOOK_SEARCH]: 8,
    [METRICS.INSTAGRAM_SEARCH]: 12,
    [METRICS.AI_ANALYSIS]: 8,
    [METRICS.CRO_AUDIT]: 1,
    [METRICS.WORKSPACE_FOLDERS]: 25,
    [METRICS.WORKSPACE_ITEMS]: 200,
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
    [METRICS.WORKSPACE_FOLDERS]: 100,
    [METRICS.WORKSPACE_ITEMS]: 1000,
    active_watchlist: 10,
    active_collections: 100,
  },
  agency: {
    [METRICS.TIKTOK_SEARCH]: 150,
    [METRICS.TIKTOK_WORKSPACE_VIDEO]: 2000,
    [METRICS.FACEBOOK_SEARCH]: 75,
    [METRICS.INSTAGRAM_SEARCH]: 90,
    [METRICS.AI_ANALYSIS]: 120,
    [METRICS.CRO_AUDIT]: 15,
    [METRICS.WORKSPACE_FOLDERS]: 500,
    [METRICS.WORKSPACE_ITEMS]: 5000,
    active_watchlist: 50,
    active_collections: 500,
  },
};

const LIVE_USAGE_METRICS = new Set([
  METRICS.WORKSPACE_FOLDERS,
  METRICS.WORKSPACE_ITEMS,
]);

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

async function getWorkspaceUsageCountsByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT
      (
        (SELECT COUNT(*) FROM tiktok_workspace_folders WHERE user_id = ?)
        + (SELECT COUNT(*) FROM facebook_workspace_folders WHERE user_id = ?)
        + (SELECT COUNT(*) FROM instagram_workspace_folders WHERE user_id = ?)
      ) AS folder_count,
      (
        (SELECT COUNT(*) FROM tiktok_workspace_videos WHERE user_id = ?)
        + (SELECT COUNT(*) FROM facebook_workspace_videos WHERE user_id = ?)
        + (SELECT COUNT(*) FROM instagram_workspace_videos WHERE user_id = ?)
        + (SELECT COUNT(*) FROM bookmarks WHERE user_id = ?)
      ) AS item_count`,
    [userId, userId, userId, userId, userId, userId, userId]
  );

  const row = rows?.[0] || {};
  return {
    folderCount: Number(row.folder_count || 0),
    itemCount: Number(row.item_count || 0),
  };
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

  if (
    Object.prototype.hasOwnProperty.call(limits, METRICS.WORKSPACE_FOLDERS) ||
    Object.prototype.hasOwnProperty.call(limits, METRICS.WORKSPACE_ITEMS)
  ) {
    const workspaceCounts = await getWorkspaceUsageCountsByUserId(userId);

    if (usage[METRICS.WORKSPACE_FOLDERS]) {
      usage[METRICS.WORKSPACE_FOLDERS].used = workspaceCounts.folderCount;
      usage[METRICS.WORKSPACE_FOLDERS].remaining = Math.max(
        0,
        Number(usage[METRICS.WORKSPACE_FOLDERS].limit || 0) - workspaceCounts.folderCount
      );
    }

    if (usage[METRICS.WORKSPACE_ITEMS]) {
      usage[METRICS.WORKSPACE_ITEMS].used = workspaceCounts.itemCount;
      usage[METRICS.WORKSPACE_ITEMS].remaining = Math.max(
        0,
        Number(usage[METRICS.WORKSPACE_ITEMS].limit || 0) - workspaceCounts.itemCount
      );
    }
  }

  return {
    cycle_key: cycleKey,
    plan_key: getPlanKey(subscription),
    usage,
  };
}

async function incrementUsage(userId, subscription = {}, metricKey, amount = 1) {
  if (LIVE_USAGE_METRICS.has(metricKey)) {
    return getUsageSummaryByUserId(userId, subscription);
  }
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
  getWorkspaceUsageCountsByUserId,
  incrementUsage,
};
