const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const {
  adminLogin,
  createAdminArticle,
  deleteAdminArticle,
  getAdminArticles,
  updateAdminArticle,
} = require('../controllers/articlesController');
const {
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
} = require('../controllers/adminOpsController');

const router = express.Router();

router.post('/login', adminLogin);
router.get('/users', adminAuth, getAdminUsers);
router.get('/analytics', adminAuth, getAdminAnalytics);
router.get('/analytics/events', adminAuth, getAdminAnalyticsEvents);
router.get('/analytics/events/:eventName', adminAuth, getAdminAnalyticsEventDetail);
router.get('/analytics/onboarding', adminAuth, getAdminAnalyticsOnboarding);
router.get('/analytics/signin', adminAuth, getAdminAnalyticsSignIn);
router.get('/analytics/funnels', adminAuth, getAdminAnalyticsFunnels);
router.get('/onboarding', adminAuth, getAdminOnboardingProfiles);
router.get('/onboarding/:userId', adminAuth, getAdminOnboardingProfileDetail);
router.get('/incidents/summary', adminAuth, getAdminIncidentsSummary);
router.get('/incidents/:id', adminAuth, getAdminIncidentDetail);
router.get('/incidents', adminAuth, getAdminIncidents);
router.get('/articles', adminAuth, getAdminArticles);
router.post('/articles', adminAuth, createAdminArticle);
router.put('/articles/:id', adminAuth, updateAdminArticle);
router.delete('/articles/:id', adminAuth, deleteAdminArticle);

module.exports = router;
