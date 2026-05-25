const express = require('express');
const {
  getPublicArticles,
  getPublicArticleBySlug,
} = require('../controllers/articlesController');

const router = express.Router();

router.get('/', getPublicArticles);
router.get('/:slug', getPublicArticleBySlug);

module.exports = router;
