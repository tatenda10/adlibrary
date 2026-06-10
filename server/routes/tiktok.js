const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requirePaidSubscription } = require('../middleware/requireSubscription');
const { fetchTikTokHotTakes } = require('../controllers/tiktokTrendsController');
const {
  getTrendingMusic,
  refreshTrendingMusic,
} = require('../controllers/tiktokTrendingMusicController');
const {
  getTrendingCreators,
  refreshTrendingCreators,
} = require('../controllers/tiktokTrendingCreatorsController');
const {
  getTopAds,
  refreshTopAds,
  streamTopAdVideo,
  streamTopAdThumbnail,
} = require('../controllers/tiktokTopAdsController');
const {
  listFolders,
  createFolder,
  getFolder,
  deleteFolder,
  addVideoToFolder,
  deleteVideoFromFolder,
} = require('../controllers/tiktokWorkspaceController');
const router = express.Router();

router.get('/trending-music', clerkAuth, hydrateSubscription, getTrendingMusic);
router.post('/trending-music/refresh', clerkAuth, hydrateSubscription, refreshTrendingMusic);

router.get(
  '/trending-creators',
  clerkAuth,
  hydrateSubscription,
  requirePaidSubscription,
  getTrendingCreators
);
router.post(
  '/trending-creators/refresh',
  clerkAuth,
  hydrateSubscription,
  requirePaidSubscription,
  refreshTrendingCreators
);

router.get('/top-ads', clerkAuth, hydrateSubscription, requirePaidSubscription, getTopAds);
router.get('/top-ads/media/:adId', streamTopAdVideo);
router.get('/top-ads/thumbnail/:adId', streamTopAdThumbnail);
router.post('/top-ads/refresh', clerkAuth, hydrateSubscription, requirePaidSubscription, refreshTopAds);

router.post('/hot-takes', clerkAuth, hydrateSubscription, requirePaidSubscription, fetchTikTokHotTakes);

router.get('/workspace/folders', clerkAuth, hydrateSubscription, listFolders);
router.post('/workspace/folders', clerkAuth, hydrateSubscription, createFolder);
router.get(
  '/workspace/folders/:folderId',
  clerkAuth,
  hydrateSubscription,
  getFolder
);
router.delete(
  '/workspace/folders/:folderId',
  clerkAuth,
  hydrateSubscription,
  deleteFolder
);
router.post(
  '/workspace/folders/:folderId/videos',
  clerkAuth,
  hydrateSubscription,
  addVideoToFolder
);
router.delete(
  '/workspace/folders/:folderId/videos/:videoId',
  clerkAuth,
  hydrateSubscription,
  deleteVideoFromFolder
);

module.exports = router;
