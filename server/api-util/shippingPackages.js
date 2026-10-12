/**
 * Map the listing's parcel details to a Shippo parcel.
 *
 * Providers enter the packed parcel's dimensions (inches) and weight (pounds) on the listing:
 * publicData.packageLength, publicData.packageWidth, publicData.packageHeight and
 * publicData.packageWeight.
 *
 * Note: units must match PACKAGE_DISTANCE_UNIT and PACKAGE_MASS_UNIT in src/util/shipping.js
 */

const DISTANCE_UNIT = 'in';
const MASS_UNIT = 'lb';

const toPositiveNumber = value => {
  const num = value == null || value === '' ? NaN : Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

/**
 * Get Shippo parcel object for the listing's package dimensions and weight.
 *
 * @param {Object} publicData listing's publicData
 * @param {number} publicData.packageLength length in inches
 * @param {number} publicData.packageWidth width in inches
 * @param {number} publicData.packageHeight height in inches
 * @param {number} publicData.packageWeight weight in pounds
 * @returns {Object|null} Shippo parcel or null if some of the values are missing or invalid
 */
const getShippoParcel = (publicData = {}) => {
  const { packageLength, packageWidth, packageHeight, packageWeight } = publicData || {};
  const length = toPositiveNumber(packageLength);
  const width = toPositiveNumber(packageWidth);
  const height = toPositiveNumber(packageHeight);
  const weight = toPositiveNumber(packageWeight);

  if (!length || !width || !height || !weight) {
    return null;
  }

  return {
    length: `${length}`,
    width: `${width}`,
    height: `${height}`,
    distanceUnit: DISTANCE_UNIT,
    weight: `${weight}`,
    massUnit: MASS_UNIT,
  };
};

module.exports = {
  getShippoParcel,
};
