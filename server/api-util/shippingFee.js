const { types } = require('sharetribe-flex-sdk');
const { ShippoServices } = require('../services');

const { Money } = types;

// Markup added on top of the Shippo rate. The customer pays the marked-up shipping fee and the
// marketplace pays Shippo's rate for the label.
const SHIPPING_RATE_MARKUP_PERCENT = 10;

/**
 * Get the shipping fee the customer pays for a Shippo rate (rate + markup), in subunits.
 *
 * @param {string|number} rateAmount Shippo rate amount, e.g. "8.79"
 * @returns {number} shipping fee in subunits (cents), e.g. 967
 */
const getShippingFeeInSubunits = rateAmount => {
  const rateInSubunits = Math.round(Number(rateAmount) * 100);
  return Math.round((rateInSubunits * (100 + SHIPPING_RATE_MARKUP_PERCENT)) / 100);
};

/**
 * Get the shipping fee the customer pays for a Shippo rate (rate + markup) as a decimal string,
 * in the same format as Shippo rate amounts.
 *
 * @param {string|number} rateAmount Shippo rate amount, e.g. "8.79"
 * @returns {string} shipping fee, e.g. "9.67"
 */
const getShippingFeeAmount = rateAmount => (getShippingFeeInSubunits(rateAmount) / 100).toFixed(2);

/**
 * Shipment metadata is used to check that the selected rate belongs to the listing.
 *
 * @param {string} listingId listing's UUID
 * @returns {string} metadata for Shippo shipment
 */
const getShipmentMetadata = listingId => `listing:${listingId}`;

const createError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  error.statusText = message;
  error.data = {};
  return error;
};

/**
 * Resolve the shipping fee from the Shippo rate selected by the customer (rate + markup).
 * The amount is always fetched from Shippo, so that the client app can't set the price.
 */
const resolveShippingFee = async ({ listingId, shippingRateId, currency }) => {
  const rate = await ShippoServices.rates.get(shippingRateId);
  const shipment = await ShippoServices.shipments.get(rate.shipment);
  const amountInSubunits = getShippingFeeInSubunits(rate.amount);

  const isValidRate =
    shipment.metadata === getShipmentMetadata(listingId) &&
    rate.currency === currency &&
    Number.isInteger(amountInSubunits) &&
    amountInSubunits > 0;

  if (!isValidRate) {
    throw createError(400, 'Invalid shipping rate.');
  }
  return new Money(amountInSubunits, currency);
};

/**
 * Resolve shipping fee for the line-items, if the customer has selected a Shippo rate.
 * Note: shipping fee can't be skipped when an actual (not speculative) order with shipping is made.
 *
 * @param {Object} params
 * @param {Object} params.orderData orderData from the client app (deliveryMethod, shippingRateId)
 * @param {Object} params.listing listing entity
 * @param {string} params.currency listing's currency
 * @param {boolean} params.isSpeculative true if the transaction is only speculated
 * @returns {Promise<Money|null>} shipping fee or null
 */
const resolveShippingFeeMaybe = ({ orderData, listing, currency, isSpeculative }) => {
  const { deliveryMethod, shippingRateId } = orderData || {};
  const isShipping = deliveryMethod === 'shipping';

  if (isShipping && shippingRateId) {
    return resolveShippingFee({ listingId: listing.id.uuid, shippingRateId, currency });
  } else if (isShipping && !isSpeculative) {
    return Promise.reject(createError(400, 'Shipping rate is required.'));
  }
  return Promise.resolve(null);
};

module.exports = {
  SHIPPING_RATE_MARKUP_PERCENT,
  getShippingFeeInSubunits,
  getShippingFeeAmount,
  getShipmentMetadata,
  resolveShippingFee,
  resolveShippingFeeMaybe,
};
