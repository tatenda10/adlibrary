const { getSubscriptionByUserId, reconcileSubscriptionByUserId } = require('../utils/billing');
const { resolveEntitlements } = require('../utils/entitlements');
const { ensureUser } = require('../utils/users');
const BILLING_MIDDLEWARE_DEBUG = true;

async function hydrateSubscription(req, res, next) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await ensureUser(req.user);
    req.subscription = await getSubscriptionByUserId(req.user.id);
    if (req.subscription?.dodo_customer_id || req.subscription?.dodo_subscription_id) {
      try {
        req.subscription = await reconcileSubscriptionByUserId(req.user.id, {
          onlyWhenInactive: false,
          subscriptionId: req.subscription?.dodo_subscription_id || null,
        });
      } catch (syncError) {
        console.warn('Subscription reconciliation skipped in middleware:', syncError?.message || syncError);
      }
    }

    req.entitlements = resolveEntitlements(req.subscription);
    req.subscription = {
      ...req.subscription,
      features: req.entitlements.features,
      limits: req.entitlements.limits,
      catalog_version: req.entitlements.catalog_version,
    };

    if (BILLING_MIDDLEWARE_DEBUG) {
      console.log('[BillingMiddleware] hydrated subscription:', {
        userId: req.user.id,
        path: req.originalUrl,
        plan_key: req.subscription?.plan_key,
        is_active: req.subscription?.is_active,
        features: req.entitlements?.features,
      });
    }
    return next();
  } catch (error) {
    console.error('hydrateSubscription error:', error);
    return res.status(500).json({ error: 'Failed to load subscription state' });
  }
}

function requirePaidSubscription(req, res, next) {
  return next();
}

function requireFeature(featureKey) {
  return function requireFeatureMiddleware(req, res, next) {
    return next();
  };
}

function requireProSubscription(req, res, next) {
  return next();
}

module.exports = {
  hydrateSubscription,
  requireFeature,
  requirePaidSubscription,
  requireProSubscription,
};
