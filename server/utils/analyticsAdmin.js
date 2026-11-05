const pool = require('../db/connection');

const ONBOARDING_MILESTONES = [
  { key: 'onboarding_started', label: 'Started' },
  { key: 'onboarding_q_role_answered', label: 'Chose role' },
  { key: 'onboarding_q_website_answered', label: 'Added website' },
  { key: 'onboarding_q_brand_name_answered', label: 'Confirmed brand' },
  { key: 'onboarding_q_channels_answered', label: 'Markets & channels' },
  { key: 'onboarding_completed', label: 'Completed setup' },
];

const BILLING_MILESTONES = [
  { key: 'onboarding_unlock_viewed', label: 'Saw unlock' },
  { key: 'onboarding_unlock_clicked', label: 'Clicked unlock' },
  { key: 'onboarding_billing_viewed', label: 'Viewed plans' },
  { key: 'onboarding_billing_plan_selected', label: 'Picked a plan' },
  { key: 'onboarding_billing_checkout_started', label: 'Started checkout' },
  { key: 'onboarding_billing_payment_success', label: 'Paid' },
];

const BILLING_OUTCOME_EVENTS = [
  { key: 'onboarding_billing_checkout_canceled', label: 'Returned without paying' },
  { key: 'onboarding_billing_checkout_failed', label: 'Checkout failed' },
  { key: 'onboarding_billing_agency_clicked', label: 'Clicked Agency / Talk to sales' },
];

const QUESTION_ANSWER_EVENTS = [
  { key: 'onboarding_q_role_answered', label: 'Your role' },
  { key: 'onboarding_q_website_answered', label: 'Website URL' },
  { key: 'onboarding_q_website_skipped', label: 'Skipped website' },
  { key: 'onboarding_q_brand_name_answered', label: 'Brand name' },
  { key: 'onboarding_q_industry_answered', label: 'Industry' },
  { key: 'onboarding_q_niche_answered', label: 'Niche' },
  { key: 'onboarding_q_countries_answered', label: 'Countries' },
  { key: 'onboarding_q_channels_answered', label: 'Channels' },
  { key: 'onboarding_q_story_answered', label: 'Brand story' },
  { key: 'onboarding_q_ideal_customer_answered', label: 'Ideal customer' },
];

const QUESTION_LABELS = {
  role: 'Your role',
  website: 'Website URL',
  brand: 'Brand details',
  brand_name: 'Brand name',
  industry: 'Industry',
  niche: 'Niche',
  markets: 'Markets & channels',
  countries: 'Countries',
  channels: 'Channels',
  voice: 'Brand voice',
  story: 'Brand story',
  ideal_customer: 'Ideal customer',
  step_1: 'Your role',
  step_2: 'Website URL',
  step_3: 'Brand details',
  step_4: 'Markets & channels',
  step_5: 'Brand voice',
  unlock: 'Unlock teaser',
  billing: 'Billing / plans',
  checkout: 'Payment checkout',
};

const ROLE_FLOW_DEFS = [
  { key: 'founder', label: 'Founder' },
  { key: 'media_buyer', label: 'Solo media buyer' },
  { key: 'in_house', label: 'In-house growth' },
  { key: 'agency', label: 'Agency / operator' },
  { key: 'unknown', label: 'No role yet' },
];

function mapEventCounts(list, countsByEvent) {
  return list.map((step) => {
    const row = countsByEvent.get(step.key) || {};
    return {
      key: step.key,
      label: step.label,
      total: Number(row.total || 0),
      unique_users: Number(row.unique_users || 0),
    };
  });
}

function safeDays(raw) {
  return Math.min(Math.max(Number(raw) || 7, 1), 90);
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeEventRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    event_name: row.event_name,
    page_path: row.page_path,
    element_label: row.element_label,
    props: parseJson(row.props_json),
    session_id: row.session_id || null,
    created_at: row.created_at,
  };
}

async function listAllEvents({ days = 7 } = {}) {
  const safeDaysVal = safeDays(days);

  const [rows] = await pool.query(
    `SELECT
       event_name,
       COUNT(*) AS total,
       COUNT(DISTINCT user_id) AS unique_users,
       COUNT(DISTINCT session_id) AS unique_sessions,
       MAX(created_at) AS last_seen
     FROM product_events
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY event_name
     ORDER BY total DESC`,
    [safeDaysVal]
  );

  return { days: safeDaysVal, events: rows || [] };
}

async function getEventDetail({ eventName, days = 7 } = {}) {
  const name = String(eventName || '').trim().slice(0, 128);
  if (!name) return null;

  const safeDaysVal = safeDays(days);

  const [summaryRows] = await pool.query(
    `SELECT
       COUNT(*) AS total,
       COUNT(DISTINCT user_id) AS unique_users,
       COUNT(DISTINCT session_id) AS unique_sessions,
       MIN(created_at) AS first_seen,
       MAX(created_at) AS last_seen
     FROM product_events
     WHERE event_name = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [name, safeDaysVal]
  );

  const [byDay] = await pool.query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS total, COUNT(DISTINCT user_id) AS unique_users
     FROM product_events
     WHERE event_name = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)
     ORDER BY day ASC`,
    [name, safeDaysVal]
  );

  const [byPage] = await pool.query(
    `SELECT page_path, COUNT(*) AS total
     FROM product_events
     WHERE event_name = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND page_path IS NOT NULL AND page_path != ''
     GROUP BY page_path
     ORDER BY total DESC
     LIMIT 20`,
    [name, safeDaysVal]
  );

  const [recent] = await pool.query(
    `SELECT id, user_id, event_name, page_path, element_label, session_id, props_json, created_at
     FROM product_events
     WHERE event_name = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     ORDER BY created_at DESC
     LIMIT 100`,
    [name, safeDaysVal]
  );

  const [rawProps] = await pool.query(
    `SELECT props_json
     FROM product_events
     WHERE event_name = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND props_json IS NOT NULL
     LIMIT 500`,
    [name, safeDaysVal]
  );

  const propBreakdown = buildPropBreakdown(rawProps || []);

  return {
    days: safeDaysVal,
    event_name: name,
    summary: summaryRows[0] || {},
    by_day: byDay || [],
    by_page: byPage || [],
    prop_breakdown: propBreakdown,
    recent: (recent || []).map(normalizeEventRow),
  };
}

function buildPropBreakdown(rows) {
  const counts = new Map();

  for (const row of rows) {
    const props = parseJson(row.props_json);
    if (!props || typeof props !== 'object') continue;

    for (const [key, value] of Object.entries(props)) {
      if (['page_path', 'route', 'query'].includes(key)) continue;
      if (value === undefined || value === null || value === '') continue;
      const bucketKey = `${key}=${String(value).slice(0, 80)}`;
      counts.set(bucketKey, (counts.get(bucketKey) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([key, total]) => {
      const [prop, ...rest] = key.split('=');
      return { prop, value: rest.join('='), total };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 25);
}

async function getOnboardingAnalytics({ days = 30 } = {}) {
  const safeDaysVal = safeDays(days);

  const [milestoneRows] = await pool.query(
    `SELECT event_name, COUNT(*) AS total, COUNT(DISTINCT user_id) AS unique_users
     FROM product_events
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND event_name LIKE 'onboarding_%'
     GROUP BY event_name
     ORDER BY total DESC`,
    [safeDaysVal]
  );

  const countsByEvent = new Map((milestoneRows || []).map((row) => [row.event_name, row]));

  const funnel = mapEventCounts(ONBOARDING_MILESTONES, countsByEvent);
  const billingFunnel = mapEventCounts(BILLING_MILESTONES, countsByEvent);
  const billingOutcomes = mapEventCounts(BILLING_OUTCOME_EVENTS, countsByEvent);
  const questionAnswers = mapEventCounts(QUESTION_ANSWER_EVENTS, countsByEvent);

  const [stepViews] = await pool.query(
    `SELECT props_json, user_id, session_id
     FROM product_events
     WHERE event_name = 'onboarding_step_view'
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     LIMIT 2000`,
    [safeDaysVal]
  );

  const stepBreakdown = new Map();
  for (const row of stepViews || []) {
    const props = parseJson(row.props_json) || {};
    const stepKey = String(props.step_key || props.step_index || 'unknown');
    const entry = stepBreakdown.get(stepKey) || { step_key: stepKey, views: 0, users: new Set(), sessions: new Set() };
    entry.views += 1;
    if (row.user_id) entry.users.add(row.user_id);
    if (row.session_id) entry.sessions.add(row.session_id);
    stepBreakdown.set(stepKey, entry);
  }

  const steps = [...stepBreakdown.values()]
    .map((entry) => ({
      step_key: entry.step_key,
      label: QUESTION_LABELS[entry.step_key] || entry.step_key,
      views: entry.views,
      unique_users: entry.users.size,
      unique_sessions: entry.sessions.size,
    }))
    .sort((a, b) => b.views - a.views);

  const [dropoffRows] = await pool.query(
    `SELECT props_json, user_id, session_id, created_at
     FROM product_events
     WHERE event_name IN ('onboarding_dropoff', 'onboarding_billing_dropoff')
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     ORDER BY created_at DESC
     LIMIT 2000`,
    [safeDaysVal]
  );

  const [planRows] = await pool.query(
    `SELECT props_json, user_id
     FROM product_events
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND event_name IN (
         'onboarding_billing_plan_selected',
         'onboarding_billing_checkout_started',
         'onboarding_billing_payment_success'
       )
     LIMIT 2000`,
    [safeDaysVal]
  );

  const planBreakdown = new Map();
  for (const row of planRows || []) {
    const props = parseJson(row.props_json) || {};
    const planKey = String(props.plan_key || props.checkout_plan || 'unknown');
    const entry = planBreakdown.get(planKey) || { plan_key: planKey, total: 0, users: new Set() };
    entry.total += 1;
    if (row.user_id) entry.users.add(row.user_id);
    planBreakdown.set(planKey, entry);
  }

  const plans = [...planBreakdown.values()]
    .map((entry) => ({
      plan_key: entry.plan_key,
      total: entry.total,
      unique_users: entry.users.size,
    }))
    .sort((a, b) => b.total - a.total);

  const milestoneEventNames = [
    ...ONBOARDING_MILESTONES.map((step) => step.key),
    ...BILLING_MILESTONES.map((step) => step.key),
    'onboarding_q_role_answered',
    'onboarding_q_website_answered',
    'onboarding_website_extracted',
    'onboarding_billing_checkout_canceled',
    'onboarding_billing_checkout_failed',
  ];

  // Only milestone events — avoid ASC LIMIT 8000 cutting off newer checkout/billing rows.
  const [roleEventRows] = await pool.query(
    `SELECT event_name, user_id, session_id, props_json, created_at
     FROM product_events
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND event_name IN (?)
     ORDER BY created_at ASC`,
    [safeDaysVal, milestoneEventNames]
  );

  const knownRoleByUser = new Map();
  const userProgress = new Map();
  const sessionToUser = new Map();
  for (const row of roleEventRows || []) {
    const props = parseJson(row.props_json) || {};
    const role = String(props.audience_role || props.audienceRole || '').trim();
    if (role && row.user_id) knownRoleByUser.set(row.user_id, role);
    if (row.session_id && row.user_id) sessionToUser.set(row.session_id, row.user_id);

    if (!row.user_id) continue;
    const entry = userProgress.get(row.user_id) || {
      role: 'unknown',
      events: new Set(),
      lastAt: null,
    };
    entry.events.add(row.event_name);
    if (role) entry.role = role;
    else if (knownRoleByUser.has(row.user_id)) entry.role = knownRoleByUser.get(row.user_id);
    if (!entry.lastAt || new Date(row.created_at) > new Date(entry.lastAt)) {
      entry.lastAt = row.created_at;
    }
    userProgress.set(row.user_id, entry);
  }

  function resolveRole(row) {
    const props = parseJson(row.props_json) || {};
    const fromProps = String(props.audience_role || props.audienceRole || '').trim();
    if (fromProps) return fromProps;
    if (row.user_id && knownRoleByUser.has(row.user_id)) return knownRoleByUser.get(row.user_id);
    return 'unknown';
  }

  function roleLabel(roleKey) {
    return ROLE_FLOW_DEFS.find((item) => item.key === roleKey)?.label || roleKey || 'No role yet';
  }

  function buildMilestoneDropoffs(milestones) {
    const result = [];
    for (let i = 0; i < milestones.length - 1; i += 1) {
      const from = milestones[i];
      const laterKeys = milestones.slice(i + 1).map((step) => step.key);
      const droppedUsers = [];
      for (const [userId, prog] of userProgress.entries()) {
        if (!prog.events.has(from.key)) continue;
        const reachedLater = laterKeys.some((key) => prog.events.has(key));
        if (reachedLater) continue;
        droppedUsers.push({
          user_id: userId,
          role: prog.role || 'unknown',
          role_label: roleLabel(prog.role || 'unknown'),
          last_at: prog.lastAt,
        });
      }
      droppedUsers.sort((a, b) => String(b.last_at || '').localeCompare(String(a.last_at || '')));
      result.push({
        from_key: from.key,
        from_label: from.label,
        to_key: milestones[i + 1].key,
        to_label: milestones[i + 1].label,
        unique_users: droppedUsers.length,
        users: droppedUsers.slice(0, 50),
      });
    }
    return result;
  }

  const setupDropoffs = buildMilestoneDropoffs(ONBOARDING_MILESTONES);
  const billingDropoffs = buildMilestoneDropoffs(BILLING_MILESTONES);

  const [sessionRows] = await pool.query(
    `SELECT session_id, user_id
     FROM product_events
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND event_name LIKE 'onboarding_%'
       AND session_id IS NOT NULL AND TRIM(session_id) <> ''
       AND user_id IS NOT NULL AND TRIM(user_id) <> ''
     LIMIT 8000`,
    [safeDaysVal]
  );
  for (const row of sessionRows || []) {
    if (row.session_id && row.user_id) sessionToUser.set(row.session_id, row.user_id);
  }

  const dropoffBreakdown = new Map();
  for (const row of dropoffRows || []) {
    const props = parseJson(row.props_json) || {};
    const stepKey = String(props.step_key || props.question_label || 'unknown');
    const resolvedUserId = row.user_id || (row.session_id ? sessionToUser.get(row.session_id) : null) || null;
    let role = String(props.audience_role || props.audienceRole || '').trim();
    if (!role && resolvedUserId && knownRoleByUser.has(resolvedUserId)) {
      role = knownRoleByUser.get(resolvedUserId);
    }
    if (!role && resolvedUserId && userProgress.has(resolvedUserId)) {
      role = userProgress.get(resolvedUserId).role || '';
    }
    if (!role) role = 'unknown';
    const bucket = `${role}::${stepKey}`;
    const entry = dropoffBreakdown.get(bucket) || {
      step_key: stepKey,
      role,
      total: 0,
      users: new Map(),
    };
    entry.total += 1;
    if (resolvedUserId) {
      const existing = entry.users.get(resolvedUserId) || {
        user_id: resolvedUserId,
        role,
        role_label: roleLabel(role),
        last_at: row.created_at,
        leaves: 0,
      };
      existing.leaves += 1;
      if (!existing.last_at || new Date(row.created_at) > new Date(existing.last_at)) {
        existing.last_at = row.created_at;
      }
      entry.users.set(resolvedUserId, existing);
    }
    dropoffBreakdown.set(bucket, entry);
  }

  let dropoffs = [...dropoffBreakdown.values()]
    .map((entry) => ({
      step_key: entry.step_key,
      label: QUESTION_LABELS[entry.step_key] || entry.step_key,
      role: entry.role,
      role_label: roleLabel(entry.role),
      total: entry.total,
      unique_users: entry.users.size,
      users: [...entry.users.values()]
        .sort((a, b) => String(b.last_at || '').localeCompare(String(a.last_at || '')))
        .slice(0, 50),
    }))
    .sort((a, b) => b.total - a.total);

  const dropUserIds = new Set();
  for (const row of setupDropoffs) {
    for (const user of row.users || []) dropUserIds.add(user.user_id);
  }
  for (const row of billingDropoffs) {
    for (const user of row.users || []) dropUserIds.add(user.user_id);
  }
  for (const row of dropoffs) {
    for (const user of row.users || []) dropUserIds.add(user.user_id);
  }

  const userMetaById = new Map();
  if (dropUserIds.size) {
    const [userRows] = await pool.query(
      `SELECT id, email, username FROM users WHERE id IN (?)`,
      [[...dropUserIds]]
    );
    for (const row of userRows || []) {
      userMetaById.set(row.id, {
        email: row.email || null,
        username: row.username || null,
      });
    }
  }

  function attachUserMeta(users = []) {
    return users.map((user) => {
      const meta = userMetaById.get(user.user_id) || {};
      return {
        ...user,
        email: meta.email || null,
        username: meta.username || null,
        display_name: meta.email || meta.username || user.user_id,
      };
    });
  }

  for (const row of setupDropoffs) row.users = attachUserMeta(row.users);
  for (const row of billingDropoffs) row.users = attachUserMeta(row.users);
  dropoffs = dropoffs.map((row) => ({ ...row, users: attachUserMeta(row.users) }));

  function withStepDropoffs(steps, dropoffRows) {
    const byKey = new Map((dropoffRows || []).map((row) => [row.from_key, row]));
    return (steps || []).map((step) => {
      const drop = byKey.get(step.key);
      const users = drop?.users || [];
      return {
        ...step,
        dropoff_users: users,
        dropoff_count: users.length,
      };
    });
  }

  const funnelWithDropoffs = withStepDropoffs(funnel, setupDropoffs);
  const billingFunnelWithDropoffs = withStepDropoffs(billingFunnel, billingDropoffs);

  const countsByRoleEvent = new Map();
  for (const row of roleEventRows || []) {
    const role = resolveRole(row);
    const key = `${role}::${row.event_name}`;
    const entry = countsByRoleEvent.get(key) || { total: 0, users: new Set() };
    entry.total += 1;
    if (row.user_id) entry.users.add(row.user_id);
    countsByRoleEvent.set(key, entry);
  }

  function roleEventStats(role, eventName) {
    const entry = countsByRoleEvent.get(`${role}::${eventName}`) || { total: 0, users: new Set() };
    return { total: entry.total, unique_users: entry.users.size };
  }

  const roleFunnels = ROLE_FLOW_DEFS.map((role) => {
    const steps = ONBOARDING_MILESTONES.map((step) => {
      const stats = roleEventStats(role.key, step.key);
      return {
        key: step.key,
        label: step.label,
        total: stats.total,
        unique_users: stats.unique_users,
      };
    });
    const billing = BILLING_MILESTONES.map((step) => {
      const stats = roleEventStats(role.key, step.key);
      return {
        key: step.key,
        label: step.label,
        total: stats.total,
        unique_users: stats.unique_users,
      };
    });
    const started = roleEventStats(role.key, 'onboarding_q_role_answered').unique_users
      || roleEventStats(role.key, 'onboarding_started').unique_users;
    const completed = roleEventStats(role.key, 'onboarding_completed').unique_users;
    const paid = roleEventStats(role.key, 'onboarding_billing_payment_success').unique_users;
    return {
      role: role.key,
      label: role.label,
      started,
      completed,
      paid,
      completion_rate: started > 0 ? Math.round((completed / started) * 1000) / 10 : 0,
      funnel: steps,
      billing_funnel: billing,
    };
  }).filter((row) => row.started || row.completed || row.paid);

  const roleBreakdown = ROLE_FLOW_DEFS.map((role) => {
    const started = roleEventStats(role.key, 'onboarding_q_role_answered').unique_users
      || roleEventStats(role.key, 'onboarding_started').unique_users;
    const completed = roleEventStats(role.key, 'onboarding_completed').unique_users;
    const unlockViewedRole = roleEventStats(role.key, 'onboarding_unlock_viewed').unique_users;
    const paidRole = roleEventStats(role.key, 'onboarding_billing_payment_success').unique_users;
    return {
      role: role.key,
      label: role.label,
      started,
      completed,
      unlock_viewed: unlockViewedRole,
      paid: paidRole,
    };
  }).filter((row) => row.started || row.completed || row.unlock_viewed || row.paid || row.role !== 'unknown');

  const [recent] = await pool.query(
    `SELECT id, user_id, event_name, page_path, props_json, created_at
     FROM product_events
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND event_name LIKE 'onboarding_%'
     ORDER BY created_at DESC
     LIMIT 50`,
    [safeDaysVal]
  );

  const started = Number(countsByEvent.get('onboarding_started')?.unique_users || 0);
  const completed = Number(countsByEvent.get('onboarding_completed')?.unique_users || 0);
  const completionRate = started > 0 ? Math.round((completed / started) * 1000) / 10 : 0;
  const unlockViewed = Number(countsByEvent.get('onboarding_unlock_viewed')?.unique_users || 0);
  const paid = Number(countsByEvent.get('onboarding_billing_payment_success')?.unique_users || 0);
  const billingConversionRate = unlockViewed > 0 ? Math.round((paid / unlockViewed) * 1000) / 10 : 0;

  return {
    days: safeDaysVal,
    funnel: funnelWithDropoffs,
    billing_funnel: billingFunnelWithDropoffs,
    billing_outcomes: billingOutcomes,
    plan_breakdown: plans,
    role_breakdown: roleBreakdown,
    role_funnels: roleFunnels,
    question_answers: questionAnswers,
    step_breakdown: steps,
    dropoffs: dropoffs.filter((row) => row.unique_users > 0),
    setup_dropoffs: setupDropoffs,
    billing_dropoffs: billingDropoffs,
    completion_rate: completionRate,
    billing_conversion_rate: billingConversionRate,
    recent: (recent || []).map(normalizeEventRow),
  };
}

async function getSignInAnalytics({ days = 30 } = {}) {
  const safeDaysVal = safeDays(days);

  const [loginEvents] = await pool.query(
    `SELECT
       COUNT(*) AS total,
       COUNT(DISTINCT user_id) AS unique_users,
       COUNT(DISTINCT session_id) AS unique_sessions
     FROM product_events
     WHERE event_name IN ('user_signed_in', 'session_started')
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [safeDaysVal]
  );

  const [loginByDay] = await pool.query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS total, COUNT(DISTINCT user_id) AS unique_users
     FROM product_events
     WHERE event_name = 'user_signed_in'
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)
     ORDER BY day ASC`,
    [safeDaysVal]
  );

  const [recentLogins] = await pool.query(
    `SELECT id, user_id, session_id, props_json, created_at
     FROM product_events
     WHERE event_name = 'user_signed_in'
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     ORDER BY created_at DESC
     LIMIT 50`,
    [safeDaysVal]
  );

  const [activeUsers] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM users
     WHERE last_login_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [safeDaysVal]
  );

  const [recentDbLogins] = await pool.query(
    `SELECT id, email, username, last_login_at, login_count, created_at
     FROM users
     WHERE last_login_at IS NOT NULL
     ORDER BY last_login_at DESC
     LIMIT 30`
  );

  return {
    days: safeDaysVal,
    client_events: loginEvents[0] || {},
    by_day: loginByDay || [],
    recent_client_logins: (recentLogins || []).map(normalizeEventRow),
    active_users_server: Number(activeUsers[0]?.total || 0),
    recent_server_logins: recentDbLogins || [],
  };
}

module.exports = {
  listAllEvents,
  getEventDetail,
  getOnboardingAnalytics,
  getSignInAnalytics,
};
