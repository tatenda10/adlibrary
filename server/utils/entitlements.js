const pool = require('../db/connection');
const {
  FEATURES,
  FEATURE_DEFINITIONS,
  METRIC_DEFINITIONS,
  PLAN_DEFINITIONS,
  DEFAULT_PLAN_FEATURES,
  DEFAULT_PLAN_LIMITS,
} = require('./entitlementsCatalog');

const TABLE_SQL = [
  `CREATE TABLE IF NOT EXISTS plans (
    plan_key VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    monthly_price_cents INT NULL,
    dodo_product_id VARCHAR(255) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_self_serve TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    metadata JSON NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS features (
    feature_key VARCHAR(64) PRIMARY KEY,
    label VARCHAR(128) NOT NULL,
    description VARCHAR(512) NULL,
    category VARCHAR(64) NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS plan_features (
    plan_key VARCHAR(64) NOT NULL,
    feature_key VARCHAR(64) NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (plan_key, feature_key),
    FOREIGN KEY (plan_key) REFERENCES plans(plan_key) ON DELETE CASCADE,
    FOREIGN KEY (feature_key) REFERENCES features(feature_key) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS plan_limits (
    plan_key VARCHAR(64) NOT NULL,
    metric_key VARCHAR(64) NOT NULL,
    limit_value INT NOT NULL DEFAULT 0,
    PRIMARY KEY (plan_key, metric_key),
    FOREIGN KEY (plan_key) REFERENCES plans(plan_key) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS entitlement_catalog_meta (
    id TINYINT PRIMARY KEY DEFAULT 1,
    version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
];

let cache = null;
let ensurePromise = null;

function buildFallbackCatalog() {
  const plans = {};
  for (const plan of PLAN_DEFINITIONS) {
    const features = {};
    for (const def of FEATURE_DEFINITIONS) {
      features[def.feature_key] = Boolean(DEFAULT_PLAN_FEATURES[plan.plan_key]?.[def.feature_key]);
    }
    plans[plan.plan_key] = {
      ...plan,
      features,
      limits: { ...(DEFAULT_PLAN_LIMITS[plan.plan_key] || {}) },
    };
  }
  return {
    version: 0,
    plans,
    featureDefs: FEATURE_DEFINITIONS,
    metricDefs: METRIC_DEFINITIONS,
    planDefs: PLAN_DEFINITIONS,
  };
}

async function ensureEntitlementsCatalog() {
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    for (const sql of TABLE_SQL) {
      await pool.query(sql);
    }

    await pool.query(
      `INSERT IGNORE INTO entitlement_catalog_meta (id, version) VALUES (1, 1)`
    );

    for (const feature of FEATURE_DEFINITIONS) {
      await pool.query(
        `INSERT INTO features (feature_key, label, description, category)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           label = VALUES(label),
           description = VALUES(description),
           category = VALUES(category)`,
        [feature.feature_key, feature.label, feature.description || null, feature.category || null]
      );
    }

    for (const plan of PLAN_DEFINITIONS) {
      await pool.query(
        `INSERT INTO plans (plan_key, name, monthly_price_cents, sort_order, is_self_serve, is_active)
         VALUES (?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           monthly_price_cents = COALESCE(plans.monthly_price_cents, VALUES(monthly_price_cents)),
           sort_order = VALUES(sort_order)`,
        [plan.plan_key, plan.name, plan.monthly_price_cents, plan.sort_order, plan.is_self_serve]
      );
    }

    const [planFeatureCount] = await pool.query(`SELECT COUNT(*) AS total FROM plan_features`);
    if (Number(planFeatureCount[0]?.total || 0) === 0) {
      for (const plan of PLAN_DEFINITIONS) {
        for (const feature of FEATURE_DEFINITIONS) {
          const enabled = Boolean(DEFAULT_PLAN_FEATURES[plan.plan_key]?.[feature.feature_key]);
          await pool.query(
            `INSERT INTO plan_features (plan_key, feature_key, enabled) VALUES (?, ?, ?)`,
            [plan.plan_key, feature.feature_key, enabled ? 1 : 0]
          );
        }
      }
    }

    const [planLimitCount] = await pool.query(`SELECT COUNT(*) AS total FROM plan_limits`);
    if (Number(planLimitCount[0]?.total || 0) === 0) {
      for (const plan of PLAN_DEFINITIONS) {
        const limits = DEFAULT_PLAN_LIMITS[plan.plan_key] || {};
        for (const [metricKey, limitValue] of Object.entries(limits)) {
          await pool.query(
            `INSERT INTO plan_limits (plan_key, metric_key, limit_value) VALUES (?, ?, ?)`,
            [plan.plan_key, metricKey, Number(limitValue) || 0]
          );
        }
      }
    }
  })().catch((error) => {
    ensurePromise = null;
    throw error;
  });

  return ensurePromise;
}

async function loadCatalogFromDb() {
  const [metaRows] = await pool.query(`SELECT version FROM entitlement_catalog_meta WHERE id = 1 LIMIT 1`);
  const version = Number(metaRows[0]?.version || 1);

  const [planRows] = await pool.query(
    `SELECT plan_key, name, monthly_price_cents, dodo_product_id, sort_order, is_self_serve, is_active
     FROM plans
     ORDER BY sort_order ASC, plan_key ASC`
  );
  const [featureRows] = await pool.query(
    `SELECT feature_key, label, description, category FROM features ORDER BY category ASC, feature_key ASC`
  );
  const [planFeatureRows] = await pool.query(
    `SELECT plan_key, feature_key, enabled FROM plan_features`
  );
  const [planLimitRows] = await pool.query(
    `SELECT plan_key, metric_key, limit_value FROM plan_limits`
  );

  const plans = {};
  for (const row of planRows) {
    plans[row.plan_key] = {
      plan_key: row.plan_key,
      name: row.name,
      monthly_price_cents: row.monthly_price_cents,
      dodo_product_id: row.dodo_product_id,
      sort_order: row.sort_order,
      is_self_serve: Boolean(row.is_self_serve),
      is_active: Boolean(row.is_active),
      features: {},
      limits: {},
    };
  }

  for (const row of planFeatureRows) {
    if (!plans[row.plan_key]) continue;
    plans[row.plan_key].features[row.feature_key] = Boolean(row.enabled);
  }

  for (const row of planLimitRows) {
    if (!plans[row.plan_key]) continue;
    plans[row.plan_key].limits[row.metric_key] = Number(row.limit_value || 0);
  }

  // Ensure every known feature/metric key exists on each plan.
  for (const plan of Object.values(plans)) {
    for (const def of FEATURE_DEFINITIONS) {
      if (!Object.prototype.hasOwnProperty.call(plan.features, def.feature_key)) {
        plan.features[def.feature_key] = Boolean(DEFAULT_PLAN_FEATURES[plan.plan_key]?.[def.feature_key]);
      }
    }
    for (const def of METRIC_DEFINITIONS) {
      if (!Object.prototype.hasOwnProperty.call(plan.limits, def.metric_key)) {
        plan.limits[def.metric_key] = Number(DEFAULT_PLAN_LIMITS[plan.plan_key]?.[def.metric_key] ?? 0);
      }
    }
  }

  return {
    version,
    plans,
    featureDefs: featureRows.length ? featureRows : FEATURE_DEFINITIONS,
    metricDefs: METRIC_DEFINITIONS,
    planDefs: planRows.length ? planRows : PLAN_DEFINITIONS,
  };
}

async function getEntitlementsCatalog({ force = false } = {}) {
  try {
    await ensureEntitlementsCatalog();
    const next = await loadCatalogFromDb();
    if (!force && cache && cache.version === next.version) {
      return cache;
    }
    cache = next;
    return cache;
  } catch (error) {
    console.warn('[entitlements] Falling back to in-code catalog:', error?.message || error);
    if (!cache) cache = buildFallbackCatalog();
    return cache;
  }
}

function invalidateEntitlementsCache() {
  cache = null;
}

function getCachedCatalog() {
  return cache || buildFallbackCatalog();
}

function getPlanEntitlements(planKey) {
  const catalog = getCachedCatalog();
  const key = String(planKey || 'unsubscribed').toLowerCase();
  return catalog.plans[key] || catalog.plans.unsubscribed || buildFallbackCatalog().plans.unsubscribed;
}

function getLimitsForPlanKey(planKey) {
  return { ...(getPlanEntitlements(planKey).limits || {}) };
}

function getFeaturesForPlanKey(planKey) {
  return { ...(getPlanEntitlements(planKey).features || {}) };
}

function resolveEntitlements(subscription = {}) {
  const planKey = String(subscription?.plan_key || subscription?.current_plan || 'unsubscribed').toLowerCase();
  const isActive = Boolean(subscription?.is_active);
  const plan = getPlanEntitlements(isActive ? planKey : 'unsubscribed');
  // Inactive paid users fall back to free entitlements for gating.
  const effectivePlanKey = isActive ? planKey : 'unsubscribed';
  const effective = getPlanEntitlements(effectivePlanKey);

  return {
    plan_key: effectivePlanKey,
    catalog_version: getCachedCatalog().version,
    features: { ...(effective.features || {}) },
    limits: { ...(effective.limits || {}) },
    plan_name: plan?.name || effectivePlanKey,
  };
}

function canAccessFeature(subscriptionOrEntitlements, featureKey) {
  if (!featureKey) return false;
  const features =
    subscriptionOrEntitlements?.features ||
    resolveEntitlements(subscriptionOrEntitlements).features ||
    {};
  return Boolean(features[featureKey]);
}

async function bumpCatalogVersion() {
  await pool.query(
    `UPDATE entitlement_catalog_meta SET version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1`
  );
  invalidateEntitlementsCache();
  return getEntitlementsCatalog({ force: true });
}

async function saveEntitlementsMatrix(payload = {}) {
  await ensureEntitlementsCatalog();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const plans = Array.isArray(payload.plans) ? payload.plans : [];
    for (const plan of plans) {
      if (!plan?.plan_key) continue;
      await connection.query(
        `INSERT INTO plans (plan_key, name, monthly_price_cents, sort_order, is_self_serve, is_active)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           monthly_price_cents = VALUES(monthly_price_cents),
           sort_order = VALUES(sort_order),
           is_self_serve = VALUES(is_self_serve),
           is_active = VALUES(is_active)`,
        [
          plan.plan_key,
          plan.name || plan.plan_key,
          Number.isFinite(Number(plan.monthly_price_cents)) ? Number(plan.monthly_price_cents) : null,
          Number(plan.sort_order) || 0,
          plan.is_self_serve ? 1 : 0,
          plan.is_active === false ? 0 : 1,
        ]
      );
    }

    const featureMatrix = Array.isArray(payload.features) ? payload.features : [];
    for (const row of featureMatrix) {
      if (!row?.plan_key || !row?.feature_key) continue;
      await connection.query(
        `INSERT INTO plan_features (plan_key, feature_key, enabled)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
        [row.plan_key, row.feature_key, row.enabled ? 1 : 0]
      );
    }

    const limitMatrix = Array.isArray(payload.limits) ? payload.limits : [];
    for (const row of limitMatrix) {
      if (!row?.plan_key || !row?.metric_key) continue;
      await connection.query(
        `INSERT INTO plan_limits (plan_key, metric_key, limit_value)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE limit_value = VALUES(limit_value)`,
        [row.plan_key, row.metric_key, Number(row.limit_value) || 0]
      );
    }

    await connection.query(
      `UPDATE entitlement_catalog_meta SET version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1`
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  invalidateEntitlementsCache();
  return getEntitlementsCatalog({ force: true });
}

function formatCatalogForAdmin(catalog) {
  const source = catalog || getCachedCatalog();
  const planKeys = Object.keys(source.plans).sort(
    (a, b) => (source.plans[a].sort_order || 0) - (source.plans[b].sort_order || 0)
  );

  return {
    catalog_version: source.version,
    plans: planKeys.map((key) => {
      const plan = source.plans[key];
      return {
        plan_key: key,
        name: plan.name,
        monthly_price_cents: plan.monthly_price_cents,
        sort_order: plan.sort_order,
        is_self_serve: Boolean(plan.is_self_serve),
        is_active: plan.is_active !== false,
        features: { ...(plan.features || {}) },
        limits: { ...(plan.limits || {}) },
      };
    }),
    feature_definitions: source.featureDefs,
    metric_definitions: source.metricDefs,
  };
}

module.exports = {
  FEATURES,
  bumpCatalogVersion,
  canAccessFeature,
  ensureEntitlementsCatalog,
  formatCatalogForAdmin,
  getCachedCatalog,
  getEntitlementsCatalog,
  getFeaturesForPlanKey,
  getLimitsForPlanKey,
  getPlanEntitlements,
  invalidateEntitlementsCache,
  resolveEntitlements,
  saveEntitlementsMatrix,
};
