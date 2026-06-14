const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requireProSubscription } = require('../middleware/requireSubscription');
const {
  generateHookScript,
  generateFacebookAdCopy,
  extractProductFromWebsite,
  generateBulkCreative,
} = require('../controllers/hooksController');

const router = express.Router();

router.post('/generate', clerkAuth, hydrateSubscription, requireProSubscription, generateHookScript);
router.post(
  '/facebook-ad-copy',
  clerkAuth,
  hydrateSubscription,
  requireProSubscription,
  generateFacebookAdCopy
);
router.post(
  '/product-from-website',
  clerkAuth,
  hydrateSubscription,
  requireProSubscription,
  extractProductFromWebsite
);
router.post(
  '/bulk-creative',
  clerkAuth,
  hydrateSubscription,
  requireProSubscription,
  generateBulkCreative
);

module.exports = router;
