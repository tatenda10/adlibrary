const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requirePaidSubscription, requireProSubscription } = require('../middleware/requireSubscription');
const {
  searchTikTok,
  intelligentSearchTikTok,
  saveRecentTikTokVideos,
  getRecentTikTokVideos,
  streamTikTokVideo,
} = require('../controllers/searchController');

const router = express.Router();

router.post('/', clerkAuth, hydrateSubscription, requirePaidSubscription, searchTikTok);
router.post('/intelligent', clerkAuth, hydrateSubscription, requirePaidSubscription, requireProSubscription, intelligentSearchTikTok);
router.get('/recent', clerkAuth, hydrateSubscription, requirePaidSubscription, getRecentTikTokVideos);
router.post('/recent', clerkAuth, hydrateSubscription, requirePaidSubscription, saveRecentTikTokVideos);
router.get('/stream', streamTikTokVideo);

module.exports = router;
