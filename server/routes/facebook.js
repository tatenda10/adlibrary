const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requireProSubscription } = require('../middleware/requireSubscription');
const { searchFacebookAds, intelligentSearchFacebookAds } = require('../controllers/facebookController');
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

router.post('/ads', clerkAuth, hydrateSubscription, searchFacebookAds);
router.post('/ads/intelligent', clerkAuth, hydrateSubscription, requireProSubscription, intelligentSearchFacebookAds);

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
