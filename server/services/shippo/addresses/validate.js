const shippoInstance = require('../instance');

/**
 * Create a Shippo address with validation. The response contains the normalized address and
 * validationResults: { isValid, messages }.
 *
 * @param {Object} address Shippo address
 * @returns {Promise<Object>} Shippo address
 */
const validate = async address => {
  return shippoInstance.addresses.create({ ...address, validate: true });
};

module.exports = validate;
