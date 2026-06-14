const express = require('express');
const optionalClerkAuth = require('../middleware/optionalClerkAuth');
const { ingestProductEvent } = require('../controllers/analyticsController');

const router = express.Router();

router.post('/event', optionalClerkAuth, ingestProductEvent);

module.exports = router;
