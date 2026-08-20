const ONBOARDING_FUNNEL_STEPS = [
  { name: 'Landing viewed', event: 'landing_viewed' },
  { name: 'Signed in', event: 'user_signed_in' },
  { name: 'Onboarding started', event: 'onboarding_started' },
  { name: 'Your role', event: 'onboarding_q_role_answered' },
  { name: 'Website URL', event: 'onboarding_q_website_viewed' },
  { name: 'Brand name', event: 'onboarding_q_brand_name_answered' },
  { name: 'Industry', event: 'onboarding_q_industry_answered' },
  { name: 'Niche', event: 'onboarding_q_niche_answered' },
  { name: 'Countries', event: 'onboarding_q_countries_answered' },
  { name: 'Channels', event: 'onboarding_q_channels_answered' },
  { name: 'Brand story', event: 'onboarding_q_story_answered' },
  { name: 'Ideal customer', event: 'onboarding_q_ideal_customer_answered' },
  { name: 'Onboarding completed', event: 'onboarding_completed' },
];

const BILLING_FUNNEL_STEPS = [
  { name: 'Unlock viewed', event: 'onboarding_unlock_viewed' },
  { name: 'Unlock clicked', event: 'onboarding_unlock_clicked' },
  { name: 'Billing viewed', event: 'onboarding_billing_viewed' },
  { name: 'Plan selected', event: 'onboarding_billing_plan_selected' },
  { name: 'Checkout started', event: 'onboarding_billing_checkout_started' },
  { name: 'Paid successfully', event: 'onboarding_billing_payment_success' },
];

function getPropertyId() {
  const raw = String(process.env.GA4_PROPERTY_ID || process.env.GOOGLE_ANALYTICS_PROPERTY_ID || '').trim();
  return raw.replace(/^properties\//, '');
}

function hasGa4Credentials() {
  if (!getPropertyId()) return false;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return true;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return true;
  return false;
}

function eventStepFilter(eventName) {
  return {
    filterExpression: {
      funnelEventFilter: {
        eventName,
      },
    },
  };
}

function cleanStepName(raw, fallback = '') {
  const value = String(raw || '').replace(/^\d+\.\s*/, '').trim();
  return value || fallback;
}

function parseFunnelRow(row, index) {
  const metrics = row.metricValues || [];
  return {
    step_index: index + 1,
    name: cleanStepName(row.dimensionValues?.[0]?.value, ONBOARDING_FUNNEL_STEPS[index]?.name || `Step ${index + 1}`),
    active_users: Number(metrics[0]?.value || 0),
    step_completion_rate: Number(metrics[1]?.value || 0),
    abandonments: Number(metrics[2]?.value || 0),
    abandonment_rate: Number(metrics[3]?.value || 0),
  };
}

function mergeFunnelSteps(apiSteps) {
  const byName = new Map(apiSteps.map((step) => [step.name.toLowerCase(), step]));

  return ONBOARDING_FUNNEL_STEPS.map((def, index) => {
    const fromApi =
      byName.get(def.name.toLowerCase()) ||
      apiSteps.find((step) => step.step_index === index + 1) ||
      apiSteps[index];

    if (fromApi) {
      return {
        ...fromApi,
        name: def.name,
        event: def.event,
      };
    }

    return {
      step_index: index + 1,
      name: def.name,
      event: def.event,
      active_users: 0,
      step_completion_rate: 0,
      abandonments: 0,
      abandonment_rate: 0,
    };
  });
}

function buildFunnelSummary(steps) {
  const entered = Number(steps[0]?.active_users || 0);
  const completed = Number(steps[steps.length - 1]?.active_users || 0);
  const overallConversion = entered > 0 ? completed / entered : 0;

  return {
    entered,
    completed,
    overall_conversion: overallConversion,
    step_count: steps.length,
  };
}

async function getGa4Client() {
  const { BetaAnalyticsDataClient } = require('@google-analytics/data');

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    return new BetaAnalyticsDataClient({ credentials });
  }

  return new BetaAnalyticsDataClient();
}

async function runGa4EventReport({ days = 30 } = {}) {
  if (!hasGa4Credentials()) {
    return { configured: false, reason: 'missing_credentials' };
  }

  const client = await getGa4Client();
  const propertyId = getPropertyId();
  const startDate = `${Math.min(Math.max(Number(days) || 30, 1), 90)}daysAgo`;

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate: 'today' }],
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }, { name: 'activeUsers' }],
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 50,
  });

  const events = (response.rows || []).map((row) => ({
    event_name: row.dimensionValues?.[0]?.value || '',
    event_count: Number(row.metricValues?.[0]?.value || 0),
    active_users: Number(row.metricValues?.[1]?.value || 0),
  }));

  return { configured: true, source: 'ga4', days: Number(days) || 30, events };
}

async function getGa4AccessToken() {
  const { GoogleAuth } = require('google-auth-library');
  const authOptions = {
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  };

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    authOptions.credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }

  const auth = new GoogleAuth(authOptions);
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
  if (!token) throw new Error('Failed to obtain GA4 access token');
  return token;
}

async function runGa4FunnelReport({ days = 30, openFunnel = false } = {}) {
  if (!hasGa4Credentials()) {
    return {
      configured: false,
      reason: 'missing_credentials',
      setup: {
        required_env: ['GA4_PROPERTY_ID', 'GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON'],
        docs: 'https://developers.google.com/analytics/devguides/reporting/data/v1/funnels',
        note: 'Link Firebase to GA4, create a service account with Analytics Viewer, and add GA4_PROPERTY_ID (numeric ID from GA Admin → Property settings).',
      },
      local_fallback: true,
    };
  }

  const propertyId = getPropertyId();
  const safeDays = Math.min(Math.max(Number(days) || 30, 1), 90);
  const startDate = `${safeDays}daysAgo`;
  const token = await getGa4AccessToken();

  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1alpha/properties/${propertyId}:runFunnelReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate: 'today' }],
        funnel: {
          isOpenFunnel: Boolean(openFunnel),
          steps: ONBOARDING_FUNNEL_STEPS.map((step) => ({
            name: step.name,
            ...eventStepFilter(step.event),
          })),
        },
        funnelVisualizationType: 'STANDARD_FUNNEL',
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GA4 funnel request failed (${response.status}): ${detail.slice(0, 400)}`);
  }

  const payload = await response.json();
  const rows = payload.funnelTable?.rows || [];
  const apiSteps = rows.map((row, index) => parseFunnelRow(row, index));
  const steps = mergeFunnelSteps(apiSteps);

  const eventReport = await runGa4EventReport({ days: safeDays });
  const openUsersByEvent = new Map(
    (eventReport.events || []).map((row) => [row.event_name, row.active_users])
  );

  const stepsWithOpen = steps.map((step) => ({
    ...step,
    open_funnel_users: Number(openUsersByEvent.get(step.event) || 0),
    pct_of_first: steps[0]?.active_users
      ? Number(step.active_users || 0) / Number(steps[0].active_users)
      : 0,
  }));

  return {
    configured: true,
    source: 'ga4_funnel',
    days: safeDays,
    is_open_funnel: Boolean(openFunnel),
    funnel_name: 'Signup → onboarding → billing',
    steps: stepsWithOpen,
    summary: buildFunnelSummary(stepsWithOpen),
  };
}

module.exports = {
  ONBOARDING_FUNNEL_STEPS,
  BILLING_FUNNEL_STEPS,
  hasGa4Credentials,
  runGa4EventReport,
  runGa4FunnelReport,
  mergeFunnelSteps,
  buildFunnelSummary,
};
