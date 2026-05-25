const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const {
  upsertOnboardingProfile,
  getBrandProfile,
  getOnboardingStatus,
  previewBrandProfile,
  previewLandingWebsite,
} = require('../controllers/onboardingController');

const router = express.Router();

router.post('/landing-preview', previewLandingWebsite);
router.get('/', clerkAuth, getBrandProfile);
router.get('/status', clerkAuth, getOnboardingStatus);
router.post('/', clerkAuth, upsertOnboardingProfile);
router.post('/preview', clerkAuth, previewBrandProfile);

module.exports = router;
