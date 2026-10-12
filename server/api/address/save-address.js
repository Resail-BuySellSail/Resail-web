const log = require('../../log');
const { getSdk, handleError, serialize } = require('../../api-util/sdk');
const {
  SHIPPING_ADDRESS_KEYS,
  getAddressValidationMessages,
  getShippoAddress,
  getValidatedShippingAddress,
  isCompleteShippingAddress,
  pickShippingAddress,
} = require('../../api-util/shippingAddress');
const { ShippoServices } = require('../../services');

// Note: keep in sync with INVALID_ADDRESS_ERROR_CODE in src/util/shipping.js
const INVALID_ADDRESS_ERROR_CODE = 'invalid-address';

/**
 * Validate the shipping address with Shippo and save it to current user's profile.privateData.
 * The address is saved only if Shippo considers it valid. The normalized address is saved.
 *
 * - addressType 'shipFrom' => profile.privateData.shippingAddress
 * - addressType 'shipTo' => profile.privateData.shipToAddress
 *
 * Request body: { addressType, address: { name, phone, street1, streetNo, city, state, zip } }
 * Response: Marketplace API response of currentUser.updateProfile (incl. the current user)
 * Errors: 400 { code: 'invalid-address', messages } if Shippo can't validate the address
 */
const saveAddress = async (req, res) => {
  const { addressType, address: addressMaybe } = req.body || {};
  const privateDataKey = SHIPPING_ADDRESS_KEYS[addressType];

  if (!privateDataKey) {
    return res.status(400).json({ error: 'Invalid addressType' });
  }

  const address = pickShippingAddress(addressMaybe);
  if (!isCompleteShippingAddress(address)) {
    return res.status(400).json({ error: 'Shipping address is incomplete' });
  }

  try {
    const shippoAddress = await ShippoServices.addresses.validate(getShippoAddress(address));

    if (!shippoAddress?.validationResults?.isValid) {
      return res.status(400).json({
        code: INVALID_ADDRESS_ERROR_CODE,
        messages: getAddressValidationMessages(shippoAddress),
      });
    }

    const validatedAddress = getValidatedShippingAddress(address, shippoAddress);
    const response = await getSdk(req, res).currentUser.updateProfile(
      { privateData: { [privateDataKey]: validatedAddress } },
      { expand: true, include: ['profileImage'] }
    );

    const { status, statusText, data } = response;
    return res
      .status(status)
      .set('Content-Type', 'application/transit+json')
      .send(serialize({ status, statusText, data }))
      .end();
  } catch (e) {
    log.error(e, 'save-shipping-address-failed', { addressType });
    return handleError(res, e, { skipErrorLogging: true });
  }
};

module.exports = saveAddress;
