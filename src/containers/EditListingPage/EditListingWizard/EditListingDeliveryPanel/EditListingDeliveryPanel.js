import React, { useMemo, useState } from 'react';
import classNames from 'classnames';

// Import configs and util modules
import { FormattedMessage } from '../../../../util/reactIntl';
import { LISTING_STATE_DRAFT, propTypes } from '../../../../util/types';
import { displayDeliveryPickup, displayDeliveryShipping } from '../../../../util/configHelpers';
import {
  SHIP_FROM_ADDRESS,
  getProfileShippingAddress,
  isCompleteShippingAddress,
} from '../../../../util/shipping';

// Import shared components
import { H3, IconSpinner, ListingLink, Modal, ShippingAddressForm } from '../../../../components';

// Import modules from this directory
import EditListingDeliveryForm from './EditListingDeliveryForm';
import css from './EditListingDeliveryPanel.module.css';

const getInitialValues = props => {
  const { listing, listingTypes } = props;
  const { geolocation, publicData } = listing?.attributes || {};

  const listingType = listing?.attributes?.publicData?.listingType;
  const listingTypeConfig = listingTypes.find(conf => conf.listingType === listingType);
  const displayShipping = displayDeliveryShipping(listingTypeConfig);
  const displayPickup = displayDeliveryPickup(listingTypeConfig);
  const displayMultipleDelivery = displayShipping && displayPickup;

  // Only render current search if full place object is available in the URL params
  // TODO bounds are missing - those need to be queried directly from Google Places
  const locationFieldsPresent = publicData?.location?.address && geolocation;
  const location = publicData?.location || {};
  const { address, building } = location;
  const {
    shippingEnabled,
    pickupEnabled,
    packageLength,
    packageWidth,
    packageHeight,
    packageWeight,
  } = publicData;
  const deliveryOptions = [];

  if (shippingEnabled || (!displayMultipleDelivery && displayShipping)) {
    deliveryOptions.push('shipping');
  }
  if (pickupEnabled || (!displayMultipleDelivery && displayPickup)) {
    deliveryOptions.push('pickup');
  }

  // Initial values for the form
  return {
    building,
    location: locationFieldsPresent
      ? {
          search: address,
          selectedPlace: { address, origin: geolocation },
        }
      : { search: undefined, selectedPlace: undefined },
    deliveryOptions,
    packageLength,
    packageWidth,
    packageHeight,
    packageWeight,
  };
};

/**
 * The EditListingDeliveryPanel component.
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className] - Custom class that extends the default class for the root element
 * @param {string} [props.rootClassName] - Custom class that overrides the default class for the root element
 * @param {propTypes.ownListing} props.listing - The listing object
 * @param {Array<Object>} props.listingTypes - The active listing types configs
 * @param {string} props.marketplaceCurrency - The marketplace currency (e.g. 'USD')
 * @param {propTypes.currentUser} props.currentUser - The current user. Seller address is read from
 * the profile (privateData.shippingAddress).
 * @param {Function} props.onSaveShippingAddress - Validate (Shippo) and save the seller address to
 * the profile. If the seller address is missing, it's asked in a modal when the form is submitted.
 * @param {Function} props.onManageDisableScrolling - The function to disable scrolling (modal)
 * @param {boolean} props.disabled - Whether the form is disabled
 * @param {boolean} props.ready - Whether the form is ready
 * @param {Function} props.onSubmit - The submit function
 * @param {string} props.submitButtonText - The submit button text
 * @param {boolean} props.panelUpdated - Whether the panel is updated
 * @param {boolean} props.updateInProgress - Whether the update is in progress
 * @param {Object} props.errors - The errors object
 * @returns {JSX.Element}
 */
const EditListingDeliveryPanel = props => {
  // State is needed since LocationAutocompleteInput doesn't have internal state
  // and therefore re-rendering would overwrite the values during XHR call.
  const [state, setState] = useState({ initialValues: getInitialValues(props) });
  // Seller address modal. If it's opened on submit, the form values wait in pendingValues
  // and the listing is saved after the address has been saved.
  const [addressModal, setAddressModal] = useState({ isOpen: false, pendingValues: null });
  const [saveAddressInProgress, setSaveAddressInProgress] = useState(false);
  const [saveAddressError, setSaveAddressError] = useState(null);

  const {
    className,
    rootClassName,
    listing,
    listingTypes,
    marketplaceCurrency,
    currentUser,
    onSaveShippingAddress,
    onManageDisableScrolling,
    disabled,
    ready,
    onSubmit,
    submitButtonText,
    panelUpdated,
    updateInProgress,
    errors,
    updatePageTitle: UpdatePageTitle,
    intl,
  } = props;

  const classes = classNames(rootClassName || css.root, className);
  const isPublished = listing?.id && listing?.attributes.state !== LISTING_STATE_DRAFT;
  const priceCurrencyValid = listing?.attributes?.price?.currency === marketplaceCurrency;
  const listingType = listing?.attributes?.publicData?.listingType;
  const listingTypeConfig = listingTypes.find(conf => conf.listingType === listingType);
  // Seller address is always read from currentUser's profile. It's edited in a modal, so that
  // the user doesn't need to leave the listing wizard.
  const currentUserLoaded = !!currentUser?.id;
  const shipFromAddress = getProfileShippingAddress(currentUser);
  const addressInitialValues = useMemo(() => {
    const { name, phone, street1, streetNo, city, state: addressState, zip } = shipFromAddress;
    return { name, phone, street1, streetNo, city, state: addressState, zip };
  }, [shipFromAddress]);

  const openAddressModal = (pendingValues = null) => {
    setSaveAddressError(null);
    setAddressModal({ isOpen: true, pendingValues });
  };
  const closeAddressModal = () => setAddressModal({ isOpen: false, pendingValues: null });

  const saveListing = values => {
    const {
      building = '',
      location,
      deliveryOptions,
      packageLength,
      packageWidth,
      packageHeight,
      packageWeight,
    } = values;

    const shippingEnabled = deliveryOptions.includes('shipping');
    const pickupEnabled = deliveryOptions.includes('pickup');
    const address = location?.selectedPlace?.address || null;
    const origin = location?.selectedPlace?.origin || null;

    const pickupDataMaybe = pickupEnabled && address ? { location: { address, building } } : {};

    // Parcel dimensions (in) and weight (lb) are used to fetch Shippo rates
    const packageData = { packageLength, packageWidth, packageHeight, packageWeight };
    const shippingDataMaybe = shippingEnabled ? packageData : {};

    // New values for listing attributes
    const updateValues = {
      geolocation: origin,
      publicData: {
        pickupEnabled,
        ...pickupDataMaybe,
        shippingEnabled,
        ...shippingDataMaybe,
        // Shipping fees are not set per listing anymore
        shippingPriceInSubunitsOneItem: null,
        shippingPriceInSubunitsAdditionalItems: null,
      },
      // Ship-from address is read from the provider's profile when rates are fetched.
      // Clear the address copy that was saved to listings earlier.
      privateData: { shippingAddress: null },
    };

    // Save the initialValues to state
    // LocationAutocompleteInput doesn't have internal state
    // and therefore re-rendering would overwrite the values during XHR call.
    setState({
      initialValues: {
        building,
        location: { search: address, selectedPlace: { address, origin } },
        deliveryOptions,
        ...packageData,
      },
    });
    onSubmit(updateValues);
  };

  // Shippo needs the seller address: ask it before the listing is saved
  const handleSubmit = values => {
    const shippingEnabled = values.deliveryOptions?.includes('shipping');
    if (shippingEnabled && !isCompleteShippingAddress(shipFromAddress)) {
      openAddressModal(values);
      return;
    }
    saveListing(values);
  };

  const handleSaveAddress = values => {
    const { name, phone, street1, streetNo = '', city, state: addressState, zip, country } = values;
    const address = { name, phone, street1, streetNo, city, state: addressState, zip, country };
    const { pendingValues } = addressModal;

    setSaveAddressInProgress(true);
    setSaveAddressError(null);
    return onSaveShippingAddress({ addressType: SHIP_FROM_ADDRESS, address })
      .then(() => {
        setSaveAddressInProgress(false);
        closeAddressModal();
        if (pendingValues) {
          saveListing(pendingValues);
        }
      })
      .catch(e => {
        setSaveAddressInProgress(false);
        // Shippo's validation messages are shown in the form
        setSaveAddressError(e);
      });
  };

  const panelHeadingProps = isPublished
    ? {
        id: 'EditListingDeliveryPanel.title',
        values: { listingTitle: <ListingLink listing={listing} />, lineBreak: <br /> },
        messageProps: { listingTitle: listing.attributes.title },
      }
    : {
        id: 'EditListingDeliveryPanel.createListingTitle',
        values: { lineBreak: <br /> },
        messageProps: {},
      };

  return (
    <main className={classes}>
      <UpdatePageTitle
        panelHeading={intl.formatMessage(
          { id: panelHeadingProps.id },
          { ...panelHeadingProps.messageProps }
        )}
      />
      <H3 as="h1">
        <FormattedMessage id={panelHeadingProps.id} values={{ ...panelHeadingProps.values }} />
      </H3>
      {!priceCurrencyValid ? (
        <div className={css.priceCurrencyInvalid}>
          <FormattedMessage
            id="EditListingPricingPanel.listingPriceCurrencyInvalid"
            values={{ marketplaceCurrency }}
          />
        </div>
      ) : !currentUserLoaded ? (
        <IconSpinner />
      ) : (
        <EditListingDeliveryForm
          className={css.form}
          initialValues={state.initialValues}
          onSubmit={handleSubmit}
          listingTypeConfig={listingTypeConfig}
          shipFromAddress={shipFromAddress}
          onEditShipFromAddress={() => openAddressModal()}
          saveActionMsg={submitButtonText}
          disabled={disabled}
          ready={ready}
          updated={panelUpdated}
          updateInProgress={updateInProgress}
          fetchErrors={errors}
          autoFocus
        />
      )}

      <Modal
        id="EditListingDeliveryPanel.sellerAddressModal"
        contentClassName={css.addressModalContent}
        isOpen={addressModal.isOpen}
        onClose={closeAddressModal}
        onManageDisableScrolling={onManageDisableScrolling}
        usePortal
        closeButtonMessage={intl.formatMessage({
          id: 'EditListingDeliveryPanel.sellerAddressModalClose',
        })}
      >
        <H3 as="h2" className={css.addressModalTitle}>
          <FormattedMessage id="EditListingDeliveryPanel.sellerAddressModalTitle" />
        </H3>
        <p className={css.addressModalHelper}>
          <FormattedMessage id="EditListingDeliveryPanel.sellerAddressModalHelper" />
        </p>
        {addressModal.isOpen ? (
          <ShippingAddressForm
            formId="EditListingDeliveryPanel.sellerAddress"
            initialValues={addressInitialValues}
            onSubmit={handleSaveAddress}
            inProgress={saveAddressInProgress}
            saveAddressError={saveAddressError}
            submitButtonText={intl.formatMessage({
              id: addressModal.pendingValues
                ? 'EditListingDeliveryPanel.sellerAddressSaveAndContinue'
                : 'EditListingDeliveryPanel.sellerAddressSave',
            })}
          />
        ) : null}
      </Modal>
    </main>
  );
};

export default EditListingDeliveryPanel;
