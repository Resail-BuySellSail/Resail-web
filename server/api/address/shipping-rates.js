const log = require('../../log');
const { getIntegrationSdk, handleError, serialize } = require('../../api-util/sdk');
const { getShippoParcel } = require('../../api-util/shippingPackages');
const { getShippoAddress, isCompleteShippingAddress } = require('../../api-util/shippingAddress');
const { getShipmentMetadata } = require('../../api-util/shippingFee');
const { ShippoServices } = require('../../services');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const mapRate = rate => ({
  objectId: rate.objectId,
  provider: rate.provider,
  providerImage75: rate.providerImage75,
  servicelevelName: rate.servicelevel?.name,
  durationTerms: rate.durationTerms,
  estimatedDays: rate.estimatedDays,
  amount: rate.amount,
  currency: rate.currency,
});

/**
 * Fetch Shippo shipping rates for the given listing.
 *
 * - Ship-from address: listing's privateData.shippingAddress (read with Integration API)
 * - Ship-to address: current user's profile.privateData.shipToAddress
 * - Parcel: listing's publicData.packageLength, packageWidth, packageHeight & packageWeight
 *
 * Request body: { listingId }
 * Response: { data: { shipmentId, rates, messages } }
 */
const shippingRates = async (req, res) => {
  const { listingId: listingIdMaybe } = req.body || {};
  const listingId = listingIdMaybe?.uuid || listingIdMaybe;

  if (typeof listingId !== 'string' || !UUID_REGEX.test(listingId)) {
    return res.status(400).json({ error: 'Invalid listingId' });
  }

  try {
    const shipToAddress = req.currentUser.attributes.profile?.privateData?.shipToAddress;
    if (!isCompleteShippingAddress(shipToAddress)) {
      return res.status(400).json({ error: 'Shipping address is required' });
    }

    const listingResponse = await getIntegrationSdk().listings.show({
      id: listingId,
      include: ['author'],
    });
    const listing = listingResponse.data.data;
    const author = listingResponse.data.included?.find(i => i.type === 'user');
    const { publicData, privateData, price, state } = listing.attributes;

    if (state !== 'published' || !publicData?.shippingEnabled) {
      return res.status(400).json({ error: 'Shipping is not available for this listing' });
    }

    const shipFromAddress = privateData?.shippingAddress;
    if (!isCompleteShippingAddress(shipFromAddress)) {
      return res.status(400).json({ error: 'Listing ship-from address is missing' });
    }

    const parcel = getShippoParcel(publicData);
    if (!parcel) {
      return res.status(400).json({ error: 'Listing package details are missing' });
    }

    const shipment = await ShippoServices.shipments.create({
      addressFrom: getShippoAddress(shipFromAddress, author?.attributes?.email),
      addressTo: getShippoAddress(shipToAddress, req.email),
      parcels: [parcel],
      metadata: getShipmentMetadata(listingId),
      async: false,
    });

    const currency = price?.currency;
    const rates = (shipment.rates || [])
      .filter(rate => rate.currency === currency)
      .map(mapRate)
      .sort((a, b) => Number(a.amount) - Number(b.amount));

    return res
      .status(200)
      .set('Content-Type', 'application/transit+json')
      .send(
        serialize({
          data: {
            shipmentId: shipment.objectId,
            rates,
            messages: (shipment.messages || []).map(m => m.text).filter(Boolean),
          },
        })
      )
      .end();
  } catch (e) {
    log.error(e, 'shipping-rates-failed');
    return handleError(res, e, { skipErrorLogging: true });
  }
};

module.exports = shippingRates;
