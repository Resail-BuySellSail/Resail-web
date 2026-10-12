const { getShippoParcel } = require('./shippingPackages');

describe('shippingPackages', () => {
  describe('getShippoParcel', () => {
    const pkg = { packageLength: 22, packageWidth: 14, packageHeight: 6.5, packageWeight: 3.2 };

    it('maps the listing dimensions and weight to a Shippo parcel', () => {
      expect(getShippoParcel(pkg)).toEqual({
        length: '22',
        width: '14',
        height: '6.5',
        distanceUnit: 'in',
        weight: '3.2',
        massUnit: 'lb',
      });
    });

    it('returns null if some value is missing or invalid', () => {
      expect(getShippoParcel({ ...pkg, packageWeight: undefined })).toBeNull();
      expect(getShippoParcel({ ...pkg, packageHeight: 0 })).toBeNull();
      expect(getShippoParcel({ ...pkg, packageWidth: 'abc' })).toBeNull();
      expect(getShippoParcel(undefined)).toBeNull();
    });
  });
});
