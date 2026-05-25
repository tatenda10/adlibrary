const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requirePaidSubscription } = require('../middleware/requireSubscription');
const { getJobStatus } = require('../controllers/jobsController');

const router = express.Router();

router.get('/:id', clerkAuth, hydrateSubscription, requirePaidSubscription, getJobStatus);

module.exports = router;
