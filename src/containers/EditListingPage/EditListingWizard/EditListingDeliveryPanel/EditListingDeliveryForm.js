import React, { useEffect } from 'react';
import { Form as FinalForm } from 'react-final-form';
import classNames from 'classnames';

// Import configs and util modules
import { FormattedMessage, useIntl } from '../../../../util/reactIntl';
import { propTypes } from '../../../../util/types';
import { displayDeliveryPickup, displayDeliveryShipping } from '../../../../util/configHelpers';
import { PACKAGE_DIMENSION_FIELDS, isPositiveNumber } from '../../../../util/shipping';
import getUsaStates from '../../../../translations/usaStates';
import {
  autocompleteSearchRequired,
  autocompletePlaceSelected,
  composeValidators,
  required,
} from '../../../../util/validators';

// Import shared components
import {
  Form,
  FieldLocationAutocompleteInput,
  Button,
  FieldTextInput,
  FieldCheckbox,
  FieldPhoneNumberInput,
  FieldSelect,
} from '../../../../components';

// Import modules from this directory
import css from './EditListingDeliveryForm.module.css';

const identity = v => v;

// Parcel dimensions and weight are saved as numbers
const parseNumber = value => (value === '' || value == null ? value : Number(value));
const positiveNumber = message => value => (isPositiveNumber(value) ? undefined : message);

/**
 * The EditListingDeliveryForm component.
 *
 * @component
 * @param {Object} props - The component props
 * @param {string} props.formId - The form ID
 * @param {string} [props.className] - Custom class that extends the default class for the root element
 * @param {Function} props.onSubmit - The submit function
 * @param {string} props.saveActionMsg - The save action message
 * @param {Object} props.listingTypeConfig - The listing type config
 * @param {boolean} props.disabled - Whether the form is disabled
 * @param {boolean} props.ready - Whether the form is ready
 * @param {boolean} props.updated - Whether the form is updated
 * @param {boolean} props.updateInProgress - Whether the form is in progress
 * @param {Object} props.fetchErrors - The fetch errors
 * @param {propTypes.error} [props.fetchErrors.showListingsError] - The show listings error
 * @param {propTypes.error} [props.fetchErrors.updateListingError] - The update listing error
 * @param {propTypes.error} [props.fetchErrors.updateProfileError] - The ship-from address saving error
 * @param {boolean} props.autoFocus - Whether the form is auto focused
 * @returns {JSX.Element} The EditListingDeliveryForm component
 */
export const EditListingDeliveryForm = props => (
  <FinalForm
    {...props}
    render={formRenderProps => {
      const {
        formId = 'EditListingDeliveryForm',
        form,
        autoFocus,
        className,
        disabled,
        ready,
        handleSubmit,
        pristine,
        invalid,
        listingTypeConfig,
        saveActionMsg,
        updated,
        updateInProgress,
        fetchErrors,
        values,
      } = formRenderProps;
      const intl = useIntl();

      // This is a bug fix for Final Form.
      // Without this, React will return a warning:
      //   "Cannot update a component (`ForwardRef(Field)`)
      //   while rendering a different component (`ForwardRef(Field)`)"
      // This seems to happen because validation calls listeneres and
      // that causes state to change inside final-form.
      // https://github.com/final-form/react-final-form/issues/751
      //
      // TODO: it might not be worth the trouble to show these fields as disabled,
      // if this fix causes trouble in future dependency updates.
      const { pauseValidation, resumeValidation } = form;
      pauseValidation(false);
      useEffect(() => resumeValidation(), [values]);

      const displayShipping = displayDeliveryShipping(listingTypeConfig);
      const displayPickup = displayDeliveryPickup(listingTypeConfig);
      const displayMultipleDelivery = displayShipping && displayPickup;
      const shippingEnabled = displayShipping && values.deliveryOptions?.includes('shipping');
      const pickupEnabled = displayPickup && values.deliveryOptions?.includes('pickup');

      const addressRequiredMessage = intl.formatMessage({
        id: 'EditListingDeliveryForm.addressRequired',
      });
      const addressNotRecognizedMessage = intl.formatMessage({
        id: 'EditListingDeliveryForm.addressNotRecognized',
      });

      const optionalText = intl.formatMessage({
        id: 'EditListingDeliveryForm.optionalText',
      });

      const { updateListingError, showListingsError, updateProfileError } = fetchErrors || {};

      const classes = classNames(css.root, className);
      const submitReady = (updated && pristine) || ready;
      const submitInProgress = updateInProgress;
      const submitDisabled =
        invalid || disabled || submitInProgress || (!shippingEnabled && !pickupEnabled);

      const shippingLabel = intl.formatMessage({ id: 'EditListingDeliveryForm.shippingLabel' });
      const pickupLabel = intl.formatMessage({ id: 'EditListingDeliveryForm.pickupLabel' });

      const pickupClasses = classNames({
        [css.deliveryOption]: displayMultipleDelivery,
        [css.disabled]: !pickupEnabled,
        [css.hidden]: !displayPickup,
      });
      const shippingClasses = classNames({
        [css.deliveryOption]: displayMultipleDelivery,
        [css.disabled]: !shippingEnabled,
        [css.hidden]: !displayShipping,
      });

      // Shipping fields are validated only when shipping is enabled.
      // When the validation changes, the key prop of the field needs to change too,
      // so that the field (and its validation function) is reregistered with Final Form.
      // See example: https://codesandbox.io/s/changing-field-level-validators-zc8ei
      const shippingValidationKey = shippingEnabled ? 'shippingValidation' : 'noShippingValidation';
      const requiredForShipping = messageId =>
        shippingEnabled ? required(intl.formatMessage({ id: messageId })) : null;
      const usaStates = getUsaStates();
      const packageNumberValidators = (requiredMessageId, invalidMessageId) =>
        shippingEnabled
          ? composeValidators(
              required(intl.formatMessage({ id: requiredMessageId })),
              positiveNumber(intl.formatMessage({ id: invalidMessageId }))
            )
          : null;

      return (
        <Form className={classes} onSubmit={handleSubmit}>
          <FieldCheckbox
            id={formId ? `${formId}.pickup` : 'pickup'}
            className={classNames(css.deliveryCheckbox, { [css.hidden]: !displayMultipleDelivery })}
            name="deliveryOptions"
            label={pickupLabel}
            value="pickup"
          />
          <div className={pickupClasses}>
            {updateListingError ? (
              <p className={css.error}>
                <FormattedMessage id="EditListingDeliveryForm.updateFailed" />
              </p>
            ) : null}

            {showListingsError ? (
              <p className={css.error}>
                <FormattedMessage id="EditListingDeliveryForm.showListingFailed" />
              </p>
            ) : null}

            <FieldLocationAutocompleteInput
              disabled={!pickupEnabled}
              rootClassName={css.input}
              inputClassName={css.locationAutocompleteInput}
              iconClassName={css.locationAutocompleteInputIcon}
              predictionsClassName={css.predictionsRoot}
              validClassName={css.validLocation}
              autoFocus={autoFocus}
              name="location"
              id={`${formId}.location`}
              label={intl.formatMessage({ id: 'EditListingDeliveryForm.address' })}
              placeholder={intl.formatMessage({
                id: 'EditListingDeliveryForm.addressPlaceholder',
              })}
              useDefaultPredictions={false}
              format={identity}
              valueFromForm={values.location}
              validate={
                pickupEnabled
                  ? composeValidators(
                      autocompleteSearchRequired(addressRequiredMessage),
                      autocompletePlaceSelected(addressNotRecognizedMessage)
                    )
                  : () => {}
              }
              hideErrorMessage={!pickupEnabled}
              // Whatever parameters are being used to calculate
              // the validation function need to be combined in such
              // a way that, when they change, this key prop
              // changes, thus reregistering this field (and its
              // validation function) with Final Form.
              // See example: https://codesandbox.io/s/changing-field-level-validators-zc8ei
              key={pickupEnabled ? 'locationValidation' : 'noLocationValidation'}
            />

            <FieldTextInput
              className={css.input}
              type="text"
              name="building"
              id={formId ? `${formId}.building` : 'building'}
              label={intl.formatMessage(
                { id: 'EditListingDeliveryForm.building' },
                { optionalText }
              )}
              placeholder={intl.formatMessage({
                id: 'EditListingDeliveryForm.buildingPlaceholder',
              })}
              disabled={!pickupEnabled}
            />
          </div>

          <FieldCheckbox
            id={formId ? `${formId}.shipping` : 'shipping'}
            className={classNames(css.deliveryCheckbox, { [css.hidden]: !displayMultipleDelivery })}
            name="deliveryOptions"
            label={shippingLabel}
            value="shipping"
          />

          <div className={shippingClasses}>
            {updateProfileError ? (
              <p className={css.error}>
                <FormattedMessage id="EditListingDeliveryForm.updateProfileFailed" />
              </p>
            ) : null}

            <fieldset className={css.fieldset}>
              <legend className={css.legend}>
                <FormattedMessage id="EditListingDeliveryForm.shipFromHeading" />
              </legend>
              <p className={css.helper}>
                <FormattedMessage id="EditListingDeliveryForm.shipFromHelper" />
              </p>

              <div className={css.formRow}>
                <FieldTextInput
                  id={`${formId}.name`}
                  className={css.field}
                  type="text"
                  name="name"
                  autoComplete="name"
                  label={intl.formatMessage({ id: 'EditListingDeliveryForm.nameLabel' })}
                  placeholder={intl.formatMessage({
                    id: 'EditListingDeliveryForm.namePlaceholder',
                  })}
                  disabled={!shippingEnabled}
                  validate={requiredForShipping('EditListingDeliveryForm.nameRequired')}
                  hideErrorMessage={!shippingEnabled}
                  key={`name.${shippingValidationKey}`}
                />
                <FieldPhoneNumberInput
                  id={`${formId}.phone`}
                  className={css.field}
                  name="phone"
                  autoComplete="tel"
                  label={intl.formatMessage({ id: 'EditListingDeliveryForm.phoneLabel' })}
                  placeholder={intl.formatMessage({
                    id: 'EditListingDeliveryForm.phonePlaceholder',
                  })}
                  disabled={!shippingEnabled}
                  validate={requiredForShipping('EditListingDeliveryForm.phoneRequired')}
                  hideErrorMessage={!shippingEnabled}
                  key={`phone.${shippingValidationKey}`}
                />
              </div>

              <FieldTextInput
                id={`${formId}.street1`}
                className={css.input}
                type="text"
                name="street1"
                autoComplete="address-line1"
                label={intl.formatMessage({ id: 'EditListingDeliveryForm.streetLabel' })}
                placeholder={intl.formatMessage({
                  id: 'EditListingDeliveryForm.streetPlaceholder',
                })}
                disabled={!shippingEnabled}
                validate={requiredForShipping('EditListingDeliveryForm.streetRequired')}
                hideErrorMessage={!shippingEnabled}
                key={`street1.${shippingValidationKey}`}
              />

              <FieldTextInput
                id={`${formId}.streetNo`}
                className={css.input}
                type="text"
                name="streetNo"
                autoComplete="address-line2"
                label={intl.formatMessage(
                  { id: 'EditListingDeliveryForm.aptLabel' },
                  { optionalText }
                )}
                placeholder={intl.formatMessage({ id: 'EditListingDeliveryForm.aptPlaceholder' })}
                disabled={!shippingEnabled}
              />

              <div className={css.formRow}>
                <FieldTextInput
                  id={`${formId}.city`}
                  className={css.field}
                  type="text"
                  name="city"
                  autoComplete="address-level2"
                  label={intl.formatMessage({ id: 'EditListingDeliveryForm.cityLabel' })}
                  placeholder={intl.formatMessage({
                    id: 'EditListingDeliveryForm.cityPlaceholder',
                  })}
                  disabled={!shippingEnabled}
                  validate={requiredForShipping('EditListingDeliveryForm.cityRequired')}
                  hideErrorMessage={!shippingEnabled}
                  key={`city.${shippingValidationKey}`}
                />
                <FieldSelect
                  id={`${formId}.state`}
                  className={css.field}
                  name="state"
                  autoComplete="address-level1"
                  label={intl.formatMessage({ id: 'EditListingDeliveryForm.stateLabel' })}
                  disabled={!shippingEnabled}
                  validate={requiredForShipping('EditListingDeliveryForm.stateRequired')}
                  key={`state.${shippingValidationKey}`}
                >
                  <option disabled value="">
                    {intl.formatMessage({ id: 'EditListingDeliveryForm.statePlaceholder' })}
                  </option>
                  {usaStates.map(state => (
                    <option key={state.code} value={state.code}>
                      {state.name}
                    </option>
                  ))}
                </FieldSelect>
              </div>

              <div className={css.formRow}>
                <FieldTextInput
                  id={`${formId}.zip`}
                  className={css.field}
                  type="text"
                  name="zip"
                  autoComplete="postal-code"
                  label={intl.formatMessage({ id: 'EditListingDeliveryForm.zipLabel' })}
                  placeholder={intl.formatMessage({ id: 'EditListingDeliveryForm.zipPlaceholder' })}
                  disabled={!shippingEnabled}
                  validate={requiredForShipping('EditListingDeliveryForm.zipRequired')}
                  hideErrorMessage={!shippingEnabled}
                  key={`zip.${shippingValidationKey}`}
                />
                <FieldTextInput
                  id={`${formId}.country`}
                  className={css.field}
                  type="text"
                  name="country"
                  label={intl.formatMessage({ id: 'EditListingDeliveryForm.countryLabel' })}
                  disabled={!shippingEnabled}
                  readOnly
                />
              </div>
            </fieldset>

            <fieldset className={css.fieldset}>
              <legend className={css.legend}>
                <FormattedMessage id="EditListingDeliveryForm.packageHeading" />
              </legend>
              <p className={css.helper}>
                <FormattedMessage id="EditListingDeliveryForm.packageHelper" />
              </p>
              <div className={css.packageDimensions}>
                {PACKAGE_DIMENSION_FIELDS.map(name => (
                  <FieldTextInput
                    key={`${name}.${shippingValidationKey}`}
                    id={`${formId}.${name}`}
                    className={css.packageDimension}
                    type="number"
                    name={name}
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    parse={parseNumber}
                    label={intl.formatMessage({ id: `EditListingDeliveryForm.${name}Label` })}
                    placeholder={intl.formatMessage({
                      id: 'EditListingDeliveryForm.packageDimensionPlaceholder',
                    })}
                    disabled={!shippingEnabled}
                    validate={packageNumberValidators(
                      'EditListingDeliveryForm.packageDimensionRequired',
                      'EditListingDeliveryForm.packageDimensionInvalid'
                    )}
                    hideErrorMessage={!shippingEnabled}
                  />
                ))}
              </div>

              <FieldTextInput
                key={`packageWeight.${shippingValidationKey}`}
                id={`${formId}.packageWeight`}
                className={css.field}
                type="number"
                name="packageWeight"
                min="0"
                step="0.1"
                inputMode="decimal"
                parse={parseNumber}
                label={intl.formatMessage({ id: 'EditListingDeliveryForm.packageWeightLabel' })}
                placeholder={intl.formatMessage({
                  id: 'EditListingDeliveryForm.packageWeightPlaceholder',
                })}
                disabled={!shippingEnabled}
                validate={packageNumberValidators(
                  'EditListingDeliveryForm.packageWeightRequired',
                  'EditListingDeliveryForm.packageWeightInvalid'
                )}
                hideErrorMessage={!shippingEnabled}
              />
            </fieldset>
          </div>

          <Button
            className={css.submitButton}
            type="submit"
            inProgress={submitInProgress}
            disabled={submitDisabled}
            ready={submitReady}
          >
            {saveActionMsg}
          </Button>
        </Form>
      );
    }}
  />
);

export default EditListingDeliveryForm;
