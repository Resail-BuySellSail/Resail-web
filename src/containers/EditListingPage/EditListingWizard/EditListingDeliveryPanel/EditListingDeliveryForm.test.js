import React from 'react';
import '@testing-library/jest-dom';

import { fakeIntl } from '../../../../util/testData';
import { renderWithProviders as render, testingLibrary } from '../../../../util/testHelpers';

import EditListingDeliveryForm from './EditListingDeliveryForm';

const { screen, userEvent } = testingLibrary;

const noop = () => null;

describe('EditListingDeliveryForm', () => {
  it('Check that ship-from address and package can be given and submit button activates', async () => {
    const user = userEvent.setup();
    const saveActionMsg = 'Save location';
    render(
      <EditListingDeliveryForm
        intl={fakeIntl}
        dispatch={noop}
        onSubmit={noop}
        saveActionMsg={saveActionMsg}
        initialValues={{ country: 'US' }}
        updated={false}
        updateInProgress={false}
        disabled={false}
        ready={false}
      />
    );

    // Pickup fields
    const address = 'EditListingDeliveryForm.address';
    expect(screen.getByText(address)).toBeInTheDocument();

    const building = 'EditListingDeliveryForm.building';
    expect(screen.getByText(building)).toBeInTheDocument();

    // Test that save button is disabled at first
    expect(screen.getByRole('button', { name: saveActionMsg })).toBeDisabled();

    // Enable shipping
    await user.click(screen.getByLabelText(/EditListingDeliveryForm.shippingLabel/i));

    // Ship-from address
    const textbox = name => screen.getByRole('textbox', { name });
    await user.type(textbox('EditListingDeliveryForm.nameLabel'), 'Jane Rider');
    await user.type(textbox('EditListingDeliveryForm.phoneLabel'), '3055550100');
    await user.type(textbox('EditListingDeliveryForm.streetLabel'), '1 Stable Lane');
    await user.type(textbox('EditListingDeliveryForm.cityLabel'), 'Wellington');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'EditListingDeliveryForm.stateLabel' }),
      'FL'
    );
    await user.type(textbox('EditListingDeliveryForm.zipLabel'), '33414');
    expect(textbox('EditListingDeliveryForm.countryLabel')).toHaveValue('US');

    // Package dimensions & weight
    const spinbutton = name => screen.getByRole('spinbutton', { name });
    await user.type(spinbutton('EditListingDeliveryForm.packageLengthLabel'), '14');
    await user.type(spinbutton('EditListingDeliveryForm.packageWidthLabel'), '11');
    await user.type(spinbutton('EditListingDeliveryForm.packageHeightLabel'), '4');

    // Still disabled until package weight is given
    expect(screen.getByRole('button', { name: saveActionMsg })).toBeDisabled();

    await user.type(spinbutton('EditListingDeliveryForm.packageWeightLabel'), '1.5');

    // Test that save button is enabled
    expect(screen.getByRole('button', { name: saveActionMsg })).toBeEnabled();
  });
});
