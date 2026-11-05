const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requirePaidSubscription, requireFeature } = require('../middleware/requireSubscription');
const { FEATURES } = require('../utils/entitlements');
const {
  getWeeklyRecommendations,
  generateCreativeTestPlanner,
  generateMonthlySocialCalendar,
  runCompetitorRadar,
  getCompetitorChangeAlerts,
  getWinningPatterns,
  generateCreativeBrief,
  getAudiencePersonaLens,
  getPerformanceBenchmarks,
  getLandingAdMatchScore,
  runCompetitorFunnelSpy,
  runCompetitorsExtractor,
  getSavedPlans,
  createSavedPlan,
  updateSavedPlan,
  deleteSavedPlan,
  getWatchlist,
  createWatchlistItem,
  updateWatchlistItem,
  deleteWatchlistItem,
} = require('../controllers/strategyController');

const router = express.Router();

router.get('/weekly-recommendations', clerkAuth, hydrateSubscription, requirePaidSubscription, getWeeklyRecommendations);
router.post('/test-planner', clerkAuth, hydrateSubscription, requireFeature(FEATURES.CREATIVE_TEST_PLANNER), generateCreativeTestPlanner);
router.post('/monthly-social-calendar', clerkAuth, hydrateSubscription, requirePaidSubscription, generateMonthlySocialCalendar);
router.post('/competitor-radar', clerkAuth, hydrateSubscription, requireFeature(FEATURES.COMPETITOR_RADAR), runCompetitorRadar);
router.get('/competitor-alerts', clerkAuth, hydrateSubscription, requireFeature(FEATURES.COMPETITOR_RADAR), getCompetitorChangeAlerts);
router.get('/winning-patterns', clerkAuth, hydrateSubscription, requireFeature(FEATURES.COMPETITOR_RADAR), getWinningPatterns);
router.post('/creative-brief', clerkAuth, hydrateSubscription, requireFeature(FEATURES.COMPETITOR_RADAR), generateCreativeBrief);
router.get('/persona-lens', clerkAuth, hydrateSubscription, requireFeature(FEATURES.COMPETITOR_RADAR), getAudiencePersonaLens);
router.get('/benchmarks', clerkAuth, hydrateSubscription, requireFeature(FEATURES.COMPETITOR_RADAR), getPerformanceBenchmarks);
router.post('/landing-ad-match', clerkAuth, hydrateSubscription, requireFeature(FEATURES.COMPETITOR_RADAR), getLandingAdMatchScore);
router.post('/funnel-spy', clerkAuth, hydrateSubscription, requireFeature(FEATURES.WEBSITE_RESEARCH), runCompetitorFunnelSpy);
router.post('/competitors-extractor', clerkAuth, hydrateSubscription, requireFeature(FEATURES.WEBSITE_RESEARCH), runCompetitorsExtractor);
router.get('/saved-plans', clerkAuth, hydrateSubscription, requirePaidSubscription, getSavedPlans);
router.post('/saved-plans', clerkAuth, hydrateSubscription, requirePaidSubscription, createSavedPlan);
router.patch('/saved-plans/:id', clerkAuth, hydrateSubscription, requirePaidSubscription, updateSavedPlan);
router.delete('/saved-plans/:id', clerkAuth, hydrateSubscription, requirePaidSubscription, deleteSavedPlan);
router.get('/watchlist', clerkAuth, hydrateSubscription, requireFeature(FEATURES.COMPETITOR_WATCHLIST), getWatchlist);
router.post('/watchlist', clerkAuth, hydrateSubscription, requireFeature(FEATURES.COMPETITOR_WATCHLIST), createWatchlistItem);
router.patch('/watchlist/:id', clerkAuth, hydrateSubscription, requireFeature(FEATURES.COMPETITOR_WATCHLIST), updateWatchlistItem);
router.delete('/watchlist/:id', clerkAuth, hydrateSubscription, requireFeature(FEATURES.COMPETITOR_WATCHLIST), deleteWatchlistItem);

module.exports = router;
