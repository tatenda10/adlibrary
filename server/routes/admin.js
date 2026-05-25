const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const {
  adminLogin,
  createAdminArticle,
  deleteAdminArticle,
  getAdminArticles,
  updateAdminArticle,
} = require('../controllers/articlesController');

const router = express.Router();

router.post('/login', adminLogin);
router.get('/articles', adminAuth, getAdminArticles);
router.post('/articles', adminAuth, createAdminArticle);
router.put('/articles/:id', adminAuth, updateAdminArticle);
router.delete('/articles/:id', adminAuth, deleteAdminArticle);

module.exports = router;
