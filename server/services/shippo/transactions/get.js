const shippoInstance = require('../instance');

const get = async transactionId => {
  return shippoInstance.transactions.get(transactionId);
};

module.exports = get;
