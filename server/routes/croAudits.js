const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requireProSubscription } = require('../middleware/requireSubscription');
const { listCroAudits, saveCroAudit, deleteCroAudit } = require('../controllers/croAuditsController');

const router = express.Router();

router.get('/', clerkAuth, hydrateSubscription, requireProSubscription, listCroAudits);
router.post('/', clerkAuth, hydrateSubscription, requireProSubscription, saveCroAudit);
router.delete('/:id', clerkAuth, hydrateSubscription, requireProSubscription, deleteCroAudit);

module.exports = router;
