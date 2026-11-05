const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requireFeature } = require('../middleware/requireSubscription');
const { FEATURES } = require('../utils/entitlements');
const {
  generateHookScript,
  generateFacebookAdCopy,
  extractProductFromWebsite,
  generateBulkCreative,
  generateAdImage,
  generateContentVideo,
} = require('../controllers/hooksController');

const router = express.Router();

router.post('/generate', clerkAuth, hydrateSubscription, requireFeature(FEATURES.TIKTOK_HOOKS), generateHookScript);
router.post(
  '/facebook-ad-copy',
  clerkAuth,
  hydrateSubscription,
  requireFeature(FEATURES.TIKTOK_HOOKS),
  generateFacebookAdCopy
);
router.post(
  '/product-from-website',
  clerkAuth,
  hydrateSubscription,
  requireFeature(FEATURES.TIKTOK_HOOKS),
  extractProductFromWebsite
);
router.post(
  '/bulk-creative',
  clerkAuth,
  hydrateSubscription,
  requireFeature(FEATURES.TIKTOK_HOOKS),
  generateBulkCreative
);
router.post(
  '/ad-image',
  clerkAuth,
  hydrateSubscription,
  requireFeature(FEATURES.TIKTOK_HOOKS),
  generateAdImage
);
router.post(
  '/video',
  clerkAuth,
  hydrateSubscription,
  requireFeature(FEATURES.TIKTOK_HOOKS),
  generateContentVideo
);

module.exports = router;
