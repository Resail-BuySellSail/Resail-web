import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../../util/testHelpers';

import DeliveryInfoMaybe from './DeliveryInfoMaybe';

const { screen, userEvent } = testingLibrary;

const protectedData = {
  deliveryMethod: 'shipping',
  shippingDetails: {
    name: 'Jane Doe',
    address: {
      line1: '1600 Pennsylvania Ave NW',
      city: 'Washington',
      postalCode: '20500',
      state: 'DC',
      country: 'US',
    },
  },
};

const shippingLabelDetails = {
  trackingNumber: '9205590164917312751089',
  trackingUrl: 'https://tools.usps.com/track',
  labelUrl: 'https://deliver.goshippo.com/label.pdf',
  qrCodeUrl: 'https://deliver.goshippo.com/qr_code.png',
};

const renderDeliveryInfo = props =>
  render(
    <DeliveryInfoMaybe
      protectedData={protectedData}
      locale="en"
      shippingLabelDetails={shippingLabelDetails}
      transactionId={{ uuid: 'tx-1' }}
      onManageDisableScrolling={() => null}
      {...props}
    />,
    { withPortals: true }
  );

describe('DeliveryInfoMaybe', () => {
  it('shows the shipping label QR code in a modal for the provider', async () => {
    const user = userEvent.setup();
    renderDeliveryInfo({ isProvider: true });

    expect(screen.queryByRole('img', { name: 'TransactionPanel.qrCodeImageAlt' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'TransactionPanel.showQrCode' }));

    expect(screen.getByText('TransactionPanel.qrCodeModalTitle')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'TransactionPanel.qrCodeImageAlt' })).toHaveAttribute(
      'src',
      shippingLabelDetails.qrCodeUrl
    );
  });

  it('does not show the QR code to the customer or when the carrier has no QR code', () => {
    const { unmount } = renderDeliveryInfo({ isProvider: false });
    expect(screen.queryByText('TransactionPanel.showQrCode')).toBeNull();
    unmount();

    renderDeliveryInfo({
      isProvider: true,
      shippingLabelDetails: { ...shippingLabelDetails, qrCodeUrl: null },
    });
    expect(screen.getByText('TransactionPanel.labelUrl')).toBeInTheDocument();
    expect(screen.queryByText('TransactionPanel.showQrCode')).toBeNull();
  });
});
