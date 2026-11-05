const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requireFeature } = require('../middleware/requireSubscription');
const { listCroAudits, saveCroAudit, deleteCroAudit } = require('../controllers/croAuditsController');
const { FEATURES } = require('../utils/entitlements');

const router = express.Router();

router.get('/', clerkAuth, hydrateSubscription, requireFeature(FEATURES.WEBSITE_RESEARCH), listCroAudits);
router.post('/', clerkAuth, hydrateSubscription, requireFeature(FEATURES.WEBSITE_RESEARCH), saveCroAudit);
router.delete('/:id', clerkAuth, hydrateSubscription, requireFeature(FEATURES.WEBSITE_RESEARCH), deleteCroAudit);

module.exports = router;
