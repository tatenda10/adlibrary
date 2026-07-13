const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription, requirePaidSubscription } = require('../middleware/requireSubscription');
const {
  getBookmarks,
  createBookmark,
  deleteBookmark,
} = require('../controllers/bookmarksController');

const router = express.Router();

router.get('/', clerkAuth, hydrateSubscription, requirePaidSubscription, getBookmarks);
router.post('/', clerkAuth, hydrateSubscription, requirePaidSubscription, createBookmark);
router.delete('/:id', clerkAuth, hydrateSubscription, requirePaidSubscription, deleteBookmark);

module.exports = router;
