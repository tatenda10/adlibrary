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
  const audienceRole = preferences?.audienceRole || '';

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
    audience_role: audienceRole,
    country: preferences?.country || (Array.isArray(preferences?.countries) ? preferences.countries[0] : '') || '',
    countries: preferences?.countries || [],
    suggested_channels_text: preferences?.suggestedChannelsText || '',
    story: row.story || '',
    tone,
    value_props: valueProps,
    content_pillars: contentPillars,
    onboarding_step: Number(row.onboarding_step) || 1,
    onboarding_completed: Boolean(Number(row.onboarding_completed)),
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
       bp.onboarding_step,
       bp.onboarding_completed,
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
       bp.onboarding_step,
       bp.onboarding_completed,
       bp.created_at,
       bp.updated_at,
       bp.last_scraped_at
     FROM brand_profiles bp
     LEFT JOIN users u ON u.id = bp.user_id
     WHERE bp.user_id = ?
     LIMIT 1`,
    [id]
  );

  if (!rows?.length) {
    const [userOnly] = await pool.query(
      `SELECT id, email, username FROM users WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!userOnly?.length) return null;
    return {
      user_id: userOnly[0].id,
      email: userOnly[0].email || null,
      username: userOnly[0].username || null,
      brand_name: '',
      website_url: '',
      industry: '',
      niche: '',
      audience_role: '',
      countries: [],
      channels: [],
      story: '',
      target_audience: '',
      onboarding_step: 1,
      onboarding_completed: false,
    };
  }
  return normalizeBrandProfileRow(rows[0]);
}

async function getAdminOnboardingUserJourney(userId, { days = 90 } = {}) {
  const id = String(userId || '').trim();
  if (!id) return null;

  const profile = await getAdminOnboardingProfileByUserId(id);
  const safeDays = Math.min(Math.max(Number(days) || 90, 1), 180);

  const [eventRows] = await pool.query(
    `SELECT event_name, props_json, page_path, created_at
     FROM product_events
     WHERE user_id = ?
       AND event_name LIKE 'onboarding_%'
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     ORDER BY created_at ASC
     LIMIT 500`,
    [id, safeDays]
  );

  const events = (eventRows || []).map((row) => {
    let props = null;
    try {
      props = typeof row.props_json === 'object' ? row.props_json : JSON.parse(row.props_json || 'null');
    } catch {
      props = null;
    }
    return {
      event_name: row.event_name,
      page_path: row.page_path || '',
      props: props || {},
      created_at: row.created_at,
    };
  });

  const roleFromEvents = events
    .map((item) => item.props?.audience_role || item.props?.audienceRole || '')
    .filter(Boolean)
    .pop();

  const answers = {};
  for (const item of events) {
    const key = String(item.event_name || '');
    if (key === 'onboarding_q_role_answered') answers.role = item.props?.audience_role || item.props?.audienceRole || answers.role;
    if (key === 'onboarding_q_website_answered' || key === 'onboarding_website_extracted') {
      answers.website = item.props?.website_url || answers.website;
    }
    if (key === 'onboarding_billing_plan_selected' || key === 'onboarding_billing_checkout_started') {
      answers.plan = item.props?.plan_key || item.props?.checkout_plan || answers.plan;
    }
  }

  return {
    user_id: id,
    profile,
    flow: {
      audience_role: profile?.audience_role || roleFromEvents || '',
      brand_name: profile?.brand_name || '',
      website_url: profile?.website_url || answers.website || '',
      industry: profile?.industry || '',
      niche: profile?.niche || '',
      countries: profile?.countries || [],
      channels: Array.isArray(profile?.channels) ? profile.channels : [],
      story: profile?.story || '',
      ideal_customer: profile?.target_audience || '',
      plan: answers.plan || '',
      onboarding_step: profile?.onboarding_step || 1,
      onboarding_completed: Boolean(profile?.onboarding_completed),
    },
    events,
  };
}

module.exports = {
  listAdminOnboardingProfiles,
  getAdminOnboardingProfileByUserId,
  getAdminOnboardingUserJourney,
};
