import {
  formatShippingAddressLine,
  getProfileShippingAddress,
  getProfileShipToAddress,
  hasCompletePackage,
  isCompleteShippingAddress,
} from './shipping';

const address = {
  name: 'Jane Rider',
  phone: '+13055550100',
  street1: '1 Stable Lane',
  streetNo: '',
  city: 'Wellington',
  state: 'FL',
  zip: '33414',
  country: 'US',
};

describe('shipping', () => {
  describe('getProfileShippingAddress', () => {
    it('returns the address from profile privateData', () => {
      const user = { attributes: { profile: { privateData: { shippingAddress: address } } } };
      expect(getProfileShippingAddress(user)).toEqual(address);
    });

    it('returns an empty object when the address is missing', () => {
      expect(getProfileShippingAddress(null)).toEqual({});
      expect(getProfileShippingAddress({ attributes: { profile: {} } })).toEqual({});
    });
  });

  describe('formatShippingAddressLine', () => {
    it('formats the address to a single line', () => {
      expect(formatShippingAddressLine(address)).toBe('1 Stable Lane, Wellington, FL 33414');
      expect(formatShippingAddressLine({ ...address, streetNo: 'Barn 2' })).toBe(
        '1 Stable Lane, Barn 2, Wellington, FL 33414'
      );
      expect(formatShippingAddressLine(undefined)).toBe('');
    });
  });

  describe('getProfileShipToAddress', () => {
    it('returns the ship-to address from profile privateData', () => {
      const user = { attributes: { profile: { privateData: { shipToAddress: address } } } };
      expect(getProfileShipToAddress(user)).toEqual(address);
      expect(getProfileShipToAddress(null)).toEqual({});
    });
  });

  describe('isCompleteShippingAddress', () => {
    it('returns true when the required fields exist', () => {
      expect(isCompleteShippingAddress(address)).toBe(true);
    });

    it('returns false when a required field is missing', () => {
      expect(isCompleteShippingAddress({ ...address, zip: '' })).toBe(false);
      expect(isCompleteShippingAddress({ ...address, phone: undefined })).toBe(false);
      expect(isCompleteShippingAddress(undefined)).toBe(false);
    });
  });

  describe('hasCompletePackage', () => {
    const pkg = { packageLength: 12, packageWidth: 10, packageHeight: 4.5, packageWeight: 1.5 };

    it('returns true when all dimensions and weight are positive numbers', () => {
      expect(hasCompletePackage(pkg)).toBe(true);
    });

    it('returns false for missing, zero or invalid values', () => {
      expect(hasCompletePackage({ ...pkg, packageHeight: undefined })).toBe(false);
      expect(hasCompletePackage({ ...pkg, packageWeight: 0 })).toBe(false);
      expect(hasCompletePackage({ ...pkg, packageWidth: 'abc' })).toBe(false);
      expect(hasCompletePackage(undefined)).toBe(false);
    });
  });
});
