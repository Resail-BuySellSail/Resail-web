/**
 * Helpers for Shippo tracking updates (track_updated webhook).
 *
 * The tracking status and history are saved to transaction's metadata.shippingTracking:
 * {
 *   carrier, trackingNumber, status, substatus, statusDetails, statusDate, location, eta,
 *   history: [{ status, substatus, statusDetails, statusDate, location }],
 *   autoMarkedShippedAt, updatedAt
 * }
 */

// Shippo tracking statuses
const TRACKING_STATUS = {
  UNKNOWN: 'UNKNOWN',
  PRE_TRANSIT: 'PRE_TRANSIT',
  TRANSIT: 'TRANSIT',
  DELIVERED: 'DELIVERED',
  RETURNED: 'RETURNED',
  FAILURE: 'FAILURE',
};

// The carrier has the parcel: the order can be marked as shipped for the provider
const SHIPPED_TRACKING_STATUSES = [TRACKING_STATUS.TRANSIT, TRACKING_STATUS.DELIVERED];

// Keep metadata small: Sharetribe limits the size of extended data
const MAX_TRACKING_HISTORY_EVENTS = 50;

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Parse Sharetribe transaction id from Shippo metadata,
 * e.g. "Sharetribe Transaction ID #6acc714b-ce0d-4cd3-a143-f450eecf05f5"
 *
 * @param {string} [metadata]
 * @returns {string|null} transaction UUID
 */
const parseSharetribeTransactionId = metadata => {
  const match = typeof metadata === 'string' ? metadata.match(UUID_REGEX) : null;
  return match ? match[0].toLowerCase() : null;
};

/**
 * Get the tracking details from the track_updated webhook body.
 * Note: webhook bodies use snake_case keys.
 *
 * @param {Object} body webhook body: { event, test, data }
 * @returns {Object} { trackingNumber, carrier }
 */
const getTrackingFromWebhook = body => {
  const data = body?.data || {};
  return {
    trackingNumber: data.tracking_number || data.trackingNumber || null,
    carrier: data.carrier || null,
  };
};

const toISOString = date => {
  if (!date) {
    return null;
  }
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const toLocation = location => {
  const { city, state, zip, country } = location || {};
  return city || state || zip || country
    ? { city: city || null, state: state || null, zip: zip || null, country: country || null }
    : null;
};

/**
 * Map Shippo tracking status (SDK format) to a compact tracking event.
 *
 * @param {Object} trackingStatus Shippo TrackingStatus
 * @returns {Object|null} { status, substatus, statusDetails, statusDate, location }
 */
const toTrackingEvent = trackingStatus => {
  if (!trackingStatus?.status) {
    return null;
  }
  const { status, substatus, statusDetails, statusDate, location } = trackingStatus;
  return {
    status,
    substatus: substatus
      ? {
          code: substatus.code || null,
          text: substatus.text || null,
          actionRequired: !!substatus.actionRequired,
        }
      : null,
    statusDetails: statusDetails || null,
    statusDate: toISOString(statusDate),
    location: toLocation(location),
  };
};

/**
 * Build metadata.shippingTracking from Shippo Track. The history is in chronological order,
 * and only the latest events are kept.
 *
 * @param {Object} track Shippo Track (SDK format)
 * @param {Object} [previous] the current metadata.shippingTracking
 * @param {Date} [now]
 * @returns {Object} shippingTracking
 */
const buildShippingTracking = (track, previous = {}, now = new Date()) => {
  const latest = toTrackingEvent(track.trackingStatus);
  const history = (track.trackingHistory || [])
    .map(toTrackingEvent)
    .filter(Boolean)
    .slice(-MAX_TRACKING_HISTORY_EVENTS);

  return {
    carrier: track.carrier || null,
    trackingNumber: track.trackingNumber || null,
    ...(latest || { status: TRACKING_STATUS.UNKNOWN }),
    eta: toISOString(track.eta),
    history,
    autoMarkedShippedAt: previous?.autoMarkedShippedAt || null,
    updatedAt: now.toISOString(),
  };
};

/**
 * Check if the parcel is with the carrier (in transit or delivered).
 *
 * @param {string} status Shippo tracking status
 * @returns {boolean}
 */
const isShippedTrackingStatus = status => SHIPPED_TRACKING_STATUSES.includes(status);

module.exports = {
  TRACKING_STATUS,
  MAX_TRACKING_HISTORY_EVENTS,
  parseSharetribeTransactionId,
  getTrackingFromWebhook,
  toTrackingEvent,
  buildShippingTracking,
  isShippedTrackingStatus,
};
