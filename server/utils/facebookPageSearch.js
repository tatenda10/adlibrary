const FACEBOOK_BASE_URL = 'https://www.facebook.com';

function normalizeCountryCodes(countries) {
  const list = Array.isArray(countries) && countries.length ? countries : ['US'];
  const normalized = [...new Set(list.map((value) => String(value || '').toUpperCase().trim()).filter(Boolean))];
  if (normalized.includes('ALL')) return ['ALL'];
  return normalized;
}

function isFacebookPageUrl(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  return raw.includes('facebook.com/') && !raw.includes('/ads/library');
}

function normalizeFacebookPageUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (isFacebookPageUrl(raw)) {
    return raw.startsWith('http') ? raw : `https://${raw.replace(/^\/+/, '')}`;
  }

  if (/^[a-zA-Z0-9.\-_]+$/.test(raw) && !raw.includes(' ')) {
    return `${FACEBOOK_BASE_URL}/${raw.replace(/^@/, '')}`;
  }

  return '';
}

function buildPageLink({ link, username, id, name }) {
  const direct = normalizeFacebookPageUrl(link || '');
  if (direct) return direct;

  const handle = String(username || '').trim().replace(/^@/, '');
  if (handle) return `${FACEBOOK_BASE_URL}/${handle}`;

  const pageId = String(id || '').trim();
  if (pageId && /^\d+$/.test(pageId)) {
    return `${FACEBOOK_BASE_URL}/${pageId}`;
  }

  const slug = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  if (slug) return `${FACEBOOK_BASE_URL}/${slug}`;

  return '';
}

async function searchFacebookPages(query, { countries = ['US'], limit = 10 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];

  const token = process.env.META_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN;
  const graphVersion = process.env.META_GRAPH_VERSION || 'v22.0';
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);
  const results = [];
  const seen = new Set();

  const pushPage = (page) => {
    const id = String(page.id || page.page_id || '').trim();
    const link = buildPageLink({
      link: page.link,
      username: page.username,
      id,
      name: page.name || page.page_name,
    });
    if (!link && !id) return;

    const key = (id || link).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    results.push({
      id: id || null,
      name: String(page.name || page.page_name || '').trim() || link,
      link,
      url: link,
      username: String(page.username || '').trim() || null,
      verification_status: page.verification_status || (page.is_verified ? 'verified' : ''),
      source: page.source || 'unknown',
    });
  };

  const direct = normalizeFacebookPageUrl(q);
  if (direct) {
    pushPage({ link: direct, name: q, source: 'direct_handle' });
  }

  if (token) {
    try {
      const params = new URLSearchParams({
        access_token: token,
        q,
        fields: 'id,name,link,username,verification_status,is_verified',
        limit: String(safeLimit),
      });
      const response = await fetch(`https://graph.facebook.com/${graphVersion}/pages/search?${params.toString()}`);
      const data = await response.json();
      if (response.ok && Array.isArray(data?.data)) {
        for (const row of data.data) {
          pushPage({ ...row, source: 'graph_pages_search' });
        }
      }
    } catch {
      // Graph page search may require Page Public Metadata Access.
    }

    if (results.length < safeLimit) {
      try {
        const params = new URLSearchParams({
          access_token: token,
          search_terms: q,
          ad_type: 'ALL',
          ad_active_status: 'ALL',
          ad_reached_countries: JSON.stringify(normalizeCountryCodes(countries)),
          fields: 'page_id,page_name',
          limit: '50',
        });
        const response = await fetch(`https://graph.facebook.com/${graphVersion}/ads_archive?${params.toString()}`);
        const data = await response.json();
        if (response.ok && Array.isArray(data?.data)) {
          for (const row of data.data) {
            if (results.length >= safeLimit) break;
            if (!row?.page_id || !row?.page_name) continue;
            pushPage({
              id: row.page_id,
              name: row.page_name,
              link: `https://www.facebook.com/${row.page_id}`,
              source: 'ads_archive',
            });
          }
        }
      } catch {
        // Ad Library API may be unavailable for this token.
      }
    }
  }

  const slug = q.toLowerCase().replace(/^@/, '').replace(/\s+/g, '');
  if (slug && !slug.includes(' ') && !seen.has(`${FACEBOOK_BASE_URL}/${slug}`.toLowerCase())) {
    pushPage({
      link: `${FACEBOOK_BASE_URL}/${slug}`,
      name: q,
      source: 'slug_guess',
    });
  }

  return results.slice(0, safeLimit);
}

module.exports = {
  normalizeFacebookPageUrl,
  searchFacebookPages,
};
