const express = require('express');
const bodyParser = require('body-parser');
const shippoWebhook = require('./shippo');

const router = express.Router();

// Shippo posts JSON
router.post('/shippo', bodyParser.json(), shippoWebhook);

module.exports = router;
