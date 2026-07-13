const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requirePaidSubscription, requireProSubscription } = require('../middleware/requireSubscription');
const { searchFacebookAds, intelligentSearchFacebookAds, searchFacebookPagesHandler, proxyFacebookMedia } = require('../controllers/facebookController');
const facebookWorkspace = require('../controllers/facebookWorkspaceController');

const router = express.Router();

const {
  listFolders,
  createFolder,
  getFolder,
  deleteFolder,
  addVideoToFolder,
  deleteVideoFromFolder,
} = facebookWorkspace;

router.get('/pages/search', clerkAuth, hydrateSubscription, requirePaidSubscription, searchFacebookPagesHandler);
router.get('/media-proxy', proxyFacebookMedia);
router.post('/ads', clerkAuth, hydrateSubscription, requirePaidSubscription, searchFacebookAds);
router.post('/ads/intelligent', clerkAuth, hydrateSubscription, requirePaidSubscription, requireProSubscription, intelligentSearchFacebookAds);

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
