const express = require('express');
const middleware = require('../../middleware');
const saveAddress = require('./save-address');
const shippingRates = require('./shipping-rates');

const router = express.Router();

router.post('/save', middleware.auth, saveAddress);
router.post('/shipping-rates', middleware.auth, shippingRates);

module.exports = router;
