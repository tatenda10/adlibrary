const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requireProSubscription } = require('../middleware/requireSubscription');
const {
  generateHookScript,
  generateFacebookAdCopy,
  extractProductFromWebsite,
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

module.exports = router;
