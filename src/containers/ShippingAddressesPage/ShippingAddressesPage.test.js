import React from 'react';
import '@testing-library/jest-dom';

import { createCurrentUser } from '../../util/testData';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import { saveShippingAddress } from '../../util/api';

import ShippingAddressesPage from './ShippingAddressesPage';

jest.mock('../TopbarContainer/TopbarContainer', () => {
  // eslint-disable-next-line react/display-name
  return () => <div data-testid="topbar" />;
});

jest.mock('../../util/api', () => ({
  ...jest.requireActual('../../util/api'),
  saveShippingAddress: jest.fn(),
}));

const { screen, userEvent } = testingLibrary;

const shippingAddress = {
  name: 'Jane Doe',
  phone: '5555550100',
  street1: '215 Clayton St',
  streetNo: '',
  city: 'San Francisco',
  state: 'CA',
  zip: '94117',
  country: 'US',
};

const getInitialState = () => {
  const currentUser = createCurrentUser('user1');
  currentUser.attributes.profile.privateData = { shippingAddress };
  return {
    user: {
      currentUser,
      currentUserHasListings: false,
      sendVerificationEmailInProgress: false,
    },
  };
};

describe('ShippingAddressesPage', () => {
  it('shows the saved ship-from address and switches to the ship-to tab', async () => {
    const user = userEvent.setup();
    render(<ShippingAddressesPage />, { initialState: getInitialState() });

    expect(screen.getByText('ShippingAddressesPage.shipFromHelper')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'ShippingAddressForm.streetLabel' })).toHaveValue(
      '215 Clayton St'
    );

    await user.click(screen.getByRole('button', { name: 'ShippingAddressesPage.shipToTabTitle' }));

    expect(screen.getByText('ShippingAddressesPage.shipToHelper')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'ShippingAddressForm.streetLabel' })).toHaveValue(
      ''
    );
  });

  it('shows Shippo validation messages when the address is invalid', async () => {
    const user = userEvent.setup();
    const error = new Error();
    error.code = 'invalid-address';
    error.messages = ['Multiple addresses were found, and there is no default match.'];
    saveShippingAddress.mockRejectedValueOnce(error);

    render(<ShippingAddressesPage />, { initialState: getInitialState() });

    await user.click(screen.getByRole('button', { name: 'ShippingAddressesPage.saveAddress' }));

    expect(saveShippingAddress).toHaveBeenCalledWith({
      addressType: 'shipFrom',
      address: { ...shippingAddress },
    });
    expect(await screen.findByText('ShippingAddressForm.invalidAddress')).toBeInTheDocument();
    expect(
      screen.getByText('Multiple addresses were found, and there is no default match.')
    ).toBeInTheDocument();
  });
});
