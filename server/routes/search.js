const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requireProSubscription } = require('../middleware/requireSubscription');
const {
  searchTikTok,
  intelligentSearchTikTok,
  saveRecentTikTokVideos,
  getRecentTikTokVideos,
  streamTikTokVideo,
} = require('../controllers/searchController');

const router = express.Router();

router.post('/', clerkAuth, hydrateSubscription, searchTikTok);
router.post('/intelligent', clerkAuth, hydrateSubscription, requireProSubscription, intelligentSearchTikTok);
router.get('/recent', clerkAuth, getRecentTikTokVideos);
router.post('/recent', clerkAuth, saveRecentTikTokVideos);
router.get('/stream', streamTikTokVideo);

module.exports = router;
