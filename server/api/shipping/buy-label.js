const log = require('../../log');
const { getIntegrationSdk, handleError } = require('../../api-util/sdk');
const { resolveShippingFee } = require('../../api-util/shippingFee');
const buyLabelForTransaction = require('../../services/shippo/buyLabelForTransaction');
const { getLabelErrorMessages } = buyLabelForTransaction;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATE_PURCHASED = 'state/purchased';
const LINE_ITEM_SHIPPING_FEE = 'line-item/shipping-fee';

/**
 * POST /api/shipping/buy-label
 *
 * Body: { transactionId }
 * Buys a Shippo label after the payment is confirmed (customer, checkout)
 * or retries if the label is missing (provider, transaction page).
 * Label details are saved to transaction's metadata.shippingDetails.
 */
module.exports = async (req, res) => {
  const { transactionId: transactionIdMaybe } = req.body || {};
  const transactionId = transactionIdMaybe?.uuid || transactionIdMaybe;
  if (typeof transactionId !== 'string' || !UUID_REGEX.test(transactionId)) {
    return res.status(400).json({ error: 'A valid transactionId is required' });
  }

  try {
    // Note: relationships are returned only when they are included
    const response = await getIntegrationSdk().transactions.show({
      id: transactionId,
      include: ['customer', 'provider', 'listing'],
    });
    const transaction = response.data.data;
    const { customer, provider, listing } = transaction.relationships || {};

    const customerId = customer?.data?.id?.uuid;
    const providerId = provider?.data?.id?.uuid;
    if (req.tokenUserId !== customerId && req.tokenUserId !== providerId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { metadata, protectedData, lineItems, state } = transaction.attributes;
    const existingShippingDetails = metadata?.shippingDetails;
    if (existingShippingDetails?.labelUrl) {
      return res.status(200).json({ shippingDetails: existingShippingDetails });
    }

    if (state !== STATE_PURCHASED) {
      return res
        .status(409)
        .json({ error: 'Shipping label can be bought only for purchased orders' });
    }

    const rateId = protectedData?.shippingRateId;
    if (protectedData?.deliveryMethod !== 'shipping' || !rateId) {
      return res.status(400).json({ error: 'Missing shippingRateId on the transaction' });
    }

    // Make sure that the label is bought with the same rate the customer paid for.
    const shippingFeeLineItem = lineItems.find(
      item => item.code === LINE_ITEM_SHIPPING_FEE && !item.reversal
    );
    const paidShippingFee = shippingFeeLineItem?.lineTotal;
    const rateAmount = paidShippingFee
      ? await resolveShippingFee({
          listingId: listing?.data?.id?.uuid,
          shippingRateId: rateId,
          currency: paidShippingFee.currency,
        })
      : null;
    if (!rateAmount || rateAmount.amount !== paidShippingFee.amount) {
      return res.status(400).json({ error: 'Shipping rate does not match the paid shipping fee' });
    }

    const shippoTransaction = await buyLabelForTransaction(rateId, transactionId);
    if (!shippoTransaction || shippoTransaction.status !== 'SUCCESS') {
      // Carrier messages tell the provider what went wrong (e.g. invalid recipient address)
      return res.status(502).json({
        error: 'Failed to buy the shipping label',
        messages: getLabelErrorMessages(shippoTransaction),
      });
    }

    return res.status(200).json({
      shippingDetails: {
        transactionId: shippoTransaction.objectId,
        trackingNumber: shippoTransaction.trackingNumber,
        trackingUrl: shippoTransaction.trackingUrlProvider,
        labelUrl: shippoTransaction.labelUrl,
        qrCodeUrl: shippoTransaction.qrCodeUrl || null,
      },
    });
  } catch (error) {
    log.error(error, 'buy-shipping-label-failed', {
      userId: req.tokenUserId,
      transactionId,
    });
    return handleError(res, error, { skipErrorLogging: true });
  }
};
