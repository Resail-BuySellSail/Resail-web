import React from 'react';
import classNames from 'classnames';

// Import configs and util modules
import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { propTypes } from '../../../util/types';
import { formatMoney } from '../../../util/currency';
import { types as sdkTypes } from '../../../util/sdkLoader';

// Import shared components
import { IconSpinner } from '../../../components';

// Import modules from this directory
import css from './ShippingMethodForm.module.css';

const { Money } = sdkTypes;

/**
 * Format Shippo rate amount (e.g. "8.79") to money string.
 *
 * @param {Object} intl
 * @param {Object} rate Shippo rate with amount and currency
 * @returns {string} formatted price
 */
export const formatShippingRatePrice = (intl, rate) =>
  formatMoney(intl, new Money(Math.round(Number(rate.amount) * 100), rate.currency));

/**
 * Shippo rate as a selectable option.
 *
 * @component
 * @param {Object} props
 * @param {Object} props.rate - Shippo rate
 * @param {boolean} props.isSelected - Whether the rate is selected
 * @param {boolean} props.inProgress - Whether the order is updated with this rate
 * @param {boolean} props.disabled - Whether the rate can't be selected
 * @param {Function} props.onSelect - Called with the rate when it's selected
 * @returns {JSX.Element}
 */
const ShippingRate = props => {
  const intl = useIntl();
  const { rate, isSelected, inProgress, disabled, onSelect } = props;
  const { provider, providerImage75, servicelevelName, durationTerms } = rate;

  return (
    <button
      type="button"
      className={classNames(css.rate, { [css.selected]: isSelected })}
      onClick={() => onSelect(rate)}
      aria-pressed={isSelected}
      aria-busy={inProgress}
      disabled={disabled}
    >
      <span className={css.rateHeader}>
        {providerImage75 ? (
          <img src={providerImage75} alt="" className={css.providerImage} />
        ) : null}
        <span className={css.rateDetails}>
          <span className={css.rateName}>
            {provider}{' '}
            {servicelevelName ? (
              <span className={css.rateServiceLevel}>({servicelevelName})</span>
            ) : null}
          </span>
          {durationTerms ? <span className={css.rateDuration}>{durationTerms}</span> : null}
        </span>
      </span>
      {inProgress ? (
        <IconSpinner className={css.rateSpinner} />
      ) : (
        <span className={css.ratePrice}>{formatShippingRatePrice(intl, rate)}</span>
      )}
    </button>
  );
};

/**
 * List of Shippo shipping rates. Selecting a rate calls onSelectShippingRate.
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className] - Custom class that extends the default class for the root element
 * @param {Object} [props.shipment] - Shipment from the server: { shipmentId, rates, messages }
 * @param {boolean} props.fetchShippingRatesInProgress - Whether the rates are being fetched
 * @param {propTypes.error} [props.fetchShippingRatesError] - Error from fetching the rates
 * @param {Object} [props.selectedShippingRate] - Selected Shippo rate
 * @param {string} [props.pendingShippingRateId] - Rate that the order is being updated with
 * @param {Function} props.onSelectShippingRate - Called with the selected rate
 * @returns {JSX.Element}
 */
const ShippingMethodForm = props => {
  const {
    className,
    shipment,
    fetchShippingRatesInProgress,
    fetchShippingRatesError,
    selectedShippingRate,
    pendingShippingRateId,
    onSelectShippingRate,
  } = props;

  if (fetchShippingRatesInProgress) {
    return <IconSpinner />;
  }

  if (fetchShippingRatesError) {
    return (
      <p className={css.error}>
        <FormattedMessage id="ShippingMethodForm.fetchFailed" />
      </p>
    );
  }

  const rates = shipment?.rates || [];
  const messages = shipment?.messages || [];

  if (shipment && rates.length === 0) {
    return (
      <div className={css.root}>
        <p className={css.error}>
          <FormattedMessage id="ShippingMethodForm.noRates" />
        </p>
        {messages.map((message, i) => (
          <p key={i} className={css.message}>
            {message}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className={classNames(css.root, className)}>
      {rates.map(rate => (
        <ShippingRate
          key={rate.objectId}
          rate={rate}
          isSelected={selectedShippingRate?.objectId === rate.objectId}
          inProgress={pendingShippingRateId === rate.objectId}
          disabled={!!pendingShippingRateId}
          onSelect={onSelectShippingRate}
        />
      ))}
    </div>
  );
};

export default ShippingMethodForm;
