const crypto = require('crypto');
const log = require('../../log');
const config = require('../../config');
const {
  getTrackingFromWebhook,
  parseSharetribeTransactionId,
} = require('../../api-util/shippingTracking');
const { ShippoServices } = require('../../services');
const applyTrackingUpdate = require('../../services/shippo/applyTrackingUpdate');

const TRACK_UPDATED = 'track_updated';

/**
 * Shippo webhooks are not signed. The webhook URL contains a secret token:
 * https://<marketplace>/api/webhooks/shippo?token=<SHIPPO_WEBHOOK_TOKEN>
 *
 * @param {string} [token]
 * @returns {boolean}
 */
const isValidToken = token => {
  const expected = config.shippo.webhookToken;
  if (!expected || typeof token !== 'string') {
    return false;
  }
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * Find the Sharetribe transaction of the tracked shipment. Labels are bought with Shippo metadata
 * "Sharetribe Transaction ID #<uuid>" (see buyLabelForTransaction.js).
 *
 * @param {Object} track Shippo Track
 * @returns {Promise<string|null>} Sharetribe transaction UUID
 */
const getSharetribeTransactionId = async track => {
  if (track.transaction) {
    const shippoTransaction = await ShippoServices.transactions.get(track.transaction);
    const transactionId = parseSharetribeTransactionId(shippoTransaction?.metadata);
    if (transactionId) {
      return transactionId;
    }
  }
  return parseSharetribeTransactionId(track.metadata);
};

/**
 * Shippo webhook: track_updated
 *
 * Shippo sends tracking updates of the labels bought through Shippo. The webhook body is only
 * used to know which shipment changed: the tracking status is fetched from Shippo API.
 * See applyTrackingUpdate.js for what is done with the update.
 *
 * Shippo retries the webhook if the response is not 2xx, so 2xx is returned for updates that
 * are ignored on purpose (e.g. unknown shipments).
 */
const shippoWebhook = async (req, res) => {
  if (!isValidToken(req.query?.token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { event } = req.body || {};
  if (event !== TRACK_UPDATED) {
    return res.status(200).json({ ignored: 'event' });
  }

  const { trackingNumber, carrier } = getTrackingFromWebhook(req.body);
  if (!trackingNumber || !carrier) {
    return res.status(200).json({ ignored: 'missing-tracking-number' });
  }

  try {
    const track = await ShippoServices.tracks.get(trackingNumber, carrier);
    const transactionId = await getSharetribeTransactionId(track);
    if (!transactionId) {
      return res.status(200).json({ ignored: 'unknown-shipment' });
    }

    const result = await applyTrackingUpdate({ transactionId, track });
    return res.status(200).json(result);
  } catch (e) {
    log.error(e, 'shippo-webhook-failed', { trackingNumber, carrier });
    // Let Shippo retry
    return res.status(500).json({ error: 'Failed to handle the tracking update' });
  }
};

module.exports = shippoWebhook;
