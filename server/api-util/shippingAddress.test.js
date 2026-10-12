const { getShippoAddress, isCompleteShippingAddress } = require('./shippingAddress');

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
});
