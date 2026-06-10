const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const { hydrateSubscription } = require('../middleware/requireSubscription');
const {
  getBookmarks,
  createBookmark,
  deleteBookmark,
} = require('../controllers/bookmarksController');

const router = express.Router();

router.get('/', clerkAuth, hydrateSubscription, getBookmarks);
router.post('/', clerkAuth, hydrateSubscription, createBookmark);
router.delete('/:id', clerkAuth, hydrateSubscription, deleteBookmark);

module.exports = router;
