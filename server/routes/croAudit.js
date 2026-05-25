const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requireProSubscription } = require('../middleware/requireSubscription');
const { createUsageGuard } = require('../middleware/usageGuard');
const { analyzeCroAudit } = require('../controllers/croAuditController');
const { enqueueJob } = require('../utils/asyncJobs');
const { METRICS } = require('../utils/usage');

const router = express.Router();

router.post('/', clerkAuth, hydrateSubscription, requireProSubscription, createUsageGuard(METRICS.CRO_AUDIT, {
  message: 'You have reached your monthly CRO audit limit.',
  upgradePrompt: 'Upgrade your plan or wait for the next billing cycle to run more CRO audits.',
}), analyzeCroAudit);

router.post('/jobs', clerkAuth, hydrateSubscription, requireProSubscription, createUsageGuard(METRICS.CRO_AUDIT, {
  message: 'You have reached your monthly CRO audit limit.',
  upgradePrompt: 'Upgrade your plan or wait for the next billing cycle to queue more CRO audits.',
}), async (req, res) => {
  try {
    const job = await enqueueJob(req.user.id, 'cro_audit', req.body || {});
    return res.status(202).json({ job });
  } catch (error) {
    console.error('enqueue cro audit job error:', error);
    return res.status(500).json({ error: 'Failed to queue CRO audit job.' });
  }
});

module.exports = router;
