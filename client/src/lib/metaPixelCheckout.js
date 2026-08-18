import { trackMetaCheckoutSuccess, trackMetaInitiateCheckout } from './metaPixel.js';

export function trackCheckoutStarted(planKey, flow = 'default') {
  trackMetaInitiateCheckout({ planKey, flow });
}

export function trackCheckoutCompletedFromBilling(subscription, options = {}) {
  const planKey =
    options.planKey ||
    subscription?.plan_key ||
    subscription?.current_plan ||
    'starter';

  if (!subscription?.is_active) return;

  trackMetaCheckoutSuccess(planKey, {
    eventId: options.eventId,
    value: options.value,
    currency: options.currency || subscription?.currency || 'USD',
  });
}
