const shipments = require('./shipments');
const rates = require('./rates');
const transactions = require('./transactions');

const shippo = {
  shipments,
  rates,
  transactions,
};

module.exports = shippo;
