import React, { useState } from 'react';
import classNames from 'classnames';

import getCountryCodes from '../../../translations/countryCodes';
import { FormattedMessage } from '../../../util/reactIntl';
import { ExternalLink, Heading, SecondaryButton } from '../../../components';

import AddressLinkMaybe from './AddressLinkMaybe';

import css from './TransactionPanel.module.css';

/**
 * Shippo label details: tracking number and tracking link are shown to both parties.
 * The label is shown only to the provider, who can also retry buying it if it's missing.
 *
 * @component
 * @param {Object} props
 * @param {Object} [props.shippingLabelDetails] - { trackingNumber, trackingUrl, labelUrl }
 * @param {Array<string>} [props.shippingLabelErrors] - Carrier messages from the last failed attempt
 * @param {boolean} props.isProvider - Whether the current user is the provider
 * @param {boolean} props.canBuyShippingLabel - Whether the provider can buy the label
 * @param {Object} props.transactionId - The transaction id
 * @param {Function} [props.onBuyShippingLabel] - The function to buy the label
 * @returns {JSX.Element|null}
 */
const ShippingLabelMaybe = props => {
  const {
    shippingLabelDetails,
    shippingLabelErrors,
    isProvider,
    canBuyShippingLabel,
    transactionId,
    onBuyShippingLabel,
  } = props;
  const [buyLabelInProgress, setBuyLabelInProgress] = useState(false);
  const [buyLabelError, setBuyLabelError] = useState(null);

  const { trackingNumber, trackingUrl, labelUrl } = shippingLabelDetails || {};
  const hasLabel = !!labelUrl;
  const showBuyLabelButton = isProvider && !hasLabel && canBuyShippingLabel && onBuyShippingLabel;

  if (!hasLabel && !showBuyLabelButton) {
    return null;
  }

  const handleBuyLabel = () => {
    setBuyLabelInProgress(true);
    setBuyLabelError(null);
    onBuyShippingLabel(transactionId)
      .then(() => setBuyLabelInProgress(false))
      .catch(e => {
        setBuyLabelInProgress(false);
        // Carrier messages returned by the server (e.g. invalid recipient address)
        setBuyLabelError({ messages: Array.isArray(e?.messages) ? e.messages : [] });
      });
  };

  // Show the messages of the latest attempt: this session's retry or the stored failure
  const labelErrorMessages = buyLabelError
    ? buyLabelError.messages
    : Array.isArray(shippingLabelErrors)
    ? shippingLabelErrors
    : [];
  const showLabelError = !!buyLabelError || labelErrorMessages.length > 0;

  return (
    <div className={css.shippingLabelContainer}>
      <Heading as="h3" rootClassName={css.sectionHeading}>
        <FormattedMessage id="TransactionPanel.shippingDetailsHeading" />
      </Heading>
      <div className={css.shippingLabelContent}>
        {trackingNumber ? (
          <p className={css.shippingLabelRow}>
            <FormattedMessage id="TransactionPanel.trackingNumber" values={{ trackingNumber }} />
          </p>
        ) : null}
        {trackingUrl ? (
          <p className={css.shippingLabelRow}>
            <ExternalLink href={trackingUrl}>
              <FormattedMessage id="TransactionPanel.trackingUrl" />
            </ExternalLink>
          </p>
        ) : null}
        {hasLabel && isProvider ? (
          <p className={css.shippingLabelRow}>
            <ExternalLink href={labelUrl}>
              <FormattedMessage id="TransactionPanel.labelUrl" />
            </ExternalLink>
          </p>
        ) : null}
        {showBuyLabelButton ? (
          <>
            <p className={css.shippingLabelRow}>
              <FormattedMessage id="TransactionPanel.labelMissing" />
            </p>
            <SecondaryButton
              className={css.getLabelButton}
              type="button"
              inProgress={buyLabelInProgress}
              disabled={buyLabelInProgress}
              onClick={handleBuyLabel}
            >
              <FormattedMessage id="TransactionPanel.getLabel" />
            </SecondaryButton>
            {showLabelError ? (
              <div className={css.getLabelError}>
                <p className={css.getLabelErrorTitle}>
                  <FormattedMessage id="TransactionPanel.getLabelFailed" />
                </p>
                {labelErrorMessages.map((message, i) => (
                  <p key={i} className={css.getLabelErrorMessage}>
                    {message}
                  </p>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
};

// Functional component as a helper to build ActivityFeed section
const DeliveryInfoMaybe = props => {
  const {
    className,
    rootClassName,
    protectedData,
    listing,
    locale,
    shippingLabelDetails,
    isProvider,
    canBuyShippingLabel,
    transactionId,
    onBuyShippingLabel,
  } = props;
  const classes = classNames(rootClassName || css.deliveryInfoContainer, className);
  const deliveryMethod = protectedData?.deliveryMethod;
  const isShipping = deliveryMethod === 'shipping';
  const isPickup = deliveryMethod === 'pickup';

  if (isPickup) {
    const pickupLocation = listing?.attributes?.publicData?.location || {};
    return (
      <div className={classes}>
        <Heading as="h3" rootClassName={css.sectionHeading}>
          <FormattedMessage id="TransactionPanel.pickupInfoHeading" />
        </Heading>
        <div className={css.pickupInfoContent}>
          <AddressLinkMaybe
            linkRootClassName={css.pickupAddress}
            location={pickupLocation}
            geolocation={listing?.attributes?.geolocation}
            showAddress={true}
          />
        </div>
      </div>
    );
  } else if (isShipping) {
    const { name, phoneNumber, address } = protectedData?.shippingDetails || {};
    const { line1, line2, city, postalCode, state, country: countryCode } = address || {};
    const phoneMaybe = !!phoneNumber ? (
      <>
        {phoneNumber}
        <br />
      </>
    ) : null;

    const countryCodes = getCountryCodes(locale);
    const countryInfo = countryCodes.find(c => c.code === countryCode);
    const country = countryInfo?.name;

    return (
      <div className={classes}>
        <Heading as="h3" rootClassName={css.sectionHeading}>
          <FormattedMessage id="TransactionPanel.shippingInfoHeading" />
        </Heading>
        <div className={css.shippingInfoContent}>
          {name}
          <br />
          {phoneMaybe}
          {line1}
          {line2 ? `, ${line2}` : ''}
          <br />
          {postalCode}, {city}
          <br />
          {state ? `${state}, ` : ''}
          {country}
          <br />
        </div>
        <ShippingLabelMaybe
          shippingLabelDetails={shippingLabelDetails}
          isProvider={isProvider}
          canBuyShippingLabel={canBuyShippingLabel}
          transactionId={transactionId}
          onBuyShippingLabel={onBuyShippingLabel}
        />
      </div>
    );
  }
  return null;
};

export default DeliveryInfoMaybe;
