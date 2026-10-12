jest.mock('../../services', () => ({
  ShippoServices: { addresses: { validate: jest.fn() } },
}));
jest.mock('../../api-util/sdk', () => ({
  ...jest.requireActual('../../api-util/sdk'),
  getSdk: jest.fn(),
}));
jest.mock('../../log', () => ({ error: jest.fn() }));

const { ShippoServices } = require('../../services');
const { getSdk } = require('../../api-util/sdk');
const saveAddress = require('./save-address');

const address = {
  name: 'Jane Doe',
  phone: '5555550100',
  street1: '215 clayton street',
  streetNo: '',
  city: 'san francisco',
  state: 'CA',
  zip: '94117',
};

const createRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.set = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.end = jest.fn(() => res);
  return res;
};

describe('save-address', () => {
  const updateProfile = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    getSdk.mockReturnValue({ currentUser: { updateProfile } });
  });

  it('rejects unknown address types', async () => {
    const res = createRes();
    await saveAddress({ body: { addressType: 'other', address } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(ShippoServices.addresses.validate).not.toHaveBeenCalled();
  });

  it('does not save the address if Shippo can not validate it', async () => {
    ShippoServices.addresses.validate.mockResolvedValue({
      validationResults: {
        isValid: false,
        messages: [{ text: 'Multiple addresses were found.' }],
      },
    });
    const res = createRes();
    await saveAddress({ body: { addressType: 'shipTo', address } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      code: 'invalid-address',
      messages: ['Multiple addresses were found.'],
    });
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('saves the normalized address to the matching privateData key', async () => {
    ShippoServices.addresses.validate.mockResolvedValue({
      street1: '215 Clayton St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94117-1913',
      validationResults: { isValid: true, messages: [] },
    });
    updateProfile.mockResolvedValue({ status: 200, statusText: 'OK', data: { data: {} } });
    const res = createRes();
    await saveAddress({ body: { addressType: 'shipFrom', address } }, res);

    expect(updateProfile).toHaveBeenCalledWith(
      {
        privateData: {
          shippingAddress: {
            ...address,
            street1: '215 Clayton St',
            city: 'San Francisco',
            zip: '94117-1913',
            country: 'US',
          },
        },
      },
      { expand: true, include: ['profileImage'] }
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
