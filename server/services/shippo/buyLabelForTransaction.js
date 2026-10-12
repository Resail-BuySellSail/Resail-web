const log = require('../../log');
const { ShippoServices } = require('../../services');
const updateTransactionMetadata = require('../transactions/updateMetadata');

/**
 * Get carrier messages (e.g. "Recipient address invalid: ...") from a failed Shippo transaction.
 *
 * @param {Object} shippoTransaction
 * @returns {Array<string>}
 */
const getLabelErrorMessages = shippoTransaction =>
  (shippoTransaction?.messages || []).map(m => m.text).filter(Boolean);

/**
 * Buy a Shippo label for a Sharetribe transaction and store it to the transaction's metadata:
 * metadata.shippingDetails: { transactionId, trackingNumber, trackingUrl, labelUrl }
 * If the carrier rejects the label, the messages are stored to metadata.shippingLabelErrors,
 * so that the provider can see what went wrong.
 *
 * @param {string} rateId Shippo rate id
 * @param {string} transactionId Sharetribe transaction UUID
 * @returns {Promise<Object|null>} Shippo transaction or null on failure
 */
const buyLabelForTransaction = async (rateId, transactionId) => {
  try {
    const shippoTransaction = await ShippoServices.transactions.create({
      rate: rateId,
      metadata: `Sharetribe Transaction ID #${transactionId}`,
      async: false,
    });

    if (shippoTransaction.status !== 'SUCCESS') {
      log.error(
        new Error(`Shippo transaction status ${shippoTransaction.status}`),
        'shippo-transaction-not-success',
        {
          shippoTransactionId: shippoTransaction.objectId,
          rateId,
          transactionId,
          messages: shippoTransaction.messages,
        }
      );
      await updateTransactionMetadata(transactionId, {
        shippingLabelErrors: getLabelErrorMessages(shippoTransaction),
      });
      return shippoTransaction;
    }

    await updateTransactionMetadata(transactionId, {
      shippingDetails: {
        transactionId: shippoTransaction.objectId,
        trackingNumber: shippoTransaction.trackingNumber,
        trackingUrl: shippoTransaction.trackingUrlProvider,
        labelUrl: shippoTransaction.labelUrl,
      },
      shippingTrackingNumber: shippoTransaction.trackingNumber,
      // Clear the errors of the previous attempts
      shippingLabelErrors: null,
    });
    return shippoTransaction;
  } catch (error) {
    log.error(error, 'buy-label-for-transaction-failed', { rateId, transactionId });
    return null;
  }
};

module.exports = buyLabelForTransaction;
module.exports.getLabelErrorMessages = getLabelErrorMessages;
