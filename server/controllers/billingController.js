const pool = require('../db/connection');
const { ensureUser } = require('../utils/users');
const { getFullClerkUser, pickPrimaryEmail } = require('../utils/clerkUsers');
const {
  PLAN_KEYS,
  dodoRequest,
  getPlanProductId,
  getPriceForPlan,
  getSubscriptionByUserId,
  inferPlanKeyFromSubscription,
  mapDodoSubscriptionToPatch,
  reconcileSubscriptionByUserId,
  resolvePlanKeyFromProductId,
  upsertSubscriptionByUserId,
  verifyDodoWebhookSignature,
} = require('../utils/billing');
const { getLimitsForSubscription, getUsageSummaryByUserId } = require('../utils/usage');
const { resolveEntitlements, getLimitsForPlanKey, getFeaturesForPlanKey } = require('../utils/entitlements');
const { getCreditSummary } = require('../utils/credits');

function pickDisplayName(user) {
  const firstName = String(user?.firstName || user?.first_name || '').trim();
  const lastName = String(user?.lastName || user?.last_name || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (user?.username) return user.username;
  if (user?.email) return user.email.split('@')[0];
  return 'Customer';
}

function hadPaidSubscriptionBefore(subscription) {
  if (!subscription || subscription.is_active) return false;
  const pk = String(subscription.plan_key || PLAN_KEYS.UNSUBSCRIBED).toLowerCase();
  if ([PLAN_KEYS.STARTER, PLAN_KEYS.PRO, PLAN_KEYS.AGENCY].includes(pk)) return true;
  if (subscription.dodo_subscription_id) return true;
  const st = String(subscription.status || '').toLowerCase();
  if (['canceled', 'cancelled', 'expired', 'past_due', 'unpaid'].includes(st)) return true;
  return false;
}

function formatBillingResponse(subscription) {
  const plan = subscription.plan_key || PLAN_KEYS.UNSUBSCRIBED;
  const price = getPriceForPlan(plan);
  const resolved = resolveEntitlements(subscription);
  const limits = resolved.limits || getLimitsForSubscription(subscription);

  return {
    ...subscription,
    current_plan: plan,
    monthly_price: price,
    entitlements: limits,
    features: resolved.features || {},
    limits,
    catalog_version: resolved.catalog_version,
    had_subscription_before: hadPaidSubscriptionBefore(subscription),
  };
}

function extractArrayPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.subscriptions)) return payload.subscriptions;
  return [];
}

async function fetchDodoInvoicesForCustomer(customerId) {
  const endpointCandidates = [
    `/invoices?customer_id=${encodeURIComponent(customerId)}`,
    `/customers/${encodeURIComponent(customerId)}/invoices`,
  ];

  for (const endpoint of endpointCandidates) {
    try {
      const payload = await dodoRequest(endpoint, { method: 'GET' });
      const invoices = extractArrayPayload(payload);
      if (invoices.length) return invoices;
    } catch {
      // Try next endpoint shape.
    }
  }

  return [];
}

function mapDodoInvoice(invoice = {}, fallbackStatus = 'paid') {
  return {
    id: invoice.invoice_id || invoice.id || 'invoice',
    amount:
      invoice.amount ??
      invoice.total ??
      invoice.total_amount ??
      invoice.paid_amount ??
      null,
    date: invoice.created_at || invoice.createdAt || invoice.issued_at || null,
    period_end: invoice.period_end || invoice.current_period_end || null,
    status: invoice.status || fallbackStatus,
  };
}

function buildFallbackInvoiceFromSubscription(subscription = {}) {
  const amount = Number(subscription.recurring_amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return {
    id: subscription.latest_invoice_id || `sub-${subscription.dodo_subscription_id || 'current'}`,
    amount,
    date: subscription.current_period_start || subscription.updated_at || new Date().toISOString(),
    period_end: subscription.current_period_end || null,
    status: subscription.status || 'active',
  };
}

async function getBillingStatus(req, res) {
  try {
    await ensureUser(req.user);
    let subscription = await getSubscriptionByUserId(req.user.id);
    const subscriptionIdFromQuery =
      typeof req.query.subscription_id === 'string' ? req.query.subscription_id.trim() : '';
    const shouldReconcile =
      Boolean(subscriptionIdFromQuery) ||
      Boolean(subscription?.dodo_subscription_id) ||
      Boolean(subscription?.dodo_customer_id);

    if (shouldReconcile && !subscription?.is_active) {
      try {
        subscription = await reconcileSubscriptionByUserId(req.user.id, {
          onlyWhenInactive: true,
          subscriptionId: subscriptionIdFromQuery || subscription?.dodo_subscription_id || null,
        });
      } catch (syncError) {
        console.warn('Billing reconciliation skipped:', syncError?.message || syncError);
      }
    }

    const [invoiceRows] = await pool.query(
      `SELECT latest_invoice_id, latest_invoice_amount, current_period_end, updated_at
       FROM subscriptions
       WHERE user_id = ? AND latest_invoice_id IS NOT NULL
       LIMIT 5`,
      [req.user.id]
    );

    let invoices = invoiceRows.map((row) => ({
      id: row.latest_invoice_id,
      amount: row.latest_invoice_amount,
      date: row.updated_at,
      period_end: row.current_period_end,
      status: subscription.status,
    }));

    if (!invoices.length && subscription?.dodo_customer_id) {
      try {
        const remoteInvoices = await fetchDodoInvoicesForCustomer(subscription.dodo_customer_id);
        invoices = remoteInvoices.slice(0, 5).map((invoice) => mapDodoInvoice(invoice, subscription.status));
      } catch (invoiceError) {
        console.warn('Billing invoice sync skipped:', invoiceError?.message || invoiceError);
      }
    }

    if (!invoices.length) {
      const fallbackInvoice = buildFallbackInvoiceFromSubscription(subscription);
      if (fallbackInvoice) {
        invoices = [fallbackInvoice];
      }
    }

    const usage = await getUsageSummaryByUserId(req.user.id, subscription);
    const credits = await getCreditSummary(req.user.id, formatBillingResponse(subscription));

    return res.json({
      subscription: formatBillingResponse(subscription),
      usage,
      credits,
      invoices,
      plans: [
        {
          key: PLAN_KEYS.STARTER,
          name: 'Starter',
          price: 49,
          interval: 'month',
          cta: 'Choose Starter',
          entitlements: getLimitsForPlanKey(PLAN_KEYS.STARTER),
          limits: getLimitsForPlanKey(PLAN_KEYS.STARTER),
          features: getFeaturesForPlanKey(PLAN_KEYS.STARTER),
        },
        {
          key: PLAN_KEYS.PRO,
          name: 'Pro',
          price: 99,
          interval: 'month',
          cta: 'Upgrade to Pro',
          entitlements: getLimitsForPlanKey(PLAN_KEYS.PRO),
          limits: getLimitsForPlanKey(PLAN_KEYS.PRO),
          features: getFeaturesForPlanKey(PLAN_KEYS.PRO),
        },
        {
          key: PLAN_KEYS.AGENCY,
          name: 'Agency',
          price: 299,
          interval: 'month',
          cta: 'Talk to Sales',
          entitlements: getLimitsForPlanKey(PLAN_KEYS.AGENCY),
          limits: getLimitsForPlanKey(PLAN_KEYS.AGENCY),
          features: getFeaturesForPlanKey(PLAN_KEYS.AGENCY),
        },
      ],
      catalog_version: resolveEntitlements(subscription).catalog_version,
    });
  } catch (error) {
    console.error('getBillingStatus error:', error);
    return res.status(500).json({ error: error.message || 'Failed to load billing status' });
  }
}

async function getCreditStatus(req, res) {
  try {
    await ensureUser(req.user);
    const subscription = await getSubscriptionByUserId(req.user.id);
    const credits = await getCreditSummary(req.user.id, formatBillingResponse(subscription));
    return res.json({ credits });
  } catch (error) {
    console.error('getCreditStatus error:', error);
    return res.status(500).json({ error: error.message || 'Failed to load credit status' });
  }
}

async function createDodoCustomerForUser(user) {
  return dodoRequest('/customers', {
    method: 'POST',
    body: JSON.stringify({
      email: pickPrimaryEmail(user) || `${user.id}@clerk.local`,
      name: pickDisplayName(user),
      metadata: {
        clerk_user_id: user.id,
      },
    }),
  });
}

async function getDodoCustomer(customerId) {
  return dodoRequest(`/customers/${encodeURIComponent(customerId)}`, {
    method: 'GET',
  });
}

async function updateDodoCustomerName(customerId, user) {
  return dodoRequest(`/customers/${encodeURIComponent(customerId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: pickDisplayName(user),
    }),
  });
}

async function ensureDodoCustomerForUser(existingSubscription, user) {
  const desiredEmail = pickPrimaryEmail(user) || `${user.id}@clerk.local`;
  let customerId = existingSubscription.dodo_customer_id || null;

  if (!customerId) {
    const createdCustomer = await createDodoCustomerForUser(user);
    return createdCustomer.customer_id || createdCustomer.id || null;
  }

  try {
    const existingCustomer = await getDodoCustomer(customerId);
    const existingEmail = String(existingCustomer?.email || '').trim().toLowerCase();
    const nextEmail = String(desiredEmail || '').trim().toLowerCase();

    if (existingEmail && nextEmail && existingEmail !== nextEmail) {
      const recreatedCustomer = await createDodoCustomerForUser(user);
      return recreatedCustomer.customer_id || recreatedCustomer.id || customerId;
    }

    await updateDodoCustomerName(customerId, user);
    return customerId;
  } catch (error) {
    console.warn('[Billing checkout] Failed to sync Dodo customer before checkout', {
      userId: user?.id || null,
      customerId,
      message: error?.message || String(error),
    });
    return customerId;
  }
}

async function createBillingCheckout(req, res) {
  try {
    await ensureUser(req.user);
    const billingUser = await getFullClerkUser(req.user.id);

    const { planKey, flow } = req.body || {};
    if (![PLAN_KEYS.STARTER, PLAN_KEYS.PRO].includes(planKey)) {
      return res.status(400).json({ error: 'Only starter and pro plans support self-serve checkout' });
    }

    const productId = getPlanProductId(planKey);
    if (!productId) {
      console.error('[Billing checkout] Missing product mapping', {
        userId: req.user?.id || null,
        planKey,
        starterProductIdConfigured: Boolean(process.env.DODO_STARTER_PRODUCT_ID),
        proProductIdConfigured: Boolean(process.env.DODO_PRO_PRODUCT_ID),
      });
      return res.status(500).json({ error: `Missing product configuration for ${planKey}` });
    }

    const resolvedFromProduct = resolvePlanKeyFromProductId(productId);
    if (resolvedFromProduct !== planKey) {
      console.error('[Billing checkout] Product mapping mismatch', {
        userId: req.user?.id || null,
        requestedPlanKey: planKey,
        resolvedPlanFromProductId: resolvedFromProduct,
        productId,
      });
      return res.status(500).json({ error: 'Billing product mapping mismatch. Please verify Dodo product IDs.' });
    }

    console.log('[Billing checkout] Creating checkout', {
      userId: req.user?.id || null,
      requestedPlanKey: planKey,
      productId,
      flow: flow || 'default',
      dodoEnvironment: process.env.DODO_PAYMENTS_ENVIRONMENT || 'test_mode',
    });

    const existingSubscription = await getSubscriptionByUserId(req.user.id);
    if (existingSubscription.is_active && existingSubscription.plan_key === planKey) {
      return res.status(400).json({ error: `You are already on the ${planKey} plan` });
    }

    const customerId = await ensureDodoCustomerForUser(existingSubscription, billingUser);

    if (!customerId) {
      return res.status(500).json({ error: 'Failed to create billing customer' });
    }

    const customerEmail = pickPrimaryEmail(billingUser) || `${req.user.id}@clerk.local`;
    const customerName = pickDisplayName(billingUser);

    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    const isOnboardingFlow = String(flow || '').toLowerCase() === 'onboarding';
    const checkoutBasePath = isOnboardingFlow ? '/onboarding/billing' : '/billing';
    const returnUrl = `${clientOrigin}${checkoutBasePath}?checkout=success`;
    const cancelUrl = `${clientOrigin}${checkoutBasePath}?checkout=canceled`;

    const checkout = await dodoRequest('/checkouts', {
      method: 'POST',
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: {
          customer_id: customerId,
          email: customerEmail,
          name: customerName,
        },
        return_url: returnUrl,
        cancel_url: cancelUrl,
        metadata: {
          clerk_user_id: req.user.id,
          plan_key: planKey,
        },
      }),
    });

    console.log('[Billing checkout] Checkout session created', {
      userId: req.user?.id || null,
      requestedPlanKey: planKey,
      productId,
      sessionId: checkout?.session_id || null,
      hasCheckoutUrl: Boolean(checkout?.checkout_url),
    });

    await upsertSubscriptionByUserId(req.user.id, {
      ...existingSubscription,
      dodo_customer_id: customerId,
      plan_key: existingSubscription.plan_key || PLAN_KEYS.UNSUBSCRIBED,
      status: existingSubscription.status || 'unsubscribed',
      metadata: {
        ...(existingSubscription.metadata || {}),
        pending_checkout_plan: planKey,
      },
    });

    return res.status(201).json({
      checkout_url: checkout.checkout_url,
      session_id: checkout.session_id,
    });
  } catch (error) {
    console.error('createBillingCheckout error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create checkout' });
  }
}

async function createBillingPortal(req, res) {
  try {
    await ensureUser(req.user);
    const subscription = await getSubscriptionByUserId(req.user.id);

    if (!subscription.dodo_customer_id) {
      return res.status(400).json({ error: 'No billing customer found for this account' });
    }

    const session = await dodoRequest(
      `/customers/${encodeURIComponent(subscription.dodo_customer_id)}/customer-portal/session`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );

    return res.json({ link: session.link || null });
  } catch (error) {
    console.error('createBillingPortal error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create portal session' });
  }
}

async function resolveUserIdFromEvent(data) {
  const fromMeta =
    data?.metadata?.clerk_user_id ||
    data?.customer?.metadata?.clerk_user_id ||
    null;
  if (fromMeta) return fromMeta;

  const customerId = data?.customer_id || data?.customer?.customer_id || null;
  if (customerId) {
    const [rows] = await pool.query(
      `SELECT user_id FROM subscriptions WHERE dodo_customer_id = ? LIMIT 1`,
      [customerId]
    );
    if (rows[0]?.user_id) return rows[0].user_id;
  }

  const subscriptionId = data?.subscription_id || data?.id || null;
  if (subscriptionId) {
    const [rows] = await pool.query(
      `SELECT user_id FROM subscriptions WHERE dodo_subscription_id = ? LIMIT 1`,
      [subscriptionId]
    );
    if (rows[0]?.user_id) return rows[0].user_id;
  }

  return null;
}

async function recordWebhookEvent(webhookId, eventType) {
  if (!webhookId) return true;
  const [result] = await pool.query(
    `INSERT IGNORE INTO billing_webhook_events (webhook_id, event_type) VALUES (?, ?)`,
    [webhookId, eventType]
  );
  return result.affectedRows > 0;
}

async function handleBillingWebhook(req, res) {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
    const verified = verifyDodoWebhookSignature(rawBody, req.headers);
    const payload = JSON.parse(rawBody || '{}');
    const eventType = payload?.type || 'unknown';
    const data = payload?.data || {};

    const shouldProcess = await recordWebhookEvent(verified.id, eventType);
    if (!shouldProcess) {
      return res.json({ ok: true, duplicate: true });
    }

    const userId = await resolveUserIdFromEvent(data);
    if (!userId) {
      console.warn('[Billing webhook] Ignored event without resolvable user', {
        eventType,
        customerId: data?.customer_id || data?.customer?.customer_id || null,
        subscriptionId: data?.subscription_id || data?.id || null,
      });
      return res.json({ ok: true, ignored: true });
    }

    await ensureUser({
      id: userId,
      email: data?.customer?.email || null,
      username: data?.customer?.name || null,
    });

    const patch = mapDodoSubscriptionToPatch(data, data?.customer_id || data?.customer?.customer_id) || {
      dodo_customer_id: data?.customer_id || data?.customer?.customer_id || null,
      dodo_subscription_id: data?.subscription_id || data?.id || null,
      plan_key: inferPlanKeyFromSubscription(data),
      status: data?.status || 'unsubscribed',
      currency: data?.currency || null,
      recurring_amount: data?.recurring_pre_tax_amount || null,
      metadata: data?.metadata || null,
    };

    if (
      eventType === 'subscription.active' ||
      eventType === 'subscription.renewed' ||
      eventType === 'subscription.updated'
    ) {
      patch.status = data?.status || 'active';
      if (!patch.plan_key || patch.plan_key === PLAN_KEYS.UNSUBSCRIBED) {
        patch.plan_key = inferPlanKeyFromSubscription(data);
      }
    }

    if (eventType === 'subscription.cancelled' || eventType === 'subscription.expired') {
      patch.status = data?.status || 'canceled';
      patch.plan_key = resolvePlanKeyFromProductId(data?.product_id) || patch.plan_key || PLAN_KEYS.UNSUBSCRIBED;
    }

    await upsertSubscriptionByUserId(userId, patch);
    return res.json({ ok: true });
  } catch (error) {
    console.error('handleBillingWebhook error:', error);
    return res.status(400).json({ error: error.message || 'Invalid webhook' });
  }
}

module.exports = {
  createBillingCheckout,
  createBillingPortal,
  getCreditStatus,
  getBillingStatus,
  handleBillingWebhook,
};
