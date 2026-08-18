const DEFAULT_PIXEL_ID = '1587873156343019';

const PLAN_VALUES_USD = {
  starter: 49,
  pro: 99,
  agency: 299,
};

let initPromise = null;

function getPixelId() {
  return String(import.meta.env.VITE_META_PIXEL_ID || DEFAULT_PIXEL_ID).trim();
}

function canUsePixel() {
  return typeof window !== 'undefined' && Boolean(getPixelId());
}

function callFbq(...args) {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq(...args);
  }
}

export function getPlanMetaValue(planKey) {
  const key = String(planKey || '').toLowerCase();
  return PLAN_VALUES_USD[key] || 0;
}

function sanitizeParams(params = {}) {
  const next = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'number' && Number.isFinite(value)) {
      next[key] = value;
    } else if (typeof value === 'string' || typeof value === 'boolean') {
      next[key] = value;
    } else {
      next[key] = String(value);
    }
  }
  return next;
}

function trackStandard(eventName, params = {}) {
  if (!canUsePixel()) return;
  const payload = sanitizeParams(params);
  if (Object.keys(payload).length) {
    callFbq('track', eventName, payload);
  } else {
    callFbq('track', eventName);
  }
}

function purchaseStorageKey(eventId) {
  return `meta_pixel_purchase_${eventId}`;
}

function wasPurchaseTracked(eventId) {
  if (!eventId || typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(purchaseStorageKey(eventId)) === '1';
  } catch {
    return false;
  }
}

function markPurchaseTracked(eventId) {
  if (!eventId || typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(purchaseStorageKey(eventId), '1');
  } catch {
    // ignore storage failures
  }
}

export function initMetaPixel() {
  if (!canUsePixel()) return Promise.resolve(false);
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve) => {
    if (window.__metaPixelInitialized) {
      resolve(true);
      return;
    }

    if (typeof window.fbq !== 'function') {
      const queue = [];
      const fbq = function fbq(...args) {
        if (fbq.callMethod) {
          fbq.callMethod.apply(fbq, args);
        } else {
          queue.push(args);
        }
      };
      fbq.queue = queue;
      fbq.loaded = true;
      fbq.version = '2.0';
      fbq.push = fbq;
      window.fbq = fbq;
      if (!window._fbq) window._fbq = fbq;
    }

    const finishInit = () => {
      callFbq('init', getPixelId());
      window.__metaPixelInitialized = true;
      resolve(true);
    };

    const existing = document.querySelector('script[src="https://connect.facebook.net/en_US/fbevents.js"]');
    if (existing) {
      finishInit();
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    script.onload = finishInit;
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return initPromise;
}

export function trackMetaPageView() {
  trackStandard('PageView');
}

export function trackMetaViewContent(params = {}) {
  trackStandard('ViewContent', {
    content_type: 'product',
    ...params,
  });
}

export function trackMetaLead(params = {}) {
  trackStandard('Lead', {
    content_category: 'signup',
    ...params,
  });
}

export function trackMetaCompleteRegistration(params = {}) {
  trackStandard('CompleteRegistration', {
    content_category: 'onboarding',
    status: true,
    ...params,
  });
}

export function trackMetaInitiateCheckout({ planKey, flow, value, currency = 'USD' } = {}) {
  const key = String(planKey || '').toLowerCase();
  const resolvedValue = Number(value) || getPlanMetaValue(key);
  trackStandard('InitiateCheckout', {
    content_name: key || 'subscription',
    content_type: 'subscription',
    content_ids: key ? [key] : undefined,
    num_items: 1,
    value: resolvedValue || undefined,
    currency,
    flow: flow || undefined,
  });
}

export function trackMetaPurchase({ planKey, value, currency = 'USD', eventId } = {}) {
  const key = String(planKey || '').toLowerCase();
  const resolvedValue = Number(value) || getPlanMetaValue(key);
  if (!resolvedValue) return;

  const payload = sanitizeParams({
    content_name: key || 'subscription',
    content_type: 'subscription',
    content_ids: key ? [key] : undefined,
    num_items: 1,
    value: resolvedValue,
    currency,
  });

  if (eventId) {
    callFbq('track', 'Purchase', { ...payload, eventID: eventId });
  } else {
    trackStandard('Purchase', payload);
  }
}

export function trackMetaSubscribe({ planKey, value, currency = 'USD', eventId } = {}) {
  const key = String(planKey || '').toLowerCase();
  const resolvedValue = Number(value) || getPlanMetaValue(key);
  if (!resolvedValue) return;

  const payload = sanitizeParams({
    content_name: key || 'subscription',
    content_type: 'subscription',
    content_ids: key ? [key] : undefined,
    value: resolvedValue,
    currency,
    predicted_ltv: resolvedValue * 12,
  });

  if (eventId) {
    callFbq('track', 'Subscribe', { ...payload, eventID: eventId });
  } else {
    trackStandard('Subscribe', payload);
  }
}

export function trackMetaCustom(eventName, params = {}) {
  if (!canUsePixel() || !eventName) return;
  const payload = sanitizeParams(params);
  if (Object.keys(payload).length) {
    callFbq('trackCustom', eventName, payload);
  } else {
    callFbq('trackCustom', eventName);
  }
}

export function trackMetaCheckoutSuccess(planKey, options = {}) {
  const key = String(planKey || '').toLowerCase();
  const value = Number(options.value) || getPlanMetaValue(key);
  if (!value) return;

  const eventId =
    options.eventId ||
    (typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('payment_id') ||
        new URLSearchParams(window.location.search).get('subscription_id')
      : null) ||
    `${key}-${Date.now()}`;

  if (wasPurchaseTracked(eventId)) return;

  trackMetaPurchase({ planKey: key, value, currency: options.currency || 'USD', eventId });
  trackMetaSubscribe({ planKey: key, value, currency: options.currency || 'USD', eventId });
  markPurchaseTracked(eventId);
}
