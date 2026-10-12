jest.mock('../../config', () => ({ shippo: { webhookToken: 'secret-token' } }));
jest.mock('../../services', () => ({
  ShippoServices: { tracks: { get: jest.fn() }, transactions: { get: jest.fn() } },
}));
jest.mock('../../services/shippo/applyTrackingUpdate', () => jest.fn());
jest.mock('../../log', () => ({ error: jest.fn() }));

const { ShippoServices } = require('../../services');
const applyTrackingUpdate = require('../../services/shippo/applyTrackingUpdate');
const shippoWebhook = require('./shippo');

const transactionId = '6acc714b-ce0d-4cd3-a143-f450eecf05f5';
const body = {
  event: 'track_updated',
  test: false,
  data: { tracking_number: 'TN1', carrier: 'usps', tracking_status: { status: 'TRANSIT' } },
};

const createRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('Shippo webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects requests without the secret token', async () => {
    const res = createRes();
    await shippoWebhook({ query: { token: 'wrong' }, body }, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(ShippoServices.tracks.get).not.toHaveBeenCalled();
  });

  it('ignores other events', async () => {
    const res = createRes();
    await shippoWebhook(
      { query: { token: 'secret-token' }, body: { ...body, event: 'transaction_created' } },
      res
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(ShippoServices.tracks.get).not.toHaveBeenCalled();
  });

  it('fetches the tracking status from Shippo and applies it to the transaction', async () => {
    const track = { trackingNumber: 'TN1', carrier: 'usps', transaction: 'shippo-tx-1' };
    ShippoServices.tracks.get.mockResolvedValue(track);
    ShippoServices.transactions.get.mockResolvedValue({
      metadata: `Sharetribe Transaction ID #${transactionId}`,
    });
    applyTrackingUpdate.mockResolvedValue({ status: 'TRANSIT', markedShipped: true });

    const res = createRes();
    await shippoWebhook({ query: { token: 'secret-token' }, body }, res);

    expect(ShippoServices.tracks.get).toHaveBeenCalledWith('TN1', 'usps');
    expect(applyTrackingUpdate).toHaveBeenCalledWith({ transactionId, track });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('ignores shipments that are not from this marketplace', async () => {
    ShippoServices.tracks.get.mockResolvedValue({ trackingNumber: 'TN1', metadata: 'Other' });
    const res = createRes();
    await shippoWebhook({ query: { token: 'secret-token' }, body }, res);

    expect(applyTrackingUpdate).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ignored: 'unknown-shipment' });
  });

  it('returns 500 so that Shippo retries when the update fails', async () => {
    ShippoServices.tracks.get.mockRejectedValue(new Error('Shippo is down'));
    const res = createRes();
    await shippoWebhook({ query: { token: 'secret-token' }, body }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
