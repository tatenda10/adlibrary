const { canAccessPro, getSubscriptionByUserId, reconcileSubscriptionByUserId } = require('../utils/billing');
const { ensureUser } = require('../utils/users');
const BILLING_MIDDLEWARE_DEBUG = true;

async function hydrateSubscription(req, res, next) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await ensureUser(req.user);
    req.subscription = await getSubscriptionByUserId(req.user.id);
    if (req.subscription?.dodo_customer_id) {
      try {
        req.subscription = await reconcileSubscriptionByUserId(req.user.id, { onlyWhenInactive: false });
      } catch (syncError) {
        console.warn('Subscription reconciliation skipped in middleware:', syncError?.message || syncError);
      }
    }
    if (BILLING_MIDDLEWARE_DEBUG) {
      console.log('[BillingMiddleware] hydrated subscription:', {
        userId: req.user.id,
        path: req.originalUrl,
        subscription: req.subscription,
      });
    }
    return next();
  } catch (error) {
    console.error('hydrateSubscription error:', error);
    return res.status(500).json({ error: 'Failed to load subscription state' });
  }
}

function requirePaidSubscription(req, res, next) {
  if (!req.subscription?.is_active) {
    if (BILLING_MIDDLEWARE_DEBUG) {
      console.log('[BillingMiddleware] paid gate blocked request:', {
        userId: req.user?.id,
        path: req.originalUrl,
        subscription: req.subscription,
      });
    }
    return res.status(402).json({
      error: 'An active subscription is required',
      code: 'subscription_required',
      billing: req.subscription,
    });
  }
  return next();
}

function requireProSubscription(req, res, next) {
  if (!req.subscription?.is_active) {
    if (BILLING_MIDDLEWARE_DEBUG) {
      console.log('[BillingMiddleware] pro gate blocked inactive request:', {
        userId: req.user?.id,
        path: req.originalUrl,
        subscription: req.subscription,
      });
    }
    return res.status(402).json({
      error: 'An active subscription is required',
      code: 'subscription_required',
      billing: req.subscription,
    });
  }

  if (!canAccessPro(req.subscription)) {
    if (BILLING_MIDDLEWARE_DEBUG) {
      console.log('[BillingMiddleware] pro gate blocked non-pro request:', {
        userId: req.user?.id,
        path: req.originalUrl,
        subscription: req.subscription,
      });
    }
    return res.status(403).json({
      error: 'A Pro subscription is required',
      code: 'pro_required',
      billing: req.subscription,
    });
  }

  return next();
}

module.exports = {
  hydrateSubscription,
  requirePaidSubscription,
  requireProSubscription,
};
