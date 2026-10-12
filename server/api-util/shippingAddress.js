const US_COUNTRY = 'US';

// Address types and the matching keys in user's profile.privateData.
// Note: keep in sync with SHIPPING_ADDRESS_TYPES in src/util/shipping.js
const SHIPPING_ADDRESS_KEYS = {
  shipFrom: 'shippingAddress',
  shipTo: 'shipToAddress',
};

const toTrimmedString = value => (typeof value === 'string' ? value.trim() : '');

/**
 * Pick the known shipping address fields from user input.
 *
 * @param {Object} address
 * @returns {Object} { name, phone, street1, streetNo, city, state, zip, country }
 */
const pickShippingAddress = (address = {}) => ({
  name: toTrimmedString(address?.name),
  phone: toTrimmedString(address?.phone),
  street1: toTrimmedString(address?.street1),
  streetNo: toTrimmedString(address?.streetNo),
  city: toTrimmedString(address?.city),
  state: toTrimmedString(address?.state),
  zip: toTrimmedString(address?.zip),
  country: US_COUNTRY,
});

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
 * - Ship-from address is saved to provider's profile.privateData.shippingAddress
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

/**
 * Get the address to save from Shippo's validated address. Shippo normalizes the street, city,
 * state and ZIP code (e.g. "215 clayton street" => "215 Clayton St"). Name and phone are kept as
 * entered.
 *
 * @param {Object} address entered address
 * @param {Object} shippoAddress validated Shippo address
 * @returns {Object} { name, phone, street1, streetNo, city, state, zip, country }
 */
const getValidatedShippingAddress = (address, shippoAddress) => ({
  name: address.name,
  phone: address.phone,
  street1: shippoAddress.street1 || address.street1,
  streetNo: shippoAddress.street2 || address.streetNo || '',
  city: shippoAddress.city || address.city,
  state: shippoAddress.state || address.state,
  zip: shippoAddress.zip || address.zip,
  country: US_COUNTRY,
});

/**
 * Get validation messages (e.g. "Multiple addresses were found...") from Shippo address.
 *
 * @param {Object} shippoAddress
 * @returns {Array<string>}
 */
const getAddressValidationMessages = shippoAddress =>
  (shippoAddress?.validationResults?.messages || []).map(m => m.text).filter(Boolean);

module.exports = {
  SHIPPING_ADDRESS_KEYS,
  pickShippingAddress,
  isCompleteShippingAddress,
  getShippoAddress,
  getValidatedShippingAddress,
  getAddressValidationMessages,
};
