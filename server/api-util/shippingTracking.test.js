const {
  MAX_TRACKING_HISTORY_EVENTS,
  buildShippingTracking,
  getTrackingFromWebhook,
  isShippedTrackingStatus,
  parseSharetribeTransactionId,
} = require('./shippingTracking');

const transitStatus = {
  status: 'TRANSIT',
  statusDetails: 'Your shipment has departed from the origin.',
  statusDate: new Date('2026-10-09T13:42:47.713Z'),
  substatus: { code: 'package_departed', text: 'Package departed', actionRequired: false },
  location: { city: 'San Francisco', state: 'CA', zip: '94103', country: 'US' },
};

const track = {
  carrier: 'usps',
  trackingNumber: '9205590164917312751089',
  eta: new Date('2026-10-12T05:40:07.887Z'),
  trackingStatus: transitStatus,
  trackingHistory: [
    {
      status: 'PRE_TRANSIT',
      statusDetails: 'Label created.',
      statusDate: new Date('2026-10-08T09:42:47.713Z'),
    },
    transitStatus,
  ],
};

describe('shippingTracking', () => {
  it('parses the Sharetribe transaction id from Shippo metadata', () => {
    expect(
      parseSharetribeTransactionId(
        'Sharetribe Transaction ID #6ACC714B-ce0d-4cd3-a143-f450eecf05f5'
      )
    ).toBe('6acc714b-ce0d-4cd3-a143-f450eecf05f5');
    expect(parseSharetribeTransactionId('Shippo test tracking')).toBeNull();
    expect(parseSharetribeTransactionId(undefined)).toBeNull();
  });

  it('reads the tracking number and carrier from the webhook body', () => {
    const body = { event: 'track_updated', data: { tracking_number: 'TN1', carrier: 'usps' } };
    expect(getTrackingFromWebhook(body)).toEqual({ trackingNumber: 'TN1', carrier: 'usps' });
    expect(getTrackingFromWebhook({})).toEqual({ trackingNumber: null, carrier: null });
  });

  it('treats only in transit and delivered as shipped', () => {
    expect(isShippedTrackingStatus('TRANSIT')).toBe(true);
    expect(isShippedTrackingStatus('DELIVERED')).toBe(true);
    expect(isShippedTrackingStatus('PRE_TRANSIT')).toBe(false);
    expect(isShippedTrackingStatus('UNKNOWN')).toBe(false);
  });

  it('builds the tracking metadata with the latest status and history', () => {
    const now = new Date('2026-10-12T10:00:00.000Z');
    const previous = { autoMarkedShippedAt: '2026-10-10T10:00:00.000Z' };

    expect(buildShippingTracking(track, previous, now)).toEqual({
      carrier: 'usps',
      trackingNumber: '9205590164917312751089',
      status: 'TRANSIT',
      substatus: { code: 'package_departed', text: 'Package departed', actionRequired: false },
      statusDetails: 'Your shipment has departed from the origin.',
      statusDate: '2026-10-09T13:42:47.713Z',
      location: { city: 'San Francisco', state: 'CA', zip: '94103', country: 'US' },
      eta: '2026-10-12T05:40:07.887Z',
      history: [
        {
          status: 'PRE_TRANSIT',
          substatus: null,
          statusDetails: 'Label created.',
          statusDate: '2026-10-08T09:42:47.713Z',
          location: null,
        },
        {
          status: 'TRANSIT',
          substatus: { code: 'package_departed', text: 'Package departed', actionRequired: false },
          statusDetails: 'Your shipment has departed from the origin.',
          statusDate: '2026-10-09T13:42:47.713Z',
          location: { city: 'San Francisco', state: 'CA', zip: '94103', country: 'US' },
        },
      ],
      autoMarkedShippedAt: '2026-10-10T10:00:00.000Z',
      updatedAt: '2026-10-12T10:00:00.000Z',
    });
  });

  it('keeps only the latest history events', () => {
    const trackingHistory = Array.from({ length: MAX_TRACKING_HISTORY_EVENTS + 5 }, (_, i) => ({
      status: 'TRANSIT',
      statusDetails: `Event ${i}`,
    }));
    const { history } = buildShippingTracking({ ...track, trackingHistory });
    expect(history).toHaveLength(MAX_TRACKING_HISTORY_EVENTS);
    expect(history[history.length - 1].statusDetails).toBe(
      `Event ${MAX_TRACKING_HISTORY_EVENTS + 4}`
    );
  });
});
