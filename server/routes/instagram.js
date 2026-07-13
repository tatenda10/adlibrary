const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requirePaidSubscription, requireProSubscription } = require('../middleware/requireSubscription');
const { searchInstagram, intelligentSearchInstagram, proxyInstagramMedia } = require('../controllers/instagramController');
const { getTrends, refreshTrends } = require('../controllers/instagramTrendsController');
const instagramWorkspace = require('../controllers/instagramWorkspaceController');

const router = express.Router();

router.get('/media-proxy', proxyInstagramMedia);

const {
  listFolders,
  createFolder,
  getFolder,
  deleteFolder,
  addVideoToFolder,
  deleteVideoFromFolder,
} = instagramWorkspace;

router.post('/search', clerkAuth, hydrateSubscription, requirePaidSubscription, searchInstagram);
router.post('/intelligent', clerkAuth, hydrateSubscription, requirePaidSubscription, requireProSubscription, intelligentSearchInstagram);

router.get('/trends', clerkAuth, hydrateSubscription, requirePaidSubscription, getTrends);
router.post('/trends/refresh', clerkAuth, hydrateSubscription, requirePaidSubscription, refreshTrends);

router.get('/workspace/folders', clerkAuth, hydrateSubscription, requirePaidSubscription, listFolders);
router.post('/workspace/folders', clerkAuth, hydrateSubscription, requirePaidSubscription, createFolder);
router.get(
  '/workspace/folders/:folderId',
  clerkAuth,
  hydrateSubscription,
  requirePaidSubscription,
  getFolder
);
router.delete(
  '/workspace/folders/:folderId',
  clerkAuth,
  hydrateSubscription,
  requirePaidSubscription,
  deleteFolder
);
router.post(
  '/workspace/folders/:folderId/videos',
  clerkAuth,
  hydrateSubscription,
  requirePaidSubscription,
  addVideoToFolder
);
router.delete(
  '/workspace/folders/:folderId/videos/:videoId',
  clerkAuth,
  hydrateSubscription,
  requirePaidSubscription,
  deleteVideoFromFolder
);

module.exports = router;
