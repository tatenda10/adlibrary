const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requirePaidSubscription, requireProSubscription } = require('../middleware/requireSubscription');
const { createUsageGuard } = require('../middleware/usageGuard');
const { searchFacebookAds, intelligentSearchFacebookAds } = require('../controllers/facebookController');
const facebookWorkspace = require('../controllers/facebookWorkspaceController');
const { METRICS } = require('../utils/usage');

const router = express.Router();

const {
  listFolders,
  createFolder,
  getFolder,
  deleteFolder,
  addVideoToFolder,
  deleteVideoFromFolder,
} = facebookWorkspace;

router.post('/ads', clerkAuth, hydrateSubscription, requirePaidSubscription, createUsageGuard(METRICS.FACEBOOK_SEARCH, {
  message: 'You have reached your monthly Facebook search limit.',
  upgradePrompt: 'Upgrade your plan or wait for the next billing cycle to continue Facebook research.',
}), searchFacebookAds);
router.post('/ads/intelligent', clerkAuth, hydrateSubscription, requireProSubscription, createUsageGuard(METRICS.FACEBOOK_SEARCH, {
  message: 'You have reached your monthly Facebook search limit.',
  upgradePrompt: 'Upgrade your plan or wait for the next billing cycle to continue Facebook research.',
}), intelligentSearchFacebookAds);

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
