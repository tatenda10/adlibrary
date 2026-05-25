const crypto = require('crypto');
const pool = require('../db/connection');

const PLAN_KEYS = {
  UNSUBSCRIBED: 'unsubscribed',
  STARTER: 'starter',
  PRO: 'pro',
  AGENCY: 'agency',
};

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'on_trial']);

function parseJsonField(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeSubscription(row) {
  if (!row) {
    return {
      plan_key: PLAN_KEYS.UNSUBSCRIBED,
      status: 'unsubscribed',
      is_active: false,
      is_pro: false,
      is_paid: false,
      cancel_at_period_end: false,
      metadata: null,
    };
  }

  const inferredFromAmount = (() => {
    const amount = Number(row.recurring_amount ?? row.latest_invoice_amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return PLAN_KEYS.UNSUBSCRIBED;
    if (amount >= 29900) return PLAN_KEYS.AGENCY;
    if (amount >= 9900) return PLAN_KEYS.PRO;
    if (amount >= 4900) return PLAN_KEYS.STARTER;
    return PLAN_KEYS.UNSUBSCRIBED;
  })();
  const planFromName = (() => {
    const text = String(row.product_name || row.metadata?.product_name || '').toLowerCase();
    if (text.includes('agency')) return PLAN_KEYS.AGENCY;
    if (text.includes('pro')) return PLAN_KEYS.PRO;
    if (text.includes('starter')) return PLAN_KEYS.STARTER;
    return PLAN_KEYS.UNSUBSCRIBED;
  })();
  const rawPlanKey = String(row.plan_key || PLAN_KEYS.UNSUBSCRIBED).toLowerCase();
  const planKey = rawPlanKey !== PLAN_KEYS.UNSUBSCRIBED
    ? rawPlanKey
    : (planFromName !== PLAN_KEYS.UNSUBSCRIBED ? planFromName : inferredFromAmount);
  const effectivePlanKey = (() => {
    // If stored plan says starter but billed amount clearly matches Pro/Agency, trust amount.
    if (rawPlanKey === PLAN_KEYS.STARTER && (inferredFromAmount === PLAN_KEYS.PRO || inferredFromAmount === PLAN_KEYS.AGENCY)) {
      return inferredFromAmount;
    }
    if (rawPlanKey === PLAN_KEYS.UNSUBSCRIBED && planFromName !== PLAN_KEYS.UNSUBSCRIBED) {
      return planFromName;
    }
    if (rawPlanKey === PLAN_KEYS.UNSUBSCRIBED && inferredFromAmount !== PLAN_KEYS.UNSUBSCRIBED) {
      return inferredFromAmount;
    }
    return planKey;
  })();
  const status = row.status || 'unsubscribed';
  const isActive = ACTIVE_STATUSES.has(String(status).toLowerCase());

  return {
    ...row,
    metadata: parseJsonField(row.metadata),
    plan_key: effectivePlanKey,
    current_plan: effectivePlanKey,
    status,
    is_active: isActive,
    is_paid: isActive && effectivePlanKey !== PLAN_KEYS.UNSUBSCRIBED,
    is_pro: isActive && (effectivePlanKey === PLAN_KEYS.PRO || effectivePlanKey === PLAN_KEYS.AGENCY),
    cancel_at_period_end: Boolean(row.cancel_at_period_end),
  };
}

async function getSubscriptionByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT id, user_id, dodo_customer_id, dodo_subscription_id, plan_key, status, currency,
            recurring_amount, current_period_start, current_period_end, cancel_at_period_end,
            latest_invoice_id, latest_invoice_amount, metadata, created_at, updated_at
     FROM subscriptions
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  );

  return normalizeSubscription(rows[0] || null);
}

async function upsertSubscriptionByUserId(userId, patch = {}) {
  const normalized = {
    dodo_customer_id: patch.dodo_customer_id || null,
    dodo_subscription_id: patch.dodo_subscription_id || null,
    plan_key: patch.plan_key || PLAN_KEYS.UNSUBSCRIBED,
    status: patch.status || 'unsubscribed',
    currency: patch.currency || null,
    recurring_amount: Number.isFinite(Number(patch.recurring_amount)) ? Number(patch.recurring_amount) : null,
    current_period_start: patch.current_period_start || null,
    current_period_end: patch.current_period_end || null,
    cancel_at_period_end: patch.cancel_at_period_end ? 1 : 0,
    latest_invoice_id: patch.latest_invoice_id || null,
    latest_invoice_amount: Number.isFinite(Number(patch.latest_invoice_amount))
      ? Number(patch.latest_invoice_amount)
      : null,
    metadata: patch.metadata ? JSON.stringify(patch.metadata) : null,
  };

  await pool.query(
    `INSERT INTO subscriptions (
      user_id, dodo_customer_id, dodo_subscription_id, plan_key, status, currency,
      recurring_amount, current_period_start, current_period_end, cancel_at_period_end,
      latest_invoice_id, latest_invoice_amount, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      dodo_customer_id = COALESCE(VALUES(dodo_customer_id), dodo_customer_id),
      dodo_subscription_id = COALESCE(VALUES(dodo_subscription_id), dodo_subscription_id),
      plan_key = VALUES(plan_key),
      status = VALUES(status),
      currency = VALUES(currency),
      recurring_amount = VALUES(recurring_amount),
      current_period_start = VALUES(current_period_start),
      current_period_end = VALUES(current_period_end),
      cancel_at_period_end = VALUES(cancel_at_period_end),
      latest_invoice_id = VALUES(latest_invoice_id),
      latest_invoice_amount = VALUES(latest_invoice_amount),
      metadata = VALUES(metadata),
      updated_at = CURRENT_TIMESTAMP`,
    [
      userId,
      normalized.dodo_customer_id,
      normalized.dodo_subscription_id,
      normalized.plan_key,
      normalized.status,
      normalized.currency,
      normalized.recurring_amount,
      normalized.current_period_start,
      normalized.current_period_end,
      normalized.cancel_at_period_end,
      normalized.latest_invoice_id,
      normalized.latest_invoice_amount,
      normalized.metadata,
    ]
  );

  return getSubscriptionByUserId(userId);
}

function getDodoBaseUrl() {
  const environment = process.env.DODO_PAYMENTS_ENVIRONMENT || 'test_mode';
  if (environment === 'live_mode' || environment === 'live') {
    return 'https://live.dodopayments.com';
  }
  return 'https://test.dodopayments.com';
}

async function dodoRequest(path, options = {}) {
  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  if (!apiKey) {
    throw new Error('DODO_PAYMENTS_API_KEY is not configured');
  }

  const response = await fetch(`${getDodoBaseUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      (typeof data === 'string' ? data : null) ||
      `Dodo request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function getPlanProductId(planKey) {
  if (planKey === PLAN_KEYS.STARTER) return process.env.DODO_STARTER_PRODUCT_ID;
  if (planKey === PLAN_KEYS.PRO) return process.env.DODO_PRO_PRODUCT_ID;
  return null;
}

function resolvePlanKeyFromProductId(productId) {
  if (!productId) return PLAN_KEYS.UNSUBSCRIBED;
  if (productId === process.env.DODO_STARTER_PRODUCT_ID) return PLAN_KEYS.STARTER;
  if (productId === process.env.DODO_PRO_PRODUCT_ID) return PLAN_KEYS.PRO;
  if (productId === process.env.DODO_AGENCY_PRODUCT_ID) return PLAN_KEYS.AGENCY;
  return PLAN_KEYS.UNSUBSCRIBED;
}

function inferPlanKeyFromSubscription(subscription = {}) {
  const byProductId = resolvePlanKeyFromProductId(subscription.product_id || subscription.product?.product_id);
  if (byProductId && byProductId !== PLAN_KEYS.UNSUBSCRIBED) return byProductId;

  const productName = String(subscription.product_name || subscription.product?.name || '').toLowerCase();
  if (productName.includes('pro')) return PLAN_KEYS.PRO;
  if (productName.includes('starter')) return PLAN_KEYS.STARTER;
  if (productName.includes('agency')) return PLAN_KEYS.AGENCY;

  const amount = Number(
    subscription.recurring_pre_tax_amount ??
      subscription.recurring_amount ??
      subscription.price_amount ??
      0
  );
  if (amount >= 29900) return PLAN_KEYS.AGENCY;
  if (amount >= 9900) return PLAN_KEYS.PRO;
  if (amount >= 4900) return PLAN_KEYS.STARTER;
  return PLAN_KEYS.UNSUBSCRIBED;
}

function getPriceForPlan(planKey) {
  if (planKey === PLAN_KEYS.STARTER) return 49;
  if (planKey === PLAN_KEYS.PRO) return 99;
  if (planKey === PLAN_KEYS.AGENCY) return 299;
  return null;
}

function parseDateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function extractArrayPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.subscriptions)) return payload.subscriptions;
  if (Array.isArray(payload?.invoices)) return payload.invoices;
  return [];
}

function pickBestSubscription(candidates = []) {
  if (!candidates.length) return null;
  const scored = [...candidates].sort((a, b) => {
    const aStatus = String(a?.status || '').toLowerCase();
    const bStatus = String(b?.status || '').toLowerCase();
    const aActive = ['active', 'trialing', 'on_trial'].includes(aStatus) ? 1 : 0;
    const bActive = ['active', 'trialing', 'on_trial'].includes(bStatus) ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    const aDate = new Date(a?.updated_at || a?.updatedAt || a?.created_at || a?.createdAt || 0).getTime();
    const bDate = new Date(b?.updated_at || b?.updatedAt || b?.created_at || b?.createdAt || 0).getTime();
    return bDate - aDate;
  });
  return scored[0];
}

function mapDodoSubscriptionToPatch(subscription, fallbackCustomerId) {
  if (!subscription || typeof subscription !== 'object') return null;
  const inferredPlanKey = inferPlanKeyFromSubscription(subscription);
  return {
    dodo_customer_id:
      subscription.customer_id ||
      subscription.customer?.customer_id ||
      fallbackCustomerId ||
      null,
    dodo_subscription_id: subscription.subscription_id || subscription.id || null,
    plan_key: inferredPlanKey,
    status: subscription.status || 'unsubscribed',
    currency: subscription.currency || null,
    recurring_amount:
      subscription.recurring_pre_tax_amount ??
      subscription.recurring_amount ??
      subscription.price_amount ??
      null,
    current_period_start: parseDateOrNull(
      subscription.previous_billing_date ||
        subscription.current_period_start ||
        subscription.started_at
    ),
    current_period_end: parseDateOrNull(
      subscription.next_billing_date ||
        subscription.current_period_end ||
        subscription.expires_at
    ),
    cancel_at_period_end: Boolean(
      subscription.cancel_at_next_billing_date || subscription.cancel_at_period_end
    ),
    latest_invoice_id: subscription.latest_invoice_id || subscription.invoice_id || null,
    latest_invoice_amount:
      subscription.latest_invoice_amount ??
      subscription.latest_invoice?.amount ??
      null,
    metadata: subscription.metadata || null,
  };
}

async function fetchDodoSubscriptionsForCustomer(customerId) {
  const endpointCandidates = [
    `/subscriptions?customer_id=${encodeURIComponent(customerId)}`,
    `/customers/${encodeURIComponent(customerId)}/subscriptions`,
  ];

  for (const endpoint of endpointCandidates) {
    try {
      const payload = await dodoRequest(endpoint, { method: 'GET' });
      const subscriptions = extractArrayPayload(payload);
      if (subscriptions.length) return subscriptions;
    } catch {
      // Try next endpoint shape.
    }
  }

  return [];
}

async function reconcileSubscriptionByUserId(userId, options = {}) {
  const { onlyWhenInactive = true } = options;
  const existing = await getSubscriptionByUserId(userId);
  if (!existing?.dodo_customer_id) return existing;
  if (onlyWhenInactive && existing.is_active) return existing;

  const remoteSubscriptions = await fetchDodoSubscriptionsForCustomer(existing.dodo_customer_id);
  const best = pickBestSubscription(remoteSubscriptions);
  if (!best) return existing;

  const patch = mapDodoSubscriptionToPatch(best, existing.dodo_customer_id);
  if (!patch) return existing;
  return upsertSubscriptionByUserId(userId, patch);
}

function isSubscriptionActive(subscription) {
  return Boolean(subscription?.is_active);
}

function canAccessPro(subscription) {
  if (!subscription) return false;
  if (subscription.is_pro) return true;
  const plan = String(subscription.plan_key || subscription.current_plan || '').toLowerCase();
  const amount = Number(subscription.recurring_amount ?? 0);
  if (plan === PLAN_KEYS.PRO || plan === PLAN_KEYS.AGENCY) return true;
  // Fallback safety for mismatched plan labels.
  return Number.isFinite(amount) && amount >= 9900;
}

function verifyDodoWebhookSignature(rawBody, headers) {
  const secret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('DODO_PAYMENTS_WEBHOOK_SECRET is not configured');
  }

  const signature = headers['webhook-signature'] || headers['Webhook-Signature'];
  if (!signature) {
    throw new Error('Missing webhook-signature header');
  }

  const id = headers['webhook-id'] || headers['Webhook-Id'] || '';
  const timestamp = headers['webhook-timestamp'] || headers['Webhook-Timestamp'] || '';
  const payload = `${id}.${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(String(signature));
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    throw new Error('Invalid webhook signature');
  }

  return { id: String(id || ''), timestamp: String(timestamp || '') };
}

module.exports = {
  ACTIVE_STATUSES,
  PLAN_KEYS,
  canAccessPro,
  dodoRequest,
  getDodoBaseUrl,
  getPlanProductId,
  getPriceForPlan,
  getSubscriptionByUserId,
  reconcileSubscriptionByUserId,
  isSubscriptionActive,
  normalizeSubscription,
  inferPlanKeyFromSubscription,
  resolvePlanKeyFromProductId,
  upsertSubscriptionByUserId,
  verifyDodoWebhookSignature,
};
