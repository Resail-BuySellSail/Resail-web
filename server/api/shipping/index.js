const express = require('express');
const middleware = require('../../middleware');
const buyLabel = require('./buy-label');

const router = express.Router();

router.post('/buy-label', middleware.auth, buyLabel);

module.exports = router;
