import React, { useState } from 'react';
import classNames from 'classnames';

import getCountryCodes from '../../../translations/countryCodes';
import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import {
  ExternalLink,
  Heading,
  InlineTextButton,
  Modal,
  SecondaryButton,
} from '../../../components';

import AddressLinkMaybe from './AddressLinkMaybe';

import css from './TransactionPanel.module.css';

/**
 * Shippo label details: tracking number and tracking link are shown to both parties.
 * The label is shown only to the provider, who can also retry buying it if it's missing.
 *
 * @component
 * @param {Object} props
 * @param {Object} [props.shippingLabelDetails] - { trackingNumber, trackingUrl, labelUrl, qrCodeUrl }
 * @param {Array<string>} [props.shippingLabelErrors] - Carrier messages from the last failed attempt
 * @param {boolean} props.isProvider - Whether the current user is the provider
 * @param {boolean} props.canBuyShippingLabel - Whether the provider can buy the label
 * @param {Object} props.transactionId - The transaction id
 * @param {Function} [props.onBuyShippingLabel] - The function to buy the label
 * @param {Function} props.onManageDisableScrolling - The function to disable scrolling (QR code modal)
 * @returns {JSX.Element|null}
 */
const ShippingLabelMaybe = props => {
  const intl = useIntl();
  const {
    shippingLabelDetails,
    shippingLabelErrors,
    isProvider,
    canBuyShippingLabel,
    transactionId,
    onBuyShippingLabel,
    onManageDisableScrolling,
  } = props;
  const [buyLabelInProgress, setBuyLabelInProgress] = useState(false);
  const [buyLabelError, setBuyLabelError] = useState(null);
  const [isQrCodeModalOpen, setQrCodeModalOpen] = useState(false);

  const { trackingNumber, trackingUrl, labelUrl, qrCodeUrl } = shippingLabelDetails || {};
  // QR code exists only for carriers that support it (e.g. USPS domestic)
  const showQrCode = isProvider && !!qrCodeUrl && !!onManageDisableScrolling;
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
        {showQrCode ? (
          <p className={css.shippingLabelRow}>
            <InlineTextButton
              rootClassName={css.qrCodeButton}
              type="button"
              onClick={() => setQrCodeModalOpen(true)}
            >
              <FormattedMessage id="TransactionPanel.showQrCode" />
            </InlineTextButton>
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

      {showQrCode ? (
        <Modal
          id={`ShippingLabelQrCode.${transactionId?.uuid || transactionId}`}
          contentClassName={css.qrCodeModalContent}
          isOpen={isQrCodeModalOpen}
          onClose={() => setQrCodeModalOpen(false)}
          onManageDisableScrolling={onManageDisableScrolling}
          usePortal
          closeButtonMessage={intl.formatMessage({ id: 'TransactionPanel.qrCodeModalClose' })}
        >
          <Heading as="h2" rootClassName={css.qrCodeModalTitle}>
            <FormattedMessage id="TransactionPanel.qrCodeModalTitle" />
          </Heading>
          <p className={css.qrCodeModalHelper}>
            <FormattedMessage id="TransactionPanel.qrCodeModalHelper" />
          </p>
          {isQrCodeModalOpen ? (
            <img
              className={css.qrCodeImage}
              src={qrCodeUrl}
              alt={intl.formatMessage({ id: 'TransactionPanel.qrCodeImageAlt' })}
            />
          ) : null}
          <ExternalLink className={css.qrCodeLink} href={qrCodeUrl}>
            <FormattedMessage id="TransactionPanel.qrCodeOpen" />
          </ExternalLink>
        </Modal>
      ) : null}
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
    shippingLabelErrors,
    isProvider,
    canBuyShippingLabel,
    transactionId,
    onBuyShippingLabel,
    onManageDisableScrolling,
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
          shippingLabelErrors={shippingLabelErrors}
          isProvider={isProvider}
          canBuyShippingLabel={canBuyShippingLabel}
          transactionId={transactionId}
          onBuyShippingLabel={onBuyShippingLabel}
          onManageDisableScrolling={onManageDisableScrolling}
        />
      </div>
    );
  }
  return null;
};

export default DeliveryInfoMaybe;
