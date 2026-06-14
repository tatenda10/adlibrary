const pool = require('../db/connection');

function safeParseJson(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  const text = String(value).trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    if (text.includes(',')) {
      return text
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }
    return text;
  }
}

function normalizeBrandProfileRow(row) {
  const preferences = safeParseJson(row.preferences) || {};
  const goals = safeParseJson(row.goals);
  const channels = safeParseJson(row.channels);
  const tone = safeParseJson(row.tone);
  const valueProps = safeParseJson(row.value_props);
  const contentPillars = safeParseJson(row.content_pillars);

  return {
    id: row.id,
    user_id: row.user_id,
    email: row.email || null,
    username: row.username || null,
    brand_name: row.brand_name || '',
    website_url: row.website_url || '',
    industry: row.industry || '',
    brand_size: row.brand_size || '',
    target_audience: row.target_audience || '',
    goals,
    channels,
    preferences,
    niche: preferences?.niche || '',
    country: preferences?.country || (Array.isArray(preferences?.countries) ? preferences.countries[0] : '') || '',
    countries: preferences?.countries || [],
    suggested_channels_text: preferences?.suggestedChannelsText || '',
    story: row.story || '',
    tone,
    value_props: valueProps,
    content_pillars: contentPillars,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_scraped_at: row.last_scraped_at,
  };
}

async function listAdminOnboardingProfiles({ limit = 100, offset = 0, search = '' } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const filters = [];
  const params = [];

  if (search) {
    const term = `%${String(search).slice(0, 80)}%`;
    filters.push(
      `(u.email LIKE ? OR bp.brand_name LIKE ? OR bp.website_url LIKE ? OR bp.industry LIKE ? OR bp.user_id LIKE ?)`
    );
    params.push(term, term, term, term, term);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT
       bp.id,
       bp.user_id,
       u.email,
       u.username,
       bp.brand_name,
       bp.website_url,
       bp.industry,
       bp.brand_size,
       bp.target_audience,
       bp.goals,
       bp.channels,
       bp.preferences,
       bp.story,
       bp.tone,
       bp.value_props,
       bp.content_pillars,
       bp.created_at,
       bp.updated_at,
       bp.last_scraped_at
     FROM brand_profiles bp
     LEFT JOIN users u ON u.id = bp.user_id
     ${where}
     ORDER BY bp.updated_at DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, safeOffset]
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM brand_profiles bp
     LEFT JOIN users u ON u.id = bp.user_id
     ${where}`,
    params
  );

  return {
    profiles: (rows || []).map(normalizeBrandProfileRow),
    total: Number(countRows[0]?.total || 0),
  };
}

async function getAdminOnboardingProfileByUserId(userId) {
  const id = String(userId || '').trim();
  if (!id) return null;

  const [rows] = await pool.query(
    `SELECT
       bp.id,
       bp.user_id,
       u.email,
       u.username,
       bp.brand_name,
       bp.website_url,
       bp.industry,
       bp.brand_size,
       bp.target_audience,
       bp.goals,
       bp.channels,
       bp.preferences,
       bp.story,
       bp.tone,
       bp.value_props,
       bp.content_pillars,
       bp.created_at,
       bp.updated_at,
       bp.last_scraped_at
     FROM brand_profiles bp
     LEFT JOIN users u ON u.id = bp.user_id
     WHERE bp.user_id = ?
     LIMIT 1`,
    [id]
  );

  if (!rows?.length) return null;
  return normalizeBrandProfileRow(rows[0]);
}

module.exports = {
  listAdminOnboardingProfiles,
  getAdminOnboardingProfileByUserId,
};
