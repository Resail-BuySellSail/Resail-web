const addresses = require('./addresses');
const shipments = require('./shipments');
const rates = require('./rates');
const transactions = require('./transactions');

const shippo = {
  addresses,
  shipments,
  rates,
  transactions,
};

module.exports = shippo;
