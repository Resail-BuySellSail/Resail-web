import React, { useEffect, useRef, useState } from 'react';

// Import contexts and util modules
import { FormattedMessage, intlShape } from '../../util/reactIntl';
import { pathByRouteName } from '../../util/routes';
import {
  isValidCurrencyForTransactionProcess,
  pickTransactionFieldsData,
} from '../../util/fieldHelpers.js';
import { propTypes } from '../../util/types';
import { ensureTransaction } from '../../util/data';
import { createSlug } from '../../util/urlHelpers';
import {
  SHIP_TO_ADDRESS,
  getProfileShipToAddress,
  isCompleteShippingAddress,
} from '../../util/shipping';
import {
  isTransactionInitiateListingNotFoundError,
  isTransactionsTransitionInvalidTransition,
} from '../../util/errors';
import {
  getProcess,
  resolveLatestProcessName,
  BOOKING_PROCESS_NAME,
  NEGOTIATION_PROCESS_NAME,
  PURCHASE_PROCESS_NAME,
} from '../../transactions/transaction';

// Import shared components
import {
  H3,
  H4,
  InlineTextButton,
  NamedLink,
  OrderBreakdown,
  Page,
  ShippingAddressForm,
  TopbarSimplified,
} from '../../components';

// Session helpers file needs to be imported before other CheckoutPage modules that use it
import { clearData } from './CheckoutPageSessionHelpers';

import {
  bookingDatesMaybe,
  getBillingDetails,
  getFormattedTotalPrice,
  getShippingDetailsFromAddress,
  getShippingDetailsMaybe,
  getTransactionTypeData,
  hasDefaultPaymentMethod,
  hasPaymentExpired,
  hasTransactionPassedPendingPayment,
  processCheckoutWithPayment,
  setOrderPageInitialValues,
} from './CheckoutPageTransactionHelpers.js';
import { getErrorMessages } from './ErrorMessages';

import StripePaymentForm from './StripePaymentForm/StripePaymentForm';
import ShippingMethodForm, {
  formatShippingRatePrice,
} from './ShippingMethodForm/ShippingMethodForm';
import DetailsSideCard from './DetailsSideCard';
import MobileListingImage from './MobileListingImage';
import MobileOrderBreakdown from './MobileOrderBreakdown';

import css from './CheckoutPage.module.css';

// Stripe PaymentIntent statuses, where user actions are already completed
// https://stripe.com/docs/payments/payment-intents/status
const STRIPE_PI_USER_ACTIONS_DONE_STATUSES = ['processing', 'requires_capture', 'succeeded'];

// Payment charge options
const ONETIME_PAYMENT = 'ONETIME_PAYMENT';
const PAY_AND_SAVE_FOR_LATER_USE = 'PAY_AND_SAVE_FOR_LATER_USE';
const USE_SAVED_CARD = 'USE_SAVED_CARD';

const paymentFlow = (selectedPaymentMethod, saveAfterOnetimePayment) => {
  // Payment mode could be 'replaceCard', but without explicit saveAfterOnetimePayment flag,
  // we'll handle it as one-time payment
  return selectedPaymentMethod === 'defaultCard'
    ? USE_SAVED_CARD
    : saveAfterOnetimePayment
    ? PAY_AND_SAVE_FOR_LATER_USE
    : ONETIME_PAYMENT;
};

// Checkout steps when the order is shipped with Shippo
const STEP_ADDRESS = 'address';
const STEP_SHIPPING_METHOD = 'shippingMethod';
const STEP_PAYMENT = 'payment';

const capitalizeString = s => `${s.charAt(0).toUpperCase()}${s.substr(1)}`;

/**
 * Prefix the properties of the chosen price variant as first level properties for the protected data of the transaction
 *
 * @example
 * const priceVariant = {
 *   name: 'something',
 * }
 *
 * will be returned as:
 * const priceVariant = {
 *   priceVariantName: 'something',
 * }
 *
 * @param {Object} priceVariant - The price variant object
 * @returns {Object} The price variant object with the properties prefixed with priceVariant*
 */
const prefixPriceVariantProperties = priceVariant => {
  if (!priceVariant) {
    return {};
  }

  const entries = Object.entries(priceVariant).map(([key, value]) => {
    return [`priceVariant${capitalizeString(key)}`, value];
  });
  return Object.fromEntries(entries);
};

/**
 * Construct orderParams object using pageData from session storage, shipping details, and optional payment params.
 * Note: This is used for both speculate transition and real transition
 *       - Speculate transition is called, when the the component is mounted. It's used to test if the data can go through the API validation
 *       - Real transition is made, when the user submits the StripePaymentForm.
 *
 * @param {Object} pageData data that's saved to session storage.
 * @param {Object} shippingDetails shipping address if applicable.
 * @param {Object} optionalPaymentParams (E.g. paymentMethod or setupPaymentMethodForSaving)
 * @param {Object} config app-wide configs. This contains hosted configs too.
 * @param {Object} transactionFieldProtectedData transaction fields saved to protected data.
 * @param {string} customerDefaultMessage initial message from the customer.
 * @param {Object} shippingRateParams selected Shippo rate: { shippingRateId, shipmentId }
 * @returns orderParams.
 */
const getOrderParams = (
  pageData,
  shippingDetails,
  optionalPaymentParams,
  config,
  transactionFieldProtectedData,
  customerDefaultMessage,
  shippingRateParams = {}
) => {
  const quantity = pageData.orderData?.quantity;
  const quantityMaybe = quantity ? { quantity } : {};
  const seats = pageData.orderData?.seats;
  const seatsMaybe = seats ? { seats } : {};
  const deliveryMethod = pageData.orderData?.deliveryMethod;
  const deliveryMethodMaybe = deliveryMethod ? { deliveryMethod } : {};
  const { listingType, unitType, priceVariants } = pageData?.listing?.attributes?.publicData || {};

  // price variant data for fixed duration bookings
  const priceVariantName = pageData.orderData?.priceVariantName;
  const priceVariantNameMaybe = priceVariantName ? { priceVariantName } : {};
  const priceVariant = priceVariants?.find(pv => pv.name === priceVariantName);
  const priceVariantMaybe = priceVariant ? prefixPriceVariantProperties(priceVariant) : {};

  const customerDefaultMessageMaybe = customerDefaultMessage ? { customerDefaultMessage } : {};

  // Shipping fee is resolved on the server from the selected Shippo rate (shippingRateId).
  // The rate and shipment ids are also saved to protected data for buying the shipping label.
  const { shippingRateId, shipmentId } = shippingRateParams;
  const shippingRateIdMaybe = shippingRateId ? { shippingRateId } : {};
  const shippingRateProtectedDataMaybe = shippingRateId ? { shippingRateId, shipmentId } : {};

  const protectedDataMaybe = {
    protectedData: {
      ...getTransactionTypeData(listingType, unitType, config),
      ...deliveryMethodMaybe,
      ...shippingDetails,
      ...priceVariantMaybe,
      ...transactionFieldProtectedData,
      ...customerDefaultMessageMaybe,
      ...shippingRateProtectedDataMaybe,
    },
  };

  // Note: Avoid misinterpreting the following logic as allowing arbitrary mixing of `quantity` and `seats`.
  // You can only pass either quantity OR seats and units to the orderParams object
  // Quantity represents the total booked units for the line item (e.g. days, hours).
  // When quantity is not passed, we pass seats and units.
  // If `bookingDatesMaybe` is provided, it determines `units`, and `seats` defaults to 1
  // (implying quantity = units)

  // These are the order parameters for the first payment-related transition
  // which is either initiate-transition or initiate-transition-after-enquiry
  const orderParams = {
    listingId: pageData?.listing?.id,
    ...deliveryMethodMaybe,
    ...quantityMaybe,
    ...seatsMaybe,
    ...bookingDatesMaybe(pageData.orderData?.bookingDates),
    ...priceVariantNameMaybe,
    ...shippingRateIdMaybe,
    ...protectedDataMaybe,
    ...optionalPaymentParams,
  };
  return orderParams;
};

const fetchSpeculatedTransactionIfNeeded = (orderParams, pageData, fetchSpeculatedTransaction) => {
  const tx = pageData ? pageData.transaction : null;
  const pageDataListing = pageData.listing;
  const processName =
    tx?.attributes?.processName ||
    pageDataListing?.attributes?.publicData?.transactionProcessAlias?.split('/')[0];
  const process = processName ? getProcess(processName) : null;

  // If transaction has passed payment-pending state, speculated tx is not needed.
  const shouldFetchSpeculatedTransaction =
    !!pageData?.listing?.id &&
    !!pageData.orderData &&
    !!process &&
    !hasTransactionPassedPendingPayment(tx, process);

  if (shouldFetchSpeculatedTransaction) {
    const processAlias = pageData.listing.attributes.publicData?.transactionProcessAlias;
    const transactionId = tx ? tx.id : null;
    const isInquiryInPaymentProcess =
      tx?.attributes?.lastTransition === process.transitions.INQUIRE;
    const resolvedProcessName = resolveLatestProcessName(processName);
    const isOfferPendingInNegotiationProcess =
      resolvedProcessName === NEGOTIATION_PROCESS_NAME &&
      tx.attributes.state === `state/${process.states.OFFER_PENDING}`;

    const requestTransition = isInquiryInPaymentProcess
      ? process.transitions.REQUEST_PAYMENT_AFTER_INQUIRY
      : isOfferPendingInNegotiationProcess
      ? process.transitions.REQUEST_PAYMENT_TO_ACCEPT_OFFER
      : process.transitions.REQUEST_PAYMENT;
    const isPrivileged = process.isPrivileged(requestTransition);

    return fetchSpeculatedTransaction(
      orderParams,
      processAlias,
      transactionId,
      requestTransition,
      isPrivileged
    );
  }
};

/**
 * Load initial data for the page
 *
 * Since the data for the checkout is not passed in the URL (there
 * might be lots of options in the future), we must pass in the data
 * some other way. Currently the ListingPage sets the initial data
 * for the CheckoutPage's Redux store.
 *
 * For some cases (e.g. a refresh in the CheckoutPage), the Redux
 * store is empty. To handle that case, we store the received data
 * to window.sessionStorage and read it from there if no props from
 * the store exist.
 *
 * This function also sets of fetching the speculative transaction
 * based on this initial data.
 */
export const loadInitialDataForStripePayments = ({
  pageData,
  fetchSpeculatedTransaction,
  fetchStripeCustomer,
  config,
}) => {
  // Fetch currentUser with stripeCustomer entity
  // Note: since there's need for data loading in "componentWillMount" function,
  //       this is added here instead of loadData static function.
  fetchStripeCustomer();

  // Fetch speculated transaction for showing price in order breakdown
  // NOTE: if unit type is line-item/item, quantity needs to be added.
  // The way to pass it to checkout page is through pageData.orderData
  const shippingDetails = {};
  const optionalPaymentParams = {};
  const orderParams = getOrderParams(pageData, shippingDetails, optionalPaymentParams, config);

  fetchSpeculatedTransactionIfNeeded(orderParams, pageData, fetchSpeculatedTransaction);
};

const handleSubmit = (
  values,
  process,
  props,
  stripe,
  submitting,
  setSubmitting,
  shippingCheckout = null
) => {
  if (submitting) {
    return;
  }
  setSubmitting(true);

  const {
    history,
    config,
    routeConfiguration,
    speculatedTransaction,
    currentUser,
    stripeCustomerFetched,
    paymentIntent,
    dispatch,
    onInitiateOrder,
    onConfirmCardPayment,
    onConfirmPayment,
    onSavePaymentMethod,
    onFetchTransaction,
    onSubmitCallback,
    pageData,
    setPageData,
    sessionStorageKey,
    transaction: reduxTransaction,
    transactionFieldConfigs = [],
  } = props;
  const { card, message, paymentMethod: selectedPaymentMethod, formValues } = values;
  const { saveAfterOnetimePayment: saveAfterOnetimePaymentRaw } = formValues;

  const transactionFieldsProtectedData = {
    ...pickTransactionFieldsData(formValues, 'protected', true, transactionFieldConfigs),
  };

  const saveAfterOnetimePayment =
    Array.isArray(saveAfterOnetimePaymentRaw) && saveAfterOnetimePaymentRaw.length > 0;
  const selectedPaymentFlow = paymentFlow(selectedPaymentMethod, saveAfterOnetimePayment);
  const hasDefaultPaymentMethodSaved = hasDefaultPaymentMethod(stripeCustomerFetched, currentUser);
  const stripePaymentMethodId = hasDefaultPaymentMethodSaved
    ? currentUser?.stripeCustomer?.defaultPaymentMethod?.attributes?.stripePaymentMethodId
    : null;

  // If paymentIntent status is not waiting user action,
  // confirmCardPayment has been called previously.
  const hasPaymentIntentUserActionsDone =
    paymentIntent && STRIPE_PI_USER_ACTIONS_DONE_STATUSES.includes(paymentIntent.status);

  const requestPaymentParams = {
    pageData,
    speculatedTransaction,
    stripe,
    card,
    billingDetails: getBillingDetails(formValues, currentUser),
    paymentIntent,
    hasPaymentIntentUserActionsDone,
    stripePaymentMethodId,
    process,
    onInitiateOrder,
    onConfirmCardPayment,
    onConfirmPayment,
    onSavePaymentMethod,
    sessionStorageKey,
    stripeCustomer: currentUser?.stripeCustomer,
    isPaymentFlowUseSavedCard: selectedPaymentFlow === USE_SAVED_CARD,
    isPaymentFlowPayAndSaveCard: selectedPaymentFlow === PAY_AND_SAVE_FOR_LATER_USE,
    setPageData,
  };

  // With Shippo checkout, the ship-to address is given on the first step (not in StripePaymentForm)
  const { shipToAddress, shippingRateParams } = shippingCheckout || {};
  const shippingDetails = shippingCheckout
    ? getShippingDetailsFromAddress(shipToAddress)
    : getShippingDetailsMaybe(formValues);
  // Note: optionalPaymentParams contains Stripe paymentMethod,
  // but that can also be passed on Step 2
  // stripe.confirmCardPayment(stripe, { payment_method: stripePaymentMethodId })
  const optionalPaymentParams =
    selectedPaymentFlow === USE_SAVED_CARD && hasDefaultPaymentMethodSaved
      ? { paymentMethod: stripePaymentMethodId }
      : selectedPaymentFlow === PAY_AND_SAVE_FOR_LATER_USE
      ? { setupPaymentMethodForSaving: true }
      : {};

  // These are the order parameters for the first payment-related transition
  // which is either initiate-transition or initiate-transition-after-enquiry
  const orderParams = getOrderParams(
    pageData,
    shippingDetails,
    optionalPaymentParams,
    config,
    transactionFieldsProtectedData,
    message,
    shippingRateParams
  );

  // There are multiple XHR calls that needs to be made against Stripe API and Sharetribe Marketplace API on checkout with payments
  processCheckoutWithPayment(orderParams, requestPaymentParams)
    .then(response => {
      const { orderId, paymentMethodSaved } = response;
      setSubmitting(false);

      const orderDetailsPath = pathByRouteName('OrderDetailsPage', routeConfiguration, {
        id: orderId.uuid,
      });
      const initialValues = {
        savePaymentMethodFailed: !paymentMethodSaved,
      };

      setOrderPageInitialValues(initialValues, routeConfiguration, dispatch);
      onSubmitCallback();
      history.push(orderDetailsPath);
    })
    .catch(err => {
      console.error(err);
      setSubmitting(false);

      // After process expiry (or if payment was already confirmed), confirm/initiate can fail with
      // invalid transition while checkout still holds a stale pending-payment transaction.
      if (!isTransactionsTransitionInvalidTransition(err)) {
        return;
      }

      const txId = pageData?.transaction?.id || reduxTransaction?.id;
      if (!txId || !onFetchTransaction) {
        return;
      }

      onFetchTransaction(txId)
        .then(tx => {
          if (process.getState(tx) === process.states.PAYMENT_EXPIRED) {
            setPageData({ ...pageData, transaction: tx });
            clearData(sessionStorageKey);
          } else if (process.hasPassedState(process.states.PENDING_PAYMENT, tx)) {
            // Confirm already succeeded earlier (e.g. network drop after Marketplace confirm).
            const orderDetailsPath = pathByRouteName('OrderDetailsPage', routeConfiguration, {
              id: tx.id.uuid,
            });
            setOrderPageInitialValues({}, routeConfiguration, dispatch);
            onSubmitCallback();
            history.push(orderDetailsPath);
          }
        })
        .catch(() => {
          // Keep the generic confirm/initiate error UI from Redux.
        });
    });
};

const onStripeInitialized = (stripe, process, props) => {
  const { paymentIntent, onRetrievePaymentIntent, pageData } = props;
  const tx = pageData?.transaction || null;

  // We need to get up to date PI, if payment is pending but it's not expired.
  const shouldFetchPaymentIntent =
    stripe &&
    !paymentIntent &&
    tx?.id &&
    process?.getState(tx) === process?.states.PENDING_PAYMENT &&
    !hasPaymentExpired(tx, process);

  if (shouldFetchPaymentIntent) {
    const { stripePaymentIntentClientSecret } =
      tx.attributes.protectedData?.stripePaymentIntents?.default || {};

    // Fetch up to date PaymentIntent from Stripe
    onRetrievePaymentIntent({ stripe, stripePaymentIntentClientSecret });
  }
};

/**
 * A component that renders the checkout page with payment.
 *
 * @component
 * @param {Object} props
 * @param {boolean} props.scrollingDisabled - Whether the page should scroll
 * @param {string} props.speculateTransactionError - The error message for the speculate transaction
 * @param {propTypes.transaction} props.speculatedTransaction - The speculated transaction
 * @param {string} props.initiateOrderError - The error message for the initiate order
 * @param {string} props.confirmPaymentError - The error message for the confirm payment
 * @param {intlShape} props.intl - The intl object
 * @param {propTypes.currentUser} props.currentUser - The current user
 * @param {string} props.confirmCardPaymentError - The error message for the confirm card payment
 * @param {propTypes.paymentIntent} props.paymentIntent - The Stripe's payment intent
 * @param {boolean} props.stripeCustomerFetched - Whether the stripe customer has been fetched
 * @param {Object} props.pageData - The page data
 * @param {propTypes.listing} props.pageData.listing - The listing entity
 * @param {boolean} props.showListingImage - A boolean indicating whether images are enabled with this listing type
 * @param {propTypes.transaction} props.pageData.transaction - The transaction entity
 * @param {Object} props.pageData.orderData - The order data
 * @param {string} props.processName - The process name
 * @param {string} props.listingTitle - The listing title
 * @param {string} props.title - The title
 * @param {Function} props.onInitiateOrder - The function to initiate the order
 * @param {Function} props.onConfirmCardPayment - The function to confirm the card payment
 * @param {Function} props.onConfirmPayment - The function to confirm the payment after Stripe call is made
 * @param {Function} props.onFetchTransaction - The function to fetch an up-to-date transaction entity
 * @param {Function} props.onSavePaymentMethod - The function to save the payment method for later use
 * @param {Function} props.onSubmitCallback - The function to submit the callback
 * @param {propTypes.error} props.initiateOrderError - The error message for the initiate order
 * @param {propTypes.error} props.confirmPaymentError - The error message for the confirm payment
 * @param {propTypes.error} props.confirmCardPaymentError - The error message for the confirm card payment
 * @param {propTypes.paymentIntent} props.paymentIntent - The Stripe's payment intent
 * @param {boolean} props.stripeCustomerFetched - Whether the stripe customer has been fetched
 * @param {Object} props.config - The config
 * @param {Object} props.routeConfiguration - The route configuration
 * @param {Object} props.history - The history object
 * @param {Object} props.history.push - The push state function of the history object
 * @param {Function} props.fetchSpeculatedTransaction - The function to speculate the transaction
 * @param {Function} props.onSaveShippingAddress - The function to validate (Shippo) and save the
 * ship-to address to user's privateData
 * @param {Function} props.onFetchShippingRates - The function to fetch Shippo rates for the listing
 * @param {Object} props.shipment - Shippo shipment with rates: { shipmentId, rates, messages }
 * @param {boolean} props.fetchShippingRatesInProgress - Whether the Shippo rates are being fetched
 * @param {propTypes.error} props.fetchShippingRatesError - The error from fetching Shippo rates
 * @returns {JSX.Element}
 */
export const CheckoutPageWithPayment = props => {
  const [submitting, setSubmitting] = useState(false);
  // Initialized stripe library is saved to state - if it's needed at some point here too.
  const [stripe, setStripe] = useState(null);

  const {
    scrollingDisabled,
    speculateTransactionError,
    speculatedTransaction: speculatedTransactionMaybe,
    initiateOrderError,
    confirmPaymentError,
    intl,
    currentUser,
    confirmCardPaymentError,
    showListingImage,
    paymentIntent,
    retrievePaymentIntentError,
    stripeCustomerFetched,
    pageData,
    processName,
    listingTitle,
    title,
    transactionFieldConfigs = [],
    showTransactionFields,
    config,
    fetchSpeculatedTransaction,
    onSaveShippingAddress,
    onFetchShippingRates,
    shipment,
    fetchShippingRatesInProgress,
    fetchShippingRatesError,
  } = props;

  // Shippo checkout steps: ship-to address => shipping method (rate) => payment
  const [checkoutStep, setCheckoutStep] = useState(STEP_ADDRESS);
  const [selectedShippingRate, setSelectedShippingRate] = useState(null);
  const [pendingShippingRateId, setPendingShippingRateId] = useState(null);
  const [saveShipToAddressInProgress, setSaveShipToAddressInProgress] = useState(false);
  const [saveShipToAddressError, setSaveShipToAddressError] = useState(null);
  const didAutoAdvanceToShippingMethod = useRef(false);

  // Since the listing data is already given from the ListingPage
  // and stored to handle refreshes, it might not have the possible
  // deleted or closed information in it. If the transaction
  // initiate or the speculative initiate fail due to the listing
  // being deleted or closed, we should dig the information from the
  // errors and not the listing data.
  const listingNotFound =
    isTransactionInitiateListingNotFoundError(speculateTransactionError) ||
    isTransactionInitiateListingNotFoundError(initiateOrderError);

  const { listing, transaction, orderData } = pageData;
  const existingTransaction = ensureTransaction(transaction);
  const speculatedTransaction = ensureTransaction(speculatedTransactionMaybe, {}, null);

  // If existing transaction has line-items, it has gone through one of the request-payment transitions.
  // Otherwise, we try to rely on speculatedTransaction for order breakdown data.
  const tx =
    existingTransaction?.attributes?.lineItems?.length > 0
      ? existingTransaction
      : speculatedTransaction;
  const timeZone = listing?.attributes?.availabilityPlan?.timezone;
  const transactionProcessAlias = listing?.attributes?.publicData?.transactionProcessAlias;
  const priceVariantName = tx.attributes.protectedData?.priceVariantName;

  const txBookingMaybe = tx?.booking?.id ? { booking: tx.booking, timeZone } : {};

  // Show breakdown only when (speculated?) transaction is loaded
  // (i.e. it has an id and lineItems)
  const breakdown =
    tx.id && tx.attributes.lineItems?.length > 0 ? (
      <OrderBreakdown
        className={css.orderBreakdown}
        userRole="customer"
        transaction={tx}
        {...txBookingMaybe}
        currency={config.currency}
        marketplaceName={config.marketplaceName}
      />
    ) : null;

  const totalPrice =
    tx?.attributes?.lineItems?.length > 0 ? getFormattedTotalPrice(tx, intl) : null;

  const process = processName ? getProcess(processName) : null;
  const transitions = process.transitions;
  const isPaymentExpired = hasPaymentExpired(existingTransaction, process);

  // Shipping is handled with Shippo: the customer gives the ship-to address and selects a rate,
  // before the payment form is shown.
  const isShippingCheckout =
    orderData?.deliveryMethod === 'shipping' &&
    !hasTransactionPassedPendingPayment(existingTransaction, process);
  const shipToAddress = getProfileShipToAddress(currentUser);
  const hasShipToAddress = isCompleteShippingAddress(shipToAddress);

  // Speculate the transaction again, so that the order breakdown shows the shipping fee.
  const speculateWithShippingRate = shippingRate => {
    const shippingRateParams = shippingRate
      ? { shippingRateId: shippingRate.objectId, shipmentId: shipment?.shipmentId }
      : {};
    const orderParams = getOrderParams(pageData, {}, {}, config, {}, null, shippingRateParams);
    return Promise.resolve(
      fetchSpeculatedTransactionIfNeeded(orderParams, pageData, fetchSpeculatedTransaction)
    );
  };

  const showShippingMethodStep = () => {
    if (selectedShippingRate) {
      setSelectedShippingRate(null);
      speculateWithShippingRate(null);
    }
    setCheckoutStep(STEP_SHIPPING_METHOD);
    onFetchShippingRates(listing.id);
  };

  // If the customer has saved a ship-to address earlier, start from the shipping method step.
  useEffect(() => {
    if (isShippingCheckout && hasShipToAddress && !didAutoAdvanceToShippingMethod.current) {
      didAutoAdvanceToShippingMethod.current = true;
      showShippingMethodStep();
    }
  }, [isShippingCheckout, hasShipToAddress]);

  const handleSaveShipToAddress = values => {
    const { name, phone, street1, streetNo = '', city, state, zip, country } = values;
    const address = { name, phone, street1, streetNo, city, state, zip, country };

    setSaveShipToAddressInProgress(true);
    setSaveShipToAddressError(null);
    // Ship-to address is validated with Shippo and saved to the user's privateData,
    // so that it's prefilled next time (it's also managed on the Shipping addresses page).
    onSaveShippingAddress({ addressType: SHIP_TO_ADDRESS, address })
      .then(() => {
        setSaveShipToAddressInProgress(false);
        didAutoAdvanceToShippingMethod.current = true;
        showShippingMethodStep();
      })
      .catch(e => {
        setSaveShipToAddressInProgress(false);
        setSaveShipToAddressError(e);
      });
  };

  // Move to the payment step only after the line-items (shipping fee) are updated.
  const handleSelectShippingRate = shippingRate => {
    setSelectedShippingRate(shippingRate);
    setPendingShippingRateId(shippingRate.objectId);
    speculateWithShippingRate(shippingRate).then(action => {
      setPendingShippingRateId(null);
      // Speculation errors are shown by the page (speculateTransactionError)
      if (!action?.error) {
        setCheckoutStep(STEP_PAYMENT);
      }
    });
  };

  // Allow showing page when currentUser is still being downloaded,
  // but show payment form only when user info is loaded.
  const showPaymentForm = !!(
    currentUser &&
    !listingNotFound &&
    !initiateOrderError &&
    !speculateTransactionError &&
    !retrievePaymentIntentError &&
    !isPaymentExpired
  );

  const firstImage = listing?.images?.length > 0 ? listing.images[0] : null;

  const listingLink = (
    <NamedLink
      name="ListingPage"
      params={{ id: listing?.id?.uuid, slug: createSlug(listingTitle) }}
    >
      <FormattedMessage id="CheckoutPage.errorlistingLinkText" />
    </NamedLink>
  );

  const errorMessages = getErrorMessages(
    listingNotFound,
    initiateOrderError,
    isPaymentExpired,
    retrievePaymentIntentError,
    speculateTransactionError,
    listingLink
  );

  const isBooking = processName === BOOKING_PROCESS_NAME;
  const isPurchase = processName === PURCHASE_PROCESS_NAME;
  const isNegotiation = processName === NEGOTIATION_PROCESS_NAME;

  const txTransitions = existingTransaction?.attributes?.transitions || [];
  const hasInquireTransition = txTransitions.find(tr => tr.transition === transitions.INQUIRE);
  const showInitialMessageInput = !hasInquireTransition && !isNegotiation;

  // Get first and last name of the current user and use it in the StripePaymentForm to autofill the name field
  const userName = currentUser?.attributes?.profile
    ? `${currentUser.attributes.profile.firstName} ${currentUser.attributes.profile.lastName}`
    : null;

  // If paymentIntent status is not waiting user action,
  // confirmCardPayment has been called previously.
  const hasPaymentIntentUserActionsDone =
    paymentIntent && STRIPE_PI_USER_ACTIONS_DONE_STATUSES.includes(paymentIntent.status);

  // If your marketplace works mostly in one country you can use initial values to select country automatically
  // e.g. {country: 'FI'}

  // With Shippo checkout, billing address is prefilled with the ship-to address.
  const initialValuesForStripePayment = isShippingCheckout
    ? {
        name: shipToAddress.name || userName,
        recipientName: shipToAddress.name || userName,
        addressLine1: shipToAddress.street1,
        addressLine2: shipToAddress.streetNo,
        postal: shipToAddress.zip,
        city: shipToAddress.city,
        state: shipToAddress.state,
        country: shipToAddress.country,
      }
    : { name: userName, recipientName: userName };
  const showShippingSteps = isShippingCheckout && checkoutStep !== STEP_PAYMENT;

  const listingLocation = listing?.attributes?.publicData?.location;
  const showPickUpLocation = isPurchase && orderData?.deliveryMethod === 'pickup';
  const showLocation = (isBooking || isNegotiation) && listingLocation?.address;

  const providerDisplayName = isNegotiation
    ? existingTransaction?.provider?.attributes?.profile?.displayName
    : listing?.author?.attributes?.profile?.displayName;

  // Check if the listing currency is compatible with Stripe for the specified transaction process.
  // This function validates the currency against the transaction process requirements and
  // ensures it is supported by Stripe, as indicated by the 'stripe' parameter.
  // If using a transaction process without any stripe actions, leave out the 'stripe' parameter.
  const currency =
    existingTransaction?.attributes?.payinTotal?.currency || listing.attributes.price?.currency;
  const isStripeCompatibleCurrency = isValidCurrencyForTransactionProcess(
    transactionProcessAlias,
    currency,
    'stripe'
  );

  // Render an error message if the listing is using a non Stripe supported currency
  // and is using a transaction process with Stripe actions (default-booking or default-purchase)
  if (!isStripeCompatibleCurrency) {
    return (
      <Page title={title} scrollingDisabled={scrollingDisabled}>
        <TopbarSimplified />
        <div className={css.contentContainer}>
          <section className={css.incompatibleCurrency}>
            <H4 as="h1" className={css.heading}>
              <FormattedMessage id="CheckoutPage.incompatibleCurrency" />
            </H4>
          </section>
        </div>
      </Page>
    );
  }

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <TopbarSimplified />
      <div className={css.contentContainer}>
        <MobileListingImage
          listingTitle={listingTitle}
          author={listing?.author}
          firstImage={firstImage}
          layoutListingImageConfig={config.layout.listingImage}
          showListingImage={showListingImage}
        />
        <main className={css.orderFormContainer}>
          <div className={css.headingContainer}>
            <H3 as="h1" className={css.heading}>
              {title}
            </H3>
            <H4 as="h2" className={css.detailsHeadingMobile}>
              <FormattedMessage id="CheckoutPage.listingTitle" values={{ listingTitle }} />
            </H4>
          </div>
          <MobileOrderBreakdown
            speculateTransactionErrorMessage={errorMessages.speculateTransactionErrorMessage}
            breakdown={breakdown}
            priceVariantName={priceVariantName}
          />
          <section className={css.paymentContainer}>
            {errorMessages.initiateOrderErrorMessage}
            {errorMessages.listingNotFoundErrorMessage}
            {errorMessages.speculateErrorMessage}
            {errorMessages.retrievePaymentIntentErrorMessage}
            {errorMessages.paymentExpiredMessage}

            {showPaymentForm && showShippingSteps ? (
              <div className={css.shippingStep}>
                <div className={css.shippingStepHeader}>
                  <H4 as="h2" className={css.shippingStepHeading}>
                    {checkoutStep === STEP_ADDRESS ? (
                      <FormattedMessage id="CheckoutPage.shippingAddressHeading" />
                    ) : (
                      <FormattedMessage id="CheckoutPage.shippingMethodHeading" />
                    )}
                  </H4>
                  {checkoutStep === STEP_SHIPPING_METHOD ? (
                    <InlineTextButton
                      type="button"
                      className={css.shippingStepChange}
                      onClick={() => setCheckoutStep(STEP_ADDRESS)}
                    >
                      <FormattedMessage id="CheckoutPage.changeShippingAddress" />
                    </InlineTextButton>
                  ) : null}
                </div>

                {checkoutStep === STEP_ADDRESS ? (
                  <ShippingAddressForm
                    formId="CheckoutPageShipToAddressForm"
                    initialValues={shipToAddress}
                    onSubmit={handleSaveShipToAddress}
                    inProgress={saveShipToAddressInProgress}
                    saveAddressError={saveShipToAddressError}
                    submitButtonText={intl.formatMessage({
                      id: 'CheckoutPage.saveShippingAddress',
                    })}
                  />
                ) : (
                  <ShippingMethodForm
                    shipment={shipment}
                    fetchShippingRatesInProgress={fetchShippingRatesInProgress}
                    fetchShippingRatesError={fetchShippingRatesError}
                    selectedShippingRate={selectedShippingRate}
                    pendingShippingRateId={pendingShippingRateId}
                    onSelectShippingRate={handleSelectShippingRate}
                  />
                )}
              </div>
            ) : null}

            {showPaymentForm && isShippingCheckout && !showShippingSteps ? (
              <div className={css.shippingSummary}>
                <div className={css.shippingSummaryRow}>
                  <div>
                    <H4 as="h2" className={css.shippingStepHeading}>
                      <FormattedMessage id="CheckoutPage.shipToHeading" />
                    </H4>
                    <p className={css.shippingSummaryText}>
                      {[
                        shipToAddress.name,
                        [shipToAddress.street1, shipToAddress.streetNo].filter(Boolean).join(', '),
                        `${shipToAddress.city}, ${shipToAddress.state} ${shipToAddress.zip}`,
                      ].join(' · ')}
                    </p>
                  </div>
                  <InlineTextButton
                    type="button"
                    className={css.shippingStepChange}
                    onClick={() => setCheckoutStep(STEP_ADDRESS)}
                  >
                    <FormattedMessage id="CheckoutPage.changeShippingAddress" />
                  </InlineTextButton>
                </div>
                {selectedShippingRate ? (
                  <div className={css.shippingSummaryRow}>
                    <div>
                      <H4 as="h2" className={css.shippingStepHeading}>
                        <FormattedMessage id="CheckoutPage.shippingMethodHeading" />
                      </H4>
                      <p className={css.shippingSummaryText}>
                        {[
                          selectedShippingRate.provider,
                          selectedShippingRate.servicelevelName,
                          formatShippingRatePrice(intl, selectedShippingRate),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <InlineTextButton
                      type="button"
                      className={css.shippingStepChange}
                      onClick={() => setCheckoutStep(STEP_SHIPPING_METHOD)}
                    >
                      <FormattedMessage id="CheckoutPage.changeShippingMethod" />
                    </InlineTextButton>
                  </div>
                ) : null}
              </div>
            ) : null}

            {showPaymentForm && !showShippingSteps ? (
              <StripePaymentForm
                className={css.paymentForm}
                onSubmit={values =>
                  handleSubmit(
                    values,
                    process,
                    props,
                    stripe,
                    submitting,
                    setSubmitting,
                    isShippingCheckout
                      ? {
                          shipToAddress,
                          shippingRateParams: {
                            shippingRateId: selectedShippingRate?.objectId,
                            shipmentId: shipment?.shipmentId,
                          },
                        }
                      : null
                  )
                }
                inProgress={submitting}
                formId="CheckoutPagePaymentForm"
                providerDisplayName={providerDisplayName}
                showInitialMessageInput={showInitialMessageInput}
                initialValues={initialValuesForStripePayment}
                initiateOrderError={initiateOrderError}
                confirmCardPaymentError={confirmCardPaymentError}
                confirmPaymentError={confirmPaymentError}
                hasHandledCardPayment={hasPaymentIntentUserActionsDone}
                loadingData={!stripeCustomerFetched}
                defaultPaymentMethod={
                  hasDefaultPaymentMethod(stripeCustomerFetched, currentUser)
                    ? currentUser.stripeCustomer.defaultPaymentMethod
                    : null
                }
                paymentIntent={paymentIntent}
                onStripeInitialized={stripe => {
                  setStripe(stripe);
                  return onStripeInitialized(stripe, process, props);
                }}
                askShippingDetails={false}
                showPickUpLocation={showPickUpLocation}
                showLocation={showLocation}
                listingLocation={listingLocation}
                totalPrice={totalPrice}
                locale={config.localization.locale}
                stripePublishableKey={config.stripe.publishableKey}
                marketplaceName={config.marketplaceName}
                processName={processName}
                isFuzzyLocation={config.maps.fuzzy.enabled}
                transactionFieldConfigs={transactionFieldConfigs}
                showTransactionFields={showTransactionFields}
              />
            ) : null}
          </section>
        </main>

        <DetailsSideCard
          listing={listing}
          listingTitle={listingTitle}
          priceVariantName={priceVariantName}
          author={listing?.author}
          firstImage={firstImage}
          layoutListingImageConfig={config.layout.listingImage}
          speculateTransactionErrorMessage={errorMessages.speculateTransactionErrorMessage}
          isInquiryProcess={false}
          processName={processName}
          breakdown={breakdown}
          showListingImage={showListingImage}
          intl={intl}
        />
      </div>
    </Page>
  );
};

export default CheckoutPageWithPayment;
