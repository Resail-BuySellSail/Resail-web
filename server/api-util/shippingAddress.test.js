const {
  getAddressValidationMessages,
  getShippoAddress,
  getValidatedShippingAddress,
  isCompleteShippingAddress,
  pickShippingAddress,
} = require('./shippingAddress');

const address = {
  name: 'Jane Rider',
  phone: '3055550100',
  street1: '1 Stable Lane',
  streetNo: 'Barn 2',
  city: 'Wellington',
  state: 'FL',
  zip: '33414',
  country: 'US',
};

describe('shippingAddress', () => {
  it('maps the saved address to Shippo address', () => {
    expect(getShippoAddress(address, 'jane@example.com')).toEqual({
      name: 'Jane Rider',
      phone: '3055550100',
      street1: '1 Stable Lane',
      street2: 'Barn 2',
      city: 'Wellington',
      state: 'FL',
      zip: '33414',
      country: 'US',
      email: 'jane@example.com',
    });
  });

  it('checks that the US address is complete', () => {
    expect(isCompleteShippingAddress(address)).toBe(true);
    expect(isCompleteShippingAddress({ ...address, zip: '' })).toBe(false);
    expect(isCompleteShippingAddress({ ...address, country: 'CA' })).toBe(false);
    expect(isCompleteShippingAddress(undefined)).toBe(false);
  });

  it('picks and trims the known address fields', () => {
    expect(
      pickShippingAddress({ ...address, name: '  Jane Rider ', country: 'CA', extra: 'x' })
    ).toEqual({ ...address, country: 'US' });
  });

  it('uses the normalized address from Shippo but keeps name and phone', () => {
    const shippoAddress = {
      name: 'JANE RIDER',
      phone: '+1 305 555 0100',
      street1: '1 STABLE LN',
      street2: 'BARN 2',
      city: 'WELLINGTON',
      state: 'FL',
      zip: '33414-1234',
    };
    expect(getValidatedShippingAddress(address, shippoAddress)).toEqual({
      name: 'Jane Rider',
      phone: '3055550100',
      street1: '1 STABLE LN',
      streetNo: 'BARN 2',
      city: 'WELLINGTON',
      state: 'FL',
      zip: '33414-1234',
      country: 'US',
    });
  });

  it('returns Shippo validation messages', () => {
    const shippoAddress = {
      validationResults: {
        isValid: false,
        messages: [{ code: 'Ambiguous Address', text: 'Multiple addresses were found.' }],
      },
    };
    expect(getAddressValidationMessages(shippoAddress)).toEqual(['Multiple addresses were found.']);
    expect(getAddressValidationMessages({})).toEqual([]);
  });
});
