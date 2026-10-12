const { types } = require('sharetribe-flex-sdk');
const { ShippoServices } = require('../services');

const { Money } = types;

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
 * Resolve the shipping fee from the Shippo rate selected by the customer.
 * The amount is always fetched from Shippo, so that the client app can't set the price.
 */
const resolveShippingFee = async ({ listingId, shippingRateId, currency }) => {
  const rate = await ShippoServices.rates.get(shippingRateId);
  const shipment = await ShippoServices.shipments.get(rate.shipment);
  const amountInSubunits = Math.round(Number(rate.amount) * 100);

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
  getShipmentMetadata,
  resolveShippingFee,
  resolveShippingFeeMaybe,
};
