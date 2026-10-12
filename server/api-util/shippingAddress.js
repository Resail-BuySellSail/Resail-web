const US_COUNTRY = 'US';

/**
 * Check that the US shipping address has the required fields.
 * Note: keep in sync with isCompleteShippingAddress in src/util/shipping.js
 *
 * @param {Object} address { name, phone, street1, streetNo, city, state, zip, country }
 * @returns {boolean}
 */
const isCompleteShippingAddress = address =>
  !!(
    address?.name &&
    address?.phone &&
    address?.street1 &&
    address?.city &&
    address?.state &&
    address?.zip &&
    (address?.country || US_COUNTRY) === US_COUNTRY
  );

/**
 * Map the saved shipping address to Shippo address.
 * - Ship-from address is saved to listing's privateData.shippingAddress
 * - Ship-to address is saved to customer's profile.privateData.shipToAddress
 *
 * @param {Object} address { name, phone, street1, streetNo, city, state, zip, country }
 * @param {string} [email]
 * @returns {Object} Shippo address
 */
const getShippoAddress = (address, email) => {
  const { name, phone, street1, streetNo, city, state, zip, country } = address;
  return {
    name,
    phone,
    street1,
    ...(streetNo ? { street2: streetNo } : {}),
    city,
    state,
    zip,
    country: country || US_COUNTRY,
    ...(email ? { email } : {}),
  };
};

module.exports = {
  isCompleteShippingAddress,
  getShippoAddress,
};
