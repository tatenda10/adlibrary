const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requirePaidSubscription } = require('../middleware/requireSubscription');
const {
  createCollection,
  deleteCollection,
  duplicateCollection,
  getCollection,
  listCollections,
  updateCollection,
} = require('../controllers/collectionsController');

const router = express.Router();

router.get('/', clerkAuth, hydrateSubscription, requirePaidSubscription, listCollections);
router.post('/', clerkAuth, hydrateSubscription, requirePaidSubscription, createCollection);
router.get('/:id', clerkAuth, hydrateSubscription, requirePaidSubscription, getCollection);
router.patch('/:id', clerkAuth, hydrateSubscription, requirePaidSubscription, updateCollection);
router.delete('/:id', clerkAuth, hydrateSubscription, requirePaidSubscription, deleteCollection);
router.post('/:id/duplicate', clerkAuth, hydrateSubscription, requirePaidSubscription, duplicateCollection);

module.exports = router;
