const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requirePaidSubscription, requireProSubscription } = require('../middleware/requireSubscription');
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
router.post('/test-planner', clerkAuth, hydrateSubscription, requireProSubscription, generateCreativeTestPlanner);
router.post('/monthly-social-calendar', clerkAuth, hydrateSubscription, requirePaidSubscription, generateMonthlySocialCalendar);
router.post('/competitor-radar', clerkAuth, hydrateSubscription, requireProSubscription, runCompetitorRadar);
router.get('/competitor-alerts', clerkAuth, hydrateSubscription, requireProSubscription, getCompetitorChangeAlerts);
router.get('/winning-patterns', clerkAuth, hydrateSubscription, requireProSubscription, getWinningPatterns);
router.post('/creative-brief', clerkAuth, hydrateSubscription, requireProSubscription, generateCreativeBrief);
router.get('/persona-lens', clerkAuth, hydrateSubscription, requireProSubscription, getAudiencePersonaLens);
router.get('/benchmarks', clerkAuth, hydrateSubscription, requireProSubscription, getPerformanceBenchmarks);
router.post('/landing-ad-match', clerkAuth, hydrateSubscription, requireProSubscription, getLandingAdMatchScore);
router.get('/saved-plans', clerkAuth, hydrateSubscription, requirePaidSubscription, getSavedPlans);
router.post('/saved-plans', clerkAuth, hydrateSubscription, requirePaidSubscription, createSavedPlan);
router.patch('/saved-plans/:id', clerkAuth, hydrateSubscription, requirePaidSubscription, updateSavedPlan);
router.delete('/saved-plans/:id', clerkAuth, hydrateSubscription, requirePaidSubscription, deleteSavedPlan);
router.get('/watchlist', clerkAuth, hydrateSubscription, requireProSubscription, getWatchlist);
router.post('/watchlist', clerkAuth, hydrateSubscription, requireProSubscription, createWatchlistItem);
router.patch('/watchlist/:id', clerkAuth, hydrateSubscription, requireProSubscription, updateWatchlistItem);
router.delete('/watchlist/:id', clerkAuth, hydrateSubscription, requireProSubscription, deleteWatchlistItem);

module.exports = router;
