const addresses = require('./addresses');
const shipments = require('./shipments');
const rates = require('./rates');
const tracks = require('./tracks');
const transactions = require('./transactions');

const shippo = {
  addresses,
  shipments,
  rates,
  tracks,
  transactions,
};

module.exports = shippo;
