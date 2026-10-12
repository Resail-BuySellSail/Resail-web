import React from 'react';
import '@testing-library/jest-dom';
import Decimal from 'decimal.js';

import { types as sdkTypes } from '../../util/sdkLoader';
import {
  createCurrentUser,
  createImage,
  createListing,
  createTransaction,
  createUser,
  fakeIntl,
} from '../../util/testData';
import {
  renderWithProviders as render,
  testingLibrary,
  getDefaultConfiguration,
} from '../../util/testHelpers';

import CheckoutPageWithPayment from './CheckoutPageWithPayment';
import CheckoutPageWithInquiryProcess from './CheckoutPageWithInquiryProcess';
import checkoutPageReducer, { setInitialValues } from './CheckoutPage.duck';

const { Money } = sdkTypes;
const { screen, userEvent } = testingLibrary;
const noop = () => null;

const routeConfiguration = [
  {
    path: '/',
    name: 'LandingPage',
    component: props => <div />,
  },
  {
    path: '/about',
    name: 'AboutPage',
    component: props => <div />,
  },
];

describe('CheckoutPage', () => {
  beforeEach(() => {
    // This is not defined by default on test env. AuthenticationPage needs it.
    window.matchMedia = jest.fn(() => ({
      matches: true,
      addEventListener: noop,
      removeEventListener: noop,
    }));

    window.Stripe = jest.fn(() => ({
      elements: () => ({
        create: () => ({
          mount: noop,
          unmount: noop,
          update: noop,
          addEventListener: noop,
          removeEventListener: noop,
        }),
      }),
    }));
  });

  afterAll(() => {
    // Remove window.scrollTo
    jest.clearAllMocks();
  });

  const lineItems = [
    {
      code: 'line-item/item',
      includeFor: ['customer', 'provider'],
      quantity: new Decimal(2),
      unitPrice: new Money(1000, 'USD'),
      lineTotal: new Money(2000, 'USD'),
      reversal: false,
    },
    {
      code: 'line-item/provider-commission',
      includeFor: ['provider'],
      unitPrice: new Money(-100, 'USD'),
      lineTotal: new Money(-100, 'USD'),
      reversal: false,
    },
  ];
  const commonProps = {
    dispatch: noop,
    history: { push: noop, action: 'PUSH' },
    intl: fakeIntl,
    currentUser: createCurrentUser('currentUser'),
    params: { id: 'listing1', slug: 'listing1' },
    sendOrderRequest: noop,
    fetchStripeCustomer: noop,
    stripeCustomerFetched: true,
    fetchSpeculatedTransaction: noop,
    speculateTransactionInProgress: false,
    scrollingDisabled: false,
    onConfirmPayment: noop,
    onConfirmCardPayment: noop,
    onInitiateOrder: noop,
    onRetrievePaymentIntent: noop,
    onSavePaymentMethod: noop,
    confirmCardPaymentInProgress: false,
    config: getDefaultConfiguration(),
    routeConfiguration,
  };

  const purchaseListing = createListing(
    'listing1',
    { publicData: { transactionProcessAlias: 'default-purchase/release-1', unitType: 'item' } },
    { author: createUser('author'), images: [createImage('first-image')] }
  );

  const shippingFeeLineItem = [
    {
      code: 'line-item/shipping-fee',
      includeFor: ['customer'],
      unitPrice: new Money(500, 'USD'),
      quantity: new Decimal(1),
      lineTotal: new Money(500, 'USD'),
      reversal: false,
    },
  ];

  const shipToAddress = {
    name: 'Jane Rider',
    phone: '3055550100',
    street1: '1 Stable Lane',
    streetNo: '',
    city: 'Wellington',
    state: 'FL',
    zip: '33414',
    country: 'US',
  };

  const purchaseProps = {
    ...commonProps,
    pageData: {
      orderData: { quantity: 2, deliveryMethod: 'shipping' },
      listing: purchaseListing,
    },
    processName: 'default-purchase',
    listingTitle: purchaseListing.attributes.title,
    title: 'CheckoutPage.default-purchase.title',
    speculatedTransaction: createTransaction({
      id: 'tx1',
      lineItems: lineItems.concat(shippingFeeLineItem),
      total: new Money(2500, 'USD'),
    }),
    onUpdateProfile: () => Promise.resolve(),
    onFetchShippingRates: noop,
    shipment: null,
    fetchShippingRatesInProgress: false,
    fetchShippingRatesError: null,
  };

  it('Check that purchase has relevant info', () => {
    render(<CheckoutPageWithPayment {...purchaseProps} />);

    const purchaseTitle = 'CheckoutPage.default-purchase.title';
    expect(screen.getByRole('heading', { name: purchaseTitle })).toBeInTheDocument();
    const orderBreakdownTitle = 'CheckoutPage.default-purchase.orderBreakdown';
    expect(screen.getByRole('heading', { name: orderBreakdownTitle })).toBeInTheDocument();
    // These are rendered twice (mobile & desktop)
    expect(screen.getAllByText('OrderBreakdown.baseUnitQuantity')).toHaveLength(2);
    expect(screen.getAllByText('OrderBreakdown.shippingFee')).toHaveLength(2);
    expect(screen.getAllByText('OrderBreakdown.total')).toHaveLength(2);

    const getTextbox = name => screen.getByRole('textbox', { name });

    // Step 1: ship-to address (no saved address)
    const shippingHeading = 'CheckoutPage.shippingAddressHeading';
    expect(screen.getByRole('heading', { name: shippingHeading })).toBeInTheDocument();
    expect(getTextbox('ShippingAddressForm.nameLabel')).toBeInTheDocument();
    expect(getTextbox('ShippingAddressForm.phoneLabel')).toBeInTheDocument();
    expect(getTextbox('ShippingAddressForm.streetLabel')).toBeInTheDocument();
    expect(getTextbox('ShippingAddressForm.aptLabel')).toBeInTheDocument();
    expect(getTextbox('ShippingAddressForm.cityLabel')).toBeInTheDocument();
    expect(getTextbox('ShippingAddressForm.zipLabel')).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'ShippingAddressForm.stateLabel' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'CheckoutPage.saveShippingAddress' })
    ).toBeInTheDocument();

    // Payment form is shown on the last step
    expect(
      screen.queryByRole('heading', { name: 'StripePaymentForm.paymentHeading' })
    ).not.toBeInTheDocument();
  });

  it('Check that purchase with saved ship-to address shows rates and then payment', async () => {
    const user = userEvent.setup();
    const fetchSpeculatedTransaction = jest.fn();
    const onFetchShippingRates = jest.fn();
    const rate = {
      objectId: 'rate-1',
      provider: 'USPS',
      servicelevelName: 'Priority Mail',
      durationTerms: 'Delivery within 1, 2, or 3 days.',
      amount: '8.79',
      currency: 'USD',
    };
    const props = {
      ...purchaseProps,
      currentUser: createCurrentUser('currentUser', {
        profile: { firstName: 'Jane', lastName: 'Rider', privateData: { shipToAddress } },
      }),
      fetchSpeculatedTransaction,
      onFetchShippingRates,
      shipment: { shipmentId: 'shipment-1', rates: [rate], messages: [] },
    };

    render(<CheckoutPageWithPayment {...props} />);

    // Step 2: shipping method
    expect(onFetchShippingRates).toHaveBeenCalledWith(purchaseListing.id);
    const shippingMethodHeading = 'CheckoutPage.shippingMethodHeading';
    expect(screen.getByRole('heading', { name: shippingMethodHeading })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /USPS/ }));

    // Transaction is speculated again with the selected rate
    expect(fetchSpeculatedTransaction).toHaveBeenCalled();
    const [orderParams] = fetchSpeculatedTransaction.mock.calls[0];
    expect(orderParams.shippingRateId).toEqual('rate-1');
    expect(orderParams.protectedData.shipmentId).toEqual('shipment-1');

    // Step 3: payment
    expect(screen.getByRole('heading', { name: 'CheckoutPage.shipToHeading' })).toBeInTheDocument();
    const paymentHeading = 'StripePaymentForm.paymentHeading';
    expect(screen.getByRole('heading', { name: paymentHeading })).toBeInTheDocument();
    const billingDetails = 'StripePaymentForm.billingDetails';
    expect(screen.getByRole('heading', { name: billingDetails })).toBeInTheDocument();
    // Billing address is prefilled with the ship-to address
    expect(
      screen.getByRole('textbox', { name: 'StripePaymentAddress.addressLine1Label' })
    ).toHaveValue('1 Stable Lane');
    expect(
      screen.getByRole('textbox', { name: 'StripePaymentForm.messageLabel' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'StripePaymentForm.submitPaymentInfo' })
    ).toBeInTheDocument();
  });

  it('Check that booking has relevant info', () => {
    const listing = createListing(
      'listing1',
      { publicData: { transactionProcessAlias: 'default-booking/release-1', unitType: 'day' } },
      { author: createUser('author'), images: [createImage('first-image')] }
    );

    const props = {
      ...commonProps,
      pageData: {
        orderData: { quantity: 2 },
        listing,
      },
      processName: 'default-booking',
      listingTitle: listing.attributes.title,
      title: 'CheckoutPage.default-booking.title',
      speculatedTransaction: createTransaction({
        id: 'tx1',
        lineItems,
        total: new Money(2500, 'USD'),
      }),
    };
    render(<CheckoutPageWithPayment {...props} />);

    const bookingTitle = 'CheckoutPage.default-booking.title';
    expect(screen.getByRole('heading', { name: bookingTitle })).toBeInTheDocument();
    const orderBreakdownTitle = 'CheckoutPage.default-booking.orderBreakdown';
    expect(screen.getByRole('heading', { name: orderBreakdownTitle })).toBeInTheDocument();

    // These are rendered twice (mobile & desktop)
    expect(screen.getAllByText('OrderBreakdown.baseUnitQuantity')).toHaveLength(2);
    expect(screen.queryAllByText('OrderBreakdown.shippingFee')).toHaveLength(0);
    expect(screen.getAllByText('OrderBreakdown.total')).toHaveLength(2);

    const getTextbox = name => screen.getByRole('textbox', { name });

    const paymentHeading = 'StripePaymentForm.paymentHeading';
    expect(screen.getByRole('heading', { name: paymentHeading })).toBeInTheDocument();

    const billingDetails = 'StripePaymentForm.billingDetails';
    expect(screen.getByRole('heading', { name: billingDetails })).toBeInTheDocument();
    expect(getTextbox('StripePaymentForm.billingDetailsNameLabel')).toBeInTheDocument();
    expect(getTextbox('StripePaymentAddress.addressLine1Label')).toBeInTheDocument();
    expect(getTextbox('StripePaymentAddress.addressLine2Label')).toBeInTheDocument();
    expect(getTextbox('StripePaymentAddress.postalCodeLabel')).toBeInTheDocument();
    expect(getTextbox('StripePaymentAddress.cityLabel')).toBeInTheDocument();
    expect(getTextbox('StripePaymentAddress.stateLabel')).toBeInTheDocument();
    expect(getTextbox('StripePaymentForm.messageLabel')).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: 'StripePaymentForm.submitPaymentInfo' })
    ).toBeInTheDocument();
  });

  it('Check that inquiry process has relevant info', () => {
    const listing = createListing(
      'listing1',
      {
        publicData: {
          listingType: 'inquiry',
          transactionProcessAlias: 'default-inquiry/release-1',
          unitType: 'inquiry',
        },
      },
      { author: createUser('author'), images: [createImage('first-image')] }
    );

    const defaultConfig = getDefaultConfiguration();

    const props = {
      ...commonProps,
      pageData: {
        orderData: {},
        listing,
      },
      processName: 'default-inquiry',
      listingTitle: listing.attributes.title,
      title: 'CheckoutPage.default-inquiry.title',
      // reset from commonProps
      stripeCustomerFetched: null,
      config: {
        ...defaultConfig,
        listing: {
          ...defaultConfig.listing,
          listingTypes: [
            {
              listingType: 'inquiry',
              label: 'Inquiry',
              transactionType: {
                process: 'default-inquiry',
                alias: 'default-inquiry/release-1',
                unitType: 'inquiry',
              },
              defaultListingFields: {
                price: true,
              },
            },
          ],
        },
      },
    };
    render(<CheckoutPageWithInquiryProcess {...props} />);

    const inquiryTitle = 'CheckoutPage.default-inquiry.title';
    expect(screen.getByRole('heading', { name: inquiryTitle })).toBeInTheDocument();
    const inquiryMessageLabel = 'CheckoutPageWithInquiryProcess.messageLabel';
    expect(screen.getByRole('heading', { name: inquiryMessageLabel })).toBeInTheDocument();
    // price
    expect(screen.getAllByText('55')).toHaveLength(2);
    const submitBtnText = 'CheckoutPageWithInquiryProcess.submitButtonText';
    expect(screen.getByRole('button', { name: submitBtnText })).toBeInTheDocument();

    // THESE SHOULD NOT BE PRESENT
    const orderBreakdownTitle = 'CheckoutPage.default-inquiry.orderBreakdown';
    expect(screen.queryByRole('heading', { name: orderBreakdownTitle })).not.toBeInTheDocument();

    // These are rendered twice (mobile & desktop)
    expect(screen.queryAllByText('OrderBreakdown.baseUnitQuantity')).toHaveLength(0);
    expect(screen.queryAllByText('OrderBreakdown.shippingFee')).toHaveLength(0);
    expect(screen.queryAllByText('OrderBreakdown.total')).toHaveLength(0);

    const paymentHeading = 'StripePaymentForm.paymentHeading';
    expect(screen.queryByRole('heading', { name: paymentHeading })).not.toBeInTheDocument();

    const billingDetails = 'StripePaymentForm.billingDetails';
    expect(screen.queryByRole('heading', { name: billingDetails })).not.toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: 'StripePaymentForm.submitPaymentInfo' })
    ).not.toBeInTheDocument();
  });

  it('Check that inquiry process without price has relevant info', () => {
    const listing = createListing(
      'listing1',
      {
        publicData: {
          listingType: 'inquiry',
          transactionProcessAlias: 'default-inquiry/release-1',
          unitType: 'inquiry',
        },
      },
      { author: createUser('author'), images: [createImage('first-image')] }
    );

    const defaultConfig = getDefaultConfiguration();

    const props = {
      ...commonProps,
      pageData: {
        orderData: {},
        listing,
      },
      processName: 'default-inquiry',
      listingTitle: listing.attributes.title,
      title: 'CheckoutPage.default-inquiry.title',
      // reset from commonProps
      stripeCustomerFetched: null,
      config: {
        ...defaultConfig,
        listing: {
          ...defaultConfig.listing,
          listingTypes: [
            {
              listingType: 'inquiry',
              label: 'Inquiry',
              transactionType: {
                process: 'default-inquiry',
                alias: 'default-inquiry/release-1',
                unitType: 'inquiry',
              },
              defaultListingFields: {
                price: false,
              },
            },
          ],
        },
      },
    };
    render(<CheckoutPageWithInquiryProcess {...props} />);

    const inquiryTitle = 'CheckoutPage.default-inquiry.title';
    expect(screen.getByRole('heading', { name: inquiryTitle })).toBeInTheDocument();
    const inquiryMessageLabel = 'CheckoutPageWithInquiryProcess.messageLabel';
    expect(screen.getByRole('heading', { name: inquiryMessageLabel })).toBeInTheDocument();
    // price should not exists
    expect(screen.queryAllByText('55')).toHaveLength(0);
    const submitBtnText = 'CheckoutPageWithInquiryProcess.submitButtonText';
    expect(screen.getByRole('button', { name: submitBtnText })).toBeInTheDocument();
  });

  describe('Duck', () => {
    it('ActionCreator: setInitialValues(initialValues)', () => {
      const listing = createListing(
        '00000000-0000-0000-0000-000000000000',
        {},
        {
          author: createUser('author1'),
        }
      );
      const orderData = { quantity: 3, deliveryMethod: 'shipping' };
      const expectedAction = {
        type: 'CheckoutPage/setInitialValues',
        payload: { listing, orderData },
      };

      expect(setInitialValues({ listing, orderData })).toEqual(expectedAction);
    });

    describe('Reducer', () => {
      const initialValues = {
        initiateOrderError: null,
        listing: null,
        orderData: null,
        stripeCustomerFetched: false,
        stripeCustomerFetchError: null,
        speculateTransactionError: null,
        speculateTransactionInProgress: false,
        speculatedTransaction: null,
        transaction: null,
        confirmPaymentError: null,
        initiateInquiryError: null,
        initiateInquiryInProgress: false,
        shipment: null,
        fetchShippingRatesInProgress: false,
        fetchShippingRatesError: null,
      };

      it('should return the initial state', () => {
        expect(checkoutPageReducer(undefined, {})).toEqual(initialValues);
      });

      it('should handle setInitialValues', () => {
        const listing = createListing(
          '00000000-0000-0000-0000-000000000000',
          {},
          {
            author: createUser('author1'),
          }
        );
        const orderData = { quantity: 3, deliveryMethod: 'shipping' };
        const payload = { listing, orderData };
        const expected = { ...initialValues, ...payload };
        expect(checkoutPageReducer({}, { type: 'CheckoutPage/setInitialValues', payload })).toEqual(
          expected
        );
      });
    });
  });
});
