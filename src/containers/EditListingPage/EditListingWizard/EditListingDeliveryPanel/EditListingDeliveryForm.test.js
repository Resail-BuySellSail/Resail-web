import React from 'react';
import '@testing-library/jest-dom';

import { fakeIntl } from '../../../../util/testData';
import { renderWithProviders as render, testingLibrary } from '../../../../util/testHelpers';

import EditListingDeliveryForm from './EditListingDeliveryForm';

const { screen, userEvent } = testingLibrary;

const noop = () => null;

const shipFromAddress = {
  name: 'Jane Doe',
  phone: '5555550100',
  street1: '215 Clayton St',
  streetNo: '',
  city: 'San Francisco',
  state: 'CA',
  zip: '94117',
  country: 'US',
};

const renderForm = props =>
  render(
    <EditListingDeliveryForm
      intl={fakeIntl}
      dispatch={noop}
      onSubmit={noop}
      saveActionMsg="Save location"
      initialValues={{}}
      updated={false}
      updateInProgress={false}
      disabled={false}
      ready={false}
      {...props}
    />
  );

const fillPackage = async user => {
  const spinbutton = name => screen.getByRole('spinbutton', { name });
  await user.type(spinbutton('EditListingDeliveryForm.packageLengthLabel'), '14');
  await user.type(spinbutton('EditListingDeliveryForm.packageWidthLabel'), '11');
  await user.type(spinbutton('EditListingDeliveryForm.packageHeightLabel'), '4');
  await user.type(spinbutton('EditListingDeliveryForm.packageWeightLabel'), '1.5');
};

describe('EditListingDeliveryForm', () => {
  it('shows the ship-from address from profile and activates submit when package is given', async () => {
    const user = userEvent.setup();
    const saveActionMsg = 'Save location';
    renderForm({ shipFromAddress });

    // Pickup fields
    expect(screen.getByText('EditListingDeliveryForm.address')).toBeInTheDocument();
    expect(screen.getByText('EditListingDeliveryForm.building')).toBeInTheDocument();

    // Test that save button is disabled at first
    expect(screen.getByRole('button', { name: saveActionMsg })).toBeDisabled();

    // Enable shipping
    await user.click(screen.getByLabelText(/EditListingDeliveryForm.shippingLabel/i));

    // Ship-from address is shown, but it can't be edited here
    expect(screen.getByText('215 Clayton St, San Francisco, CA 94117')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /nameLabel/ })).not.toBeInTheDocument();

    // Still disabled until package dimensions and weight are given
    expect(screen.getByRole('button', { name: saveActionMsg })).toBeDisabled();

    await fillPackage(user);

    // Test that save button is enabled
    expect(screen.getByRole('button', { name: saveActionMsg })).toBeEnabled();
  });

  it('keeps submit disabled when shipping is enabled without a ship-from address', async () => {
    const user = userEvent.setup();
    const saveActionMsg = 'Save location';
    renderForm({ shipFromAddress: {} });

    await user.click(screen.getByLabelText(/EditListingDeliveryForm.shippingLabel/i));
    expect(screen.getByText('EditListingDeliveryForm.shipFromMissing')).toBeInTheDocument();

    await fillPackage(user);
    expect(screen.getByRole('button', { name: saveActionMsg })).toBeDisabled();
  });
});
