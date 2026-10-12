const { types } = require('sharetribe-flex-sdk');

jest.mock('../services', () => ({
  ShippoServices: {
    rates: { get: jest.fn() },
    shipments: { get: jest.fn() },
  },
}));

const { ShippoServices } = require('../services');
const { resolveShippingFeeMaybe } = require('./shippingFee');

const { Money, UUID } = types;

const listingId = '00000000-0000-0000-0000-000000000001';
const listing = { id: new UUID(listingId), attributes: { publicData: {} } };
const shippingOrderData = { deliveryMethod: 'shipping', shippingRateId: 'rate-1' };

describe('shippingFee', () => {
  beforeEach(() => {
    ShippoServices.rates.get.mockReset();
    ShippoServices.shipments.get.mockReset();
  });

  it('resolves the shipping fee from Shippo rate', async () => {
    ShippoServices.rates.get.mockResolvedValue({
      amount: '8.79',
      currency: 'USD',
      shipment: 'shipment-1',
    });
    ShippoServices.shipments.get.mockResolvedValue({ metadata: `listing:${listingId}` });

    const fee = await resolveShippingFeeMaybe({
      orderData: shippingOrderData,
      listing,
      currency: 'USD',
      isSpeculative: false,
    });

    expect(ShippoServices.rates.get).toHaveBeenCalledWith('rate-1');
    expect(ShippoServices.shipments.get).toHaveBeenCalledWith('shipment-1');
    expect(fee).toEqual(new Money(879, 'USD'));
  });

  it('rejects a rate that belongs to another listing', async () => {
    ShippoServices.rates.get.mockResolvedValue({
      amount: '1.00',
      currency: 'USD',
      shipment: 'shipment-1',
    });
    ShippoServices.shipments.get.mockResolvedValue({ metadata: 'listing:another-listing' });

    await expect(
      resolveShippingFeeMaybe({
        orderData: shippingOrderData,
        listing,
        currency: 'USD',
        isSpeculative: true,
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a rate with a different currency', async () => {
    ShippoServices.rates.get.mockResolvedValue({
      amount: '8.79',
      currency: 'EUR',
      shipment: 'shipment-1',
    });
    ShippoServices.shipments.get.mockResolvedValue({ metadata: `listing:${listingId}` });

    await expect(
      resolveShippingFeeMaybe({
        orderData: shippingOrderData,
        listing,
        currency: 'USD',
        isSpeculative: true,
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('requires a rate for an actual order with shipping', async () => {
    await expect(
      resolveShippingFeeMaybe({
        orderData: { deliveryMethod: 'shipping' },
        listing,
        currency: 'USD',
        isSpeculative: false,
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('returns null for speculation without a rate and for pickup', async () => {
    const speculatedFee = await resolveShippingFeeMaybe({
      orderData: { deliveryMethod: 'shipping' },
      listing,
      currency: 'USD',
      isSpeculative: true,
    });
    const pickupFee = await resolveShippingFeeMaybe({
      orderData: { deliveryMethod: 'pickup', shippingRateId: 'rate-1' },
      listing,
      currency: 'USD',
      isSpeculative: false,
    });

    expect(speculatedFee).toBeNull();
    expect(pickupFee).toBeNull();
    expect(ShippoServices.rates.get).not.toHaveBeenCalled();
  });
});
