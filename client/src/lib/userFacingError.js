const TECHNICAL_PATTERNS = [
  /apify/i,
  /memory limit/i,
  /actor run/i,
  /console\.apify\.com/i,
  /exceed the memory/i,
  /requested:\s*\d+mb/i,
  /currently used:\s*\d+mb/i,
  /APIFY_TOKEN/i,
  /defaultdatasetid/i,
  /key-value-stores/i,
];

const TOAST_FALLBACKS = {
  offline: 'You appear to be offline. Reconnect and try again.',
  network: 'Network issue — check your connection and try again.',
  timeout: 'That took too long. Please try again.',
  unauthorized: 'Your session expired. Refresh the page and sign in again.',
  forbidden: "You don't have access to this feature on your current plan.",
  not_found: 'Nothing is saved for this yet. Try refreshing to load new data.',
  server: 'Our servers are busy. Please try again in a few minutes.',
  unavailable: 'This data is temporarily unavailable. Please try again shortly.',
  validation: 'Please check your input and try again.',
  generic: 'Something went wrong. Please try again.',
};

export function isTechnicalErrorMessage(message) {
  const raw = String(message || '').trim();
  if (!raw) return false;
  if (raw.length > 320 && /https?:\/\//i.test(raw)) return true;
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(raw));
}

export function classifyError(err) {
  if (!err) return 'generic';

  const code = String(err?.code || '').toLowerCase();
  if (code === 'quota_exceeded' || code === 'subscription_required' || code === 'pro_required') {
    return 'billing';
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'offline';
  }

  const status = Number(err?.status);
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 408 || status === 504) return 'timeout';
  if (status >= 500) return 'server';
  if (status === 502 || status === 503) return 'unavailable';

  const message = String(
    typeof err === 'string' ? err : err?.userMessage || err?.message || ''
  ).toLowerCase();

  if (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message.includes('network request failed')
  ) {
    return 'network';
  }
  if (message.includes('timeout') || message.includes('timed out') || message.includes('aborted')) {
    return 'timeout';
  }
  if (message.includes('not configured') || message.includes('temporarily unavailable')) {
    return 'unavailable';
  }

  return 'generic';
}

export function getUserFacingError(err, fallback = TOAST_FALLBACKS.generic) {
  if (!err) return fallback;

  const kind = classifyError(err);
  if (kind === 'billing') return fallback;

  const raw =
    typeof err === 'string'
      ? err
      : err.userMessage || err.message || '';

  const message = String(raw).trim();
  if (!message) return fallback;
  if (isTechnicalErrorMessage(message)) {
    return TOAST_FALLBACKS[kind] || fallback;
  }
  return message;
}

/** Message tuned for toast notifications (maps status/network/technical errors). */
export function getToastErrorMessage(err, fallback = TOAST_FALLBACKS.generic) {
  const kind = classifyError(err);
  if (kind === 'billing') return fallback;

  const mapped = TOAST_FALLBACKS[kind];
  const raw =
    typeof err === 'string'
      ? err
      : err?.userMessage || err?.message || '';

  const message = String(raw).trim();
  if (!message || isTechnicalErrorMessage(message)) {
    return mapped || fallback;
  }

  if (kind !== 'generic' && kind !== 'not_found') {
    return message;
  }

  return getUserFacingError(err, mapped || fallback);
}

export { TOAST_FALLBACKS };
