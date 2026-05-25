const express = require('express');
const clerkAuth = require('../middleware/clerkAuth');
const {
  createBillingCheckout,
  createBillingPortal,
  getBillingStatus,
} = require('../controllers/billingController');

const router = express.Router();

router.get('/status', clerkAuth, getBillingStatus);
router.post('/checkout', clerkAuth, createBillingCheckout);
router.post('/portal', clerkAuth, createBillingPortal);

module.exports = router;
