const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const {
  upsertOnboardingProfile,
  patchOnboardingProfile,
  getBrandProfile,
  getOnboardingStatus,
  extractWebsiteBrand,
  generateVoiceDraft,
  previewBrandProfile,
  previewLandingWebsite,
} = require('../controllers/onboardingController');

const router = express.Router();

router.post('/landing-preview', previewLandingWebsite);
router.get('/', clerkAuth, getBrandProfile);
router.get('/status', clerkAuth, getOnboardingStatus);
router.post('/', clerkAuth, upsertOnboardingProfile);
router.patch('/', clerkAuth, patchOnboardingProfile);
router.post('/extract', clerkAuth, extractWebsiteBrand);
router.post('/generate-voice', clerkAuth, generateVoiceDraft);
router.post('/preview', clerkAuth, previewBrandProfile);

module.exports = router;
