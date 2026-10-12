import React, { useState } from 'react';
import classNames from 'classnames';

// Import configs and util modules
import { FormattedMessage } from '../../../../util/reactIntl';
import { LISTING_STATE_DRAFT, propTypes } from '../../../../util/types';
import { displayDeliveryPickup, displayDeliveryShipping } from '../../../../util/configHelpers';
import {
  US_COUNTRY,
  getListingShippingAddress,
  getProfileShippingAddress,
  isCompleteShippingAddress,
} from '../../../../util/shipping';

// Import shared components
import { H3, IconSpinner, ListingLink } from '../../../../components';

// Import modules from this directory
import EditListingDeliveryForm from './EditListingDeliveryForm';
import css from './EditListingDeliveryPanel.module.css';

// Ship-from address fields. The address is saved to listing's privateData.
// The latest saved address is also saved to currentUser's profile (privateData),
// so that it can be used to autofill the form for the next listing.
const getShipFromAddressInitialValues = (listing, currentUser) => {
  const listingShippingAddress = getListingShippingAddress(listing);
  const shippingAddress = isCompleteShippingAddress(listingShippingAddress)
    ? listingShippingAddress
    : getProfileShippingAddress(currentUser);
  const { name, phone, street1, streetNo, city, state, zip, country } = shippingAddress;
  return {
    name: name || '',
    phone: phone || '',
    street1: street1 || '',
    streetNo: streetNo || '',
    city: city || '',
    state: state || '',
    zip: zip || '',
    country: country || US_COUNTRY,
  };
};

const getInitialValues = props => {
  const { listing, listingTypes, currentUser } = props;
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
    ...getShipFromAddressInitialValues(listing, currentUser),
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
 * @param {propTypes.currentUser} props.currentUser - The current user
 * @param {Function} props.onUpdateProfile - The function to save ship-from address to user's profile
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
  const [state, setState] = useState({
    initialValues: getInitialValues(props),
    hasCurrentUser: !!props.currentUser?.id,
  });
  const [updateProfileError, setUpdateProfileError] = useState(null);

  const {
    className,
    rootClassName,
    listing,
    listingTypes,
    marketplaceCurrency,
    currentUser,
    onUpdateProfile,
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
  // Ship-from address is autofilled from currentUser's profile.
  // If currentUser was not loaded on the first render, the initial values are created again.
  const currentUserLoaded = !!currentUser?.id;
  if (currentUserLoaded && !state.hasCurrentUser) {
    setState({ initialValues: getInitialValues(props), hasCurrentUser: true });
  }

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
          onSubmit={values => {
            const {
              building = '',
              location,
              deliveryOptions,
              name,
              phone,
              street1,
              streetNo = '',
              city,
              state: addressState,
              zip,
              country,
              packageLength,
              packageWidth,
              packageHeight,
              packageWeight,
            } = values;

            const shippingEnabled = deliveryOptions.includes('shipping');
            const pickupEnabled = deliveryOptions.includes('pickup');
            const address = location?.selectedPlace?.address || null;
            const origin = location?.selectedPlace?.origin || null;

            const pickupDataMaybe =
              pickupEnabled && address ? { location: { address, building } } : {};

            // Parcel dimensions (in) and weight (lb) are used to fetch Shippo rates
            const packageData = { packageLength, packageWidth, packageHeight, packageWeight };
            const shippingDataMaybe = shippingEnabled ? packageData : {};

            const shippingAddress = {
              name,
              phone,
              street1,
              streetNo,
              city,
              state: addressState,
              zip,
              country: country || US_COUNTRY,
            };

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
              ...(shippingEnabled ? { privateData: { shippingAddress } } : {}),
            };

            // Save the initialValues to state
            // LocationAutocompleteInput doesn't have internal state
            // and therefore re-rendering would overwrite the values during XHR call.
            setState({
              initialValues: {
                building,
                location: { search: address, selectedPlace: { address, origin } },
                deliveryOptions,
                ...shippingAddress,
                ...packageData,
              },
              hasCurrentUser: true,
            });
            setUpdateProfileError(null);

            // The latest ship-from address is saved to the profile too,
            // so that it can autofill the form for the next listing.
            const saveShippingAddressMaybe = shippingEnabled
              ? onUpdateProfile({ privateData: { shippingAddress } })
              : Promise.resolve();

            // Note: listing update errors are handled by onSubmit (shown as updateListingError).
            return saveShippingAddressMaybe.then(
              () => onSubmit(updateValues),
              e => setUpdateProfileError(e)
            );
          }}
          listingTypeConfig={listingTypeConfig}
          saveActionMsg={submitButtonText}
          disabled={disabled}
          ready={ready}
          updated={panelUpdated}
          updateInProgress={updateInProgress}
          fetchErrors={{ ...errors, updateProfileError }}
          autoFocus
        />
      )}
    </main>
  );
};

export default EditListingDeliveryPanel;
