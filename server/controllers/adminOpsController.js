const {
  getProductEventSummary,
  listApiIncidents,
  getIncidentById,
  getIncidentsSummary,
} = require('../utils/observabilityStore');
const { listAdminUsersFromClerk } = require('../utils/clerkUsers');
const {
  listAdminOnboardingProfiles,
  getAdminOnboardingProfileByUserId,
} = require('../utils/adminOnboarding');
const {
  listAllEvents,
  getEventDetail,
  getOnboardingAnalytics,
  getSignInAnalytics,
} = require('../utils/analyticsAdmin');
const { runGa4EventReport, runGa4FunnelReport } = require('../utils/ga4Analytics');

async function getAdminUsers(req, res) {
  try {
    const limit = req.query?.limit;
    const offset = req.query?.offset;
    const data = await listAdminUsersFromClerk({ limit, offset });
    return res.json(data);
  } catch (error) {
    console.error('getAdminUsers error:', error);
    const message = error?.errors?.[0]?.message || error?.message || '';
    if (/secret key|unauthorized|authentication/i.test(message)) {
      return res.status(500).json({ error: 'Clerk API auth failed — check CLERK_SECRET_KEY in server .env' });
    }
    return res.status(500).json({ error: 'Failed to load users from Clerk' });
  }
}

async function getAdminAnalytics(req, res) {
  try {
    const days = req.query?.days;
    const summary = await getProductEventSummary({ days });
    return res.json(summary);
  } catch (error) {
    console.error('getAdminAnalytics error:', error);
    return res.status(500).json({ error: 'Failed to load analytics' });
  }
}

async function getAdminAnalyticsEvents(req, res) {
  try {
    const data = await listAllEvents({ days: req.query?.days });
    return res.json(data);
  } catch (error) {
    console.error('getAdminAnalyticsEvents error:', error);
    return res.status(500).json({ error: 'Failed to load events' });
  }
}

async function getAdminAnalyticsEventDetail(req, res) {
  try {
    const eventName = decodeURIComponent(req.params.eventName || '');
    const data = await getEventDetail({ eventName, days: req.query?.days });
    if (!data) return res.status(400).json({ error: 'event name is required' });
    return res.json(data);
  } catch (error) {
    console.error('getAdminAnalyticsEventDetail error:', error);
    return res.status(500).json({ error: 'Failed to load event detail' });
  }
}

async function getAdminAnalyticsOnboarding(req, res) {
  try {
    const data = await getOnboardingAnalytics({ days: req.query?.days });
    return res.json(data);
  } catch (error) {
    console.error('getAdminAnalyticsOnboarding error:', error);
    return res.status(500).json({ error: 'Failed to load onboarding analytics' });
  }
}

async function getAdminAnalyticsSignIn(req, res) {
  try {
    const data = await getSignInAnalytics({ days: req.query?.days });
    return res.json(data);
  } catch (error) {
    console.error('getAdminAnalyticsSignIn error:', error);
    return res.status(500).json({ error: 'Failed to load sign-in analytics' });
  }
}

async function getAdminAnalyticsFunnels(req, res) {
  try {
    const days = req.query?.days;
    const openFunnel = String(req.query?.openFunnel || '').toLowerCase() === 'true';
    const [ga4Funnel, ga4Events, localOnboarding] = await Promise.all([
      runGa4FunnelReport({ days, openFunnel }).catch((err) => ({
        configured: false,
        reason: 'api_error',
        message: err?.message || 'GA4 funnel request failed',
      })),
      runGa4EventReport({ days }).catch(() => ({ configured: false, reason: 'api_error' })),
      getOnboardingAnalytics({ days: days || 30 }),
    ]);

    return res.json({
      ga4_funnel: ga4Funnel,
      ga4_events: ga4Events,
      local_onboarding_funnel: localOnboarding.funnel,
      local_completion_rate: localOnboarding.completion_rate,
    });
  } catch (error) {
    console.error('getAdminAnalyticsFunnels error:', error);
    return res.status(500).json({ error: 'Failed to load funnel analytics' });
  }
}

async function getAdminIncidents(req, res) {
  try {
    const incidents = await listApiIncidents({
      limit: req.query?.limit,
      severity: req.query?.severity,
      source: req.query?.source,
    });
    return res.json({ incidents });
  } catch (error) {
    console.error('getAdminIncidents error:', error);
    return res.status(500).json({ error: 'Failed to load incidents' });
  }
}

async function getAdminIncidentsSummary(req, res) {
  try {
    const summary = await getIncidentsSummary({
      hours: req.query?.hours,
      sinceId: req.query?.sinceId,
    });
    return res.json(summary);
  } catch (error) {
    console.error('getAdminIncidentsSummary error:', error);
    return res.status(500).json({ error: 'Failed to load incident summary' });
  }
}

async function getAdminIncidentDetail(req, res) {
  try {
    const incident = await getIncidentById(req.params.id);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });
    return res.json({ incident });
  } catch (error) {
    console.error('getAdminIncidentDetail error:', error);
    return res.status(500).json({ error: 'Failed to load incident' });
  }
}

async function getAdminOnboardingProfiles(req, res) {
  try {
    const data = await listAdminOnboardingProfiles({
      limit: req.query?.limit,
      offset: req.query?.offset,
      search: req.query?.search,
    });
    return res.json(data);
  } catch (error) {
    console.error('getAdminOnboardingProfiles error:', error);
    return res.status(500).json({ error: 'Failed to load onboarding profiles' });
  }
}

async function getAdminOnboardingProfileDetail(req, res) {
  try {
    const profile = await getAdminOnboardingProfileByUserId(req.params.userId);
    if (!profile) return res.status(404).json({ error: 'Onboarding profile not found' });
    return res.json({ profile });
  } catch (error) {
    console.error('getAdminOnboardingProfileDetail error:', error);
    return res.status(500).json({ error: 'Failed to load onboarding profile' });
  }
}

module.exports = {
  getAdminUsers,
  getAdminAnalytics,
  getAdminAnalyticsEvents,
  getAdminAnalyticsEventDetail,
  getAdminAnalyticsOnboarding,
  getAdminAnalyticsSignIn,
  getAdminAnalyticsFunnels,
  getAdminIncidents,
  getAdminIncidentsSummary,
  getAdminIncidentDetail,
  getAdminOnboardingProfiles,
  getAdminOnboardingProfileDetail,
};
