const express = require('express');
const { createSupportMessage } = require('../controllers/supportController');

const router = express.Router();

router.post('/contact', createSupportMessage);

module.exports = router;
