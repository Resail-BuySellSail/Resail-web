/**
 * Shipping helpers for Shippo-based delivery.
 *
 * - The provider's ship-from address is stored to the user profile
 *   (profile.privateData.shippingAddress). It's managed on the Shipping addresses page and used for
 *   all the provider's listings.
 * - The customer's ship-to address is stored to the user profile (profile.privateData.shipToAddress).
 * - The provider enters the packed parcel's dimensions (inches) and weight (pounds).
 *   They are stored to listing's publicData: packageLength, packageWidth, packageHeight and
 *   packageWeight. The server maps them to a Shippo parcel (server/api-util/shippingPackages.js).
 */

export const US_COUNTRY = 'US';

// Address types of the Shipping addresses page. The address is validated with Shippo and saved
// to the user's profile.privateData (shipFrom => shippingAddress, shipTo => shipToAddress).
// Note: keep in sync with SHIPPING_ADDRESS_KEYS in server/api-util/shippingAddress.js
export const SHIP_FROM_ADDRESS = 'shipFrom';
export const SHIP_TO_ADDRESS = 'shipTo';
export const SHIPPING_ADDRESS_TYPES = [SHIP_FROM_ADDRESS, SHIP_TO_ADDRESS];

// Error code returned by the server, if Shippo can't validate the address.
// Note: keep in sync with INVALID_ADDRESS_ERROR_CODE in server/api/address/save-address.js
export const INVALID_ADDRESS_ERROR_CODE = 'invalid-address';

// Units used for the package details the provider enters on the listing.
export const PACKAGE_DISTANCE_UNIT = 'in';
export const PACKAGE_MASS_UNIT = 'lb';

// Parcel dimension fields in listing's publicData. Labels are in translations:
// EditListingDeliveryForm.<key>Label
export const PACKAGE_DIMENSION_FIELDS = ['packageLength', 'packageWidth', 'packageHeight'];

const EMPTY_SHIPPING_ADDRESS = {};

/**
 * Get the ship-from address saved to the user's profile (Shipping addresses page).
 *
 * @param {Object} [user] currentUser entity
 * @returns {Object} shippingAddress or an empty object
 */
export const getProfileShippingAddress = user =>
  user?.attributes?.profile?.privateData?.shippingAddress || EMPTY_SHIPPING_ADDRESS;

/**
 * Get the ship-to address saved to the user's profile.
 *
 * @param {Object} [user] currentUser entity
 * @returns {Object} shipToAddress or an empty object
 */
export const getProfileShipToAddress = user =>
  user?.attributes?.profile?.privateData?.shipToAddress || EMPTY_SHIPPING_ADDRESS;

/**
 * Check that the US shipping address has all the required fields.
 *
 * @param {Object} [address]
 * @returns {boolean} true if name, phone, street1, city, state and zip exist
 */
export const isCompleteShippingAddress = address =>
  !!(
    address?.name &&
    address?.phone &&
    address?.street1 &&
    address?.city &&
    address?.state &&
    address?.zip
  );

/**
 * Check that the value is a positive number (e.g. a parcel dimension or weight).
 *
 * @param {number|string} [value]
 * @returns {boolean} true if the value is a finite number greater than 0
 */
export const isPositiveNumber = value =>
  value != null && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0;

/**
 * Check that the listing has the parcel dimensions and weight set.
 *
 * @param {Object} [publicData] listing's publicData
 * @returns {boolean} true if packageLength, packageWidth, packageHeight and packageWeight are
 * positive numbers
 */
export const hasCompletePackage = (publicData = {}) =>
  [...PACKAGE_DIMENSION_FIELDS, 'packageWeight'].every(key => isPositiveNumber(publicData?.[key]));

/**
 * Format the shipping address to a single line, e.g. "215 Clayton St, Apt 4, San Francisco, CA 94117"
 *
 * @param {Object} [address]
 * @returns {string}
 */
export const formatShippingAddressLine = address => {
  const { street1, streetNo, city, state, zip } = address || {};
  const stateAndZip = [state, zip].filter(Boolean).join(' ');
  return [street1, streetNo, city, stateAndZip].filter(Boolean).join(', ');
};
