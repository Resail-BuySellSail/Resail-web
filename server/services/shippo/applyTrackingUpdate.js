const log = require('../../log');
const { getIntegrationSdk } = require('../../api-util/sdk');
const {
  buildShippingTracking,
  isShippedTrackingStatus,
} = require('../../api-util/shippingTracking');
const updateTransactionMetadata = require('../transactions/updateMetadata');

// Labels are bought only for purchases in this state (see server/api/shipping/buy-label.js)
const STATE_PURCHASED = 'state/purchased';
const TRANSITION_OPERATOR_MARK_DELIVERED = 'transition/operator-mark-delivered';

/**
 * Mark the order shipped on behalf of the provider ("delivered" state in the purchase process).
 * The provider might have marked it shipped at the same time, so a conflict is not an error.
 *
 * @param {string} transactionId
 * @returns {Promise<boolean>} true if the transaction was transitioned
 */
const markShipped = async transactionId => {
  try {
    await getIntegrationSdk().transactions.transition({
      id: transactionId,
      transition: TRANSITION_OPERATOR_MARK_DELIVERED,
      params: {},
    });
    return true;
  } catch (e) {
    if (e?.status === 409) {
      log.error(e, 'shippo-tracking-mark-shipped-conflict', { transactionId });
      return false;
    }
    throw e;
  }
};

/**
 * Apply a Shippo tracking update to a Sharetribe transaction:
 * 1. If the carrier has the parcel (TRANSIT or DELIVERED) and the provider hasn't marked the
 *    order shipped, it's marked shipped with transition/operator-mark-delivered.
 * 2. The tracking status and history are saved to metadata.shippingTracking.
 *
 * @param {Object} params
 * @param {string} params.transactionId Sharetribe transaction UUID
 * @param {Object} params.track Shippo Track (SDK format)
 * @param {boolean} [params.skipTrackingNumberCheck] Only for simulating test tracking updates
 * @returns {Promise<Object>} { status, markedShipped } or { skipped }
 */
const applyTrackingUpdate = async ({ transactionId, track, skipTrackingNumberCheck = false }) => {
  const response = await getIntegrationSdk().transactions.show({ id: transactionId });
  const transaction = response.data.data;
  const { metadata = {}, state } = transaction.attributes;
  const labelTrackingNumber = metadata.shippingDetails?.trackingNumber;

  // The update must be for the label that was bought for this transaction
  if (!skipTrackingNumberCheck && labelTrackingNumber !== track.trackingNumber) {
    return { skipped: 'tracking-number-mismatch' };
  }

  const shippingTracking = buildShippingTracking(track, metadata.shippingTracking);
  const shouldMarkShipped =
    state === STATE_PURCHASED && isShippedTrackingStatus(shippingTracking.status);
  const markedShipped = shouldMarkShipped ? await markShipped(transactionId) : false;

  await updateTransactionMetadata(transactionId, {
    shippingTracking: {
      ...shippingTracking,
      ...(markedShipped ? { autoMarkedShippedAt: shippingTracking.updatedAt } : {}),
    },
  });

  return { status: shippingTracking.status, markedShipped };
};

module.exports = applyTrackingUpdate;
