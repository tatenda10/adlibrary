export function parseAdDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Days an ad has been live — closest proxy Meta gives for a proven winner. */
export function computeAdLongevityDays(ad) {
  const start = parseAdDate(ad?.ad_delivery_start_time || ad?.ad_creation_time);
  if (!start) return 0;
  const diffMs = Date.now() - start.getTime();
  return Math.max(0, Math.round(diffMs / 86400000));
}

export function sortAdsByLongevity(ads = []) {
  return [...ads].sort((a, b) => {
    const longevityDiff = computeAdLongevityDays(b) - computeAdLongevityDays(a);
    if (longevityDiff !== 0) return longevityDiff;
    const startA = parseAdDate(a.ad_delivery_start_time || a.ad_creation_time)?.getTime() || 0;
    const startB = parseAdDate(b.ad_delivery_start_time || b.ad_creation_time)?.getTime() || 0;
    return startA - startB;
  });
}
