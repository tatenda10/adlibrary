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

router.post('/search', clerkAuth, hydrateSubscription, searchInstagram);
router.post('/intelligent', clerkAuth, hydrateSubscription, requireProSubscription, intelligentSearchInstagram);

router.get('/trends', clerkAuth, hydrateSubscription, requirePaidSubscription, getTrends);
router.post('/trends/refresh', clerkAuth, hydrateSubscription, requirePaidSubscription, refreshTrends);

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
