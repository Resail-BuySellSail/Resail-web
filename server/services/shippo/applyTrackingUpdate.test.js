jest.mock('../../api-util/sdk', () => ({ getIntegrationSdk: jest.fn() }));
jest.mock('../transactions/updateMetadata', () => jest.fn(() => Promise.resolve()));
jest.mock('../../log', () => ({ error: jest.fn() }));

const { getIntegrationSdk } = require('../../api-util/sdk');
const updateTransactionMetadata = require('../transactions/updateMetadata');
const applyTrackingUpdate = require('./applyTrackingUpdate');

const transactionId = '6acc714b-ce0d-4cd3-a143-f450eecf05f5';
const trackingNumber = '9205590164917312751089';

const trackWithStatus = status => ({
  carrier: 'usps',
  trackingNumber,
  trackingStatus: { status, statusDetails: status },
  trackingHistory: [{ status, statusDetails: status }],
});

describe('applyTrackingUpdate', () => {
  const show = jest.fn();
  const transition = jest.fn();

  const mockTransaction = (state, metadata = { shippingDetails: { trackingNumber } }) =>
    show.mockResolvedValue({ data: { data: { attributes: { state, metadata } } } });

  beforeEach(() => {
    jest.clearAllMocks();
    getIntegrationSdk.mockReturnValue({ transactions: { show, transition } });
    transition.mockResolvedValue({});
  });

  it('marks the order shipped when the carrier has the parcel', async () => {
    mockTransaction('state/purchased');
    const result = await applyTrackingUpdate({ transactionId, track: trackWithStatus('TRANSIT') });

    expect(transition).toHaveBeenCalledWith({
      id: transactionId,
      transition: 'transition/operator-mark-delivered',
      params: {},
    });
    expect(result).toEqual({ status: 'TRANSIT', markedShipped: true });
    const [, metadata] = updateTransactionMetadata.mock.calls[0];
    expect(metadata.shippingTracking.status).toBe('TRANSIT');
    expect(metadata.shippingTracking.autoMarkedShippedAt).toBe(metadata.shippingTracking.updatedAt);
  });

  it('only saves the tracking when the provider has marked it shipped already', async () => {
    mockTransaction('state/delivered');
    const result = await applyTrackingUpdate({
      transactionId,
      track: trackWithStatus('DELIVERED'),
    });

    expect(transition).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'DELIVERED', markedShipped: false });
    expect(updateTransactionMetadata).toHaveBeenCalled();
  });

  it('does not mark the order shipped before the carrier has the parcel', async () => {
    mockTransaction('state/purchased');
    await applyTrackingUpdate({ transactionId, track: trackWithStatus('PRE_TRANSIT') });

    expect(transition).not.toHaveBeenCalled();
    expect(updateTransactionMetadata).toHaveBeenCalled();
  });

  it('ignores updates of other tracking numbers', async () => {
    mockTransaction('state/purchased', { shippingDetails: { trackingNumber: 'OTHER' } });
    const result = await applyTrackingUpdate({ transactionId, track: trackWithStatus('TRANSIT') });

    expect(result).toEqual({ skipped: 'tracking-number-mismatch' });
    expect(transition).not.toHaveBeenCalled();
    expect(updateTransactionMetadata).not.toHaveBeenCalled();
  });

  it('saves the tracking if the provider marked it shipped at the same time', async () => {
    mockTransaction('state/purchased');
    transition.mockRejectedValue({ status: 409 });
    const result = await applyTrackingUpdate({ transactionId, track: trackWithStatus('TRANSIT') });

    expect(result).toEqual({ status: 'TRANSIT', markedShipped: false });
    const [, metadata] = updateTransactionMetadata.mock.calls[0];
    expect(metadata.shippingTracking.autoMarkedShippedAt).toBeNull();
  });
});
