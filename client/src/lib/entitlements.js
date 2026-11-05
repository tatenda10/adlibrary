/** Keep in sync with server/utils/entitlementsCatalog.js FEATURES */
export const FEATURES = {
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

export const FEATURE_UPGRADE_COPY = {
  [FEATURES.WEBSITE_RESEARCH]: {
    title: 'Unlock Website Research',
    description: 'CRO audits, Funnel Spy, and Angle Map are available on plans that include Website Research.',
  },
  [FEATURES.INTELLIGENT_SEARCH]: {
    title: 'Unlock Intelligent Search',
    description: 'AI-assisted search is available on Pro and Agency.',
  },
  [FEATURES.TIKTOK_HOOKS]: {
    title: 'Unlock TikTok Hooks',
    description: 'Hook generation and related tools require a higher plan.',
  },
  [FEATURES.TIKTOK_PREDICTOR]: {
    title: 'Unlock Virality Predictor',
    description: 'Virality prediction is available on Pro and Agency.',
  },
  [FEATURES.COMPETITOR_RADAR]: {
    title: 'Unlock Competitor Radar',
    description: 'Competitor analysis tools are available on Pro and Agency.',
  },
  [FEATURES.COMPETITOR_WATCHLIST]: {
    title: 'Unlock Competitor Watchlist',
    description: 'Watchlist alerts are available on Pro and Agency.',
  },
  [FEATURES.CREATIVE_TEST_PLANNER]: {
    title: 'Unlock Creative Test Planner',
    description: 'Advanced testing matrices are available on Pro and Agency.',
  },
  [FEATURES.AI_ANALYSIS]: {
    title: 'Unlock AI Analysis',
    description: 'AI analysis jobs require a plan that includes this feature.',
  },
};
