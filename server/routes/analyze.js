const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requireProSubscription } = require('../middleware/requireSubscription');
const { createUsageGuard } = require('../middleware/usageGuard');
const { analyzeTikTok } = require('../controllers/analyzeController');
const { enqueueJob } = require('../utils/asyncJobs');
const { METRICS } = require('../utils/usage');

const router = express.Router();

router.post('/', clerkAuth, hydrateSubscription, requireProSubscription, createUsageGuard(METRICS.AI_ANALYSIS, {
  message: 'You have reached your monthly AI analysis limit.',
  upgradePrompt: 'Upgrade your plan or wait for the next billing cycle to analyze more videos.',
}), analyzeTikTok);

router.post('/jobs', clerkAuth, hydrateSubscription, requireProSubscription, createUsageGuard(METRICS.AI_ANALYSIS, {
  message: 'You have reached your monthly AI analysis limit.',
  upgradePrompt: 'Upgrade your plan or wait for the next billing cycle to queue more video analyses.',
}), async (req, res) => {
  try {
    const job = await enqueueJob(req.user.id, 'tiktok_analysis', req.body || {});
    return res.status(202).json({ job });
  } catch (error) {
    console.error('enqueue analyze job error:', error);
    return res.status(500).json({ error: 'Failed to queue TikTok analysis job.' });
  }
});

module.exports = router;
