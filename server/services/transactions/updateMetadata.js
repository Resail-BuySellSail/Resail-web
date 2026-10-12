const { getIntegrationSdk } = require('../../api-util/sdk');

/**
 * Update transaction's metadata with Integration API.
 * Note: top-level keys of the given metadata replace the existing keys.
 *
 * @param {string} transactionId Sharetribe transaction UUID
 * @param {Object} metadata
 */
const updateMetadata = async (transactionId, metadata) => {
  return getIntegrationSdk().transactions.updateMetadata({
    id: transactionId,
    metadata,
  });
};

module.exports = updateMetadata;
