/** Stable feature keys used in middleware and client `can(feature)`. */
const FEATURES = {
  APP_ACCESS: 'app_access',
  WEBSITE_RESEARCH: 'website_research',
  INTELLIGENT_SEARCH: 'intelligent_search',
  TIKTOK_HOOKS: 'tiktok_hooks',
  TIKTOK_PREDICTOR: 'tiktok_predictor',
  COMPETITOR_RADAR: 'competitor_radar',
  COMPETITOR_WATCHLIST: 'competitor_watchlist',
  CREATIVE_TEST_PLANNER: 'creative_test_planner',
  AI_ANALYSIS: 'ai_analysis',
};

const FEATURE_DEFINITIONS = [
  { feature_key: FEATURES.APP_ACCESS, label: 'Paid app access', description: 'Access the research workspace with a paid plan.', category: 'access' },
  { feature_key: FEATURES.WEBSITE_RESEARCH, label: 'Website research', description: 'CRO audit, Funnel Spy, and Angle Map.', category: 'product' },
  { feature_key: FEATURES.INTELLIGENT_SEARCH, label: 'Intelligent search', description: 'AI-assisted ad search across platforms.', category: 'product' },
  { feature_key: FEATURES.TIKTOK_HOOKS, label: 'TikTok hooks', description: 'Hook generator and knowledge tools.', category: 'product' },
  { feature_key: FEATURES.TIKTOK_PREDICTOR, label: 'Virality predictor', description: 'TikTok virality prediction workflows.', category: 'product' },
  { feature_key: FEATURES.COMPETITOR_RADAR, label: 'Competitor radar', description: 'Competitor analysis and radar tools.', category: 'product' },
  { feature_key: FEATURES.COMPETITOR_WATCHLIST, label: 'Competitor watchlist', description: 'Active competitor monitoring alerts.', category: 'product' },
  { feature_key: FEATURES.CREATIVE_TEST_PLANNER, label: 'Creative test planner', description: 'Advanced creative testing matrices.', category: 'product' },
  { feature_key: FEATURES.AI_ANALYSIS, label: 'AI analysis', description: 'Run AI creative analysis jobs.', category: 'product' },
];

const METRIC_DEFINITIONS = [
  { metric_key: 'tiktok_searches', label: 'TikTok searches / month' },
  { metric_key: 'tiktok_workspace_videos', label: 'TikTok workspace videos' },
  { metric_key: 'facebook_searches', label: 'Facebook searches / month' },
  { metric_key: 'instagram_searches', label: 'Instagram searches / month' },
  { metric_key: 'ai_analyses', label: 'AI analyses / month' },
  { metric_key: 'cro_audits', label: 'CRO audits / month' },
  { metric_key: 'workspace_folders', label: 'Workspace folders' },
  { metric_key: 'workspace_items', label: 'Workspace items' },
  { metric_key: 'active_watchlist', label: 'Active watchlist items' },
  { metric_key: 'active_collections', label: 'Active collections' },
  { metric_key: 'monthly_credits', label: 'Credits / month' },
];

const PLAN_DEFINITIONS = [
  { plan_key: 'unsubscribed', name: 'Free', monthly_price_cents: 0, sort_order: 0, is_self_serve: 0 },
  { plan_key: 'starter', name: 'Starter', monthly_price_cents: 4900, sort_order: 1, is_self_serve: 1 },
  { plan_key: 'pro', name: 'Pro', monthly_price_cents: 9900, sort_order: 2, is_self_serve: 1 },
  { plan_key: 'agency', name: 'Agency', monthly_price_cents: 29900, sort_order: 3, is_self_serve: 0 },
];

/** Default feature enablement by plan (matches current product gates). */
const DEFAULT_PLAN_FEATURES = {
  unsubscribed: {},
  starter: {
    [FEATURES.APP_ACCESS]: true,
    [FEATURES.WEBSITE_RESEARCH]: true,
    [FEATURES.AI_ANALYSIS]: true,
  },
  pro: {
    [FEATURES.APP_ACCESS]: true,
    [FEATURES.WEBSITE_RESEARCH]: true,
    [FEATURES.INTELLIGENT_SEARCH]: true,
    [FEATURES.TIKTOK_HOOKS]: true,
    [FEATURES.TIKTOK_PREDICTOR]: true,
    [FEATURES.COMPETITOR_RADAR]: true,
    [FEATURES.COMPETITOR_WATCHLIST]: true,
    [FEATURES.CREATIVE_TEST_PLANNER]: true,
    [FEATURES.AI_ANALYSIS]: true,
  },
  agency: {
    [FEATURES.APP_ACCESS]: true,
    [FEATURES.WEBSITE_RESEARCH]: true,
    [FEATURES.INTELLIGENT_SEARCH]: true,
    [FEATURES.TIKTOK_HOOKS]: true,
    [FEATURES.TIKTOK_PREDICTOR]: true,
    [FEATURES.COMPETITOR_RADAR]: true,
    [FEATURES.COMPETITOR_WATCHLIST]: true,
    [FEATURES.CREATIVE_TEST_PLANNER]: true,
    [FEATURES.AI_ANALYSIS]: true,
  },
};

/** Default numeric limits by plan (from usage.js PLAN_LIMITS). */
const DEFAULT_PLAN_LIMITS = {
  unsubscribed: {
    tiktok_searches: 5,
    tiktok_workspace_videos: 2,
    facebook_searches: 5,
    instagram_searches: 5,
    ai_analyses: 1,
    cro_audits: 0,
    workspace_folders: 1,
    workspace_items: 2,
    active_watchlist: 0,
    active_collections: 1,
    monthly_credits: 10,
  },
  starter: {
    tiktok_searches: 15,
    tiktok_workspace_videos: 100,
    facebook_searches: 8,
    instagram_searches: 12,
    ai_analyses: 8,
    cro_audits: 1,
    workspace_folders: 25,
    workspace_items: 200,
    active_watchlist: 0,
    active_collections: 25,
    monthly_credits: 100,
  },
  pro: {
    tiktok_searches: 40,
    tiktok_workspace_videos: 200,
    facebook_searches: 20,
    instagram_searches: 24,
    ai_analyses: 30,
    cro_audits: 4,
    workspace_folders: 100,
    workspace_items: 1000,
    active_watchlist: 10,
    active_collections: 100,
    monthly_credits: 500,
  },
  agency: {
    tiktok_searches: 150,
    tiktok_workspace_videos: 2000,
    facebook_searches: 75,
    instagram_searches: 90,
    ai_analyses: 120,
    cro_audits: 15,
    workspace_folders: 500,
    workspace_items: 5000,
    active_watchlist: 50,
    active_collections: 500,
    monthly_credits: 2500,
  },
};

module.exports = {
  FEATURES,
  FEATURE_DEFINITIONS,
  METRIC_DEFINITIONS,
  PLAN_DEFINITIONS,
  DEFAULT_PLAN_FEATURES,
  DEFAULT_PLAN_LIMITS,
};
