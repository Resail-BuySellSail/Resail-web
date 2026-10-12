const shippoInstance = require('../instance');

/**
 * Get the latest tracking status and history of a shipment from Shippo.
 *
 * @param {string} trackingNumber
 * @param {string} carrier carrier token, e.g. 'usps'
 * @returns {Promise<Object>} Shippo Track
 */
const get = async (trackingNumber, carrier) => {
  return shippoInstance.trackingStatus.get(trackingNumber, carrier);
};

module.exports = get;
