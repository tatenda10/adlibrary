const STORAGE_KEY = 'bulk-creative-intel';

export function saveBulkCreativeIntel(intel) {
  if (!intel || typeof intel !== 'object') return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...intel,
        saved_at: new Date().toISOString(),
      })
    );
  } catch {
    // ignore quota / private mode
  }
}

export function readBulkCreativeIntel() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function clearBulkCreativeIntel() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function buildIntelFromFacebookAd(ad, { competitorName = '' } = {}) {
  const body = (ad?.ad_creative_bodies || [])[0] || (ad?.captions || [])[0] || '';
  const title = (ad?.ad_creative_link_titles || [])[0] || '';
  const cta = (ad?.call_to_action_types || [])[0] || '';
  return {
    source: 'facebook_ads',
    competitor_name: competitorName || ad?.page_name || ad?.title || 'Competitor',
    winning_angle: title || body.slice(0, 160),
    offer_notes: (ad?.ad_creative_link_descriptions || [])[0] || '',
    landing_page_url: ad?.external_url || ad?.link_url || '',
    sample_ads: [
      {
        advertiser: ad?.page_name || ad?.title || '',
        title,
        body,
        cta,
        longevity_days: computeAdLongevityDaysClient(ad),
      },
    ],
  };
}

function computeAdLongevityDaysClient(ad) {
  const raw = ad?.ad_delivery_start_time || ad?.ad_creation_time;
  if (!raw) return 0;
  const start = new Date(raw);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.round((Date.now() - start.getTime()) / 86400000));
}

export function buildIntelFromFunnelSpy(result, pageIndex = 0) {
  const page = result?.landing_pages?.[pageIndex];
  if (!page) return null;
  const takeaway = (result?.report?.winner_takeaways || []).find((item) => item.url === page.url) || {};
  return {
    source: 'funnel_spy',
    competitor_name: result?.competitor_input || 'Competitor',
    winning_angle: takeaway.why_it_matters || page.domain || page.url,
    offer_notes: [takeaway.offer_observation, takeaway.cta_observation].filter(Boolean).join(' · '),
    landing_page_url: page.url,
    sample_ads: (page.sample_ads || []).map((ad) => ({
      advertiser: ad.advertiser,
      title: ad.title,
      body: ad.body,
      cta: ad.cta,
      longevity_days: ad.longevity_days || 0,
    })),
  };
}
