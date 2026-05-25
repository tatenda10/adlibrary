const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requirePaidSubscription } = require('../middleware/requireSubscription');
const { getOverview } = require('../controllers/dashboardController');

const router = express.Router();

router.get('/overview', clerkAuth, hydrateSubscription, requirePaidSubscription, getOverview);

module.exports = router;
