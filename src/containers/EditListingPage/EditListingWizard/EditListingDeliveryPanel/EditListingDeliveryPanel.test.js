import React from 'react';
import '@testing-library/jest-dom';

import { types as sdkTypes } from '../../../../util/sdkLoader';
import { createCurrentUser, createOwnListing, fakeIntl } from '../../../../util/testData';
import { renderWithProviders as render, testingLibrary } from '../../../../util/testHelpers';

import EditListingDeliveryPanel from './EditListingDeliveryPanel';

const { Money } = sdkTypes;
const { screen, userEvent, waitFor } = testingLibrary;

const noop = () => null;

const listingTypes = [
  {
    listingType: 'sell-bicycles',
    transactionProcess: { name: 'default-purchase', alias: 'default-purchase/release-1' },
    unitType: 'item',
    defaultListingFields: { pickup: false },
  },
];

const listing = createOwnListing('listing-1', {
  title: 'Bike',
  price: new Money(5500, 'USD'),
  publicData: { listingType: 'sell-bicycles' },
});

const sellerAddress = {
  name: 'Jane Doe',
  phone: '5555550100',
  street1: '215 Clayton St',
  streetNo: '',
  city: 'San Francisco',
  state: 'CA',
  zip: '94117',
  country: 'US',
};

const renderPanel = props =>
  render(
    <EditListingDeliveryPanel
      listing={listing}
      listingTypes={listingTypes}
      marketplaceCurrency="USD"
      currentUser={createCurrentUser('user-1')}
      onSaveShippingAddress={() => Promise.resolve()}
      onManageDisableScrolling={noop}
      onSubmit={noop}
      submitButtonText="Next"
      panelUpdated={false}
      updateInProgress={false}
      disabled={false}
      ready={false}
      errors={{}}
      updatePageTitle={noop}
      intl={fakeIntl}
      {...props}
    />,
    { withPortals: true }
  );

const fillPackage = async user => {
  const spinbutton = name => screen.getByRole('spinbutton', { name });
  await user.type(spinbutton('EditListingDeliveryForm.packageLengthLabel'), '14');
  await user.type(spinbutton('EditListingDeliveryForm.packageWidthLabel'), '11');
  await user.type(spinbutton('EditListingDeliveryForm.packageHeightLabel'), '4');
  await user.type(spinbutton('EditListingDeliveryForm.packageWeightLabel'), '1.5');
};

describe('EditListingDeliveryPanel', () => {
  it('asks the seller address in a modal and then saves the listing', async () => {
    const user = userEvent.setup();
    const onSaveShippingAddress = jest.fn(() => Promise.resolve());
    const onSubmit = jest.fn();
    renderPanel({ onSaveShippingAddress, onSubmit });

    await fillPackage(user);
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // The listing is not saved before the seller address exists
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText('EditListingDeliveryPanel.sellerAddressModalTitle')
    ).toBeInTheDocument();

    const textbox = name => screen.getByRole('textbox', { name });
    await user.type(textbox('ShippingAddressForm.nameLabel'), sellerAddress.name);
    await user.type(textbox('ShippingAddressForm.phoneLabel'), sellerAddress.phone);
    await user.type(textbox('ShippingAddressForm.streetLabel'), sellerAddress.street1);
    await user.type(textbox('ShippingAddressForm.cityLabel'), sellerAddress.city);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'ShippingAddressForm.stateLabel' }),
      sellerAddress.state
    );
    await user.type(textbox('ShippingAddressForm.zipLabel'), sellerAddress.zip);
    await user.click(
      screen.getByRole('button', { name: 'EditListingDeliveryPanel.sellerAddressSaveAndContinue' })
    );

    expect(onSaveShippingAddress).toHaveBeenCalledWith({
      addressType: 'shipFrom',
      address: expect.objectContaining({
        name: 'Jane Doe',
        street1: '215 Clayton St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94117',
      }),
    });

    // The listing is saved with the values that were waiting for the address
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [updateValues] = onSubmit.mock.calls[0];
    expect(updateValues.publicData).toEqual(
      expect.objectContaining({
        shippingEnabled: true,
        packageLength: 14,
        packageWidth: 11,
        packageHeight: 4,
        packageWeight: 1.5,
      })
    );
  });

  it('keeps the listing values when the address is not valid', async () => {
    const user = userEvent.setup();
    const onSaveShippingAddress = jest.fn(() =>
      Promise.reject({ code: 'invalid-address', messages: ['Multiple addresses were found.'] })
    );
    const onSubmit = jest.fn();
    const currentUser = createCurrentUser('user-1');
    currentUser.attributes.profile.privateData = { shippingAddress: { name: 'Jane Doe' } };
    renderPanel({ onSaveShippingAddress, onSubmit, currentUser });

    await fillPackage(user);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.type(screen.getByRole('textbox', { name: 'ShippingAddressForm.phoneLabel' }), '1');
    await user.type(
      screen.getByRole('textbox', { name: 'ShippingAddressForm.streetLabel' }),
      'Stanley Blv'
    );
    await user.type(screen.getByRole('textbox', { name: 'ShippingAddressForm.cityLabel' }), 'X');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'ShippingAddressForm.stateLabel' }),
      'MI'
    );
    await user.type(screen.getByRole('textbox', { name: 'ShippingAddressForm.zipLabel' }), '48009');
    await user.click(
      screen.getByRole('button', { name: 'EditListingDeliveryPanel.sellerAddressSaveAndContinue' })
    );

    expect(await screen.findByText('Multiple addresses were found.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByRole('spinbutton', { name: 'EditListingDeliveryForm.packageLengthLabel' })
    ).toHaveValue(14);
  });
});
