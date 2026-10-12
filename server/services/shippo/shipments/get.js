const shippoInstance = require('../instance');

const get = async shipmentId => {
  return shippoInstance.shipments.get(shipmentId);
};

module.exports = get;
