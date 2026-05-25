const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requirePaidSubscription, requireProSubscription } = require('../middleware/requireSubscription');
const { createUsageGuard } = require('../middleware/usageGuard');
const {
  searchTikTok,
  intelligentSearchTikTok,
  saveRecentTikTokVideos,
  getRecentTikTokVideos,
  streamTikTokVideo,
} = require('../controllers/searchController');
const { METRICS } = require('../utils/usage');

const router = express.Router();

router.post('/', clerkAuth, hydrateSubscription, requirePaidSubscription, createUsageGuard(METRICS.TIKTOK_SEARCH, {
  message: 'You have reached your monthly TikTok search limit.',
  upgradePrompt: 'Upgrade your plan or wait for the next billing cycle to continue TikTok research.',
}), searchTikTok);
router.post('/intelligent', clerkAuth, hydrateSubscription, requireProSubscription, createUsageGuard(METRICS.TIKTOK_SEARCH, {
  message: 'You have reached your monthly TikTok search limit.',
  upgradePrompt: 'Upgrade your plan or wait for the next billing cycle to continue TikTok research.',
}), intelligentSearchTikTok);
router.get('/recent', clerkAuth, getRecentTikTokVideos);
router.post('/recent', clerkAuth, saveRecentTikTokVideos);
router.get('/stream', streamTikTokVideo);

module.exports = router;
