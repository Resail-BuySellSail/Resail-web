/**
 * Simulate a Shippo tracking update for a transaction (development only).
 *
 * Shippo test mode doesn't send tracking updates for test labels. Instead, it has test tracking
 * numbers (carrier 'shippo'): SHIPPO_PRE_TRANSIT, SHIPPO_TRANSIT, SHIPPO_DELIVERED,
 * SHIPPO_RETURNED, SHIPPO_FAILURE and SHIPPO_UNKNOWN. This script fetches one of them and applies it
 * to the given Sharetribe transaction, the same way as the track_updated webhook does.
 *
 * Usage:
 *   NODE_ENV=development node scripts/simulate-shippo-tracking.js <transaction-id> [SHIPPO_TRANSIT]
 */
const path = require('path');

require(path.join(__dirname, '../server/env')).configureEnv();

const config = require('../server/config');
const { ShippoServices } = require('../server/services');
const applyTrackingUpdate = require('../server/services/shippo/applyTrackingUpdate');

const TEST_TRACKING_NUMBERS = [
  'SHIPPO_PRE_TRANSIT',
  'SHIPPO_TRANSIT',
  'SHIPPO_DELIVERED',
  'SHIPPO_RETURNED',
  'SHIPPO_FAILURE',
  'SHIPPO_UNKNOWN',
];

const run = async () => {
  const [transactionId, testTrackingNumber = 'SHIPPO_TRANSIT'] = process.argv.slice(2);

  if (!config.shippo.key?.startsWith('shippo_test_')) {
    throw new Error('This script can only be used with a Shippo test API key.');
  }
  if (!transactionId || !TEST_TRACKING_NUMBERS.includes(testTrackingNumber)) {
    throw new Error(
      `Usage: node scripts/simulate-shippo-tracking.js <transaction-id> [${TEST_TRACKING_NUMBERS.join(
        '|'
      )}]`
    );
  }

  const track = await ShippoServices.tracks.get(testTrackingNumber, 'shippo');
  const result = await applyTrackingUpdate({
    transactionId,
    track,
    skipTrackingNumberCheck: true,
  });
  console.log(`Applied ${testTrackingNumber} to transaction ${transactionId}:`, result);
};

run().catch(e => {
  console.error(e.message);
  process.exit(1);
});
