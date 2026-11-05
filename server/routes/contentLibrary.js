const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requirePaidSubscription } = require('../middleware/requireSubscription');
const {
  importKarolaExamples,
  listContentLibraryItems,
  listStaticAdExamples,
} = require('../controllers/contentLibraryController');

const router = express.Router();

router.get('/static-ad-examples', listStaticAdExamples);
router.get('/', clerkAuth, hydrateSubscription, requirePaidSubscription, listContentLibraryItems);
router.post('/import/karola-facebook-examples', clerkAuth, hydrateSubscription, requirePaidSubscription, importKarolaExamples);

module.exports = router;
