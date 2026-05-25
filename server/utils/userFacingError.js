const TECHNICAL_PATTERNS = [
  /apify/i,
  /memory limit/i,
  /actor run/i,
  /console\.apify\.com/i,
  /exceed the memory/i,
  /requested:\s*\d+mb/i,
  /currently used:\s*\d+mb/i,
  /APIFY_TOKEN/i,
];

function isTechnicalErrorMessage(message) {
  const raw = String(message || '').trim();
  if (!raw) return false;
  if (raw.length > 320 && /https?:\/\//i.test(raw)) return true;
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(raw));
}

function toUserFacingError(message, fallback = 'Something went wrong. Please try again.') {
  const raw = String(message || '').trim();
  if (!raw) return fallback;
  if (isTechnicalErrorMessage(raw)) return fallback;
  return raw;
}

module.exports = { isTechnicalErrorMessage, toUserFacingError };
